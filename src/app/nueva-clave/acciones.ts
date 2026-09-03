"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auditar } from "@/lib/audit";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EstadoNuevaClave = { error: string | null };

/// Canjea el token del correo y guarda la contraseña nueva.
///
/// `verifyOtp` valida el token y abre la sesión; con esa sesión ya se puede
/// cambiar la contraseña. El token sirve una sola vez, así que un enlace usado
/// o vencido cae en el mensaje de «pide uno nuevo».
export async function guardarContrasena(
  _estadoPrevio: EstadoNuevaClave,
  formData: FormData,
): Promise<EstadoNuevaClave> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (!token) {
    return { error: "El enlace no es válido. Pide uno nuevo desde «Entrar»." };
  }
  if (password.length < LARGO_MINIMO_CONTRASENA) {
    return {
      error: `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
    };
  }
  if (password !== confirmacion) {
    return { error: "Las dos contraseñas no coinciden." };
  }

  const supabase = await createSupabaseServerClient();

  const verificado = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: token,
  });
  if (verificado.error || !verificado.data.user) {
    return {
      error:
        "Este enlace ya se usó o venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?».",
    };
  }

  const actualizado = await supabase.auth.updateUser({ password });
  if (actualizado.error) {
    return { error: "No se pudo guardar la contraseña. Intenta otra vez." };
  }

  const email = verificado.data.user.email?.toLowerCase();
  const prisma = await getPrisma();
  const cuenta = email
    ? await prisma.appUser.findUnique({
        where: { email },
        select: { id: true, active: true },
      })
    : null;

  // Una cuenta sin rol activo no entra, aunque la contraseña se haya cambiado.
  if (!cuenta || !cuenta.active) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu contraseña quedó guardada, pero tu cuenta no tiene un rol activo. Habla con el administrador.",
    };
  }

  await auditar(prisma, {
    actorId: cuenta.id,
    action: "acceso.contrasena_recuperada",
    entityType: "app_user",
    entityId: cuenta.id,
  });

  revalidatePath("/", "layout");
  redirect("/");
}
