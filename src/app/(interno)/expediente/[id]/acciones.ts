"use server";

import { revalidatePath } from "next/cache";
import {
  FaithHouseStatus,
  LearnerStatus,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  Phase,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { fechaDeDia, hoyEnColombia } from "@/lib/dominio";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import {
  accesoAExpediente,
  cargarExpediente,
  ETIQUETA_HITO,
  HITOS_REGISTRABLES,
} from "@/lib/expediente";
import {
  HITO_DE_TRANSICION,
  puedeCambiarFase,
  requisitosDeFase,
} from "@/lib/fases";
import {
  actualizarDatosPersona,
  type DatosPersona,
  type ResultadoGuardado,
} from "@/lib/persona";

export type NotaPastoral = {
  id: string;
  fecha: string;
  autor: string;
  tipo: string;
  cuerpo: string;
};

export type ResultadoNotas =
  | { ok: true; notas: NotaPastoral[] }
  | { ok: false; mensaje: string };

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

async function usuarioConAcceso(learnerId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  const acceso = await accesoAExpediente(usuario, learnerId);
  return { usuario, acceso };
}

/// Edita los datos básicos de la persona desde su expediente. Puede hacerlo
/// quien puede escribir en ese expediente: su consolidador, su mentor, la
/// coordinación, el pastor o el administrador. Nadie más.
export async function guardarDatosPersonaDesdeExpediente(
  learnerId: string,
  datos: DatosPersona,
): Promise<ResultadoGuardado> {
  let contexto: Awaited<ReturnType<typeof usuarioConAcceso>>;
  try {
    contexto = await usuarioConAcceso(learnerId);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }
  const { usuario, acceso } = contexto;
  if (!acceso.puedeEscribir) {
    return { ok: false, mensaje: "No tienes permiso para editar los datos de esta persona." };
  }

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { personId: true },
  });
  if (!aprendiz) return { ok: false, mensaje: "No se encontró el expediente." };

  const resultado = await actualizarDatosPersona(
    prisma,
    aprendiz.personId,
    datos,
    usuario.id,
    "expediente.datos_actualizados",
  );
  if (!resultado.ok) return resultado;

  revalidatePath(`/expediente/${learnerId}`);
  revalidatePath("/operacion-72");
  revalidatePath("/administracion");
  return { ok: true };
}

/// Revela las notas pastorales. Cada apertura queda auditada: es la contraparte
/// de que sean privadas frente al aprendiz.
export async function revelarNotas(learnerId: string): Promise<ResultadoNotas> {
  const { usuario, acceso } = await usuarioConAcceso(learnerId);

  if (!acceso.puedeVerNotas) {
    return {
      ok: false,
      mensaje: "Las notas pastorales solo las ve el equipo responsable de esta persona.",
    };
  }

  const prisma = await getPrisma();

  const notas = await prisma.privateNote.findMany({
    where: { learnerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      author: { select: { fullName: true } },
    },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "notas.reveladas",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: { cantidad: notas.length },
  });

  return {
    ok: true,
    notas: notas.map((nota) => ({
      id: nota.id,
      fecha: FORMATO_FECHA.format(nota.createdAt),
      autor: nota.author.fullName,
      tipo: nota.kind,
      cuerpo: nota.body,
    })),
  };
}

export type ResultadoSimple = { ok: true } | { ok: false; mensaje: string };

export async function agregarNota(
  learnerId: string,
  tipo: string,
  cuerpo: string,
): Promise<ResultadoSimple> {
  const { usuario, acceso } = await usuarioConAcceso(learnerId);

  if (!acceso.puedeEscribir) {
    return { ok: false, mensaje: "No puedes escribir en este expediente." };
  }

  const texto = cuerpo.trim();
  if (texto.length < 3) {
    return { ok: false, mensaje: "Escribe la nota antes de guardar." };
  }

  const prisma = await getPrisma();
  await prisma.privateNote.create({
    data: {
      learnerId,
      authorId: usuario.id,
      kind: tipo.trim() || "mentoría",
      body: texto,
    },
  });

  revalidatePath(`/expediente/${learnerId}`);
  return { ok: true };
}

