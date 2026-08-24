import { z } from "zod";
import {
  CallSchedule,
  ChurchAttendance,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";

const textoOpcional = z
  .string()
  .trim()
  .max(280)
  .optional()
  .transform((valor) => (valor ? valor : null));

/// El registro es libre a propósito (§20: el historial es acumulativo, y un
/// dato en blanco se completa después; uno inventado no se corrige nunca).
///
/// Lo único obligatorio es el nombre: sin eso no hay a quién buscar. Todo lo
/// demás —apellido, género, teléfono, cómo llegó, quién invitó— se puede
/// completar más tarde desde el expediente.
export const esquemaRegistro = z.object({
  firstName: z.string().trim().min(1, "Escribe al menos el nombre.").max(120),
  lastName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((valor) => (valor ? valor : null)),
  gender: z.enum(Gender).nullish(),
  birthDate: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor ? valor : null))
    .refine(
      (valor) => valor === null || !Number.isNaN(Date.parse(valor)),
      "La fecha de nacimiento no es válida.",
    ),
  callPhone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((valor) => (valor ? valor : null)),
  whatsappPhone: textoOpcional,
  email: z
    .string()
    .trim()
    .email("El correo no es válido.")
    .optional()
    .or(z.literal(""))
    .transform((valor) => (valor ? valor.toLowerCase() : null)),
  /// Varias franjas a la vez: «mañana y noche» es una respuesta normal.
  callSchedules: z.array(z.enum(CallSchedule)).default([]),
  /// Y el horario escrito a mano cuando ninguna franja sirve.
  callScheduleNote: textoOpcional,
  address: textoOpcional,
  prayerRequest: textoOpcional,
  entryPoint: z.enum(EntryPoint).nullish(),
  entryPointOther: textoOpcional,
  churchAttendance: z.enum(ChurchAttendance).nullish(),
  invitationKind: z.enum(InvitationKind).nullish(),
  /// Solo se llena cuando el invitador se eligió de la búsqueda.
  invitedByPersonId: z.string().uuid().nullish(),
  /// El nombre de quien invitó, esté o no en la base. Si se escribió a mano,
  /// un líder lo revisa después: no se bloquea el registro por eso.
  invitedByName: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((valor) => (valor ? valor : null)),
});

export type DatosRegistro = z.input<typeof esquemaRegistro>;
export type DatosRegistroValidados = z.output<typeof esquemaRegistro>;
