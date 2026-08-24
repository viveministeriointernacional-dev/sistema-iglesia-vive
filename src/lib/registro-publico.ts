import { z } from "zod";
import {
  ChurchAttendance,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";
import { esquemaRegistro } from "@/lib/validacion-registro";

export const esquemaRegistroPublico = esquemaRegistro
  .extend({
    lastName: z.string().trim().min(1, "Escribe tus apellidos.").max(120),
    gender: z.enum(Gender, { error: "Selecciona tu género." }),
    birthDate: z
      .string()
      .trim()
      .min(1, "Selecciona tu fecha de nacimiento.")
      .refine(
        (valor) => !Number.isNaN(Date.parse(valor)),
        "La fecha de nacimiento no es válida.",
      ),
    callPhone: z.string().trim().min(1, "Escribe tu teléfono.").max(40),
    email: z
      .string()
      .trim()
      .min(1, "Escribe tu correo electrónico.")
      .email("El correo no es válido.")
      .transform((valor) => valor.toLowerCase()),
    address: z.string().trim().min(1, "Escribe tu dirección o barrio.").max(280),
    prayerRequest: z
      .string()
      .trim()
      .min(1, "Escribe tu petición de oración.")
      .max(280),
    entryPoint: z.enum(EntryPoint, {
      error: "Selecciona tu punto de encuentro.",
    }),
    churchAttendance: z.enum(ChurchAttendance, {
      error: "Selecciona si asistes o asistías a una iglesia.",
    }),
    invitationKind: z.enum(InvitationKind, {
      error: "Indica si alguien te invitó.",
    }),
    aceptaPrivacidad: z.literal(true, {
      error: "Debes autorizar el uso de tus datos para poder registrarte.",
    }),
    sitioWeb: z.string().trim().max(0).default(""),
  })
  .superRefine((datos, contexto) => {
    if (!datos.callSchedules.length && !datos.callScheduleNote) {
      contexto.addIssue({
        code: "custom",
        path: ["callSchedules"],
        message: "Selecciona o escribe un horario de llamada.",
      });
    }

    if (datos.entryPoint === EntryPoint.OTRO && !datos.entryPointOther) {
      contexto.addIssue({
        code: "custom",
        path: ["entryPointOther"],
        message: "Cuéntanos cuál fue el punto de encuentro.",
      });
    }

    if (
      datos.invitationKind === InvitationKind.PERSONA &&
      !datos.invitedByName
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["invitedByName"],
        message: "Escribe el nombre de quien te invitó.",
      });
    }
  });

export type EntradaRegistroPublico = z.input<typeof esquemaRegistroPublico>;
