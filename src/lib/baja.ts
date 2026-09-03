import {
  LearnerStatus,
  Operation72Status,
} from "@iglesia/prisma-client";
import { auditar, type AccionAuditada } from "@/lib/audit";
import type { ClientePrisma } from "@/lib/prisma";

export type ResultadoBaja =
  | { ok: true; personId: string }
  | { ok: false; mensaje: string };

/// Da de baja a una persona que no quiere (o no puede) seguir ningún proceso.
///
/// Es la misma operación se pida desde Administración o desde el tablero de
/// Operación 72: la marca como Retirada con un motivo, cierra su mentoría y su
/// Operación 72 abiertas (para que salga de listas y tableros), y desactiva su
/// acceso al sistema si tenía. No se borra nada: el expediente y el historial
/// quedan, y desde Administración se puede reactivar.
export async function darDeBajaAprendiz(
  prisma: ClientePrisma,
  datos: {
    learnerId: string;
    motivo: string;
    nota?: string | null;
    actorId: string;
    accion: AccionAuditada;
  },
): Promise<ResultadoBaja> {
  const motivo = datos.motivo.trim();
  if (motivo.length < 3) {
    return { ok: false, mensaje: "Escribe el motivo por el que se da de baja." };
  }
  const nota = datos.nota?.trim() || null;
  const razon = nota ? `${motivo} · ${nota}` : motivo;

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: datos.learnerId },
    select: {
      id: true,
      status: true,
      personId: true,
      person: { select: { user: { select: { id: true, active: true } } } },
    },
  });
  if (!aprendiz) {
    return { ok: false, mensaje: "No se encontró el proceso de la persona." };
  }
  if (aprendiz.status === LearnerStatus.RETIRADO) {
    return { ok: false, mensaje: "Esta persona ya está dada de baja." };
  }

  const ahora = new Date();
  const cuenta = aprendiz.person.user;
  // No se desactiva a sí mismo: evita quedar fuera por accidente.
  const desactivarAcceso = Boolean(
    cuenta && cuenta.active && cuenta.id !== datos.actorId,
  );

  await prisma.$transaction(async (tx) => {
    await tx.learnerProfile.update({
      where: { id: aprendiz.id },
      data: { status: LearnerStatus.RETIRADO },
    });

    await tx.learnerStatusChange.create({
      data: {
        learnerId: aprendiz.id,
        fromStatus: aprendiz.status,
        toStatus: LearnerStatus.RETIRADO,
        reason: razon,
        decidedById: datos.actorId,
      },
    });

    // Sale de las listas activas: se cierra la mentoría y la Operación 72.
    await tx.mentorRelationship.updateMany({
      where: { learnerId: aprendiz.id, endedAt: null },
      data: { endedAt: ahora, reason: "Dado de baja" },
    });
    await tx.operation72.updateMany({
      where: {
        learnerId: aprendiz.id,
        status: {
          notIn: [Operation72Status.ENTREGADA, Operation72Status.CERRADA],
        },
      },
      data: { status: Operation72Status.CERRADA, detail: `Dado de baja · ${motivo}` },
    });

    if (desactivarAcceso && cuenta) {
      await tx.appUser.update({
        where: { id: cuenta.id },
        data: { active: false },
      });
    }

    await auditar(tx, {
      actorId: datos.actorId,
      action: datos.accion,
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { motivo, nota, accesoDesactivado: desactivarAcceso },
    });
  });

  return { ok: true, personId: aprendiz.personId };
}
