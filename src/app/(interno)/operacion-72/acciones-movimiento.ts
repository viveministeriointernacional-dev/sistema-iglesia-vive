"use server";

import { Role } from "@iglesia/prisma-client";
import { requerirVistaEnAccion, veTodaLaConsolidacion } from "@/lib/auth";
import type { Desglose } from "@/lib/informe-detalle-catalogo";
import { calcularRango } from "@/lib/informe";
import { cargarEntradasDeLista, cargarSalidasDelTablero } from "@/lib/movimiento-op72";
import { listaValida, pestanaSalidaValida } from "@/lib/movimiento-op72-catalogo";
import { getPrisma } from "@/lib/prisma";

/// **Lo que piden el ⊕ de cada contador y el ⊖ de las salidas.**
///
/// Nada de esto se carga con el tablero: la página solo trae los números de los
/// botones, y la lista de quiénes fueron es un viaje a la base **solo cuando
/// alguien abre la ventana** (§12.5 — con `max: 1` cada viaje se serializa).
///
/// ⚠️ Este archivo es `"use server"`, así que **solo puede exportar funciones
/// `async`**. Una constante aquí tumba la pantalla entera en ejecución con
/// `tsc`, `eslint` y `cf:build` los tres en verde (§12.4): las listas y las
/// etiquetas viven en `movimiento-op72-catalogo.ts`.
///
/// **El alcance se recalcula aquí, no se recibe.** Un consolidador ve solo su
/// red en el tablero, así que su ventana tiene que enseñar solo su red: si el
/// `consolidadorId` llegara desde el navegador, cualquiera podría pedir la
/// lista de otro cambiando un parámetro. El guardia va en la página y en la
/// acción, no solo en el botón (§12.6).

/// Quién puede ver a quién, calculado desde la sesión. Es la misma regla que
/// aplica el tablero al contar las tarjetas, para que el ⊕ cuadre con el
/// contador que tiene encima.
async function alcance() {
  const usuario = await requerirVistaEnAccion("operacion-72");
  const soloSuRed = usuario.role === Role.CONSOLIDADOR && !veTodaLaConsolidacion(usuario);
  return { consolidadorId: soloSuRed ? usuario.id : null };
}

export async function pedirEntradasDeLista(datos: {
  lista: string;
  desde?: string;
  hasta?: string;
}): Promise<Desglose> {
  const { consolidadorId } = await alcance();

  const lista = listaValida(datos.lista);
  if (!lista) throw new Error("Esa lista no existe.");

  const prisma = await getPrisma();
  return cargarEntradasDeLista(prisma, {
    rango: calcularRango(datos.desde, datos.hasta),
    lista,
    consolidadorId,
  });
}

export async function pedirSalidasDelTablero(datos: {
  pestana?: string;
  desde?: string;
  hasta?: string;
}): Promise<Desglose> {
  const { consolidadorId } = await alcance();

  const prisma = await getPrisma();
  return cargarSalidasDelTablero(prisma, {
    rango: calcularRango(datos.desde, datos.hasta),
    pestana: pestanaSalidaValida(datos.pestana),
    consolidadorId,
  });
}
