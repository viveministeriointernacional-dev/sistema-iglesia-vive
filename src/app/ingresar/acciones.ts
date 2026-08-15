"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EstadoIngreso = { error: string | null };

/// El acceso es por invitación: el correo debe existir en `app_user` con un rol
/// asignado. Supabase Auth valida la credencial; el rol lo define la iglesia.
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

  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }

  const prisma = await getPrisma();
  const registro = await prisma.appUser.findUnique({
    where: { email },
    select: { active: true },
  });

  if (!registro || !registro.active) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu cuenta todavía no tiene un rol asignado en Iglesia Vive. Habla con el administrador.",
    };
  }

  revalidatePath("/", "layout");
  redirect(siguiente.startsWith("/") ? siguiente : "/");
}

export async function salir() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/ingresar");
}
