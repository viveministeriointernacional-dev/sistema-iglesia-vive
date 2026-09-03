import {
  CallOutcome,
  CallSchedule,
  ChurchAttendance,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";

/// Lo que deja el formulario «Registro Llamada Línea»: la llamada que hace la
/// línea y la visita que se agenda.
export type VisitaDesdeCrm = {
  /// Qué respondió la persona sobre la visita.
  confirmacion: "confirmada" | "virtual" | "no" | null;
  /// Fecha de la visita, si la línea la fijó.
  fechaVisita: string | null;
  /// Cómo salió la llamada de la línea.
  estadoLinea: CallOutcome | null;
  fechaLinea: string | null;
  observacionLinea: string | null;
};
import { z } from "zod";
import { esquemaRegistro } from "@/lib/validacion-registro";

type Objeto = Record<string, unknown>;

const contextoSchema = z.object({
  contactId: z.string().trim().min(1).max(160),
  locationId: z.string().trim().min(1).max(160),
  formId: z.string().trim().max(160).nullable(),
  formName: z.string().trim().max(240).nullable(),
  submissionId: z.string().trim().max(160).nullable(),
  /// El dueño del contacto en HighLevel. Con él, quien atiende a la persona en
  /// el CRM queda como su consolidador en el sistema.
  ownerId: z.string().trim().max(160).nullable(),
  ownerEmail: z.string().trim().max(240).nullable(),
});

function objeto(valor: unknown): Objeto | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Objeto)
    : null;
}

function texto(valor: unknown): string | null {
  if (typeof valor === "string") {
    const limpio = valor.trim();
    // HighLevel manda el merge-tag sin resolver (`{{campo}}`) cuando el contacto
    // no tiene ese dato, y la palabra literal "null"/"undefined" cuando el campo
    // existe pero está vacío (p. ej. un contacto sin usuario asignado). Ninguno
    // es un valor real: se ignoran para que un campo vacío no se guarde como
    // basura, no tumbe el registro (birthDate) ni finja un dueño inexistente
    // (ownerId="null" saltaba el reparto automático de consolidador).
    if (
      !limpio ||
      /^\{\{.*\}\}$/.test(limpio) ||
      /^(null|undefined)$/i.test(limpio)
    ) {
      return null;
    }
    return limpio;
  }
  if (typeof valor === "number" || typeof valor === "boolean") {
    return String(valor);
  }
  return null;
}

function textoOpcional(valor: unknown) {
  return texto(valor) ?? undefined;
}

