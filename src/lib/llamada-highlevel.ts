import { z } from "zod";
import { colaDeTelefono } from "@/lib/dominio";

/// Normaliza el evento de llamada que HighLevel manda por webhook.
///
/// HighLevel dispara este webhook desde un workflow con el trigger de estado de
/// llamada. Según cómo se arme el paso, los campos llegan planos, dentro de
/// `message`, o dentro de `customData`. Igual que el registro de personas, se
/// aplana todo a un índice y se busca cada dato por varios nombres posibles,
/// para no depender de una sola forma del payload.

type Objeto = Record<string, unknown>;

function objeto(valor: unknown): Objeto | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Objeto)
    : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string") {
    const limpio = valor.trim();
    // HighLevel manda `{{campo}}` sin resolver cuando el paso Webhook tiene la
    // clave pero el valor del `{{ }}` quedó vacío o mal mapeado. Eso no es un
    // dato: se ignora para no guardar basura como estado="{{}}".
    if (!limpio || /^\{\{.*\}\}$/.test(limpio)) return null;
    return limpio;
  }
  if (typeof valor === "number" || typeof valor === "boolean") {
    return String(valor);
  }
  return null;
}

function normalizarClave(clave: string) {
  return clave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function indiceDeCampos(payload: Objeto) {
  const message = objeto(payload.message) ?? {};
  const call = objeto(payload.call) ?? {};
  const data = objeto(payload.data) ?? {};
  const customData = objeto(payload.customData) ?? {};
  const contact = objeto(payload.contact) ?? {};
  const user = objeto(payload.user) ?? {};
  const indice = new Map<string, unknown>();

  // El orden importa: lo más específico primero, para que no lo pise el genérico.
  // `user` se excluye a propósito: su `id` se guarda aparte para que no se
  // confunda con el id de la llamada ni con el del contacto.
  for (const origen of [customData, data, call, message, contact, payload]) {
    for (const [clave, valor] of Object.entries(origen)) {
      // Ignora merge-tags de HighLevel sin resolver ("{{...}}"): si se guardaran
      // ocuparían el índice y taparían el dato bueno que sí venga en los datos
      // estándar del CRM (p. ej. customData manda callStatus="{{}}" pero el
      // payload trae el estado real).
      if (typeof valor === "string" && /^\{\{.*\}\}$/.test(valor.trim())) continue;
      const clv = normalizarClave(clave);
      if (!indice.has(clv)) indice.set(clv, valor);
    }
  }
  // El trigger de llamada de HighLevel no siempre manda el id del usuario. Suele
  // venir el objeto `user` con email y nombre. Se guardan aparte (con claves ya
  // normalizadas) para poder resolver quién llamó por id, por correo o por
  // nombre. Lo mismo con el id de la location, que llega anidado.
  const userId = texto(user.id) ?? texto(user.userId);
  if (userId) indice.set("hluserid", userId);
  const userEmail = texto(user.email);
  if (userEmail) indice.set("hluseremail", userEmail);
  const userName = [texto(user.firstName), texto(user.lastName)]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (userName) indice.set("hlusername", userName);
  const location = objeto(payload.location);
  if (location?.id) indice.set("hllocationid", texto(location.id));
  return indice;
}

function obtener(indice: Map<string, unknown>, ...claves: string[]) {
  for (const clave of claves) {
    const valor = indice.get(normalizarClave(clave));
    if (valor !== undefined && valor !== null && valor !== "") return valor;
  }
  return null;
}

/// Segundos de duración desde números ("83") o desde "mm:ss" / "hh:mm:ss".
function duracionEnSegundos(valor: unknown): number {
  const dato = texto(valor);
  if (!dato) return 0;
  if (/^\d+$/.test(dato)) return Number(dato);
  const partes = dato.split(":").map((p) => Number(p));
  if (partes.some((n) => Number.isNaN(n))) return 0;
  return partes.reduce((total, n) => total * 60 + n, 0);
}

function aFecha(valor: unknown): Date | null {
  const dato = texto(valor);
  if (!dato) return null;
  // Epoch en segundos o milisegundos.
  if (/^\d{10}$/.test(dato)) return new Date(Number(dato) * 1000);
  if (/^\d{13}$/.test(dato)) return new Date(Number(dato));
  const fecha = new Date(dato);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

const CONTESTADAS = new Set(["completed", "answered", "connected"]);

export type LlamadaNormalizada = {
  externalId: string;
  locationId: string | null;
  highlevelUserId: string | null;
  /// Correo del usuario que hizo/atendió la llamada. El trigger de HighLevel no
  /// manda el id, pero sí el correo: sirve para cruzar con `app_user`.
  callerEmail: string | null;
  /// Nombre del usuario (respaldo si no cruza por id ni por correo).
  callerName: string | null;
  contactId: string | null;
  direction: "inbound" | "outbound" | null;
  status: string | null;
  answered: boolean;
  durationSeconds: number;
  fromNumber: string | null;
  toNumber: string | null;
  recordingUrl: string | null;
  startedAt: Date;
};

const contextoSchema = z.object({
  locationId: z.string().trim().max(160).nullable(),
});

export function normalizarLlamadaHighLevel(entrada: unknown): LlamadaNormalizada {
  const payload = objeto(entrada);
  if (!payload) throw new Error("El cuerpo debe ser un objeto JSON.");
  const indice = indiceDeCampos(payload);

  const { locationId } = contextoSchema.parse({
    locationId: texto(obtener(indice, "hllocationid", "locationId", "location_id")),
  });

  const contactId = texto(obtener(indice, "contactId", "contact_id"));
  const fromNumber = texto(obtener(indice, "from", "fromNumber", "from_number"));
  const toNumber = texto(obtener(indice, "to", "toNumber", "to_number"));

  const direccionCruda = texto(
    obtener(indice, "direction", "callDirection", "call_direction"),
  );
  const dirN = direccionCruda ? normalizarClave(direccionCruda) : "";
  let direction: LlamadaNormalizada["direction"] = dirN.startsWith("out")
    ? "outbound"
    : dirN.startsWith("in")
      ? "inbound"
      : null;
  // Si el CRM no manda la dirección (llega vacía), se infiere por los números:
  // el teléfono del contacto en `to` = saliente; en `from` = entrante.
  if (!direction) {
    const colaContacto = colaDeTelefono(
      texto(obtener(indice, "phone", "contactPhone", "contact_phone")),
    );
    if (colaContacto) {
      if (colaDeTelefono(toNumber) === colaContacto) direction = "outbound";
      else if (colaDeTelefono(fromNumber) === colaContacto) direction = "inbound";
    }
  }

  const status = texto(
    obtener(indice, "callStatus", "call_status", "status", "messageStatus"),
  );
  const statusN = status ? normalizarClave(status) : "";
  const durationSeconds = duracionEnSegundos(
    obtener(indice, "durationSeconds", "duration_seconds", "callDuration", "duration"),
  );
  const answered = CONTESTADAS.has(statusN) || durationSeconds > 0;

  const startedAt =
    aFecha(
      obtener(
        indice,
        "startedAt",
        "started_at",
        "startTime",
        "dateAdded",
        "date_added",
        "timestamp",
        "createdAt",
        "date",
      ),
    ) ?? new Date();

  // Quién hizo/atendió la llamada. HighLevel a veces manda el id (una cadena sin
  // espacios), a veces el nombre ("Santiago Viveros"). Se separan: un valor con
  // espacios es un nombre, no un id.
  const crudoUsuario = texto(
    obtener(
      indice,
      "hluserid",
      "userId",
      "user_id",
      "agentId",
      "assignedUserId",
      "assigned_user_id",
      "assignedTo",
      "assigned_to",
    ),
  );
  const highlevelUserId =
    crudoUsuario && !/\s/.test(crudoUsuario) ? crudoUsuario : null;
  const callerEmail = texto(
    obtener(indice, "hluseremail", "userEmail", "user_email"),
  );
  const callerName =
    texto(obtener(indice, "hlusername")) ??
    (crudoUsuario && /\s/.test(crudoUsuario) ? crudoUsuario : null);

  // Id estable de la llamada para no duplicar en reintentos. Si el CRM no manda
  // uno, se arma con lo que identifica al evento.
  const idCrudo = texto(
    obtener(indice, "callId", "call_id", "messageId", "message_id", "id"),
  );
  const externalId =
    idCrudo ??
    [
      locationId ?? "sinloc",
      contactId ?? "sincontacto",
      direction ?? "sindir",
      String(durationSeconds),
      String(startedAt.getTime()),
    ].join(":");

  return {
    externalId,
    locationId,
    highlevelUserId,
    callerEmail,
    callerName,
    contactId,
    direction,
    status,
    answered,
    durationSeconds,
    fromNumber,
    toNumber,
    recordingUrl: texto(
      obtener(indice, "recordingUrl", "recording_url", "recording"),
    ),
    startedAt,
  };
}
