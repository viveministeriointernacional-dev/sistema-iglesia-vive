import { Phase, Role, ServiceStatus } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import type { UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";

/// Asistencia mínima para cerrar la Escuela, sobre las sesiones ya realizadas.
export const ASISTENCIA_MINIMA_ESCUELA = 0.75;

/// Proporción mínima de tareas entregadas, sobre las sesiones realizadas que
/// tenían tarea asignada.
export const TAREAS_MINIMAS = 0.75;

/// Quién administra la Escuela Ser Líder y el servicio.
export const ROLES_ENTRENAR: Role[] = [Role.MENTOR, Role.PASTOR, Role.ADMIN];

export const ETIQUETA_SERVICIO: Record<ServiceStatus, string> = {
  PROPUESTO: "Propuesto",
  ACTIVO: "Sirviendo",
  PAUSADO: "En pausa",
  FINALIZADO: "Finalizado",
};

export function esVistaCompletaDeEscuela(usuario: UsuarioSesion) {
  return usuario.role === Role.PASTOR || usuario.role === Role.ADMIN;
}

export async function cargarEscuelas(usuario: UsuarioSesion) {
  const prisma = await getPrisma();

  return prisma.trainingProgram.findMany({
    where: esVistaCompletaDeEscuela(usuario) ? {} : { leaderId: usuario.id },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      closedAt: true,
      leader: { select: { fullName: true } },
      _count: { select: { sessions: true, enrollments: true } },
    },
  });
}

export async function cargarEscuela(programId: string) {
  const prisma = await getPrisma();

  return prisma.trainingProgram.findUnique({
    where: { id: programId },
    select: {
      id: true,
      name: true,
      startDate: true,
      closedAt: true,
      leaderId: true,
      leader: { select: { fullName: true } },
      sessions: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          date: true,
          kind: true,
          topic: true,
          resource: true,
          task: true,
          attendance: {
            select: {
              enrollmentId: true,
              present: true,
              taskDelivered: true,
              note: true,
            },
          },
        },
      },
      enrollments: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          learnerId: true,
          completedAt: true,
          completionNote: true,
          completedBy: { select: { fullName: true } },
          learner: {
            select: { person: { select: { firstName: true, lastName: true } } },
          },
          attendance: {
            select: { present: true, taskDelivered: true, sessionId: true },
          },
        },
      },
    },
  });
}

export type DatosEscuela = NonNullable<Awaited<ReturnType<typeof cargarEscuela>>>;

export type ParticipanteDeEscuela = {
  enrollmentId: string;
  learnerId: string;
  nombre: string;
  presentes: number;
  sesionesRealizadas: number;
  porcentajeAsistencia: number;
  tareasEntregadas: number;
  tareasPedidas: number;
  porcentajeTareas: number;
  completadoEl: Date | null;
  completadoPor: string | null;
  notaDeCierre: string | null;
  faltaParaCerrar: string[];
  puedeCerrarse: boolean;
};

