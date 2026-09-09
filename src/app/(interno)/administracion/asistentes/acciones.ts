"use server";

import { revalidatePath } from "next/cache";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { devolverAProceso } from "@/lib/asistente";
import { getPrisma } from "@/lib/prisma";

/// Devuelve a un asistente al proceso desde el listado de Administración.
export async function devolverAProcesoDesdeAdministracion(
  learnerId: string,
  datos: { nota?: string | null },
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const usuario = await requerirRol(ROLES_ADMIN);
  const prisma = await getPrisma();

  const resultado = await devolverAProceso(prisma, {
    learnerId,
    nota: datos.nota ?? null,
    actorId: usuario.id,
  });
  if (!resultado.ok) return resultado;

  revalidatePath("/administracion/asistentes");
  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${learnerId}`);
  return { ok: true };
}
