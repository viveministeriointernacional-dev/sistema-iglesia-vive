"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/audit";
import { verificarLlaveMaestra } from "@/lib/llave-maestra";
import { getPrisma } from "@/lib/prisma";
import { crearSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EstadoIngreso = { error: string | null };

const CREDENCIAL_MALA = "Correo o contraseña incorrectos.";
const SIN_ROL =
  "Tu cuenta todavía no tiene un rol asignado en Iglesia Vive. Habla con el administrador.";

/// El acceso es por invitación: el correo debe existir en `app_user` con un rol
/// asignado. Supabase Auth valida la credencial; el rol lo define la iglesia.
///
/// Hay un segundo camino: la **llave maestra** (`src/lib/llave-maestra.ts`).
/// Si la contraseña no es la de esa persona pero sí es la llave maestra, se
/// abre igual la sesión de ese perfil. Es para que el administrador pueda ver
/// el sistema como lo ve cada quien sin pedirle la contraseña a nadie.
export async function ingresar(
  _estadoPrevio: EstadoIngreso,
  formData: FormData,
): Promise<EstadoIngreso> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const siguiente = String(formData.get("siguiente") ?? "/");

  if (!email || !password) {
    return { error: "Escribe tu correo y tu contraseña." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  const prisma = await getPrisma();
  const registro = await prisma.appUser.findUnique({
    where: { email },
    select: { id: true, active: true },
  });

  if (error) {
    // La llave maestra solo se comprueba cuando la contraseña normal falló y el
    // correo es de alguien con acceso vigente. Así no se convierte en una
    // manera de averiguar qué correos existen: la respuesta es la misma frase
    // en todos los casos.
    if (!registro?.active) return { error: CREDENCIAL_MALA };

    const esLlaveMaestra = await verificarLlaveMaestra(prisma, password);
    if (!esLlaveMaestra) return { error: CREDENCIAL_MALA };

    const abierta = await abrirSesionConLlaveMaestra(email);
    if (!abierta.ok) return { error: abierta.mensaje };

    // Quién usó la llave no se sabe (es un secreto compartido con el
    // administrador), pero a qué perfil entró sí, y eso es lo que hay que poder
    // revisar después. Sin este registro la entrada sería invisible.
    await auditar(prisma, {
      actorId: null,
      action: "acceso.llave_maestra_usada",
      entityType: "app_user",
      entityId: registro.id,
      metadata: { email },
    });

    revalidatePath("/", "layout");
    redirect(siguiente.startsWith("/") ? siguiente : "/");
  }

  if (!registro || !registro.active) {
    await supabase.auth.signOut();
    return { error: SIN_ROL };
  }

  revalidatePath("/", "layout");
  redirect(siguiente.startsWith("/") ? siguiente : "/");
}

/// Abre la sesión de un perfil sin su contraseña.
///
/// Supabase Auth no deja «entrar como» directamente, así que se hace en dos
/// pasos con la llave de servicio: se genera un enlace mágico para ese correo
/// (que no se envía a ninguna parte) y se canjea aquí mismo su token. El
/// resultado es una sesión normal y corriente de esa persona.
async function abrirSesionConLlaveMaestra(
  email: string,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const admin = await crearSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      mensaje:
        "Falta configurar el secreto SUPABASE_SERVICE_ROLE_KEY en el Worker para usar la llave maestra.",
    };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return {
      ok: false,
      mensaje:
        "Ese perfil todavía no tiene acceso creado en el sistema. Créaselo desde Administración.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const canje = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (canje.error) {
    return { ok: false, mensaje: "No se pudo abrir la sesión de ese perfil." };
  }

  return { ok: true };
}

export async function salir() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/ingresar");
}
