"use server";

import { revalidatePath } from "next/cache";
import {
  FaithHouseStatus,
  MilestoneKind,
  MilestoneStatus,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import { accesoAExpediente, ETIQUETA_HITO, HITOS_REGISTRABLES } from "@/lib/expediente";

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
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.milestone.upsert({
      where: { learnerId_kind: { learnerId, kind } },
      create: {
        learnerId,
        kind,
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        detail: detalle.trim() || null,
        recordedById: usuario.id,
      },
      update: {
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        detail: detalle.trim() || null,
        recordedById: usuario.id,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "hito.registrado",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { hito: kind, etiqueta: ETIQUETA_HITO[kind] },
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
