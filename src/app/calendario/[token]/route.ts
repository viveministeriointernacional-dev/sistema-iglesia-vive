import { construirIcs, reunionesDeLaCuenta } from "@/lib/calendario";

/// **El calendario de reuniones de una persona, como archivo .ics.**
///
/// Ruta pública a la fuerza: los calendarios (Google, el iPhone, Outlook) no
/// saben iniciar sesión, así que **el token de la URL es lo único que
/// autoriza**. Va en `RUTAS_PUBLICAS` por eso mismo.
///
/// Un token que no existe, o de una cuenta desactivada, devuelve **404 y nada
/// más**: ni «no autorizado» ni el nombre de nadie. Así la URL no sirve para
/// averiguar qué cuentas hay.
export const dynamic = "force-dynamic";

export async function GET(
  peticion: Request,
  contexto: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token: crudo } = await contexto.params;

  // La ruta se pide como `/calendario/<token>.ics`: la extensión es para que
  // los clientes reconozcan el archivo, no parte del token.
  const token = crudo.replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return new Response("No encontrado", { status: 404 });
  }

  const datos = await reunionesDeLaCuenta(token);
  if (!datos) return new Response("No encontrado", { status: 404 });

  const ics = construirIcs({
    nombre: datos.nombre,
    reuniones: datos.reuniones,
    dominio: new URL(peticion.url).host,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="mis-reuniones.ics"',
      // Que ningún intermediario lo guarde: es contenido personal, y además
      // tiene que reflejar el cambio de hora en cuanto el cliente lo pida.
      "cache-control": "private, no-store",
    },
  });
}
