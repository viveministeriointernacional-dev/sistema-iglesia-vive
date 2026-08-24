"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  procesarRegistroPublico,
  type EstadoRegistroPublico,
} from "@/lib/registro-publico-servidor";

export type { EstadoRegistroPublico } from "@/lib/registro-publico-servidor";

export async function guardarRegistroPublico(
  _estadoAnterior: EstadoRegistroPublico,
  formulario: FormData,
): Promise<EstadoRegistroPublico> {
  const resultado = await procesarRegistroPublico(formulario, await headers());
  if (resultado.tipo === "rechazado") return resultado.estado;

  revalidatePath("/operacion-72");
  redirect("/registro/gracias");
}
