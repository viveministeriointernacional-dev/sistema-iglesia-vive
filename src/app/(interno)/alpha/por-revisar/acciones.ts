"use server";

import { revalidatePath } from "next/cache";

import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import { revisarTaller } from "@/lib/taller";

export type ResultadoRevision =
  | { ok: true; completoLosDoce: boolean; temasCompletados: number }
  | { ok: false; mensaje: string };

export async function revisar(
  workshopId: string,
  aprobado: boolean,
  nota: string,
): Promise<ResultadoRevision> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");

  const resultado = await revisarTaller(usuario, workshopId, aprobado, nota);
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha/por-revisar");
  revalidatePath("/alpha/temas");
  return {
    ok: true,
    completoLosDoce: resultado.datos.completoLosDoce,
    temasCompletados: resultado.datos.temasCompletados,
  };
}
