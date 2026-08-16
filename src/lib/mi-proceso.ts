import {
  FaithHouseStatus,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  Phase,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import {
  ETIQUETA_HITO,
  type DatosExpediente,
  type HitoLineaDeTiempo,
} from "@/lib/expediente";

/// Lo que el aprendiz ve de su propio recorrido (§10).
///
/// Deliberadamente no se deriva de `proximoPaso` ni de `calcularAlertas`: esos
/// están redactados para quien acompaña —«asignar mentor», «Operación 72
/// vencida sin entrega»— y son información interna de gestión. §3.1 y §10 son
/// explícitos: el aprendiz no ve evaluación interna. Aquí se dice lo mismo
/// desde su lado, sin exponer cómo va la operación por dentro.
export function miProximoPaso(expediente: DatosExpediente) {
  const op72 = expediente.operation72;
  const enOperacion72 =
    op72 &&
    op72.status !== Operation72Status.ENTREGADA &&
    op72.status !== Operation72Status.CERRADA;

  if (enOperacion72) {
    return {
      titulo: "Alguien del equipo te va a buscar",
      detalle:
        "Estamos organizando tu acompañamiento. Si prefieres otro horario para " +
        "que te llamen, dilo cuando te contacten.",
    };
  }

  const pendientes = expediente.temas.filter(
    (tema) =>
      !expediente.faithHouseProgress.some(
        (avance) =>
          avance.topic.number === tema.number &&
          avance.status === FaithHouseStatus.COMPLETADO,
      ),
  );

  if (expediente.phase === Phase.FORTALECER && pendientes.length > 0) {
    const siguiente = pendientes[0];
    return {
      titulo: `Tema ${siguiente.number} · ${siguiente.name}`,
      detalle: `Te quedan ${pendientes.length} de 12 temas de Casa de Fe. El orden lo acuerdas con tu mentor.`,
    };
  }

  const tieneMentor = expediente.mentorRelationships.some((r) => !r.endedAt);
  if (!tieneMentor) {
    return {
      titulo: "Estamos definiendo quién te acompaña",
      detalle: "Te avisamos apenas tu mentor esté asignado.",
    };
  }

  return {
    titulo: "Sigue en acompañamiento",
    detalle: "Tu mentor te dice cuál es el siguiente paso.",
  };
}

/// La inscripción de Alpha del aprendiz, si la tiene, contada desde su lado:
/// a cuántas sesiones ha ido y cuál es la próxima.
export async function cargarMiAlpha(learnerId: string, ahora = new Date()) {
  const prisma = await getPrisma();

  const inscripcion = await prisma.alphaEnrollment.findFirst({
    where: { learnerId },
    orderBy: { joinedAt: "desc" },
    select: {
      focusDayAt: true,
      validatedAt: true,
      attendance: { select: { present: true, sessionId: true } },
      program: {
        select: {
          name: true,
          leader: { select: { fullName: true } },
          sessions: {
            orderBy: { number: "asc" },
            select: { id: true, number: true, date: true, topic: true },
          },
        },
      },
    },
  });

  if (!inscripcion) return null;

  const realizadas = inscripcion.program.sessions.filter(
    (sesion) => sesion.date.getTime() <= ahora.getTime(),
  );
  const idsRealizadas = new Set(realizadas.map((s) => s.id));
  const presentes = inscripcion.attendance.filter(
    (a) => a.present && idsRealizadas.has(a.sessionId),
  ).length;

  const proxima = inscripcion.program.sessions.find(
    (sesion) => sesion.date.getTime() > ahora.getTime(),
  );

  return {
    grupo: inscripcion.program.name,
    lider: inscripcion.program.leader.fullName,
    presentes,
    realizadas: realizadas.length,
    proxima: proxima
      ? { numero: proxima.number, fecha: proxima.date, tema: proxima.topic }
      : null,
    focusDay: inscripcion.focusDayAt,
    validado: inscripcion.validatedAt,
  };
}

/// La historia contada desde el lado de quien la vivió.
///
/// No es `construirLineaDeTiempo` con menos detalle: es otra redacción. La
/// interna dice «Entregada a Marta Solís · autorizó el pastor» porque describe
/// una operación; aquí eso se lee «Ahora te acompaña Marta Solís». Los intentos
/// de contacto de la Operación 72 no aparecen: son el registro de trabajo del
/// equipo, no un momento del recorrido de la persona.
export function miHistoria(expediente: DatosExpediente): HitoLineaDeTiempo[] {
  const eventos: HitoLineaDeTiempo[] = [
    {
      fecha: expediente.createdAt,
      titulo: "Llegaste a Iglesia Vive",
      detalle: expediente.lineOfOrigin
        ? `Te invitó ${expediente.lineOfOrigin}`
        : null,
      tono: "azul",
    },
  ];

  for (const relacion of expediente.mentorRelationships) {
    if (relacion.endedAt) continue;
    eventos.push({
      fecha: relacion.startedAt,
      titulo: `Ahora te acompaña ${relacion.mentor.fullName}`,
      detalle: null,
      tono: "verde",
    });
  }

  for (const hito of expediente.milestones) {
    if (hito.status !== MilestoneStatus.COMPLETADO || !hito.achievedAt) continue;
    if (hito.kind === MilestoneKind.REGISTRO) continue; // ya está arriba
    eventos.push({
      fecha: hito.achievedAt,
      titulo: `${ETIQUETA_HITO[hito.kind]} completado`,
      detalle: hito.detail,
      tono: "verde",
    });
  }

  for (const avance of expediente.faithHouseProgress) {
    if (avance.status !== FaithHouseStatus.COMPLETADO || !avance.completedAt) continue;
    eventos.push({
      fecha: avance.completedAt,
      titulo: `Tema ${avance.topic.number} · ${avance.topic.name}`,
      detalle: null,
      tono: "verde",
    });
  }

  return eventos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}
