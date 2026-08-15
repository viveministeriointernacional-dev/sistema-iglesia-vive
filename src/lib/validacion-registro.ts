import { z } from "zod";
import {
  CallSchedule,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@/generated/prisma";

const textoOpcional = z
  .string()
  .trim()
  .max(280)
  .optional()
  .transform((valor) => (valor ? valor : null));

/// Validación mínima del registro (design/README.md § Interactions):
/// obligatorios nombres, apellidos, género, teléfono de llamadas y punto de
/// entrada. Con invitador conocido, hay que decir quién invitó.
export const esquemaRegistro = z
  .object({
    firstName: z.string().trim().min(1, "Escribe los nombres.").max(120),
    lastName: z.string().trim().min(1, "Escribe los apellidos.").max(120),
    gender: z.enum(Gender, { message: "Elige el género." }),
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
      .min(7, "El teléfono para llamadas es obligatorio.")
      .max(40),
    whatsappPhone: textoOpcional,
    email: z
      .string()
      .trim()
      .email("El correo no es válido.")
      .optional()
      .or(z.literal(""))
      .transform((valor) => (valor ? valor.toLowerCase() : null)),
    callSchedule: z.enum(CallSchedule).nullish(),
    address: textoOpcional,
    prayerRequest: textoOpcional,
    entryPoint: z.enum(EntryPoint, { message: "Elige el punto de entrada." }),
    invitationKind: z.enum(InvitationKind, {
      message: "Indica si alguien la invitó.",
    }),
    invitedByPersonId: z.string().uuid().nullish(),
  })
  .refine(
    (datos) =>
      datos.invitationKind !== InvitationKind.PERSONA || !!datos.invitedByPersonId,
    {
      message: "Busca y selecciona a la persona que la invitó.",
      path: ["invitedByPersonId"],
    },
  );

export type DatosRegistro = z.input<typeof esquemaRegistro>;
export type DatosRegistroValidados = z.output<typeof esquemaRegistro>;
