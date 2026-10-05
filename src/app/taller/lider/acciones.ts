"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  abrirCuestionario,
  enviarCuestionario,
  guardarRespuestaQuiz,
} from "@/lib/cuestionario";
import { learnerPorToken } from "@/lib/taller";
import { COOKIE_TALLER } from "@/lib/taller-catalogo";

/// ⚠️ **Se reutiliza la MISMA cookie y el MISMO código de miembro que el
/// taller de Casa de Fe**, y es la decisión del 2-oct-2026: «un solo enlace y
/// un solo código para TODO lo que la persona llena». Desde el celular de un
/// líder esto son «sus talleres»; dos cookies y dos códigos serían dos cosas
/// que perder. Y como la cookie está acotada a `/taller`, el cuestionario vive
/// bajo ese prefijo y **ya es ruta pública** sin tocar `RUTAS_PUBLICAS`.

export type ResultadoPublicoQuiz = { ok: true } | { ok: false; mensaje: string };

const SE_CERRO = "Se cerró tu sesión. Vuelve a entrar con tu código.";

async function learnerDeLaCookie(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_TALLER)?.value;
  if (!token) return null;
  const persona = await learnerPorToken(token);
  return persona?.learnerId ?? null;
}

export async function responderQuiz(
  codigo: string,
  quizId: string,
  questionId: string,
  valor: { text?: string; choice?: number },
): Promise<ResultadoPublicoQuiz> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) return { ok: false, mensaje: SE_CERRO };

  const guardado = await guardarRespuestaQuiz(quizId, learnerId, questionId, valor);
  if (!guardado.ok) return guardado;
  // No se repinta en cada tecla: la pantalla ya muestra lo que escribió, y
  // repintar le borraría el foco del campo a media frase.
  return { ok: true };
}

export async function enviarQuiz(
  codigo: string,
  quizId: string,
): Promise<ResultadoPublicoQuiz> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) return { ok: false, mensaje: SE_CERRO };

  const enviado = await enviarCuestionario(quizId, learnerId);
  if (!enviado.ok) return enviado;
  revalidatePath(`/taller/lider/${codigo}`);
  revalidatePath("/taller/lider");
  revalidatePath("/taller/mis");
  return { ok: true };
}

/// Se usa al entrar: abre (o retoma) el cuestionario de este tema.
export async function abrirQuiz(codigo: string): Promise<ResultadoPublicoQuiz> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) return { ok: false, mensaje: SE_CERRO };

  const abierto = await abrirCuestionario(codigo, learnerId);
  if (!abierto.ok) return abierto;
  revalidatePath(`/taller/lider/${codigo}`);
  return { ok: true };
}
