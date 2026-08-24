import { z } from "zod";
import { esquemaRegistro } from "@/lib/validacion-registro";

export const esquemaRegistroPublico = esquemaRegistro
  .extend({
    aceptaPrivacidad: z.literal(true, {
      error: "Debes autorizar el uso de tus datos para poder registrarte.",
    }),
    sitioWeb: z.string().trim().max(0).default(""),
  })
  .superRefine((datos, contexto) => {
    if (!datos.callPhone && !datos.whatsappPhone && !datos.email) {
      contexto.addIssue({
        code: "custom",
        path: ["callPhone"],
        message: "Escribe al menos un teléfono, WhatsApp o correo.",
      });
    }
  });

export type EntradaRegistroPublico = z.input<typeof esquemaRegistroPublico>;