/// Fecha de nacimiento tolerante. HighLevel puede mandarla en ISO
/// (`1990-05-15`), con hora, o en formato colombiano `dd/mm/aaaa`. Se normaliza
/// a ISO; si no se puede interpretar, se devuelve `undefined` para que un dato
/// mal formado NO tumbe todo el registro (es un campo opcional).
function fechaNacimientoOpcional(valor: unknown): string | undefined {
  const dato = texto(valor);
  if (!dato) return undefined;
  // dd/mm/aaaa o dd-mm-aaaa → aaaa-mm-dd
  const co = dato.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (co) {
    const [, dia, mes, anio] = co;
    const iso = `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    return Number.isNaN(Date.parse(iso)) ? undefined : iso;
  }
  return Number.isNaN(Date.parse(dato)) ? undefined : dato;
}

/// Correo tolerante: devuelve el correo solo si tiene forma válida; si no, ""
/// (el esquema lo trata como ausente). Evita que un correo mal formado que
/// mande el CRM tumbe todo el registro.
function correoOpcional(valor: unknown): string {
  const dato = texto(valor);
  if (!dato) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dato) ? dato : "";
}

function normalizarClave(clave: string) {
  return clave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function camposPersonalizados(valor: unknown): Objeto {
  if (Array.isArray(valor)) {
    const resultado: Objeto = {};
    for (const campo of valor) {
      const fila = objeto(campo);
      if (!fila) continue;
      const valorCampo =
        fila.value ?? fila.field_value ?? fila.fieldValue ?? fila.values;
      for (const clave of [fila.key, fila.fieldKey, fila.name, fila.id]) {
        const nombre = texto(clave);
        if (nombre) resultado[nombre] = valorCampo;
      }
    }
    return resultado;
  }
  return objeto(valor) ?? {};
}

function indiceDeCampos(payload: Objeto) {
  const contact = objeto(payload.contact) ?? {};
  const data = objeto(payload.data) ?? {};
  const customData = objeto(payload.customData) ?? {};
  const personalizados = {
    ...camposPersonalizados(payload.customFields),
    ...camposPersonalizados(contact.customFields),
  };
  const indice = new Map<string, unknown>();

  for (const origen of [personalizados, customData, data, contact, payload]) {
    for (const [clave, valor] of Object.entries(origen)) {
      indice.set(normalizarClave(clave), valor);
    }
  }
  return indice;
}

function obtener(indice: Map<string, unknown>, ...claves: string[]) {
  for (const clave of claves) {
    const valor = indice.get(normalizarClave(clave));
    if (valor !== undefined && valor !== null && valor !== "") return valor;
  }
  return null;
}

function enumPorEtiqueta<T extends string>(
  valor: unknown,
  equivalencias: Record<string, T>,
): T | null {
  const dato = texto(valor);
  if (!dato) return null;
  return equivalencias[normalizarClave(dato)] ?? null;
}

function listaHorarios(valor: unknown): CallSchedule[] {
  const valores = Array.isArray(valor)
    ? valor
    : texto(valor)?.split(/[,;|/]/) ?? [];
  return Array.from(
    new Set(
      valores
        .map((item) =>
          enumPorEtiqueta(item, {
            manana: CallSchedule.MANANA,
            morning: CallSchedule.MANANA,
            tarde: CallSchedule.TARDE,
            afternoon: CallSchedule.TARDE,
            noche: CallSchedule.NOCHE,
            evening: CallSchedule.NOCHE,
            night: CallSchedule.NOCHE,
          }),
        )
        .filter((item): item is CallSchedule => Boolean(item)),
    ),
  );
}

export function normalizarPayloadHighLevel(entrada: unknown) {
  const payload = objeto(entrada);
  if (!payload) throw new Error("El cuerpo debe ser un objeto JSON.");
  const indice = indiceDeCampos(payload);

  const fullName = texto(obtener(indice, "fullName", "full_name", "name"));
  const firstName =
    texto(obtener(indice, "firstName", "first_name", "nombres", "nombre")) ??
    fullName;

  const direccionCompuesta = [
    texto(obtener(indice, "address1", "address_line_1")),
    texto(obtener(indice, "city", "ciudad")),
    texto(obtener(indice, "state", "departamento")),
    texto(obtener(indice, "postalCode", "postal_code")),
    texto(obtener(indice, "country", "pais")),
  ]
    .filter(Boolean)
    .join(", ");

  const contexto = contextoSchema.parse({
    contactId: texto(obtener(indice, "contactId", "contact_id")),
    locationId: texto(obtener(indice, "locationId", "location_id")),
    formId: texto(obtener(indice, "formId", "form_id")),
    formName: texto(obtener(indice, "formName", "form_name")),
    submissionId: texto(
      obtener(
        indice,
        "submissionId",
        "submission_id",
        "formSubmissionId",
        "id",
      ),
    ),
    ownerId: texto(
      obtener(
        indice,
        "assignedTo",
        "assigned_to",
        "ownerId",
        "owner_id",
        "assignedUserId",
      ),
    ),
    ownerEmail: texto(
      obtener(indice, "ownerEmail", "owner_email", "assignedToEmail"),
    ),
  });

  const datos = esquemaRegistro.parse({
    firstName,
    lastName: textoOpcional(
      obtener(indice, "lastName", "last_name", "apellidos", "apellido"),
    ),
    gender: enumPorEtiqueta(obtener(indice, "gender", "genero", "sexo"), {
      mujer: Gender.MUJER,
      femenino: Gender.MUJER,
      female: Gender.MUJER,
      hombre: Gender.HOMBRE,
      masculino: Gender.HOMBRE,
      male: Gender.HOMBRE,
    }),
    birthDate: fechaNacimientoOpcional(
      obtener(indice, "birthDate", "birth_date", "dateOfBirth", "fechaNacimiento"),
    ),
    callPhone: textoOpcional(
      obtener(indice, "callPhone", "call_phone", "phone", "telefono"),
    ),
    whatsappPhone: textoOpcional(
      obtener(indice, "whatsappPhone", "whatsapp_phone", "whatsapp"),
    ),
    // Solo se pasa el correo si tiene forma válida; uno mal formado se ignora
    // (opcional) en vez de tumbar todo el registro.
    email: correoOpcional(obtener(indice, "email", "correo")),
    callSchedules: listaHorarios(
      obtener(indice, "callSchedules", "call_schedules", "horarioLlamada"),
    ),
    callScheduleNote: textoOpcional(
      obtener(indice, "callScheduleNote", "call_schedule_note", "detalleHorario"),
    ),
    address:
      texto(obtener(indice, "address", "direccion")) ||
      direccionCompuesta ||
      undefined,
    prayerRequest: textoOpcional(
      obtener(
        indice,
        "prayerRequest",
        "prayer_request",
        "peticionOracion",
        "peticionDeOracion",
      ),
    ),
    entryPoint: enumPorEtiqueta(
      obtener(
        indice,
        "entryPoint",
        "entry_point",
        "comoLlego",
        "puntoEncuentro",
        "puntoDeEncuentro",
      ),
      {
        serviciodominical: EntryPoint.SERVICIO_DOMINICAL,
        serviciomiercoles: EntryPoint.SERVICIO_MIERCOLES,
        serviciojuvenil: EntryPoint.SERVICIO_JUVENIL,
        redessociales: EntryPoint.REDES_SOCIALES,
        alphacasadefe: EntryPoint.ALPHA_CASA_DE_FE,
        eventoobrigada: EntryPoint.EVENTO_O_BRIGADA,
        unoauno: EntryPoint.UNO_A_UNO,
        otro: EntryPoint.OTRO,
      },
    ),
    entryPointOther: textoOpcional(
      obtener(indice, "entryPointOther", "entry_point_other", "comoLlegoOtro"),
    ),
    churchAttendance: enumPorEtiqueta(
      obtener(
        indice,
        "churchAttendance",
        "church_attendance",
        "asisteIglesia",
        "asistesAlgunaIglesia",
      ),
      {
        iglesiavive: ChurchAttendance.IGLESIA_VIVE,
        siasistoalaiglesiavive: ChurchAttendance.IGLESIA_VIVE,
        otraiglesia: ChurchAttendance.OTRA_IGLESIA,
        siasistoaotraiglesia: ChurchAttendance.OTRA_IGLESIA,
        nuevo: ChurchAttendance.NUEVO,
        nosoynuevo: ChurchAttendance.NUEVO,
        asistiaantes: ChurchAttendance.ASISTIA_ANTES,
        noperoasistiaantes: ChurchAttendance.ASISTIA_ANTES,
      },
    ),
    churchName: textoOpcional(
      obtener(
        indice,
        "churchName",
        "church_name",
        "iglesiaAsiste",
        "iglesiaAlaQueAsiste",
      ),
    ),
    invitationKind: enumPorEtiqueta(
      obtener(indice, "invitationKind", "invitation_kind", "tipoInvitacion"),
      {
        persona: InvitationKind.PERSONA,
        unpersona: InvitationKind.PERSONA,
        redes: InvitationKind.REDES,
        redessociales: InvitationKind.REDES,
        desconocido: InvitationKind.DESCONOCIDO,
        nosabe: InvitationKind.DESCONOCIDO,
      },
    ),
    invitedByPersonId: null,
    invitedByName: textoOpcional(
      obtener(indice, "invitedByName", "invited_by_name", "quienInvito"),
    ),
  });

  return { contexto, datos, visita: extraerVisita(indice) };
}

/// Los campos del formulario «Registro Llamada Línea». Se buscan por el nombre
/// del campo y también por su id en HighLevel, porque según cómo se dispare el
/// webhook llega de una u otra forma.
function extraerVisita(indice: Map<string, unknown>): VisitaDesdeCrm {
  const conf = texto(
    obtener(
      indice,
      "Confirmación de visita",
      "contact.confirmacion_de_visita",
      "yzgZvkQikaYXnK0fNL81",
    ),
  );
  const confN = conf ? normalizarClave(conf) : "";
  const confirmacion: VisitaDesdeCrm["confirmacion"] = confN.includes("virtual")
    ? "virtual"
    : confN.startsWith("no")
      ? "no"
      : confN.includes("confirmada") || confN.startsWith("si")
        ? "confirmada"
        : null;

  return {
    confirmacion,
    fechaVisita: texto(
      obtener(
        indice,
        "Fecha visita",
        "Fecha de la visita",
        "contact.fecha_visita",
        "RoA76CCpoBd2DvraoQEF",
      ),
    ),
    estadoLinea: enumPorEtiqueta(
      obtener(
        indice,
        "Estado Primera Llamada Linea",
        "contact.estado_primera_llamada_linea",
        "U1VhdP5dRedFZ30ihJbJ",
      ),
      {
        contestobien: CallOutcome.CONTESTO_BIEN,
        contestoyreprogramo: CallOutcome.CONTESTO_REPROGRAMO,
        contestoregular: CallOutcome.CONTESTO_REGULAR,
        contestomal: CallOutcome.CONTESTO_MAL,
        nocontesto: CallOutcome.NO_CONTESTO,
      },
    ),
    fechaLinea: texto(
      obtener(
        indice,
        "Fecha Primera Llamada Linea",
        "contact.fecha_primera_llamada_linea",
        "mXbNh4wigwrtXUpfMSqD",
      ),
    ),
    observacionLinea: texto(
      obtener(
        indice,
        "Observación Primera LLamada Linea",
        "contact.observacion_primera_llamada_linea",
        "r0FlVnHCzP6tqnTMHqdJ",
      ),
    ),
  };
}

/// Payload del webhook de seguimiento de la línea («Registro Visita»,
/// «Primera Llamada», «Asignar a Línea»): los formularios que se llenan sobre
/// un contacto que YA está en el sistema. No trae el registro completo —solo
/// hace falta saber de quién se trata y qué pasó con la llamada o la visita—.
export function normalizarSeguimientoHighLevel(entrada: unknown) {
  const payload = objeto(entrada);
  if (!payload) throw new Error("El cuerpo debe ser un objeto JSON.");
  const indice = indiceDeCampos(payload);

  const contactId = texto(obtener(indice, "contactId", "contact_id"));
  const locationId = texto(obtener(indice, "locationId", "location_id"));
  if (!contactId || !locationId) {
    throw new Error("Faltan contactId o locationId del contacto.");
  }

  return {
    contexto: {
      contactId,
      locationId,
      formName: texto(obtener(indice, "formName", "form_name")),
      // Para reconocer a la persona si el contacto aún no está enlazado.
      phone: texto(obtener(indice, "phone", "telefono", "celular")),
      email: correoOpcional(obtener(indice, "email", "correo")) || null,
    },
    visita: extraerVisita(indice),
  };
}
