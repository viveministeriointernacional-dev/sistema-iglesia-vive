import type { CallOutcome } from "@iglesia/prisma-client";
import { nombreCompleto } from "@/lib/dominio";
import { variableDeEntorno } from "@/lib/entorno";
import { ETIQUETA_LLAMADA } from "@/lib/op72";
import { getPrisma } from "@/lib/prisma";

/// Sincronización de salida: lo que pasa en el sistema se escribe en HighLevel.
///
/// Es el reflejo del webhook de entrada. Todo aquí es «best-effort»: si no hay
/// token configurado, no hace nada; si HighLevel falla, se registra el error
/// pero nunca se rompe la acción del consolidador. El sistema es la fuente de
/// verdad; HighLevel es una copia para quien trabaja en el CRM.

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

/// IDs de los campos personalizados en HighLevel (los mismos que lee el webhook
/// de entrada en `highlevel.ts`).
const CAMPO = {
  confirmacionVisita: "yzgZvkQikaYXnK0fNL81",
  fechaVisita: "RoA76CCpoBd2DvraoQEF",
  estadoLlamada: "U1VhdP5dRedFZ30ihJbJ",
  fechaLlamada: "mXbNh4wigwrtXUpfMSqD",
  observacionLlamada: "r0FlVnHCzP6tqnTMHqdJ",
} as const;

type Credenciales = { token: string; locationId: string };

async function credenciales(): Promise<Credenciales | null> {
  const token = await variableDeEntorno("HIGHLEVEL_API_TOKEN");
  const locationId =
    (await variableDeEntorno("HIGHLEVEL_LOCATION_ID")) ?? null;
  if (!token || !locationId) return null;
  return { token, locationId };
}

async function pedir(
  ruta: string,
  metodo: "POST" | "PUT",
  cuerpo: unknown,
  token: string,
): Promise<Record<string, unknown>> {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(
      `HighLevel ${metodo} ${ruta} → ${respuesta.status} ${detalle.slice(0, 300)}`,
    );
  }
  return (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
}

/// Solo fecha, en el formato que aceptan los campos de HighLevel.
function soloFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/// Busca el contacto ya enlazado de la persona del aprendiz.
async function enlaceExistente(learnerId: string) {
  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: {
      personId: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          callPhone: true,
          whatsappPhone: true,
          email: true,
          address: true,
          highLevelContacts: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { id: true, contactId: true },
          },
        },
      },
    },
  });
  return aprendiz;
}

/// Crea (o reutiliza) el contacto en HighLevel para una persona del sistema y
/// guarda el enlace. Devuelve el id de contacto de HighLevel, o `null` si no se
/// pudo (sin token, o error). No pisa un contacto que ya venía de HighLevel.
export async function exportarContactoNuevo(
  learnerId: string,
): Promise<string | null> {
  const cred = await credenciales();
  if (!cred) return null;

  try {
    const aprendiz = await enlaceExistente(learnerId);
    if (!aprendiz) return null;
    const persona = aprendiz.person;

    // Ya está enlazado (vino de HighLevel o ya se exportó): no se duplica.
    if (persona.highLevelContacts[0]) return persona.highLevelContacts[0].contactId;

    const telefono = persona.callPhone ?? persona.whatsappPhone ?? undefined;
    const cuerpo: Record<string, unknown> = {
      locationId: cred.locationId,
      firstName: persona.firstName,
      lastName: persona.lastName ?? undefined,
      name: nombreCompleto(persona),
      email: persona.email ?? undefined,
      phone: telefono,
      address1: persona.address ?? undefined,
      source: "Sistema Iglesia Vive",
    };

    // `upsert` evita crear un duplicado si el teléfono o el correo ya existe en
    // HighLevel: en ese caso devuelve el contacto que ya estaba.
    const respuesta = await pedir("/contacts/upsert", "POST", cuerpo, cred.token);
    const contacto = (respuesta.contact ?? respuesta) as Record<string, unknown>;
    const contactId =
      typeof contacto.id === "string" ? contacto.id : null;
    if (!contactId) return null;

    const prisma = await getPrisma();
    // Se guarda el enlace para no volver a crearlo y para cerrar el círculo con
    // el webhook de entrada (que deduplica por locationId + contactId).
    await prisma.highLevelContact.upsert({
      where: {
        locationId_contactId: {
          locationId: cred.locationId,
          contactId,
        },
      },
      create: {
        locationId: cred.locationId,
        contactId,
        personId: aprendiz.personId,
      },
      update: { personId: aprendiz.personId },
    });

    return contactId;
  } catch (error) {
    console.error("No se pudo exportar el contacto a HighLevel", error);
    return null;
  }
}

/// Escribe campos personalizados en el contacto. Si aún no hay enlace, primero
/// crea el contacto.
async function actualizarCampos(
  learnerId: string,
  campos: { id: string; valor: string }[],
  cred: Credenciales,
): Promise<void> {
  const aprendiz = await enlaceExistente(learnerId);
  if (!aprendiz) return;

  const contactId =
    aprendiz.person.highLevelContacts[0]?.contactId ??
    (await exportarContactoNuevo(learnerId));
  if (!contactId) return;

  // HighLevel lee los campos como `{ id, value }` pero el endpoint de
  // actualización documenta `field_value`. Se mandan las dos claves con el
  // mismo valor para no depender de cuál interpreta esta versión de la API.
  await pedir(
    `/contacts/${contactId}`,
    "PUT",
    {
      customFields: campos.map((campo) => ({
        id: campo.id,
        field_value: campo.valor,
        value: campo.valor,
      })),
    },
    cred.token,
  );
}

/// Sube al CRM la primera llamada registrada en el sistema.
export async function exportarPrimeraLlamada(
  learnerId: string,
  datos: { resultado: CallOutcome; ocurrioEl: Date; observacion: string | null },
): Promise<void> {
  const cred = await credenciales();
  if (!cred) return;

  try {
    const campos = [
      { id: CAMPO.estadoLlamada, valor: ETIQUETA_LLAMADA[datos.resultado] },
      { id: CAMPO.fechaLlamada, valor: soloFecha(datos.ocurrioEl) },
      ...(datos.observacion
        ? [{ id: CAMPO.observacionLlamada, valor: datos.observacion }]
        : []),
    ];
    await actualizarCampos(learnerId, campos, cred);
  } catch (error) {
    console.error("No se pudo exportar la primera llamada a HighLevel", error);
  }
}

/// Sube al CRM el agendamiento de la visita hecho en el sistema.
export async function exportarVisita(
  learnerId: string,
  datos: { cuando: Date; virtual: boolean },
): Promise<void> {
  const cred = await credenciales();
  if (!cred) return;

  try {
    // Valores exactos de las opciones del campo en HighLevel.
    const confirmacion = datos.virtual
      ? "Desea reunión virtual"
      : "Sí, visita confirmada";
    const campos = [
      { id: CAMPO.confirmacionVisita, valor: confirmacion },
      { id: CAMPO.fechaVisita, valor: soloFecha(datos.cuando) },
    ];
    await actualizarCampos(learnerId, campos, cred);
  } catch (error) {
    console.error("No se pudo exportar la visita a HighLevel", error);
  }
}
