"use server";

import { pedirOracionDesdeElCelular } from "@/lib/oracion";

/// ⚠️ `"use server"`: solo funciones async (el guardián de `use-server.test.ts`).

export type EstadoDePeticion =
  | { fase: "vacio" }
  | { fase: "error"; mensaje: string; noEncontrada?: boolean }
  | { fase: "listo"; nombre: string };

const texto = (formulario: FormData, clave: string) =>
  (formulario.get(clave) as string | null)?.trim() ?? "";

export async function enviarPeticionDeOracion(
  _anterior: EstadoDePeticion,
  formulario: FormData,
): Promise<EstadoDePeticion> {
  const resultado = await pedirOracionDesdeElCelular({
    callPhone: texto(formulario, "callPhone"),
    email: texto(formulario, "email"),
    birthDate: texto(formulario, "birthDate"),
    texto: texto(formulario, "peticion"),
    // La casilla viaja en el FormData, así que esto **funciona sin
    // JavaScript** — igual que el `?escuela=1` del 3-oct.
    reservada: formulario.get("reservada") === "on",
  });

  if (!resultado.ok) {
    return {
      fase: "error",
      mensaje: resultado.mensaje,
      noEncontrada: resultado.noEncontrada,
    };
  }
  return { fase: "listo", nombre: resultado.nombre };
}
