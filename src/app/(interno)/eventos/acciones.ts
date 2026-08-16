"use server";

import { revalidatePath } from "next/cache";
import {
  EventKind,
  EventRegistrationStatus,
  MilestoneStatus,
  Phase,
} from "@iglesia/prisma-client";
import { getPrisma, type ClientePrisma } from "@/lib/prisma";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import { ErrorDePermiso, obtenerUsuarioActual } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";
import {
  ETIQUETA_EVENTO,
  HITO_POR_TIPO,
  puedeOperar,
  puedeProgramar,
} from "@/lib/eventos";

export type Resultado = { ok: true } | { ok: false; mensaje: string };

async function usuarioQueProgramar() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeProgramar(usuario)) throw new ErrorDePermiso();
  return usuario;
}

async function usuarioQueOpera() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeOperar(usuario)) throw new ErrorDePermiso();
  return usuario;
}

export async function crearEvento(datos: {
  kind: EventKind;
  titulo: string;
  fecha: string;
  lugar: string;
  cupo: string;
  fases: Phase[];
  descripcion: string;
}): Promise<Resultado> {
  const usuario = await usuarioQueProgramar();

  if (datos.titulo.trim().length < 3) {
    return { ok: false, mensaje: "Ponle un nombre al evento." };
  }
  if (Number.isNaN(Date.parse(datos.fecha))) {
    return { ok: false, mensaje: "La fecha no es válida." };
  }

  const cupo = datos.cupo.trim() ? Number(datos.cupo) : null;
  if (cupo !== null && (!Number.isInteger(cupo) || cupo < 1)) {
    return { ok: false, mensaje: "El cupo debe ser un número mayor que cero." };
  }

  const prisma = await getPrisma();
  const evento = await prisma.event.create({
    data: {
      kind: datos.kind,
      title: datos.titulo.trim(),
      description: datos.descripcion.trim() || null,
      startsAt: new Date(datos.fecha),
      location: datos.lugar.trim() || null,
      capacity: cupo,
      phases: datos.fases,
      teamId: usuario.teamId,
      createdById: usuario.id,
    },
  });

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${evento.id}`);
  return { ok: true };
}

/// Publicar es lo que lo hace visible para el aprendiz (§14). Se puede
/// despublicar mientras se corrigen datos.
export async function publicar(eventId: string, publicado: boolean): Promise<Resultado> {
  const usuario = await usuarioQueProgramar();
  const prisma = await getPrisma();

  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      kind: true,
      title: true,
      startsAt: true,
      cancelledAt: true,
      publishedAt: true,
    },
  });
  if (!evento) return { ok: false, mensaje: "Ese evento no existe." };
  if (evento.cancelledAt) {
    return { ok: false, mensaje: "El evento está cancelado." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { publishedAt: publicado ? new Date() : null },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: publicado ? "evento.publicado" : "evento.despublicado",
      entityType: "event",
      entityId: eventId,
      metadata: { titulo: evento.title },
    });

    // El anuncio sale una sola vez. Despublicar para corregir la hora y
    // volver a publicar no vuelve a escribirle a la iglesia; la cola es el
    // registro de lo que ya se anunció.
    if (publicado) {
      const anunciado = await tx.integrationEvent.count({
        where: { event: "evento_publicado", payload: { path: ["eventId"], equals: eventId } },
      });
      if (!anunciado) {
        // El envío del anuncio lo hace el worker de GoHighLevel (§15).
        await encolarEventoIntegracion(tx, "evento_publicado", {
          eventId,
          tipo: evento.kind,
          titulo: evento.title,
          fecha: evento.startsAt.toISOString(),
        });
      }
    }
  });

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${eventId}`);
  return { ok: true };
}

