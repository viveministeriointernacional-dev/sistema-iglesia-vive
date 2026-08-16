"use server";

import { revalidatePath } from "next/cache";
import { MilestoneKind, MilestoneStatus, Phase } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import {
  cargarGrupo,
  construirParticipantes,
  esVistaCompletaDeAlpha,
  puedeAdministrarAlpha,
  SESIONES_DE_ALPHA,
} from "@/lib/alpha";

export type Resultado = { ok: true } | { ok: false; mensaje: string };

async function usuarioDeAlpha() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeAdministrarAlpha(usuario)) throw new ErrorDePermiso();
  return usuario;
}

/// Un líder solo administra sus grupos; pastor y administración, todos.
async function grupoPropio(programId: string) {
  const usuario = await usuarioDeAlpha();
  const prisma = await getPrisma();
  const grupo = await prisma.alphaProgram.findUnique({
    where: { id: programId },
    select: { id: true, leaderId: true, closedAt: true },
  });
  if (!grupo) return { usuario, grupo: null };
  if (!esVistaCompletaDeAlpha(usuario) && grupo.leaderId !== usuario.id) {
    return { usuario, grupo: null };
  }
  return { usuario, grupo };
}

export async function crearGrupo(nombre: string, inicio: string): Promise<Resultado> {
  const usuario = await usuarioDeAlpha();

  if (nombre.trim().length < 3) {
    return { ok: false, mensaje: "Ponle un nombre al grupo." };
  }
  if (Number.isNaN(Date.parse(inicio))) {
    return { ok: false, mensaje: "La fecha de inicio no es válida." };
  }

  const prisma = await getPrisma();
  await prisma.alphaProgram.create({
    data: {
      name: nombre.trim(),
      startDate: new Date(inicio),
      leaderId: usuario.id,
      teamId: usuario.teamId,
    },
  });

  revalidatePath("/alpha");
  return { ok: true };
}

export async function crearSesion(
  programId: string,
  numero: number,
  fecha: string,
  tema: string,
): Promise<Resultado> {
  const { grupo } = await grupoPropio(programId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };
  if (grupo.closedAt) return { ok: false, mensaje: "El grupo ya está cerrado." };

  if (numero < 1 || numero > SESIONES_DE_ALPHA) {
    return { ok: false, mensaje: `Alpha tiene ${SESIONES_DE_ALPHA} sesiones.` };
  }
  if (Number.isNaN(Date.parse(fecha))) {
    return { ok: false, mensaje: "La fecha no es válida." };
  }
  if (!tema.trim()) return { ok: false, mensaje: "Escribe el tema de la sesión." };

  const prisma = await getPrisma();
  const existente = await prisma.alphaSession.findUnique({
    where: { programId_number: { programId, number: numero } },
    select: { id: true },
  });
  if (existente) {
    return { ok: false, mensaje: `La sesión ${numero} ya está creada.` };
  }

  await prisma.alphaSession.create({
    data: { programId, number: numero, date: new Date(fecha), topic: tema.trim() },
  });

  revalidatePath(`/alpha/${programId}`);
  return { ok: true };
}

export async function inscribir(
  programId: string,
  learnerId: string,
): Promise<Resultado> {
  const { grupo } = await grupoPropio(programId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { id: true },
  });
  if (!aprendiz) return { ok: false, mensaje: "Esa persona no existe." };

  const yaEsta = await prisma.alphaEnrollment.findUnique({
    where: { programId_learnerId: { programId, learnerId } },
    select: { id: true },
  });
  if (yaEsta) return { ok: false, mensaje: "Ya está en el grupo." };

  await prisma.alphaEnrollment.create({ data: { programId, learnerId } });

  revalidatePath(`/alpha/${programId}`);
  return { ok: true };
}