/// Marca un hito del recorrido. Queda con fecha y responsable: ninguna
/// transición del proceso ocurre sola.
export async function registrarHito(
  learnerId: string,
  kind: MilestoneKind,
  detalle: string,
  /// Cuándo ocurrió, como `AAAA-MM-DD`. Casi siempre se registra después del
  /// hecho (un bautismo del mes pasado, un encuentro de febrero), así que la
  /// fecha la pone quien registra y no puede ser la de hoy por defecto.
  fecha: string,
): Promise<ResultadoSimple> {
  const { usuario, acceso } = await usuarioConAcceso(learnerId);

  if (!acceso.puedeEscribir) {
    return { ok: false, mensaje: "No puedes escribir en este expediente." };
  }

  if (!HITOS_REGISTRABLES.includes(kind)) {
    return {
      ok: false,
      mensaje:
        "Ese hito depende de una aprobación pastoral que todavía no está definida en el sistema.",
    };
  }

  const ahora = new Date();
  const ocurrioEl = fechaDeDia(fecha, ahora);
  if (!ocurrioEl) {
    return { ok: false, mensaje: "La fecha del hito no es válida." };
  }
  // Un hito no puede haber ocurrido mañana. Se compara contra el día en hora de
  // Colombia, no contra el reloj del servidor (que va en UTC).
  if (fecha > hoyEnColombia(ahora)) {
    return { ok: false, mensaje: "La fecha del hito no puede ser futura." };
  }

  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.milestone.upsert({
      where: { learnerId_kind: { learnerId, kind } },
      create: {
        learnerId,
        kind,
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ocurrioEl,
        detail: detalle.trim() || null,
        recordedById: usuario.id,
      },
      update: {
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ocurrioEl,
        detail: detalle.trim() || null,
        recordedById: usuario.id,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "hito.registrado",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { hito: kind, etiqueta: ETIQUETA_HITO[kind], fecha },
    });
  });

  revalidatePath(`/expediente/${learnerId}`);
  return { ok: true };
}

export type TemaCasaDeFe = {
  topicId: string;
  numero: number;
  nombre: string;
  status: FaithHouseStatus;
  assessment: string | null;
  notes: string | null;
  task: string | null;
  evidence: string | null;
  registradoPor: string | null;
};

/// Actualiza un tema de Casa de Fe. El orden lo decide el mentor, así que
/// cualquier tema se puede trabajar en cualquier momento; lo que queda
/// registrado es el estado, quién lo registró y cuándo
/// (ESPECIFICACION_PRODUCTO.md §6.2).
export async function actualizarTema(
  learnerId: string,
  topicId: string,
  datos: {
    status: FaithHouseStatus;
    assessment: string;
    notes: string;
    task: string;
    evidence: string;
  },
): Promise<ResultadoSimple> {
  const { usuario, acceso } = await usuarioConAcceso(learnerId);

  if (!acceso.puedeEscribir) {
    return { ok: false, mensaje: "No puedes escribir en este expediente." };
  }

  const prisma = await getPrisma();

  const tema = await prisma.faithHouseTopic.findUnique({
    where: { id: topicId },
    select: { id: true, number: true, name: true },
  });
  if (!tema) return { ok: false, mensaje: "Ese tema no existe." };

  const limpio = (valor: string) => (valor.trim() ? valor.trim() : null);
  const completado = datos.status === FaithHouseStatus.COMPLETADO;

  await prisma.$transaction(async (tx) => {
    const comunes = {
      status: datos.status,
      assessment: limpio(datos.assessment),
      notes: limpio(datos.notes),
      task: limpio(datos.task),
      evidence: limpio(datos.evidence),
      recordedById: usuario.id,
      completedAt: completado ? new Date() : null,
    };

    await tx.faithHouseProgress.upsert({
      where: { learnerId_topicId: { learnerId, topicId } },
      create: { learnerId, topicId, ...comunes },
      update: comunes,
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "casa_de_fe.tema_actualizado",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { tema: tema.number, nombre: tema.name, estado: datos.status },
    });
  });

  revalidatePath(`/expediente/${learnerId}`);
  return { ok: true };
}