/// Igual que en Alpha: solo cuentan las sesiones ya realizadas, y las tareas
/// solo sobre las sesiones realizadas que efectivamente pedían una.
export function construirParticipantesDeEscuela(
  escuela: DatosEscuela,
  ahora = new Date(),
): ParticipanteDeEscuela[] {
  const realizadas = escuela.sessions.filter(
    (sesion) => sesion.date.getTime() <= ahora.getTime(),
  );
  const idsRealizadas = new Set(realizadas.map((s) => s.id));
  const idsConTarea = new Set(
    realizadas.filter((s) => s.task?.trim()).map((s) => s.id),
  );

  return escuela.enrollments.map((inscripcion) => {
    const presentes = inscripcion.attendance.filter(
      (a) => a.present && idsRealizadas.has(a.sessionId),
    ).length;
    const entregadas = inscripcion.attendance.filter(
      (a) => a.taskDelivered && idsConTarea.has(a.sessionId),
    ).length;

    const total = realizadas.length;
    const pedidas = idsConTarea.size;
    const proporcionAsistencia = total ? presentes / total : 0;
    const proporcionTareas = pedidas ? entregadas / pedidas : 1;

    const faltaParaCerrar: string[] = [];
    if (!total) {
      faltaParaCerrar.push("todavía no hay sesiones realizadas");
    } else if (proporcionAsistencia < ASISTENCIA_MINIMA_ESCUELA) {
      faltaParaCerrar.push(
        `asistencia ${Math.round(proporcionAsistencia * 100)} % (mínimo ${ASISTENCIA_MINIMA_ESCUELA * 100} %)`,
      );
    }
    if (pedidas && proporcionTareas < TAREAS_MINIMAS) {
      faltaParaCerrar.push(
        `tareas ${entregadas} de ${pedidas} (mínimo ${TAREAS_MINIMAS * 100} %)`,
      );
    }

    return {
      enrollmentId: inscripcion.id,
      learnerId: inscripcion.learnerId,
      nombre: nombreCompleto(inscripcion.learner.person),
      presentes,
      sesionesRealizadas: total,
      porcentajeAsistencia: Math.round(proporcionAsistencia * 100),
      tareasEntregadas: entregadas,
      tareasPedidas: pedidas,
      porcentajeTareas: Math.round(proporcionTareas * 100),
      completadoEl: inscripcion.completedAt,
      completadoPor: inscripcion.completedBy?.fullName ?? null,
      notaDeCierre: inscripcion.completionNote,
      faltaParaCerrar,
      puedeCerrarse: faltaParaCerrar.length === 0 && !inscripcion.completedAt,
    };
  });
}

/// Los servicios de una persona (§7.4), para el expediente y su propio panel.
export async function cargarServicios(learnerId: string) {
  const prisma = await getPrisma();

  return prisma.serviceAssignment.findMany({
    where: { learnerId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      ministry: true,
      status: true,
      startedAt: true,
      endedAt: true,
      notes: true,
      evidence: true,
      responsible: { select: { fullName: true } },
    },
  });
}

/// La Escuela de una persona vista desde su lado, para «Mi proceso» (§7.5).
export async function cargarMiEscuela(learnerId: string, ahora = new Date()) {
  const prisma = await getPrisma();

  const inscripcion = await prisma.trainingEnrollment.findFirst({
    where: { learnerId },
    orderBy: { joinedAt: "desc" },
    select: {
      completedAt: true,
      attendance: { select: { present: true, taskDelivered: true, sessionId: true } },
      program: {
        select: {
          name: true,
          leader: { select: { fullName: true } },
          sessions: {
            orderBy: { number: "asc" },
            select: {
              id: true,
              number: true,
              date: true,
              kind: true,
              topic: true,
              resource: true,
              task: true,
            },
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

  // La más cercana en fecha: la programación puede reordenarse y el número de
  // sesión no garantiza el orden del calendario.
  const proxima = inscripcion.program.sessions
    .filter((sesion) => sesion.date.getTime() > ahora.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  return {
    escuela: inscripcion.program.name,
    lider: inscripcion.program.leader.fullName,
    presentes,
    realizadas: realizadas.length,
    proxima: proxima
      ? {
          numero: proxima.number,
          fecha: proxima.date,
          tema: proxima.topic,
          kind: proxima.kind,
          recurso: proxima.resource,
          tarea: proxima.task,
        }
      : null,
    completado: inscripcion.completedAt,
  };
}

/// Quién puede entrar a la Escuela: personas en Fortalecer o Entrenar. La
/// Escuela forma para liderar, no es un paso de la fase Ganar.
export const FASES_PARA_ESCUELA: Phase[] = [Phase.FORTALECER, Phase.ENTRENAR];

export const SERVICIOS_ACTIVOS: ServiceStatus[] = [
  ServiceStatus.PROPUESTO,
  ServiceStatus.ACTIVO,
  ServiceStatus.PAUSADO,
];