export async function cancelar(eventId: string): Promise<Resultado> {
  const usuario = await usuarioQueProgramar();
  const prisma = await getPrisma();

  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    select: { title: true, cancelledAt: true },
  });
  if (!evento) return { ok: false, mensaje: "Ese evento no existe." };
  if (evento.cancelledAt) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: { cancelledAt: new Date(), publishedAt: null },
    });
    await auditar(tx, {
      actorId: usuario.id,
      action: "evento.cancelado",
      entityType: "event",
      entityId: eventId,
      metadata: { titulo: evento.title },
    });
    await encolarEventoIntegracion(tx, "evento_cancelado", { eventId });
  });

  revalidatePath("/eventos");
  revalidatePath(`/eventos/${eventId}`);
  return { ok: true };
}

export type CandidatoEvento = { learnerId: string; nombre: string; fase: Phase };

/// Busca a quién inscribir, respetando la segmentación del evento: si está
/// dirigido a unas fases, no aparecen personas de otras.
export async function buscarParaInscribir(
  eventId: string,
  consulta: string,
): Promise<CandidatoEvento[]> {
  await usuarioQueOpera();
  const prisma = await getPrisma();

  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    select: { phases: true },
  });
  if (!evento) return [];

  const texto = consulta.trim();

  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      ...(evento.phases.length ? { phase: { in: evento.phases } } : {}),
      eventRegistrations: { none: { eventId } },
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

export async function inscribir(
  eventId: string,
  learnerId: string,
): Promise<Resultado> {
  const usuario = await usuarioQueOpera();
  const prisma = await getPrisma();

  const evento = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      capacity: true,
      phases: true,
      cancelledAt: true,
      registrations: { select: { status: true } },
    },
  });
  if (!evento) return { ok: false, mensaje: "Ese evento no existe." };
  if (evento.cancelledAt) return { ok: false, mensaje: "El evento está cancelado." };

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { phase: true },
  });
  if (!aprendiz) return { ok: false, mensaje: "Esa persona no existe." };

  if (evento.phases.length && !evento.phases.includes(aprendiz.phase)) {
    return {
      ok: false,
      mensaje: "El evento no está dirigido a la fase de esa persona.",
    };
  }

  let sinCupo = false;

  await prisma.$transaction(async (tx) => {
    // El cupo se vuelve a contar dentro de la transacción: entre la carga de
    // la pantalla y el clic pudo entrar alguien más.
    if (evento.capacity !== null && (await cupoLleno(tx, eventId, evento.capacity))) {
      sinCupo = true;
      return;
    }

    await tx.eventRegistration.upsert({
      where: { eventId_learnerId: { eventId, learnerId } },
      create: { eventId, learnerId, registeredById: usuario.id },
      update: {
        status: EventRegistrationStatus.INSCRITO,
        registeredById: usuario.id,
      },
    });
    await auditar(tx, {
      actorId: usuario.id,
      action: "evento.inscripcion",
      entityType: "event",
      entityId: eventId,
      metadata: { learnerId },
    });
    await encolarEventoIntegracion(tx, "evento_inscripcion", { eventId, learnerId });
  });

  if (sinCupo) return { ok: false, mensaje: "El evento ya está en su cupo máximo." };

  revalidatePath(`/eventos/${eventId}`);
  return { ok: true };
}

/// Cuenta cuántos lugares ocupados hay ahora mismo. Se usa dentro de las
/// transacciones que pueden llenar el cupo.
async function cupoLleno(
  tx: ClientePrisma,
  eventId: string,
  capacidad: number,
  exceptoRegistro?: string,
) {
  const ocupados = await tx.eventRegistration.count({
    where: {
      eventId,
      status: { not: EventRegistrationStatus.CANCELADO },
      ...(exceptoRegistro ? { id: { not: exceptoRegistro } } : {}),
    },
  });
  return ocupados >= capacidad;
}

