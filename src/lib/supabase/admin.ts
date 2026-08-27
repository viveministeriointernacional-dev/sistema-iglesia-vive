import type { SupabaseClient } from "@supabase/supabase-js";
import { variableDeEntorno } from "@/lib/entorno";

/// Cliente de Supabase con permisos de administración (service role). Solo se
/// usa en el servidor, para crear los accesos de mentores y líderes desde el
/// panel de administración. Devuelve `null` si el secreto no está configurado,
/// para que la acción responda con un mensaje claro en vez de romperse.
///
/// El cliente completo de `@supabase/supabase-js` es pesado de inicializar, así
/// que se importa de forma diferida: se carga solo cuando de verdad se va a
/// crear un acceso, no al abrir la página de administración. Esto evita que la
/// ruta gaste demasiados recursos al arrancar (error 1102 del Worker).
///
/// La `service role` nunca llega al navegador: vive como secreto del Worker y
/// se lee solo aquí, dentro de acciones de servidor protegidas por rol.
export async function crearSupabaseAdmin(): Promise<SupabaseClient | null> {
  const url = await variableDeEntorno("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = await variableDeEntorno("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return null;

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
