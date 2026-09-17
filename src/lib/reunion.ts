import type { PrismaClient } from "@iglesia/prisma-client";
import { auditar } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import {
  normalizarReunion,
  type DatosDeReunion,
} from "@/lib/reunion-catalogo";

/// **Guardar el cuándo y el dónde de un grupo**, compartido por Alpha y por
/// Casa de Fe.
///
/// Vive aquí y no en cada `acciones.ts` porque las dos pantallas hacen
/// exactamente lo mismo, y porque un archivo `"use server"` solo puede
/// exportar funciones `async` (la regla que tumbó el tablero el 12-sep).

export type TipoDeGrupo = "alpha" | "casa-de-fe";

export type ResultadoReunion = { ok: true } | { ok: false; mensaje: string };

/// Qué había antes, para que la auditoría cuente el cambio y no solo el
/// resultado. Sin el «antes» nadie puede saber después si la reunión se movió
/// de día o si simplemente se le puso hora por primera vez.
type Antes = Pick<
  DatosDeReunion,
  "weekday" | "meetingTime" | "everyNWeeks" | "durationMinutes" | "address"
>;

export async function guardarReunionDeGrupo(
  tipo: TipoDeGrupo,
  grupoId: string,
  actorId: string,
  crudo: Parameters<typeof normalizarReunion>[0],
): Promise<ResultadoReunion> {
  const limpia = normalizarReunion(crudo);
  if (!limpia.ok) return { ok: false, mensaje: limpia.mensaje };

  const prisma = await getPrisma();
  const antes = await leerReunion(prisma, tipo, grupoId);
  if (!antes) return { ok: false, mensaje: "No se encontró el grupo." };

  const seleccion = {
    weekday: true,
    meetingTime: true,
    everyNWeeks: true,
    durationMinutes: true,
    address: true,
  } as const;

  if (tipo === "alpha") {
    await prisma.alphaProgram.update({
      where: { id: grupoId },
      data: limpia.datos,
      select: seleccion,
    });
  } else {
    await prisma.faithHouseGroup.update({
      where: { id: grupoId },
      data: limpia.datos,
      select: seleccion,
    });
  }

  await auditar(prisma, {
    actorId,
    action:
      tipo === "alpha" ? "alpha.reunion_actualizada" : "casa_de_fe.reunion_actualizada",
    entityType: tipo === "alpha" ? "alpha_program" : "faith_house_group",
    entityId: grupoId,
    metadata: {
      antes: {
        dia: antes.weekday,
        hora: antes.meetingTime,
        cada: antes.everyNWeeks,
        dura: antes.durationMinutes,
        direccion: antes.address,
      },
      ahora: {
        dia: limpia.datos.weekday,
        hora: limpia.datos.meetingTime,
        cada: limpia.datos.everyNWeeks,
        dura: limpia.datos.durationMinutes,
        direccion: limpia.datos.address,
      },
    },
  });

  return { ok: true };
}

async function leerReunion(
  prisma: PrismaClient,
  tipo: TipoDeGrupo,
  grupoId: string,
): Promise<Antes | null> {
  const seleccion = {
    weekday: true,
    meetingTime: true,
    everyNWeeks: true,
    durationMinutes: true,
    address: true,
  } as const;

  return tipo === "alpha"
    ? prisma.alphaProgram.findUnique({ where: { id: grupoId }, select: seleccion })
    : prisma.faithHouseGroup.findUnique({ where: { id: grupoId }, select: seleccion });
}
