"use server";

import { revalidatePath } from "next/cache";

import { requerirVistaEnAccion } from "@/lib/auth";
import {
  puedeRevisarCuestionario,
  revisarCuestionario,
} from "@/lib/cuestionario";

export type ResultadoAccionQuiz = { ok: true } | { ok: false; mensaje: string };

/// Aprobar o devolver el cuestionario de un tema.
///
/// ⚠️ **Dos guardias, y los dos hacen falta**: la vista «Escuela»
/// (`requerirVistaEnAccion`) y además `puedeRevisarCuestionario`, porque esa
/// vista la ve también el rol MENTOR y revisar está cerrado a pastores y
/// administración. Esconder la pestaña y dejar la acción abierta habría sido
/// cosmético (la lección del 11-sep-2026).
export async function revisar(
  quizId: string,
  aprobado: boolean,
  nota: string,
): Promise<ResultadoAccionQuiz> {
  const usuario = await requerirVistaEnAccion("escuela");
  if (!puedeRevisarCuestionario(usuario)) {
    return { ok: false, mensaje: "No tienes permiso para revisar cuestionarios." };
  }

  const hecho = await revisarCuestionario(quizId, aprobado, nota, usuario);
  if (!hecho.ok) return hecho;

  revalidatePath("/escuela/cuestionario");
  revalidatePath(`/escuela/cuestionario/${quizId}`);
  return { ok: true };
}
