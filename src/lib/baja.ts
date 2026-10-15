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


// ---------------------------------------------------------------------------
// Volver al tablero después de una baja
// ---------------------------------------------------------------------------

/// ⚠️ **Reactivar NO devuelve la Operación 72, y eso dejaba un agujero.**
/// Dar de baja cierra la Op72 (arriba, `CERRADA`), y `reactivar` solo toca el
/// estado de la persona y su acceso: quedaba **viva pero sin tarjeta**, así que
/// nadie la volvía a llamar ni le agendaba visita. Medido el 15-oct-2026: **206
/// personas dadas de baja, las 206 en fase GANAR y con su Op72 cerrada** — o
/// sea que no es un caso raro, es el caso.
///
/// ⚠️ **Casa de Fe y asignar mentor NO necesitan esto**: sus pantallas solo
/// exigen que la persona esté `ACTIVO`, así que en cuanto se la reactiva ya se
/// la puede inscribir o asignarle mentor. Lo único que faltaba era el tablero.
export async function devolverAlTableroOp72(
  prisma: ClientePrisma,
  datos: {
    learnerId: string;
    destino: Operation72Status;
    nota: string;
    actorId: string;
    /// Solo cuando el destino es VISITA PENDIENTE.
    visita?: { cuando: Date; lugar: string | null; virtual: boolean } | null;
  },
): Promise<ResultadoBaja> {
  const nota = datos.nota.trim();
  if (nota.length < 10) {
    return {
      ok: false,
      mensaje: "Escribe por qué vuelve al proceso (mínimo 10 caracteres).",
    };
  }

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: datos.learnerId },
    select: {
      id: true,
      status: true,
      phase: true,
      personId: true,
      operation72: { select: { id: true, status: true } },
    },
  });
  if (!aprendiz) {
    return { ok: false, mensaje: "No se encontró el proceso de la persona." };
  }

  // ⚠️ **Primero hay que reactivarla.** Devolver al tablero a alguien que
  // sigue de baja la pondría a la vista del equipo de consolidación —que la
  // llamaría— mientras su expediente dice que está retirada y su acceso
  // apagado. Son dos decisiones distintas y se toman en ese orden.
  if (aprendiz.status !== LearnerStatus.ACTIVO) {
    return {
      ok: false,
      mensaje:
        "Primero reactívala: una persona dada de baja no puede estar en el tablero.",
    };
  }

  // El tablero es de consolidación. De FORTALECER en adelante la acompaña su
  // mentor, así que devolverla aquí sería sacarla de su línea.
  if (aprendiz.phase !== "GANAR") {
    return {
      ok: false,
      mensaje:
        "Solo vuelve al tablero quien está en Ganar: de Fortalecer en adelante la acompaña su mentor.",
    };
  }

  if (!aprendiz.operation72) {
    return {
      ok: false,
      mensaje: "Esta persona no tiene Operación 72 que reabrir.",
    };
  }

  // Si ya está en el tablero no hay nada que reabrir — y para moverla de
  // columna ya existe «Se equivocaron de persona», en el propio tablero.
  const enElTablero: Operation72Status[] = [
    Operation72Status.INICIADA,
    Operation72Status.SEGUIMIENTO,
    Operation72Status.CONTACTADA,
    Operation72Status.VISITA_PENDIENTE,
    Operation72Status.LISTA_PARA_ENTREGA,
  ];
  if (enElTablero.includes(aprendiz.operation72.status)) {
    return {
      ok: false,
      mensaje: "Esta persona ya está en el tablero de Operación 72.",
    };
  }

  if (datos.destino === Operation72Status.VISITA_PENDIENTE && !datos.visita) {
    return {
      ok: false,
      mensaje: "Para dejarla en Visita pendiente hace falta la fecha y el lugar.",
    };
  }

  const ahora = new Date();
  const operacionId = aprendiz.operation72.id;

  await prisma.$transaction(async (tx) => {
    await tx.operation72.update({
      where: { id: operacionId },
      data: {
        status: datos.destino,
        startedAt: ahora,
        // ⚠️ **El plazo se reinicia** (decisión del usuario, 15-oct). El viejo
        // venció hace semanas o meses: conservarlo la haría nacer en rojo, sin
        // que nadie haya tenido oportunidad de atenderla. Lo que se mide es la
        // respuesta del equipo desde que vuelve, no desde su registro original.
        deadlineAt: new Date(ahora.getTime() + 72 * 60 * 60 * 1000),
        deliveredAt: null,
        // Lo que traía de la entrega anterior se descarta: era de otro momento.
        proposedMentorId: null,
        proposedMentorNote: null,
        detail: `Vuelve al proceso tras la baja · ${nota}`,
      },
    });

    // ⚠️ **No se inventa ninguna llamada.** Solo cuando el destino es Visita
    // pendiente se crea un registro, porque esa columna se ORDENA por la fecha
    // de la visita: sin ella la tarjeta caería al final sin decir cuándo es
    // (la regla del 12-sep).
    if (datos.visita) {
      await tx.contactAttempt.create({
        data: {
          operation72Id: operacionId,
          type: "VISITA",
          result: "Visita agendada",
          note: nota,
          scheduledAt: datos.visita.cuando,
          place: datos.visita.virtual ? null : datos.visita.lugar,
          isVirtual: datos.visita.virtual,
          byUserId: datos.actorId,
        },
      });
    }

    await auditar(tx, {
      actorId: datos.actorId,
      action: "operacion72.regresa_tras_baja",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { destino: datos.destino, nota, conVisita: Boolean(datos.visita) },
    });
  });

  return { ok: true, personId: aprendiz.personId };
}
