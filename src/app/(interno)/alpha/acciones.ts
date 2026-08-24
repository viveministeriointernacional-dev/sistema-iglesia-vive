"use server";

import { revalidatePath } from "next/cache";
import {
  EntryPoint,
  LearnerStatus,
  MilestoneKind,
  MilestoneStatus,
  Phase,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { colaDeTelefono, nombreCompleto } from "@/lib/dominio";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import {
  cargarGrupo,
  construirParticipantes,
  puedeAdministrarGrupo,
  puedeCrearAlpha,
  puedeVerAlpha,
  SESIONES_DE_ALPHA,
} from "@/lib/alpha";

export type Resultado = { ok: true } | { ok: false; mensaje: string };

async function usuarioDeAlpha() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeVerAlpha(usuario)) throw new ErrorDePermiso();
  return usuario;
}

/// Abrir y cerrar grupos es de dirección; llevarlos, de quien tiene el permiso.
async function usuarioQueAbreGrupos() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeCrearAlpha(usuario)) throw new ErrorDePermiso();
  return usuario;
}

/// El grupo que esta persona puede administrar: el que lleva, o cualquiera si
/// es de dirección.
async function grupoPropio(programId: string) {
  const usuario = await usuarioDeAlpha();
  const prisma = await getPrisma();
  const grupo = await prisma.alphaProgram.findUnique({
    where: { id: programId },
    select: { id: true, leaderId: true, closedAt: true },
  });
  if (!grupo) return { usuario, grupo: null };
  if (!puedeAdministrarGrupo(usuario, grupo)) return { usuario, grupo: null };
  return { usuario, grupo };
}

/// Abrir un grupo es de dirección; llevarlo, de quien tenga el permiso. Por
/// eso se elige el líder al crearlo, en vez de asignárselo a quien lo abre.
export async function crearGrupo(
  nombre: string,
  inicio: string,
  liderId: string,
): Promise<Resultado> {
  const usuario = await usuarioQueAbreGrupos();

  if (nombre.trim().length < 3) {
    return { ok: false, mensaje: "Ponle un nombre al grupo." };
  }
  if (Number.isNaN(Date.parse(inicio))) {
    return { ok: false, mensaje: "La fecha de inicio no es válida." };
  }

  const prisma = await getPrisma();
  const lider = await prisma.appUser.findFirst({
    where: { id: liderId, active: true, canLeadAlpha: true },
    select: { id: true, teamId: true },
  });
  if (!lider) {
    return {
      ok: false,
      mensaje: "Elige quién lleva el grupo, entre quienes tienen el permiso.",
    };
  }

  await prisma.alphaProgram.create({
    data: {
      name: nombre.trim(),
      startDate: new Date(inicio),
      leaderId: lider.id,
      createdById: usuario.id,
      teamId: lider.teamId ?? usuario.teamId,
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

/// Deshace una validación emitida por error.
///
/// La validación es un acto de líder, no un cálculo: por eso también se puede
/// equivocar, y hasta ahora no había cómo corregirla salvo por SQL. Se exige un
/// motivo porque quien mire el expediente después necesita saber por qué
/// desapareció un Alpha que estuvo validado.
///
/// El hito no se borra: vuelve a EN_CURSO. La persona sigue inscrita y sigue
/// yendo, así que decir «en curso» es lo cierto; borrarlo dejaría el expediente
/// como si nunca hubiera pasado nada.
export async function desvalidarAlpha(
  programId: string,
  enrollmentId: string,
  motivo: string,
): Promise<Resultado> {
  const { usuario, grupo } = await grupoPropio(programId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };

  const razon = motivo.trim();
  if (!razon) {
    return { ok: false, mensaje: "Escribe por qué se deshace la validación." };
  }

  const inscripcion = await (await getPrisma()).alphaEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, programId: true, learnerId: true, validatedAt: true },
  });

  // Se comprueba contra el grupo pedido: sin esto, el líder de un grupo podría
  // deshacer la validación de una inscripción de otro.
  if (!inscripcion || inscripcion.programId !== programId) {
    return { ok: false, mensaje: "Esa inscripción no existe." };
  }
  const validadoEl = inscripcion.validatedAt;
  if (!validadoEl) {
    return { ok: false, mensaje: "Esta persona no está validada." };
  }

  const ahora = new Date();
  const prisma = await getPrisma();

  const deshecho = await prisma.$transaction(async (tx) => {
    // La condición `validatedAt: { not: null }` va dentro del UPDATE, no en una
    // lectura previa: si dos personas lo deshacen a la vez, solo una encuentra
    // fila que cambiar y la otra se va sin duplicar la bitácora ni mandar dos
    // veces el aviso al CRM.
    const { count } = await tx.alphaEnrollment.updateMany({
      where: { id: enrollmentId, validatedAt: { not: null } },
      data: { validatedAt: null, validatedById: null, validationNote: null },
    });
    if (count === 0) return false;

    // El hito es uno por persona, pero alguien puede haber pasado por más de un
    // grupo de Alpha. Solo se retira si no le queda ninguna otra validación en
    // pie: si no, deshacer la de un grupo borraría el Alpha que ganó en otro.
    const otrasValidaciones = await tx.alphaEnrollment.count({
      where: { learnerId: inscripcion.learnerId, validatedAt: { not: null } },
    });

    if (otrasValidaciones === 0) {
      await tx.milestone.updateMany({
        where: {
          learnerId: inscripcion.learnerId,
          kind: MilestoneKind.ALPHA,
        },
        data: {
          status: MilestoneStatus.EN_CURSO,
          achievedAt: null,
          detail: `Validación deshecha: ${razon}`,
          recordedById: usuario.id,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "alpha.desvalidado",
      entityType: "learner_profile",
      entityId: inscripcion.learnerId,
      metadata: {
        programId,
        motivo: razon,
        validadoEl: validadoEl.toISOString(),
        deshechoEl: ahora.toISOString(),
        hitoRetirado: otrasValidaciones === 0,
      },
    });

    // El «alpha_aprobado» ya salió hacia el CRM: hay que decir que se revirtió,
    // o allá la persona se queda aprobada para siempre.
    await encolarEventoIntegracion(tx, "alpha_revocado", {
      learnerId: inscripcion.learnerId,
      motivo: razon,
    });

    return true;
  });

  if (!deshecho) {
    return { ok: false, mensaje: "Esta persona no está validada." };
  }

  revalidatePath(`/alpha/${programId}`);
  revalidatePath(`/expediente/${inscripcion.learnerId}`);
  return { ok: true };
}

export type CandidatoAlpha = {
  learnerId: string;
  nombre: string;
  fase: Phase;
  telefono: string | null;
};

/// Personas en Ganar que todavía no están en este grupo.
export async function buscarCandidatos(
  programId: string,
  consulta: string,
): Promise<CandidatoAlpha[]> {
  const { grupo } = await grupoPropio(programId);
  if (!grupo) return [];

  const texto = consulta.trim();
  const prisma = await getPrisma();

  // Sin encerrar la búsqueda a Ganar: a un Alpha entra quien quiera, y la
  // fase se muestra para que quien inscribe sepa a quién está metiendo.
  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      // Quien se retiró o ya se graduó no se ofrece para inscribir.
      status: LearnerStatus.ACTIVO,
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
      phase: true,
      person: { select: { firstName: true, lastName: true, callPhone: true } },
    },
  });

  return aprendices.map((aprendiz) => ({
    learnerId: aprendiz.id,
    nombre: nombreCompleto(aprendiz.person),
    fase: aprendiz.phase,
    telefono: aprendiz.person.callPhone,
  }));
}

