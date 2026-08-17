"use server";

import { revalidatePath } from "next/cache";
import {
  MilestoneKind,
  MilestoneStatus,
  ServiceStatus,
  TrainingSessionKind,
  type Phase,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import { accesoAExpediente } from "@/lib/expediente";
import { nombreCompleto } from "@/lib/dominio";
import {
  cargarEscuela,
  construirParticipantesDeEscuela,
  esVistaCompletaDeEscuela,
  FASES_PARA_ESCUELA,
  ROLES_ENTRENAR,
} from "@/lib/entrenar";

export type Resultado = { ok: true } | { ok: false; mensaje: string };

async function usuarioDeEntrenar() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!ROLES_ENTRENAR.includes(usuario.role)) throw new ErrorDePermiso();
  return usuario;
}

/// Un líder solo administra sus escuelas; pastor y administración, todas.
async function escuelaPropia(programId: string) {
  const usuario = await usuarioDeEntrenar();
  const prisma = await getPrisma();
  const escuela = await prisma.trainingProgram.findUnique({
    where: { id: programId },
    select: { id: true, leaderId: true, closedAt: true },
  });
  if (!escuela) return { usuario, escuela: null };
  if (!esVistaCompletaDeEscuela(usuario) && escuela.leaderId !== usuario.id) {
    return { usuario, escuela: null };
  }
  return { usuario, escuela };
}

export async function crearEscuela(nombre: string, inicio: string): Promise<Resultado> {
  const usuario = await usuarioDeEntrenar();

  if (nombre.trim().length < 3) {
    return { ok: false, mensaje: "Ponle un nombre a la escuela." };
  }
  if (Number.isNaN(Date.parse(inicio))) {
    return { ok: false, mensaje: "La fecha de inicio no es válida." };
  }

  const prisma = await getPrisma();
  await prisma.trainingProgram.create({
    data: {
      name: nombre.trim(),
      startDate: new Date(inicio),
      leaderId: usuario.id,
      teamId: usuario.teamId,
    },
  });

  revalidatePath("/escuela");
  return { ok: true };
}

export async function crearSesion(
  programId: string,
  numero: number,
  fecha: string,
  tema: string,
  kind: TrainingSessionKind,
  recurso: string,
  tarea: string,
): Promise<Resultado> {
  const { escuela } = await escuelaPropia(programId);
  if (!escuela) return { ok: false, mensaje: "Esa escuela no existe." };
  if (escuela.closedAt) return { ok: false, mensaje: "La escuela está cerrada." };

  if (Number.isNaN(Date.parse(fecha))) {
    return { ok: false, mensaje: "La fecha de la sesión no es válida." };
  }
  if (tema.trim().length < 3) {
    return { ok: false, mensaje: "Escribe el tema de la sesión." };
  }

  const prisma = await getPrisma();
  const repetida = await prisma.trainingSession.findUnique({
    where: { programId_number: { programId, number: numero } },
    select: { id: true },
  });
  if (repetida) return { ok: false, mensaje: `Ya existe la sesión ${numero}.` };

  await prisma.trainingSession.create({
    data: {
      programId,
      number: numero,
      date: new Date(fecha),
      kind,
      topic: tema.trim(),
      resource: recurso.trim() || null,
      task: tarea.trim() || null,
    },
  });

  revalidatePath(`/escuela/${programId}`);
  return { ok: true };
}

export type CandidatoEscuela = { learnerId: string; nombre: string; fase: Phase };

