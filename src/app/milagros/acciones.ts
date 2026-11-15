"use server";

import { registrarTestimonio } from "@/lib/testimonios";
import type { DatosDelTestimonio } from "@/lib/testimonios-catalogo";

/// ⚠️ Este archivo lleva `"use server"`, así que **solo puede exportar
/// funciones async** (12-sep, `use-server.test.ts`). Las reglas van en
/// `testimonios-catalogo.ts`.

/// Guarda el testimonio. Es pública a propósito: la llama `/milagros`, que no
/// pide cuenta. La validación se repite en el servidor dentro de
/// `registrarTestimonio`, porque la del navegador se puede saltar.
///
/// `trampa` es el campo invisible: si llega lleno lo llenó un programa, y se
/// le contesta que todo salió bien sin guardar nada, para que no insista.
export async function enviarTestimonio(
  datos: DatosDelTestimonio & { trampa?: string },
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  if (datos.trampa && datos.trampa.trim() !== "") return { ok: true };
  try {
    return await registrarTestimonio({
      nombre: String(datos.nombre ?? ""),
      celular: String(datos.celular ?? ""),
      edad: Number(datos.edad),
      milagro: String(datos.milagro ?? ""),
    });
  } catch (error) {
    console.error("[milagros] no se pudo guardar el testimonio", error);
    return {
      ok: false,
      mensaje: "No se pudo enviar. Revisa tu conexión e intenta de nuevo.",
    };
  }
}
