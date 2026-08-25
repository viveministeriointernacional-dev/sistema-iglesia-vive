import {
  CallSchedule,
  ChurchAttendance,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";
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
  if (typeof valor === "string") return valor.trim() || null;
  if (typeof valor === "number" || typeof valor === "boolean") {
    return String(valor);
  }
  return null;
}

function textoOpcional(valor: unknown) {
  return texto(valor) ?? undefined;
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
    birthDate: textoOpcional(
      obtener(indice, "birthDate", "birth_date", "dateOfBirth", "fechaNacimiento"),
    ),
    callPhone: textoOpcional(
      obtener(indice, "callPhone", "call_phone", "phone", "telefono"),
    ),
    whatsappPhone: textoOpcional(
      obtener(indice, "whatsappPhone", "whatsapp_phone", "whatsapp"),
    ),
    email: texto(obtener(indice, "email", "correo")) ?? "",
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

  return { contexto, datos };
}
