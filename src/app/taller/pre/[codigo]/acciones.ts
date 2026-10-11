"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { learnerPorToken } from "@/lib/taller";
import { COOKIE_TALLER, RUTA_DE_COOKIE } from "@/lib/taller-catalogo";
import {
  abrirTallerPre,
  enviarTallerPre,
  guardarRespuestaPre,
} from "@/lib/prematrimonial";

export type ResultadoPublicoPre = { ok: true } | { ok: false; mensaje: string };

async function learnerDeLaCookie(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_TALLER)?.value;
  if (!token) return null;
  const persona = await learnerPorToken(token);
  return persona?.learnerId ?? null;
}

export async function responderPre(
  codigo: string,
  workshopId: string,
  questionId: string,
  valor: { text?: string; choice?: number; choices?: number[]; ordering?: number[] },
): Promise<ResultadoPublicoPre> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) {
    return { ok: false, mensaje: "Se cerró tu sesión. Vuelve a entrar con tu código." };
  }
  const guardado = await guardarRespuestaPre(workshopId, learnerId, questionId, valor);
  if (!guardado.ok) return guardado;
  // No se repinta en cada tecla: la pantalla ya muestra lo que escribió, y
  // repintar le borraría el foco del campo a media frase.
  return { ok: true };
}

export async function enviarPre(
  codigo: string,
  workshopId: string,
): Promise<ResultadoPublicoPre> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) {
    return { ok: false, mensaje: "Se cerró tu sesión. Vuelve a entrar con tu código." };
  }
  const enviado = await enviarTallerPre(workshopId, learnerId);
  if (!enviado.ok) return enviado;
  revalidatePath(`/taller/pre/${codigo}`);
  revalidatePath("/taller/mis");
  return { ok: true };
}

/// Se usa al entrar: abre (o retoma) el taller de este tema.
/// Soltar la identificación desde el propio taller.
///
/// ⚠️ **Aquí hace más falta que en ningún otro taller, y es la razón de que
/// exista:** el prematrimonial es el único que llenan DOS personas que viven
/// juntas, así que es el único donde de verdad se van a pasar el mismo
/// teléfono. La cookie dura 30 días (`DIAS_DE_COOKIE`), de modo que sin esta
/// salida el segundo quedaría escribiendo en el taller del primero — y lo
/// único que el ejercicio mide es que cada uno responda por separado.
///
/// No se reusa `salirDelTaller` de Casa de Fe porque aquella revalida
/// `/taller/<codigo>`, que es otra ruta: dejaría esta pantalla sin repintar.
export async function salirDelTallerPre(
  codigo: string,
): Promise<ResultadoPublicoPre> {
  (await cookies()).delete({ name: COOKIE_TALLER, path: RUTA_DE_COOKIE });
  revalidatePath(`/taller/pre/${codigo}`);
  return { ok: true };
}

export async function abrirPre(codigo: string): Promise<ResultadoPublicoPre> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) {
    return { ok: false, mensaje: "Se cerró tu sesión. Vuelve a entrar con tu código." };
  }
  const abierto = await abrirTallerPre(codigo, learnerId);
  if (!abierto.ok) return abierto;
  revalidatePath(`/taller/pre/${codigo}`);
  return { ok: true };
}
