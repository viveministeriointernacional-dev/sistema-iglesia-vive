import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/sesion";

/// Refresca la sesión de Supabase en cada navegación y manda a /ingresar a
/// quien no tenga sesión.
///
/// Se mantiene como `middleware.ts` (runtime edge) y no como el `proxy.ts` de
/// Next 16: el proxy solo corre en Node y el adaptador de Cloudflare todavía no
/// lo soporta. Solo usa fetch y cookies, así que funciona en workerd.
export async function middleware(request: NextRequest) {
  return actualizarSesion(request);
}

/// ⚠️ **TODO TIPO DE ARCHIVO ESTÁTICO NUEVO HAY QUE AÑADIRLO AQUÍ, O EL
/// MIDDLEWARE SE LO TRAGA CON UN 307 A `/ingresar`.** Es la misma regla que
/// `RUTAS_PUBLICAS` para los webhooks, y falla igual de callada: el enlace se
/// pinta, se pulsa, y la persona acaba en la pantalla de entrar sin entender
/// nada — y encima la pareja del prematrimonial **no tiene cuenta**, así que
/// para ella no hay forma de salir de ahí.
///
/// `pdf` entró el 26-oct-2026 con el material de apoyo del prematrimonial, y
/// se vio antes de desplegar porque `material.pdf` daba **307** donde
/// `diapositiva-01.webp` daba **404**: dos archivos que todavía no existían,
/// con dos respuestas distintas. Esa diferencia es la señal.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)",
  ],
};
