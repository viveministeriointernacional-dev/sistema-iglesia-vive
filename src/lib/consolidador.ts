import { auditar } from "@/lib/audit";
import { exportarConsolidador } from "@/lib/highlevel-salida";
import type { ClientePrisma } from "@/lib/prisma";

/// Quién consolida a una persona se decide **en HighLevel** (un flujo del CRM
/// lo asigna casi al instante del registro), pero el sistema también lo cambia
/// solo en algunos casos —por ejemplo cuando a alguien se le quita el rol de
/// consolidador y hay que repartir su gente—. Decisión del usuario (4-sep-2026):
/// **los dos lados se sincronizan mutuamente**. Lo que se cambia acá se escribe
/// allá, y lo que se cambia allá entra acá.
///
/// El peligro obvio de una sincronización de doble vía es el **eco**: A le
/// escribe a B, B avisa a A, A le vuelve a escribir a B, y así para siempre.
/// Se corta con una sola regla, aplicada en esta función: **si el valor que
/// llega es el que ya tengo, no se hace nada y no se escribe a nadie**. Como
/// todo cambio pasa por aquí, el segundo rebote del eco siempre encuentra el
/// valor ya igual y se apaga solo.

export type OrigenDelCambio = "sistema" | "highlevel";

export type ResultadoSincronizacion =
  | { cambio: false }
  | {
      cambio: true;
      anteriorId: string | null;
      anterior: string | null;
      nuevoId: string | null;
      nuevo: string | null;
    };

/// Cambia el consolidador de una persona y mantiene los dos lados de acuerdo.
///
/// - `origen: "sistema"` — el cambio nació acá, así que **se escribe a
///   HighLevel** (best-effort: si el CRM no responde, el cambio local queda
///   igual y el error solo se registra).
/// - `origen: "highlevel"` — el cambio ya venía de allá, así que **no se
///   devuelve** nada: sería el eco.
///
/// Devuelve `{ cambio: false }` cuando no había nada que cambiar. Esa es
/// justamente la salida que apaga el eco.
export async function sincronizarConsolidador(
  prisma: ClientePrisma,
  entrada: {
    learnerId: string;
    /// `null` = dejar a la persona sin consolidador.
    nuevoConsolidadorId: string | null;
    origen: OrigenDelCambio;
    actorId: string | null;
    motivo?: string;
  },
): Promise<ResultadoSincronizacion> {
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: entrada.learnerId },
    select: {
      id: true,
      consolidatorId: true,
      consolidator: { select: { id: true, fullName: true } },
    },
  });
  if (!aprendiz) return { cambio: false };

  // La regla que apaga el eco. También evita auditoría y escrituras inútiles
  // cuando el CRM reenvía el mismo dato varias veces.
  if (aprendiz.consolidatorId === entrada.nuevoConsolidadorId) {
    return { cambio: false };
  }

  const nuevo = entrada.nuevoConsolidadorId
    ? await prisma.appUser.findUnique({
        where: { id: entrada.nuevoConsolidadorId },
        select: { id: true, fullName: true, active: true },
      })
    : null;

  // Un consolidador inactivo no se acepta ni viniendo de HighLevel: allá pudo
  // quedar apuntando a alguien que ya no está en el equipo.
  if (entrada.nuevoConsolidadorId && (!nuevo || !nuevo.active)) {
    return { cambio: false };
  }

  await prisma.learnerProfile.update({
    where: { id: aprendiz.id },
    data: { consolidatorId: nuevo?.id ?? null },
  });

  await auditar(prisma, {
    actorId: entrada.actorId,
    action: "consolidador.reasignado",
    entityType: "learner_profile",
    entityId: aprendiz.id,
    metadata: {
      origen: entrada.origen,
      anteriorId: aprendiz.consolidatorId,
      anterior: aprendiz.consolidator?.fullName ?? null,
      nuevoId: nuevo?.id ?? null,
      nuevo: nuevo?.fullName ?? null,
      motivo: entrada.motivo ?? null,
    },
  });

  // Solo se devuelve el cambio al CRM cuando nació acá.
  if (entrada.origen === "sistema") {
    await exportarConsolidador(aprendiz.id).catch((error) => {
      console.error("No se pudo reflejar el consolidador en HighLevel", error);
    });
  }

  return {
    cambio: true,
    anteriorId: aprendiz.consolidatorId,
    anterior: aprendiz.consolidator?.fullName ?? null,
    nuevoId: nuevo?.id ?? null,
    nuevo: nuevo?.fullName ?? null,
  };
}
