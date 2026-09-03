"use server";

import { auditar } from "@/lib/audit";
import { correoRecuperarContrasena, URL_SISTEMA } from "@/lib/correo";
import { getPrisma } from "@/lib/prisma";
import { crearSupabaseAdmin } from "@/lib/supabase/admin";

export type EstadoRecuperacion = {
  enviado: boolean;
  error: string | null;
};

/// Mismo texto pase lo que pase: si dijera «ese correo no existe», cualquiera
/// desde fuera podría averiguar quién tiene cuenta en la iglesia.
const RESPUESTA_NEUTRA: EstadoRecuperacion = { enviado: true, error: null };

/// Envía el enlace para crear una contraseña nueva.
///
/// El enlace lo genera Supabase (`generateLink`) pero lo entregamos nosotros por
/// Resend, que es el correo que la iglesia tiene configurado y funcionando. Del
/// enlace solo se usa el `hashed_token`: la pantalla `/nueva-clave` lo canjea
/// con `verifyOtp`, que es lo que funciona con sesiones de servidor.
export async function pedirEnlace(
  _estadoPrevio: EstadoRecuperacion,
  formData: FormData,
): Promise<EstadoRecuperacion> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) return { enviado: false, error: "Escribe tu correo." };

  const prisma = await getPrisma();
  const cuenta = await prisma.appUser.findUnique({
    where: { email },
    select: { id: true, fullName: true, active: true },
  });

  // Una cuenta inexistente o desactivada no recibe enlace, pero la respuesta es
  // la misma para quien está del otro lado.
  if (!cuenta || !cuenta.active) return RESPUESTA_NEUTRA;

  const admin = await crearSupabaseAdmin();
  if (!admin) {
    return {
      enviado: false,
      error:
        "La recuperación de contraseña no está configurada. Escríbele al administrador.",
    };
  }

  const enlace = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const token = enlace.data?.properties?.hashed_token;
  if (enlace.error || !token) {
    console.error("No se pudo generar el enlace de recuperación", enlace.error);
    return RESPUESTA_NEUTRA;
  }

  const correo = await correoRecuperarContrasena({
    to: email,
    nombre: cuenta.fullName,
    enlace: `${URL_SISTEMA}/nueva-clave?token=${encodeURIComponent(token)}`,
  });

  // La respuesta al usuario es siempre la misma (no se puede revelar si el
  // correo existe), así que el porqué de un envío fallido solo queda aquí.
  await auditar(prisma, {
    actorId: null,
    action: "acceso.recuperacion_solicitada",
    entityType: "app_user",
    entityId: cuenta.id,
    metadata: {
      email,
      correoEnviado: correo.enviado,
      motivoCorreo: correo.enviado ? null : correo.motivo,
    },
  });

  return RESPUESTA_NEUTRA;
}
