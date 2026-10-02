import { NextResponse, type NextRequest } from "next/server";

import { learnerPorToken } from "@/lib/taller";
import {
  COOKIE_TALLER,
  DIAS_DE_COOKIE,
  RUTA_DE_COOKIE,
} from "@/lib/taller-catalogo";

/// El enlace que recibe la persona por WhatsApp o por correo al entrar a una
/// Casa de Fe.
///
/// ⚠️ **Es una ruta que redirige, no una pantalla, y el motivo es que el token
/// es una CREDENCIAL** (la regla del token del calendario, 17-sep-2026). Al
/// canjearlo por la cookie, el token **desaparece de la barra de direcciones**:
/// a partir de ahí la persona navega por `/taller/mis` y por cada tema sin que
/// su credencial quede en el historial del navegador, ni en el título de una
/// captura de pantalla, ni en lo que se le reenvía a alguien. El enlace sigue
/// guardado en su WhatsApp, que es donde tiene que estar.
///
/// Y es lo que hace que desde aquí se entre a cualquier tema **sin volver a
/// identificarse**: la cookie la pone esta ruta una sola vez.
///
/// Un token desconocido devuelve **404 a secas**, sin decir si existe.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!/^[0-9a-f]{8,64}$/.test(token)) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const persona = await learnerPorToken(token);
  if (!persona) {
    return new NextResponse("No encontrado", { status: 404 });
  }

  const respuesta = NextResponse.redirect(new URL("/taller/mis", request.url));
  respuesta.cookies.set(COOKIE_TALLER, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: RUTA_DE_COOKIE,
    maxAge: DIAS_DE_COOKIE * 24 * 60 * 60,
  });
  return respuesta;
}
