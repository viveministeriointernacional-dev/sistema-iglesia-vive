"use server";

import { revalidatePath } from "next/cache";
import {
  ContactType,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import {
  ErrorDePermiso,
  requerirRolEnAccion,
  ROLES_CONFIRMAN_ENTREGA,
  ROLES_CONSOLIDACION,
  type UsuarioSesion,
} from "@/lib/auth";
import { proponerMentor } from "@/lib/asignacion";
import { TRANSICIONES } from "@/lib/op72";

export type ResultadoAccion = { ok: true } | { ok: false; mensaje: string };

/// Un consolidador solo opera sobre las personas que tiene asignadas; pastor y
/// administrador ven y operan toda la iglesia.
async function cargarOperacion(id: string, usuario: UsuarioSesion) {
  const prisma = await getPrisma();
  const operacion = await prisma.operation72.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      learnerId: true,
      lineKnown: true,
      proposedMentorId: true,
      learner: { select: { consolidatorId: true } },
    },
  });

  if (!operacion) return null;

  const esSuya =
    usuario.role !== Role.CONSOLIDADOR ||
    operacion.learner.consolidatorId === usuario.id;

  return esSuya ? operacion : null;
}

/// Avanza el estado de una Operación 72 y deja registro del contacto.
/// El historial es acumulativo: cada paso agrega un ContactAttempt, nunca
/// sobrescribe el anterior.
export async function avanzarOperacion72(
  operacionId: string,
  estadoEsperado: Operation72Status,
  detalle?: string,
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_CONSOLIDACION);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) {
    return { ok: false, mensaje: "Esta persona no está en tu lista." };
  }

  if (operacion.status !== estadoEsperado) {
    return {
      ok: false,
      mensaje: "Alguien más ya movió esta tarjeta. Actualiza el tablero.",
    };
  }

  const transicion = TRANSICIONES[operacion.status];
  if (!transicion || transicion.siguiente === Operation72Status.ENTREGADA) {
    return { ok: false, mensaje: "Esta tarjeta ya no admite este paso." };
  }

  const tipoDeContacto: Partial<Record<Operation72Status, ContactType>> = {
    [Operation72Status.INICIADA]: ContactType.LLAMADA,
    [Operation72Status.CONTACTADA]: ContactType.VISITA,
    [Operation72Status.VISITA_PENDIENTE]: ContactType.VISITA,
  };

  const accionAuditada = {
    [Operation72Status.INICIADA]: "operacion72.contacto_registrado",
    [Operation72Status.CONTACTADA]: "operacion72.visita_agendada",
    [Operation72Status.VISITA_PENDIENTE]: "operacion72.visita_cerrada",
  } as const;

  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    const proximo = transicion.siguiente;

    let propuesta = null;
    if (proximo === Operation72Status.LISTA_PARA_ENTREGA) {
      propuesta = await proponerMentor(tx, operacion.learnerId);
    }

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: proximo,
        detail:
          detalle?.trim() ||
          transicion.detallePorDefecto ||
          "Visita cerrada · lista para entrega",
        ...(propuesta
          ? {
              proposedMentorId: propuesta.mentorId,
              proposedMentorNote: propuesta.detalle,
              lineKnown: propuesta.conservaLinea,
            }
          : {}),
      },
    });

    await tx.contactAttempt.create({
      data: {
        operation72Id: operacion.id,
        type: tipoDeContacto[operacion.status] ?? ContactType.CONVERSACION,
        result: transicion.etiqueta,
        note: detalle?.trim() || null,
        byUserId: usuario.id,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: accionAuditada[operacion.status as keyof typeof accionAuditada],
      entityType: "operation72",
      entityId: operacion.id,
      metadata: { de: operacion.status, a: proximo },
    });
  });

  revalidatePath("/operacion-72");
  return { ok: true };
}

/// Entrega a mentor: cierra Operación 72 y abre la relación de discipulado.
///
/// La relación queda con fecha de inicio y responsable que la autorizó; el
/// historial nunca se sobrescribe (ARQUITECTURA_VISUAL.md §11).
export async function entregarAMentor(
  operacionId: string,
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_CONSOLIDACION);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) {
    return { ok: false, mensaje: "Esta persona no está en tu lista." };
  }

  if (operacion.status !== Operation72Status.LISTA_PARA_ENTREGA) {
    return { ok: false, mensaje: "Esta persona todavía no está lista para entrega." };
  }

  if (!operacion.proposedMentorId) {
    return {
      ok: false,
      mensaje:
        "No hay mentor propuesto con cupo. Un líder debe asignarlo antes de entregar.",
    };
  }

  // Sin línea conocida, la asignación por perfil la confirma un líder.
  if (!operacion.lineKnown && !ROLES_CONFIRMAN_ENTREGA.includes(usuario.role)) {
    return {
      ok: false,
      mensaje:
        "Sin línea conocida la entrega la confirma un líder. Avísale para que la apruebe.",
    };
  }

  const ahora = new Date();
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.mentorRelationship.create({
      data: {
        learnerId: operacion.learnerId,
        mentorId: operacion.proposedMentorId!,
        startedAt: ahora,
        reason: "Entrega desde Operación 72",
        authorizedById: usuario.id,
        keepsLine: operacion.lineKnown,
      },
    });

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: Operation72Status.ENTREGADA,
        deliveredAt: ahora,
        detail: "Entregada a mentor",
      },
    });

    await tx.milestone.upsert({
      where: {
        learnerId_kind: {
          learnerId: operacion.learnerId,
          kind: MilestoneKind.OPERACION_72,
        },
      },
      create: {
        learnerId: operacion.learnerId,
        kind: MilestoneKind.OPERACION_72,
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

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.entregada",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: { mentorId: operacion.proposedMentorId },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "mentor.asignado",
      entityType: "learner_profile",
      entityId: operacion.learnerId,
      metadata: {
        mentorId: operacion.proposedMentorId,
        conservaLinea: operacion.lineKnown,
      },
    });

    await encolarEventoIntegracion(tx, "mentor_asignado", {
      learnerId: operacion.learnerId,
      mentorId: operacion.proposedMentorId,
    });
  });

  revalidatePath("/operacion-72");
  return { ok: true };
}
