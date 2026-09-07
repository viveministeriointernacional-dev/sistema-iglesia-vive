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

/// Los estados por los que pasa una solicitud de baja.
export const ESTADO_SOLICITUD = {
  pendiente: "PENDIENTE",
  autorizada: "AUTORIZADA",
  rechazada: "RECHAZADA",
  retirada: "RETIRADA",
} as const;

export type ResultadoSolicitud =
  | { ok: true; solicitudId: string }
  | { ok: false; mensaje: string };

/// El equipo de consolidación **pide** la baja; no la aplica.
///
/// La persona sigue en el tablero y en la carga de su consolidador hasta que
/// un administrador responda: si dar de baja fuera inmediato, sería una manera
/// de aliviar carga sin que nadie revise el motivo. Lo único que cambia al
/// pedirla es que la tarjeta queda marcada «en espera».
export async function solicitarBaja(
  prisma: ClientePrisma,
  datos: {
    learnerId: string;
    motivo: string;
    nota?: string | null;
    actorId: string;
  },
): Promise<ResultadoSolicitud> {
  const motivo = datos.motivo.trim();
  if (motivo.length < 3) {
    return { ok: false, mensaje: "Escribe el motivo por el que se da de baja." };
  }
  // La nota es lo único que el administrador va a leer para decidir, así que
  // aquí sí es obligatoria (al dar de baja directamente no lo era).
  const nota = datos.nota?.trim() || null;
  if (!nota || nota.length < 10) {
    return {
      ok: false,
      mensaje: "Cuéntale al administrador qué pasó: es lo que va a leer para decidir.",
    };
  }

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: datos.learnerId },
    select: { id: true, status: true, personId: true },
  });
  if (!aprendiz) {
    return { ok: false, mensaje: "No se encontró el proceso de la persona." };
  }
  if (aprendiz.status === LearnerStatus.RETIRADO) {
    return { ok: false, mensaje: "Esta persona ya está dada de baja." };
  }

  const pendiente = await prisma.bajaRequest.findFirst({
    where: { learnerId: aprendiz.id, status: ESTADO_SOLICITUD.pendiente },
    select: { id: true },
  });
  if (pendiente) {
    return {
      ok: false,
      mensaje: "Ya hay una solicitud de baja esperando respuesta para esta persona.",
    };
  }

  const solicitud = await prisma.$transaction(async (tx) => {
    const creada = await tx.bajaRequest.create({
      data: {
        learnerId: aprendiz.id,
        reason: motivo,
        note: nota,
        requestedById: datos.actorId,
        status: ESTADO_SOLICITUD.pendiente,
      },
      select: { id: true },
    });

    await auditar(tx, {
      actorId: datos.actorId,
      action: "operacion72.baja_solicitada",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { motivo, nota, solicitudId: creada.id },
    });

    return creada;
  });

  return { ok: true, solicitudId: solicitud.id };
}

export type ResultadoResolucionBaja =
  | { ok: true; personId: string; autorizada: boolean }
  | { ok: false; mensaje: string };

/// Un administrador responde la solicitud.
///
/// **Autorizada**: se aplica la baja de verdad, con el mismo núcleo que usa
/// Administración. **No autorizada**: la persona se queda donde estaba y la
/// observación viaja a la tarjeta del consolidador — por eso es obligatoria:
/// devolver a alguien sin decir qué hacer con ella deja el trabajo en el aire.
export async function resolverSolicitudDeBaja(
  prisma: ClientePrisma,
  datos: {
    solicitudId: string;
    autoriza: boolean;
    observacion?: string | null;
    actorId: string;
  },
): Promise<ResultadoResolucionBaja> {
  const observacion = datos.observacion?.trim() || null;
  if (!datos.autoriza && (!observacion || observacion.length < 10)) {
    return {
      ok: false,
      mensaje:
        "Escribe qué debe hacer el consolidador con esta persona: es lo que va a ver en la tarjeta.",
    };
  }

  const solicitud = await prisma.bajaRequest.findUnique({
    where: { id: datos.solicitudId },
    select: {
      id: true,
      status: true,
      reason: true,
      note: true,
      learnerId: true,
      learner: { select: { personId: true } },
    },
  });
  if (!solicitud) {
    return { ok: false, mensaje: "No se encontró la solicitud." };
  }
  if (solicitud.status !== ESTADO_SOLICITUD.pendiente) {
    return { ok: false, mensaje: "Esta solicitud ya fue resuelta." };
  }

  if (!datos.autoriza) {
    await prisma.$transaction(async (tx) => {
      await tx.bajaRequest.update({
        where: { id: solicitud.id },
        data: {
          status: ESTADO_SOLICITUD.rechazada,
          resolvedById: datos.actorId,
          resolvedAt: new Date(),
          resolutionNote: observacion,
        },
      });
      await auditar(tx, {
        actorId: datos.actorId,
        action: "operacion72.baja_rechazada",
        entityType: "learner_profile",
        entityId: solicitud.learnerId,
        metadata: {
          solicitudId: solicitud.id,
          motivo: solicitud.reason,
          observacion,
        },
      });
    });
    return { ok: true, personId: solicitud.learner.personId, autorizada: false };
  }

  // La baja de verdad. Se marca la solicitud primero para que, si la baja
  // falla, no quede una solicitud «autorizada» sobre una persona activa.
  const resultado = await darDeBajaAprendiz(prisma, {
    learnerId: solicitud.learnerId,
    motivo: solicitud.reason,
    nota: solicitud.note,
    actorId: datos.actorId,
    accion: "operacion72.dado_de_baja",
  });
  if (!resultado.ok) return resultado;

  await prisma.$transaction(async (tx) => {
    await tx.bajaRequest.update({
      where: { id: solicitud.id },
      data: {
        status: ESTADO_SOLICITUD.autorizada,
        resolvedById: datos.actorId,
        resolvedAt: new Date(),
        resolutionNote: observacion,
      },
    });
    await auditar(tx, {
      actorId: datos.actorId,
      action: "operacion72.baja_autorizada",
      entityType: "learner_profile",
      entityId: solicitud.learnerId,
      metadata: {
        solicitudId: solicitud.id,
        motivo: solicitud.reason,
        observacion,
      },
    });
  });

  return { ok: true, personId: resultado.personId, autorizada: true };
}

/// El consolidador se arrepiente antes de que le respondan.
export async function retirarSolicitudDeBaja(
  prisma: ClientePrisma,
  datos: { solicitudId: string; actorId: string },
): Promise<ResultadoSolicitud> {
  const solicitud = await prisma.bajaRequest.findUnique({
    where: { id: datos.solicitudId },
    select: { id: true, status: true, learnerId: true },
  });
  if (!solicitud) return { ok: false, mensaje: "No se encontró la solicitud." };
  if (solicitud.status !== ESTADO_SOLICITUD.pendiente) {
    return { ok: false, mensaje: "Esta solicitud ya fue resuelta." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.bajaRequest.update({
      where: { id: solicitud.id },
      data: {
        status: ESTADO_SOLICITUD.retirada,
        resolvedById: datos.actorId,
        resolvedAt: new Date(),
      },
    });
    await auditar(tx, {
      actorId: datos.actorId,
      action: "operacion72.baja_retirada",
      entityType: "learner_profile",
      entityId: solicitud.learnerId,
      metadata: { solicitudId: solicitud.id },
    });
  });

  return { ok: true, solicitudId: solicitud.id };
}
