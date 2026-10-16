"use server";

import { Role } from "@iglesia/prisma-client";
import { ErrorDePermiso, requerirVistaEnAccion } from "@/lib/auth";
import { calcularRango } from "@/lib/informe";
import { cargarPersonasDelSalto } from "@/lib/informe-detalle";
import { type Desglose, extremoValido } from "@/lib/informe-detalle-catalogo";
import { getPrisma } from "@/lib/prisma";

/// **Lo que piden las gráficas del histórico al hacer clic.**
///
/// Nada se carga con la página: las series viajan con ella (una consulta), y
/// la lista de quiénes fueron solo cuando alguien abre una ventana.
///
/// ⚠️ `"use server"`: **solo funciones `async`** (§12.4).
///
/// **El guardia va dos veces, y aquí hace falta de verdad.** El histórico es
/// una pestaña dentro de la vista `operacion-72`, que ven también los
/// consolidadores: hereda el permiso de la vista, pero encima lleva su propia
/// comprobación de rol. Esconder la pestaña y dejar la acción abierta sería
/// cosmético (§12.6).

async function requerirAdminDelTablero() {
  const usuario = await requerirVistaEnAccion("operacion-72");
  if (usuario.role !== Role.ADMIN) {
    throw new ErrorDePermiso("El histórico solo lo ven los administradores.");
  }
  return usuario;
}

export async function pedirPersonasDelTramo(datos: {
  /// Nulo o ausente significa «vinieran de la columna que vinieran». Es lo que
  /// usan las tres puertas de salida.
  desde?: string | null;
  hacia: string;
  /// El tramo exacto que se pulsó: un día, una semana o un mes.
  tramoDesde: string;
  tramoHasta: string;
}): Promise<Desglose> {
  await requerirAdminDelTablero();

  const hacia = extremoValido(datos.hacia);
  if (!hacia) throw new Error("Ese movimiento no existe.");

  const desde = datos.desde ? extremoValido(datos.desde) : null;
  if (datos.desde && !desde) throw new Error("Ese movimiento no existe.");

  const prisma = await getPrisma();
  return cargarPersonasDelSalto(prisma, {
    rango: calcularRango(datos.tramoDesde, datos.tramoHasta),
    desde,
    hacia,
  });
}