/// Asistencia de una persona en una sesión, con su observación privada.
export async function registrarAsistencia(
  programId: string,
  sessionId: string,
  enrollmentId: string,
  present: boolean,
  nota: string,
): Promise<Resultado> {
  const { usuario, grupo } = await grupoPropio(programId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const prisma = await getPrisma();
  const datos = {
    present,
    note: nota.trim() || null,
    recordedById: usuario.id,
  };

  await prisma.alphaAttendance.upsert({
    where: { sessionId_enrollmentId: { sessionId, enrollmentId } },
    create: { sessionId, enrollmentId, ...datos },
    update: datos,
  });

  revalidatePath(`/alpha/${programId}`);
  return { ok: true };
}

export async function marcarFocusDay(
  programId: string,
  enrollmentId: string,
  completado: boolean,
): Promise<Resultado> {
  const { usuario, grupo } = await grupoPropio(programId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const prisma = await getPrisma();
  const inscripcion = await prisma.alphaEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { learnerId: true },
  });
  if (!inscripcion) return { ok: false, mensaje: "Esa inscripción no existe." };

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.alphaEnrollment.update({
      where: { id: enrollmentId },
      data: { focusDayAt: completado ? ahora : null },
    });

    if (completado) {
      await tx.milestone.upsert({
        where: {
          learnerId_kind: {
            learnerId: inscripcion.learnerId,
            kind: MilestoneKind.FOCUS_DAY,
          },
        },
        create: {
          learnerId: inscripcion.learnerId,
          kind: MilestoneKind.FOCUS_DAY,
          status: MilestoneStatus.COMPLETADO,
          achievedAt: ahora,
          recordedById: usuario.id,
        },
        update: {
          status: MilestoneStatus.COMPLETADO,
          achievedAt: ahora,
          recordedById: usuario.id,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "alpha.focus_day",
      entityType: "alpha_enrollment",
      entityId: enrollmentId,
      metadata: { completado },
    });
  });

  revalidatePath(`/alpha/${programId}`);
  revalidatePath(`/expediente/${inscripcion.learnerId}`);
  return { ok: true };
}

/// Validación final del líder. Comprueba de nuevo las condiciones en servidor:
/// la pantalla puede estar desactualizada, y esto no puede pasar por accidente.
///
/// Marca el hito de Alpha. **No cambia la fase**: esa transición necesita la
/// regla de aprobación pastoral, que todavía no está definida (§20).
export async function validarAlpha(
  programId: string,
  enrollmentId: string,
  nota: string,
): Promise<Resultado> {
  const { usuario, grupo } = await grupoPropio(programId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const datosDelGrupo = await cargarGrupo(programId);
  if (!datosDelGrupo) return { ok: false, mensaje: "Este grupo no existe." };

  const participante = construirParticipantes(datosDelGrupo).find(
    (p) => p.enrollmentId === enrollmentId,
  );
  if (!participante) return { ok: false, mensaje: "Esa inscripción no existe." };

  if (participante.validadoEl) {
    return { ok: false, mensaje: "Ya está validada." };
  }
  if (!participante.puedeValidarse) {
    return {
      ok: false,
      mensaje: `Todavía falta: ${participante.faltaParaValidar.join(" y ")}.`,
    };
  }

  const ahora = new Date();
  // Quién validó ya queda en `recordedBy` del hito: no se repite en el detalle.
  const detalle = `Asistencia ${participante.porcentaje} %`;
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.alphaEnrollment.update({
      where: { id: enrollmentId },
      data: {
        validatedAt: ahora,
        validatedById: usuario.id,
        validationNote: nota.trim() || null,
      },
    });

    await tx.milestone.upsert({
      where: {
        learnerId_kind: {
          learnerId: participante.learnerId,
          kind: MilestoneKind.ALPHA,
        },
      },
      create: {
        learnerId: participante.learnerId,
        kind: MilestoneKind.ALPHA,
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
      action: "alpha.validado",
      entityType: "learner_profile",
      entityId: participante.learnerId,
      metadata: {
        programId,
        asistencia: participante.porcentaje,
        focusDay: true,
      },
    });

    await encolarEventoIntegracion(tx, "alpha_aprobado", {
      learnerId: participante.learnerId,
      asistencia: participante.porcentaje,
    });
  });

  revalidatePath(`/alpha/${programId}`);
  revalidatePath(`/expediente/${participante.learnerId}`);
  return { ok: true };
}

export type CandidatoAlpha = { learnerId: string; nombre: string };

/// Personas en Ganar que todavía no están en este grupo.
export async function buscarCandidatos(
  programId: string,
  consulta: string,
): Promise<CandidatoAlpha[]> {
  const { grupo } = await grupoPropio(programId);
  if (!grupo) return [];

  const texto = consulta.trim();
  const prisma = await getPrisma();

  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      phase: Phase.GANAR,
      alphaEnrollments: { none: { programId } },
      ...(texto.length >= 2
        ? {
            person: {
              OR: [
                { firstName: { contains: texto, mode: "insensitive" as const } },
                { lastName: { contains: texto, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      person: { select: { firstName: true, lastName: true } },
    },
  });

  return aprendices.map((aprendiz) => ({
    learnerId: aprendiz.id,
    nombre: `${aprendiz.person.firstName} ${aprendiz.person.lastName}`.trim(),
  }));
}
