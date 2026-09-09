import { LearnerStatus, Operation72Status, Phase } from "@iglesia/prisma-client";
import { auditar } from "@/lib/audit";
import type { ClientePrisma } from "@/lib/prisma";

/// Asistentes de la iglesia: vienen, pero hoy no quieren entrar a un proceso.
///
/// Es el tercer desenlace de la Operación 72, al lado de «entregar a mentor» y
/// «dar de baja». **No es una baja**, y la diferencia importa: la baja apaga el
/// acceso de la persona y necesita que un administrador la autorice, porque
/// saca a alguien del sistema. Aquí no se saca a nadie — solo se reconoce que
/// hoy no quiere proceso — así que conserva expediente, acceso y todo lo que
/// alcanzó, y quien la atiende la marca sin pedir permiso.
///
/// Lo que sí cambia: sale del tablero y deja de contarle carga a su
/// consolidador. Si siguiera contando, el equipo cargaría para siempre con
/// gente a la que ya no hay que llamar.

export type ResultadoAsistente =
  | { ok: true; personId: string }
  | { ok: false; mensaje: string };

/// La marca como asistente y la saca del tablero.
export async function marcarComoAsistente(
  prisma: ClientePrisma,
  datos: {
    learnerId: string;
    motivo: string;
    nota?: string | null;
    actorId: string;
  },
): Promise<ResultadoAsistente> {
  const motivo = datos.motivo.trim();
  if (motivo.length < 3) {
    return { ok: false, mensaje: "Escoge por qué no quiere entrar a un proceso." };
  }
  // La nota es lo único que va a leer quien la busque dentro de un año: sin
  // ella el listado se vuelve una lista de nombres que nadie sabe interpretar.
  const nota = datos.nota?.trim() || null;
  if (!nota || nota.length < 10) {
    return {
      ok: false,
      mensaje: "Cuenta con tus palabras qué te dijo: es lo que va a leer quien la busque después.",
    };
  }

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: datos.learnerId },
    select: { id: true, status: true, personId: true },
  });
  if (!aprendiz) {
    return { ok: false, mensaje: "No se encontró el proceso de la persona." };
  }
  if (aprendiz.status === LearnerStatus.ASISTENTE) {
    return { ok: false, mensaje: "Esta persona ya está marcada como asistente." };
  }
  if (aprendiz.status === LearnerStatus.RETIRADO) {
    return {
      ok: false,
      mensaje: "Esta persona está dada de baja. Reactívala primero desde Administración.",
    };
  }

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.learnerProfile.update({
      where: { id: aprendiz.id },
      data: {
        status: LearnerStatus.ASISTENTE,
        attendeeSince: ahora,
        attendeeReason: motivo,
        attendeeNote: nota,
      },
    });

    await tx.learnerStatusChange.create({
      data: {
        learnerId: aprendiz.id,
        fromStatus: aprendiz.status,
        toStatus: LearnerStatus.ASISTENTE,
        reason: `${motivo} · ${nota}`,
        decidedById: datos.actorId,
      },
    });

    // Sale del tablero y de la carga del consolidador. La mentoría **no** se
    // cierra a propósito: si alguien ya la acompañaba, ese vínculo es lo único
    // que la mantiene cerca, y es justo lo que no hay que romper.
    await tx.operation72.updateMany({
      where: {
        learnerId: aprendiz.id,
        status: {
          notIn: [Operation72Status.ENTREGADA, Operation72Status.CERRADA],
        },
      },
      data: {
        status: Operation72Status.CERRADA,
        detail: `Asiste, no quiere proceso · ${motivo}`,
      },
    });

    await auditar(tx, {
      actorId: datos.actorId,
      action: "operacion72.marcado_asistente",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { motivo, nota },
    });
  });

  return { ok: true, personId: aprendiz.personId };
}

/// La devuelve al proceso: vuelve a ser ACTIVO y, si está en GANAR, vuelve al
/// tablero con 72 horas nuevas.
///
/// El plazo se cuenta desde hoy, no desde su registro original: lo que hay que
/// medir es la respuesta del equipo a partir del momento en que la persona
/// dijo que sí, no un plazo que venció hace meses.
export async function devolverAProceso(
  prisma: ClientePrisma,
  datos: { learnerId: string; nota?: string | null; actorId: string },
): Promise<ResultadoAsistente> {
  const nota = datos.nota?.trim() || null;

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: datos.learnerId },
    select: {
      id: true,
      status: true,
      personId: true,
      phase: true,
      operation72: { select: { id: true, status: true } },
    },
  });
  if (!aprendiz) {
    return { ok: false, mensaje: "No se encontró el proceso de la persona." };
  }
  if (aprendiz.status !== LearnerStatus.ASISTENTE) {
    return { ok: false, mensaje: "Esta persona no está marcada como asistente." };
  }

  const ahora = new Date();
  // Solo vuelve al tablero quien está en GANAR: de FORTALECER en adelante la
  // acompaña su mentor, y el tablero es de consolidación.
  const vuelveAlTablero =
    aprendiz.phase === Phase.GANAR && Boolean(aprendiz.operation72);

  await prisma.$transaction(async (tx) => {
    await tx.learnerProfile.update({
      where: { id: aprendiz.id },
      data: {
        status: LearnerStatus.ACTIVO,
        attendeeSince: null,
        attendeeReason: null,
        attendeeNote: null,
      },
    });

    await tx.learnerStatusChange.create({
      data: {
        learnerId: aprendiz.id,
        fromStatus: LearnerStatus.ASISTENTE,
        toStatus: LearnerStatus.ACTIVO,
        reason: nota ?? "Vuelve al proceso",
        decidedById: datos.actorId,
      },
    });

    if (vuelveAlTablero) {
      await tx.operation72.update({
        where: { learnerId: aprendiz.id },
        data: {
          status: Operation72Status.INICIADA,
          startedAt: ahora,
          deadlineAt: new Date(ahora.getTime() + 72 * 60 * 60 * 1000),
          deliveredAt: null,
          detail: "Vuelve al proceso · llamar de nuevo",
        },
      });
    }

    await auditar(tx, {
      actorId: datos.actorId,
      action: "operacion72.vuelve_a_proceso",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { nota, vuelveAlTablero },
    });
  });

  return { ok: true, personId: aprendiz.personId };
}
