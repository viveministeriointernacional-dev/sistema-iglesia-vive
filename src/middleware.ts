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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
