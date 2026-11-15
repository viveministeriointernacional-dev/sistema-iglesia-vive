"use server";

import { revalidatePath } from "next/cache";
import { requerirVistaEnAccion } from "@/lib/auth";
import { marcarContactado } from "@/lib/testimonios";

/// ⚠️ `"use server"`: solo funciones async (12-sep, `use-server.test.ts`).

export async function marcarComoContactado(
  testimonioId: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  // El guardia va también en la acción, no solo en la página (§12.6).
  const usuario = await requerirVistaEnAccion("testimonios");

  const resultado = await marcarContactado({
    testimonioId,
    usuarioId: usuario.id,
  });
  if (!resultado.ok) return resultado;

  revalidatePath("/testimonios");
  return { ok: true };
}
