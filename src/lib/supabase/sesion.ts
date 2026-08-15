import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const RUTAS_PUBLICAS = ["/ingresar", "/auth"];

/// Refresca la sesión de Supabase en cada navegación y bloquea las rutas
/// privadas. La autorización fina por rol se aplica en cada pantalla y acción.
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esPublica = RUTAS_PUBLICAS.some((ruta) => pathname.startsWith(ruta));

  if (!user && !esPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.searchParams.set("siguiente", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/ingresar") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
