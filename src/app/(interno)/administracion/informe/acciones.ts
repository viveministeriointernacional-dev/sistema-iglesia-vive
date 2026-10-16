"use server";

import { requerirVistaEnAccion } from "@/lib/auth";
import { calcularRango } from "@/lib/informe";
import {
  cargarDesglose,
  cargarPersonasDelSalto,
  type Desglose,
  extremoValido,
  indicadorValido,
  pestanaValida,
} from "@/lib/informe-detalle";
import { getPrisma } from "@/lib/prisma";

/// Lo que piden las ventanas del informe. **Nada de esto se carga con la
/// página**: cada una es un viaje a la base que solo ocurre cuando alguien abre
/// la ventana (ver la cabecera de `informe-detalle.ts`).
///
/// ⚠️ Este archivo es `"use server"`, así que **solo puede exportar funciones
/// `async`**. Una constante aquí tumba la página entera en ejecución con `tsc`,
/// `eslint` y `cf:build` los tres en verde (§12.4). Las listas y las etiquetas
/// viven en `informe-detalle-catalogo.ts`.
///
/// El guardia va en la acción además de en la página: esconder el botón y
/// dejar la acción abierta es cosmético (§12.6).

export async function pedirDesglose(datos: {
  indicador: string;
  pestana?: string;
  desde?: string;
  hasta?: string;
}): Promise<Desglose> {
  await requerirVistaEnAccion("informe");

  const indicador = indicadorValido(datos.indicador);
  if (!indicador) throw new Error("Ese indicador no existe.");

  const prisma = await getPrisma();
  return cargarDesglose(prisma, {
    indicador,
    rango: calcularRango(datos.desde, datos.hasta),
    // La pestaña válida depende del indicador: llamadas y visitas no tienen las
    // mismas, y cada uno abre en la que explica su cifra.
    pestana: pestanaValida(indicador, datos.pestana),
  });
}

export async function pedirPersonasDelSalto(datos: {
  desde: string;
  hacia: string;
  periodoDesde?: string;
  periodoHasta?: string;
}): Promise<Desglose> {
  await requerirVistaEnAccion("informe");

  const desde = extremoValido(datos.desde);
  const hacia = extremoValido(datos.hacia);
  if (!desde || !hacia) throw new Error("Ese movimiento no existe.");

  const prisma = await getPrisma();
  return cargarPersonasDelSalto(prisma, {
    rango: calcularRango(datos.periodoDesde, datos.periodoHasta),
    desde,
    hacia,
  });
}
