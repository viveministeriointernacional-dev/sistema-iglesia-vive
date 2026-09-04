"use server";

import { MilestoneKind, Phase } from "@iglesia/prisma-client";
import {
  guardarActualizacionDeLiderazgo,
  HITOS_DECLARABLES,
  type HitoDeclarado,
  type ResultadoLiderazgo,
} from "@/lib/liderazgo";
import { getPrisma } from "@/lib/prisma";

export type EstadoLiderazgo =
  | { fase: "vacio" }
  | { fase: "error"; mensaje: string }
  | { fase: "listo"; resultado: Extract<ResultadoLiderazgo, { ok: true }> };

const texto = (formulario: FormData, clave: string) =>
  (formulario.get(clave) as string | null)?.trim() ?? "";

export async function guardarDatosDeLiderazgo(
  _anterior: EstadoLiderazgo,
  formulario: FormData,
): Promise<EstadoLiderazgo> {
  const hitos: HitoDeclarado[] = HITOS_DECLARABLES.map((hito) => ({
    kind: hito.kind as MilestoneKind,
    hecho: formulario.get(`hito-${hito.kind}`) === "on",
    mes: texto(formulario, `mes-${hito.kind}`),
    ano: texto(formulario, `ano-${hito.kind}`),
  }));

  const genero = texto(formulario, "gender");
  const etapa = texto(formulario, "phase");

  try {
    const prisma = await getPrisma();
    const resultado = await guardarActualizacionDeLiderazgo(prisma, {
      callPhone: texto(formulario, "callPhone"),
      firstName: texto(formulario, "firstName"),
      lastName: texto(formulario, "lastName"),
      gender: genero === "MUJER" || genero === "HOMBRE" ? genero : "",
      birthDate: texto(formulario, "birthDate"),
      whatsappPhone: texto(formulario, "whatsappPhone"),
      email: texto(formulario, "email"),
      address: texto(formulario, "address"),
      prayerRequest: texto(formulario, "prayerRequest"),
      phase: etapa in Phase ? (etapa as Phase) : "",
      roles: formulario.getAll("roles").map(String),
      hitos,
    });

    if (!resultado.ok) return { fase: "error", mensaje: resultado.mensaje };
    return { fase: "listo", resultado };
  } catch (error) {
    console.error("No se pudo guardar la actualización de liderazgo", error);
    return {
      fase: "error",
      mensaje:
        "No pudimos guardar tus datos en este momento. Inténtalo de nuevo en un minuto.",
    };
  }
}
