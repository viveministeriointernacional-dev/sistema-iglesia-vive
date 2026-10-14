"use server";

import { revalidatePath } from "next/cache";
import { requerirVistaEnAccion } from "@/lib/auth";
import { marcarOrada } from "@/lib/oracion";

/// ⚠️ Este archivo lleva `"use server"`, así que **solo puede exportar
/// funciones async** (la lección del 12-sep, que tiene su propio guardián en
/// `use-server.test.ts`). Las listas y constantes van en `oracion-catalogo.ts`.

export async function marcarComoOrada(
  peticionId: string,
  nota: string,
): Promise<{ ok: boolean; mensaje?: string }> {
  // El guardia va también en la acción, no solo en la página: esconder el
  // botón y dejar la acción abierta sería cosmético (la regla del 11-sep).
  const usuario = await requerirVistaEnAccion("oracion");

  const resultado = await marcarOrada({
    peticionId,
    usuarioId: usuario.id,
    nota,
  });
  if (!resultado.ok) return resultado;

  revalidatePath("/oracion");
  return { ok: true };
}