/// Cambia el estado de una inscripción. Marcar ASISTIO en un Encuentro o un
/// Bautismo cierra el hito obligatorio correspondiente (§6.4); quitarlo lo
/// revierte, porque un error de digitación no debería dejar un hito falso en
/// el expediente. La fase nunca se toca: eso es decisión pastoral (§20).
export async function marcarEstado(
  eventId: string,
  registrationId: string,
  estado: EventRegistrationStatus,
): Promise<Resultado> {
  const usuario = await usuarioQueOpera();
  const prisma = await getPrisma();

  const registro = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: {
      eventId: true,
      learnerId: true,
      status: true,
      event: {
        select: {
          kind: true,
          title: true,
          startsAt: true,
          capacity: true,
          cancelledAt: true,
        },
      },
    },
  });
  if (!registro || registro.eventId !== eventId) {
    return { ok: false, mensaje: "Esa inscripción no existe." };
  }
  // La pantalla ya deshabilita los botones de un evento cancelado; el servidor
  // no confía en eso.
  if (registro.event.cancelledAt) {
    return { ok: false, mensaje: "El evento está cancelado." };
  }

  const ahora = new Date();
  const asistio = estado === EventRegistrationStatus.ASISTIO;
  const hito = HITO_POR_TIPO[registro.event.kind];
  const detalle = `${ETIQUETA_EVENTO[registro.event.kind]} · ${registro.event.title}`;
  const reactiva =
    registro.status === EventRegistrationStatus.CANCELADO &&
    estado !== EventRegistrationStatus.CANCELADO;

  let sinCupo = false;

  await prisma.$transaction(async (tx) => {
    // Sacar a alguien de «canceló» le devuelve su lugar: hay que ver si queda.
    if (
      reactiva &&
      registro.event.capacity !== null &&
      (await cupoLleno(tx, eventId, registro.event.capacity, registrationId))
    ) {
      sinCupo = true;
      return;
    }

    await tx.eventRegistration.update({
      where: { id: registrationId },
      data: {
        status: estado,
        attendedAt: asistio ? ahora : null,
        attendedById: asistio ? usuario.id : null,
      },
    });

    if (hito) {
      const existente = await tx.milestone.findUnique({
        where: { learnerId_kind: { learnerId: registro.learnerId, kind: hito } },
        select: { status: true, detail: true },
      });
      const loPusoEsteEvento = existente?.detail === detalle;

      if (asistio) {
        // Si el hito ya venía cerrado por otra vía —un Encuentro anterior, un
        // registro manual del mentor— no se sobreescribe: esa persona ya lo
        // cumplió y su constancia original no es de este evento.
        const yaEstabaCerradoPorOtro =
          existente?.status === MilestoneStatus.COMPLETADO && !loPusoEsteEvento;

        if (!yaEstabaCerradoPorOtro) {
          await tx.milestone.upsert({
            where: { learnerId_kind: { learnerId: registro.learnerId, kind: hito } },
            create: {
              learnerId: registro.learnerId,
              kind: hito,
              status: MilestoneStatus.COMPLETADO,
              achievedAt: registro.event.startsAt,
              detail: detalle,
              recordedById: usuario.id,
            },
            update: {
              status: MilestoneStatus.COMPLETADO,
              achievedAt: registro.event.startsAt,
              detail: detalle,
              recordedById: usuario.id,
            },
          });
          await encolarEventoIntegracion(tx, "hito_completado", {
            learnerId: registro.learnerId,
            hito,
            eventId,
          });
        }
      } else if (registro.status === EventRegistrationStatus.ASISTIO && loPusoEsteEvento) {
        // Solo se borra el hito que este mismo evento había cerrado.
        await tx.milestone.delete({
          where: { learnerId_kind: { learnerId: registro.learnerId, kind: hito } },
        });
      }
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "evento.asistencia",
      entityType: "event",
      entityId: eventId,
      metadata: { learnerId: registro.learnerId, estado, hito: hito ?? null },
    });
  });

  if (sinCupo) {
    return { ok: false, mensaje: "El evento ya está en su cupo máximo." };
  }

  revalidatePath(`/eventos/${eventId}`);
  revalidatePath(`/expediente/${registro.learnerId}`);
  return { ok: true };
}
