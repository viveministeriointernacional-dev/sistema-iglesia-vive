"use server";

import {
  buscarPorCelular,
  pedirAcompanamiento,
  type ResultadoAcompanamiento,
} from "@/lib/oracion";

/// **Paso 1.** Devuelve solo el nombre de pila: este link es público y
/// cualquiera puede teclear un número (ver `buscarPorCelular`).
export async function reconocerCelular(celular: string): Promise<
  | { encontrada: true; personId: string; nombre: string }
  | { encontrada: false; motivo: "sin-numero" | "no-esta" | "varias" }
> {
  return buscarPorCelular(celular);
}

/// **Paso 3.** Guarda lo que pidió y, si lo marcó, abre su Operación 72.
export async function enviarAcompanamiento(datos: {
  personId: string | null;
  celular: string;
  nombres: string;
  apellidos: string;
  correo: string;
  tipos: string[];
  quiereProceso: boolean;
  texto: string;
  reservada: boolean;
}): Promise<ResultadoAcompanamiento> {
  return pedirAcompanamiento(datos);
}