export async function buscarParaEscuela(
  programId: string,
  consulta: string,
): Promise<CandidatoEscuela[]> {
  const { escuela } = await escuelaPropia(programId);
  if (!escuela) return [];

  const prisma = await getPrisma();
  const texto = consulta.trim();

  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      phase: { in: FASES_PARA_ESCUELA },
      trainingEnrollments: { none: { programId } },
      ...(texto
        ? {
            person: {
              OR: [
                { firstName: { contains: texto, mode: "insensitive" } },
                { lastName: { contains: texto, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      phase: true,
      person: { select: { firstName: true, lastName: true } },
    },
  });

  return aprendices.map((aprendiz) => ({
    learnerId: aprendiz.id,
    nombre: nombreCompleto(aprendiz.person),
    fase: aprendiz.phase,
  }));
}

/// Entrar a la Escuela deja el hito `ENTRADA_ESCUELA`: es un paso del recorrido
/// que se puede ver desde el expediente, no solo un registro interno.
export async function inscribirEnEscuela(
  programId: string,
  learnerId: string,
): Promise<Resultado> {
  const { usuario, escuela } = await escuelaPropia(programId);
  if (!escuela) return { ok: false, mensaje: "Esa escuela no existe." };
  if (escuela.closedAt) return { ok: false, mensaje: "La escuela está cerrada." };

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { phase: true },
  });
  if (!aprendiz) return { ok: false, mensaje: "Esa persona no existe." };
  if (!FASES_PARA_ESCUELA.includes(aprendiz.phase)) {
    return {
      ok: false,
      mensaje: "La Escuela es para personas en Fortalecer o Entrenar.",
    };
  }

  const yaInscrita = await prisma.trainingEnrollment.findUnique({
    where: { programId_learnerId: { programId, learnerId } },
    select: { id: true },
  });
  if (yaInscrita) return { ok: false, mensaje: "Ya está inscrita en esta escuela." };

  const hitoPrevio = await prisma.milestone.findUnique({
    where: { learnerId_kind: { learnerId, kind: MilestoneKind.ENTRADA_ESCUELA } },
    select: { status: true },
  });
  // Entrar a una segunda escuela no borra que ya completó la primera.
  const yaLaCompleto = hitoPrevio?.status === MilestoneStatus.COMPLETADO;

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.trainingEnrollment.create({ data: { programId, learnerId } });

    if (!yaLaCompleto) {
      await tx.milestone.upsert({
        where: {
          learnerId_kind: { learnerId, kind: MilestoneKind.ENTRADA_ESCUELA },
        },
        create: {
          learnerId,
          kind: MilestoneKind.ENTRADA_ESCUELA,
          status: MilestoneStatus.EN_CURSO,
          achievedAt: ahora,
          recordedById: usuario.id,
        },
        update: {
          status: MilestoneStatus.EN_CURSO,
          recordedById: usuario.id,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "escuela.inscripcion",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { programId },
    });
  });

  revalidatePath(`/escuela/${programId}`);
  revalidatePath(`/expediente/${learnerId}`);
  return { ok: true };
}

export async function registrarAsistenciaEscuela(
  programId: string,
  sessionId: string,
  enrollmentId: string,
  presente: boolean,
  tareaEntregada: boolean,
): Promise<Resultado> {
  const { usuario, escuela } = await escuelaPropia(programId);
  if (!escuela) return { ok: false, mensaje: "Esa escuela no existe." };

  const prisma = await getPrisma();

  // La sesión y la inscripción tienen que ser de esta escuela: el identificador
  // llega del navegador y no se toma por bueno.
  const [sesion, inscripcion] = await Promise.all([
    prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { programId: true },
    }),
    prisma.trainingEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { programId: true },
    }),
  ]);

  if (sesion?.programId !== programId || inscripcion?.programId !== programId) {
    return { ok: false, mensaje: "Esa sesión no pertenece a esta escuela." };
  }

  await prisma.trainingAttendance.upsert({
    where: { sessionId_enrollmentId: { sessionId, enrollmentId } },
    create: {
      sessionId,
      enrollmentId,
      present: presente,
      taskDelivered: tareaEntregada,
      recordedById: usuario.id,
    },
    update: {
      present: presente,
      taskDelivered: tareaEntregada,
      recordedById: usuario.id,
    },
  });

  revalidatePath(`/escuela/${programId}`);
  return { ok: true };
}

/// Cierra la Escuela para una persona. Como en Alpha, las condiciones se
/// vuelven a comprobar aquí: el botón habilitado es comodidad, no permiso.
export async function cerrarEscuela(
  programId: string,
  enrollmentId: string,
  nota: string,
): Promise<Resultado> {
  const { usuario, escuela } = await escuelaPropia(programId);
  if (!escuela) return { ok: false, mensaje: "Esa escuela no existe." };

  const datos = await cargarEscuela(programId);
  if (!datos) return { ok: false, mensaje: "Esa escuela no existe." };

  const participante = construirParticipantesDeEscuela(datos).find(
    (p) => p.enrollmentId === enrollmentId,
  );
  if (!participante) return { ok: false, mensaje: "Esa inscripción no existe." };
  if (participante.completadoEl) return { ok: false, mensaje: "Ya está cerrada." };
  if (!participante.puedeCerrarse) {
    return {
      ok: false,
      mensaje: `Todavía falta: ${participante.faltaParaCerrar.join(" y ")}.`,
    };
  }

  const ahora = new Date();
  const detalle = `Asistencia ${participante.porcentajeAsistencia} % · tareas ${participante.tareasEntregadas} de ${participante.tareasPedidas}`;
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.trainingEnrollment.update({
      where: { id: enrollmentId },
      data: {
        completedAt: ahora,
        completedById: usuario.id,
        completionNote: nota.trim() || null,
      },
    });

    await tx.milestone.upsert({
      where: {
        learnerId_kind: {
          learnerId: participante.learnerId,
          kind: MilestoneKind.ENTRADA_ESCUELA,
        },
      },
      create: {
        learnerId: participante.learnerId,
        kind: MilestoneKind.ENTRADA_ESCUELA,
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        detail: detalle,
        recordedById: usuario.id,
      },
      update: {
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        detail: detalle,
        recordedById: usuario.id,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "escuela.cerrada",
      entityType: "learner_profile",
      entityId: participante.learnerId,
      metadata: {
        programId,
        asistencia: participante.porcentajeAsistencia,
        tareas: participante.tareasEntregadas,
      },
    });

    // La fase no se mueve: pasar a Multiplicar es decisión pastoral (§20).
    await encolarEventoIntegracion(tx, "escuela_completada", {
      learnerId: participante.learnerId,
      asistencia: participante.porcentajeAsistencia,
    });
  });

  revalidatePath(`/escuela/${programId}`);
  revalidatePath(`/expediente/${participante.learnerId}`);
  return { ok: true };
}