/// Alta rápida desde el propio Alpha.
///
/// A un Alpha llega gente de la que no se sabe casi nada, y detener la
/// inscripción para llenar un registro completo hace que no se registre a
/// nadie. Con el nombre basta; el teléfono ayuda a no duplicar. El expediente
/// queda abierto y se completa después desde el registro normal.
export async function crearEInscribir(
  programId: string,
  nombre: string,
  telefono: string,
): Promise<Resultado> {
  const { usuario, grupo } = await grupoPropio(programId);
  if (!grupo) return { ok: false, mensaje: "Este grupo no es tuyo." };
  if (grupo.closedAt) return { ok: false, mensaje: "El grupo está cerrado." };

  const limpio = nombre.trim().replace(/\s+/g, " ");
  if (limpio.length < 2) return { ok: false, mensaje: "Escribe el nombre." };

  const prisma = await getPrisma();
  const cola = colaDeTelefono(telefono);

  // Si ese teléfono ya existe, no se abre un segundo expediente en silencio
  // (§20): se dice a quién pertenece para que lo busquen.
  if (cola) {
    const repetida = await prisma.$queryRaw<
      { first_name: string; last_name: string | null }[]
    >`
      SELECT first_name, last_name FROM person
      WHERE active = true
        AND (right(regexp_replace(coalesce(call_phone, ''), '\\D', '', 'g'), 10) = ${cola}
             OR right(regexp_replace(coalesce(whatsapp_phone, ''), '\\D', '', 'g'), 10) = ${cola})
      LIMIT 1
    `;
    if (repetida.length) {
      return {
        ok: false,
        mensaje: `Ese teléfono ya es de ${nombreCompleto({
          firstName: repetida[0].first_name,
          lastName: repetida[0].last_name,
        })}. Búscala arriba en vez de crearla de nuevo.`,
      };
    }
  }

  const partes = limpio.split(" ");
  const primerNombre = partes[0];
  const apellido = partes.slice(1).join(" ") || null;

  await prisma.$transaction(async (tx) => {
    const persona = await tx.person.create({
      data: {
        firstName: primerNombre,
        lastName: apellido,
        callPhone: telefono.trim() || null,
      },
      select: { id: true },
    });

    const aprendiz = await tx.learnerProfile.create({
      data: {
        personId: persona.id,
        entryPoint: EntryPoint.ALPHA_CASA_DE_FE,
        registeredById: usuario.id,
      },
      select: { id: true },
    });

    await tx.milestone.create({
      data: {
        learnerId: aprendiz.id,
        kind: MilestoneKind.REGISTRO,
        status: MilestoneStatus.COMPLETADO,
        achievedAt: new Date(),
        detail: "Registrada desde Alpha",
        recordedById: usuario.id,
      },
    });

    await tx.alphaEnrollment.create({
      data: { programId, learnerId: aprendiz.id },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "persona.registrada",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { origen: "alpha", programId },
    });
  });

  revalidatePath(`/alpha/${programId}`);
  return { ok: true };
}