/// Aprueba el paso a la siguiente fase.
///
/// La regla pastoral la definió la iglesia: basta el mentor de esa persona, y
/// el pastor también puede. Las condiciones se vuelven a comprobar aquí; la
/// decisión queda registrada con fecha y responsable (§8.2, §19), y deja el
/// hito formal que corresponda.
export async function cambiarDeFase(
  learnerId: string,
  nota: string,
): Promise<{ ok: true; fase: Phase } | { ok: false; mensaje: string }> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");

  if (!(await puedeCambiarFase(usuario, learnerId))) {
    return {
      ok: false,
      mensaje: "Solo su mentor o un pastor pueden aprobar el cambio de fase.",
    };
  }

  const expediente = await cargarExpediente(learnerId);
  if (!expediente) return { ok: false, mensaje: "Esa persona no existe." };

  if (expediente.status !== LearnerStatus.ACTIVO) {
    return {
      ok: false,
      mensaje: `Su proceso está en ${expediente.status.toLowerCase()}: retómalo antes de avanzar de fase.`,
    };
  }

  const requisitos = requisitosDeFase(expediente);
  if (!requisitos.destino) {
    return { ok: false, mensaje: "Ya está en la última fase del recorrido." };
  }
  if (!requisitos.puedeAvanzar) {
    return {
      ok: false,
      mensaje: `Todavía falta: ${requisitos.faltantes.join(", ")}.`,
    };
  }

  const desde = expediente.phase;
  const hasta = requisitos.destino;
  const ahora = new Date();
  const hito = HITO_DE_TRANSICION[desde];
  const prisma = await getPrisma();

  let yaCambiada = false;

  await prisma.$transaction(async (tx) => {
    // La condición sobre la fase actual hace la aprobación idempotente: si dos
    // líderes pulsan a la vez, solo la primera escribe. Sin esto quedarían dos
    // registros, dos entradas de bitácora y dos avisos a la persona.
    const cambiadas = await tx.learnerProfile.updateMany({
      where: { id: learnerId, phase: desde },
      data: { phase: hasta, phaseStartedAt: ahora },
    });
    if (cambiadas.count === 0) {
      yaCambiada = true;
      return;
    }

    await tx.phaseChange.create({
      data: {
        learnerId,
        fromPhase: desde,
        toPhase: hasta,
        decidedById: usuario.id,
        decidedAt: ahora,
        note: nota.trim() || null,
      },
    });

    if (hito) {
      await tx.milestone.upsert({
        where: { learnerId_kind: { learnerId, kind: hito } },
        create: {
          learnerId,
          kind: hito,
          status: MilestoneStatus.COMPLETADO,
          achievedAt: ahora,
          detail: `Paso a ${hasta}`,
          recordedById: usuario.id,
        },
        update: {
          status: MilestoneStatus.COMPLETADO,
          achievedAt: ahora,
          detail: `Paso a ${hasta}`,
          recordedById: usuario.id,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "fase.cambiada",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { desde, hasta, nota: nota.trim() || null },
    });

    // Al salir de GANAR la persona deja de ser de consolidación: la acompaña su
    // mentor. La Operación 72 es el proceso de esa fase, así que se cierra como
    // ENTREGADA: sale del tablero y deja de contar en la carga del consolidador.
    // El vínculo con el consolidador se conserva como historial del expediente.
    if (desde === Phase.GANAR) {
      const entregada = await tx.operation72.updateMany({
        where: {
          learnerId,
          status: { notIn: [Operation72Status.ENTREGADA, Operation72Status.CERRADA] },
        },
        data: {
          status: Operation72Status.ENTREGADA,
          detail: "Entregada a mentor · pasa a Fortalecer",
        },
      });
      if (entregada.count > 0) {
        await auditar(tx, {
          actorId: usuario.id,
          action: "operacion72.entregada",
          entityType: "learner_profile",
          entityId: learnerId,
          metadata: {
            motivo: "Cambio de fase GANAR → FORTALECER",
            cerradaAt: ahora.toISOString(),
          },
        });
      }
    }

    await encolarEventoIntegracion(tx, "fase_cambiada", {
      learnerId,
      desde,
      hasta,
    });
  });

  if (yaCambiada) {
    return { ok: false, mensaje: "Alguien más ya aprobó este paso. Recarga la página." };
  }

  revalidatePath(`/expediente/${learnerId}`);
  revalidatePath("/mi-red");
  revalidatePath("/red");
  return { ok: true, fase: hasta };
}
