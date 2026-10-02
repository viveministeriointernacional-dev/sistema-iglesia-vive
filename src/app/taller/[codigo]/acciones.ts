"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  abrirTaller,
  enviarTaller,
  guardarRespuesta,
  identificarParaTaller,
  learnerPorToken,
} from "@/lib/taller";
import {
  COOKIE_TALLER,
  DIAS_DE_COOKIE,
  RUTA_DE_COOKIE,
} from "@/lib/taller-catalogo";

/// La cookie con la que la persona vuelve durante la semana.
///
/// ⚠️ **Es una credencial, no una preferencia**: `httpOnly` para que ningún
/// script de la página la pueda leer, y `sameSite: lax` para que no viaje desde
/// otro sitio. Dura 30 días — lo que tarda alguien en hacer varios temas — y no
/// más: un celular se presta, y una sesión eterna en un teléfono compartido
/// dejaría a la siguiente persona escribiendo en el taller de la primera.
const COOKIE = COOKIE_TALLER;
const DIAS = DIAS_DE_COOKIE;

export type ResultadoPublico = { ok: true } | { ok: false; mensaje: string };

async function learnerDeLaCookie(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const persona = await learnerPorToken(token);
  return persona?.learnerId ?? null;
}

/// `codigo` es el tema del QR por el que entró. **Puede venir nulo**: desde
/// «Mis talleres» la persona se identifica sin estar en ningún tema (perdió el
/// enlace del WhatsApp y entra con su código). En ese caso no hay taller que
/// abrir, solo sesión que dejar puesta.
export async function identificarme(
  codigo: string | null,
  datos: {
    celular?: string;
    correo?: string;
    nacimiento?: string;
    /// Su código de miembro. Es el camino que manda (ver `identificarParaTaller`).
    codigoDeMiembro?: string;
  },
): Promise<ResultadoPublico> {
  const encontrada = await identificarParaTaller({
    celular: datos.celular,
    correo: datos.correo,
    nacimiento: datos.nacimiento,
    codigo: datos.codigoDeMiembro,
  });
  if (!encontrada.ok) return encontrada;

  (await cookies()).set(COOKIE, encontrada.datos.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: RUTA_DE_COOKIE,
    maxAge: DIAS * 24 * 60 * 60,
  });

  if (codigo) {
    // Se abre ya el taller para que al repintar la pantalla esté listo.
    await abrirTaller(codigo, encontrada.datos.learnerId);
    revalidatePath(`/taller/${codigo}`);
  } else {
    revalidatePath("/taller/mis");
  }
  return { ok: true };
}

export async function salirDelTaller(codigo: string): Promise<ResultadoPublico> {
  (await cookies()).delete({ name: COOKIE, path: RUTA_DE_COOKIE });
  revalidatePath(`/taller/${codigo}`);
  return { ok: true };
}

export async function responder(
  codigo: string,
  workshopId: string,
  questionId: string,
  valor: { text?: string; choice?: number },
): Promise<ResultadoPublico> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) {
    return { ok: false, mensaje: "Se cerró tu sesión. Vuelve a escribir tu celular." };
  }
  const guardado = await guardarRespuesta(workshopId, learnerId, questionId, valor);
  if (!guardado.ok) return guardado;
  // No se repinta en cada tecla: la pantalla ya muestra lo que la persona
  // escribió. Repintar aquí le borraría el foco del campo a media frase.
  return { ok: true };
}

export async function enviar(
  codigo: string,
  workshopId: string,
): Promise<ResultadoPublico> {
  const learnerId = await learnerDeLaCookie();
  if (!learnerId) {
    return { ok: false, mensaje: "Se cerró tu sesión. Vuelve a escribir tu celular." };
  }
  const enviado = await enviarTaller(workshopId, learnerId);
  if (!enviado.ok) return enviado;
  revalidatePath(`/taller/${codigo}`);
  return { ok: true };
}
