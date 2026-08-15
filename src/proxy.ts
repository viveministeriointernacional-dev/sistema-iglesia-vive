import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/sesion";

/// Refresca la sesión de Supabase en cada navegación y manda a /ingresar a
/// quien no tenga sesión.
export default async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