// ------------------------------------------------------------------ Servicio

export async function registrarServicio(
  learnerId: string,
  datos: {
    ministerio: string;
    inicio: string;
    estado: ServiceStatus;
    observaciones: string;
    evidencia: string;
  },
): Promise<Resultado> {
  const usuario = await usuarioDeEntrenar();

  // El rol no basta: hay que acompañar a esa persona. Si no, cualquier mentor
  // podría escribir servicio —y cerrar el hito— en el expediente de otro.
  const acceso = await accesoAExpediente(usuario, learnerId);
  if (!acceso.puedeEscribir) throw new ErrorDePermiso();

  if (datos.ministerio.trim().length < 2) {
    return { ok: false, mensaje: "Escribe el ministerio." };
  }
  if (Number.isNaN(Date.parse(datos.inicio))) {
    return { ok: false, mensaje: "La fecha de inicio no es válida." };
  }

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { id: true },
  });
  if (!aprendiz) return { ok: false, mensaje: "Esa persona no existe." };

  const empieza = new Date(datos.inicio);

  await prisma.$transaction(async (tx) => {
    await tx.serviceAssignment.create({
      data: {
        learnerId,
        ministry: datos.ministerio.trim(),
        status: datos.estado,
        startedAt: empieza,
        endedAt: datos.estado === ServiceStatus.FINALIZADO ? new Date() : null,
        responsibleId: usuario.id,
        notes: datos.observaciones.trim() || null,
        evidence: datos.evidencia.trim() || null,
        registeredById: usuario.id,
      },
    });

    // Servir cierra el hito, aunque se registre en pasado ya finalizado. Lo
    // que no lo cierra es una propuesta: todavía no ha servido.
    if (
      datos.estado === ServiceStatus.ACTIVO ||
      datos.estado === ServiceStatus.FINALIZADO
    ) {
      await tx.milestone.upsert({
        where: { learnerId_kind: { learnerId, kind: MilestoneKind.SERVICIO } },
        create: {
          learnerId,
          kind: MilestoneKind.SERVICIO,
          status: MilestoneStatus.COMPLETADO,
          achievedAt: empieza,
          detail: datos.ministerio.trim(),
          recordedById: usuario.id,
        },
        update: {
          status: MilestoneStatus.COMPLETADO,
          achievedAt: empieza,
          detail: datos.ministerio.trim(),
          recordedById: usuario.id,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "servicio.registrado",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { ministerio: datos.ministerio.trim(), estado: datos.estado },
    });
  });

  revalidatePath(`/expediente/${learnerId}`);
  return { ok: true };
}

export async function cambiarEstadoDeServicio(
  serviceId: string,
  estado: ServiceStatus,
): Promise<Resultado> {
  const usuario = await usuarioDeEntrenar();
  const prisma = await getPrisma();

  const servicio = await prisma.serviceAssignment.findUnique({
    where: { id: serviceId },
    select: {
      learnerId: true,
      ministry: true,
      startedAt: true,
      endedAt: true,
      status: true,
    },
  });
  if (!servicio) return { ok: false, mensaje: "Ese servicio no existe." };

  const acceso = await accesoAExpediente(usuario, servicio.learnerId);
  if (!acceso.puedeEscribir) throw new ErrorDePermiso();

  await prisma.$transaction(async (tx) => {
    await tx.serviceAssignment.update({
      where: { id: serviceId },
      data: {
        status: estado,
        // La fecha de cierre se escribe una sola vez, al finalizar, y se borra
        // solo si el servicio se reactiva: no se recalcula en cada clic.
        endedAt:
          estado === ServiceStatus.FINALIZADO
            ? (servicio.endedAt ?? new Date())
            : null,
      },
    });

    if (estado === ServiceStatus.ACTIVO) {
      await tx.milestone.upsert({
        where: {
          learnerId_kind: {
            learnerId: servicio.learnerId,
            kind: MilestoneKind.SERVICIO,
          },
        },
        create: {
          learnerId: servicio.learnerId,
          kind: MilestoneKind.SERVICIO,
          status: MilestoneStatus.COMPLETADO,
          achievedAt: servicio.startedAt,
          detail: servicio.ministry,
          recordedById: usuario.id,
        },
        update: {
          status: MilestoneStatus.COMPLETADO,
          achievedAt: servicio.startedAt,
          detail: servicio.ministry,
          recordedById: usuario.id,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "servicio.estado_cambiado",
      entityType: "learner_profile",
      entityId: servicio.learnerId,
      metadata: { serviceId, estado },
    });
  });

  revalidatePath(`/expediente/${servicio.learnerId}`);
  return { ok: true };
}
