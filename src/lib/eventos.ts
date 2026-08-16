import {
  EventKind,
  EventRegistrationStatus,
  MilestoneKind,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import type { UsuarioSesion } from "@/lib/auth";

export const ETIQUETA_EVENTO: Record<EventKind, string> = {
  SERVICIO: "Servicio",
  ALPHA: "Alpha",
  FOCUS_DAY: "Focus Day",
  ENCUENTRO: "Encuentro",
  BAUTISMO: "Bautismo",
  CUMBRE: "Cumbre",
  ESCUELA: "Escuela Ser Líder",
  TALLER: "Taller",
  REUNION: "Reunión",
  ACTIVIDAD: "Actividad",
};

export const ETIQUETA_INSCRIPCION: Record<EventRegistrationStatus, string> = {
  INSCRITO: "Inscrito",
  CONFIRMADO: "Confirmado",
  ASISTIO: "Asistió",
  NO_ASISTIO: "No asistió",
  CANCELADO: "Cancelado",
};

/// Dos tipos de evento cierran un hito obligatorio de Fortalecer (§6.4). Es la
/// única razón por la que el tipo de evento importa para el recorrido: el
/// resto se registran igual pero no marcan nada.
export const HITO_POR_TIPO: Partial<Record<EventKind, MilestoneKind>> = {
  ENCUENTRO: MilestoneKind.ENCUENTRO,
  BAUTISMO: MilestoneKind.BAUTISMO,
};

/// Publicar y programar es decisión de dirección.
export const ROLES_PROGRAMAN_EVENTOS: Role[] = [Role.PASTOR, Role.ADMIN];

/// Inscribir y pasar asistencia lo hace quien acompaña.
export const ROLES_OPERAN_EVENTOS: Role[] = [
  Role.CONSOLIDADOR,
  Role.LIDER_ALPHA,
  Role.MENTOR,
  Role.PASTOR,
  Role.ADMIN,
];

export function puedeProgramar(usuario: UsuarioSesion) {
  return ROLES_PROGRAMAN_EVENTOS.includes(usuario.role);
}

export function puedeOperar(usuario: UsuarioSesion) {
  return ROLES_OPERAN_EVENTOS.includes(usuario.role);
}

/// Los inscritos que cuentan contra el cupo. Un cancelado libera su lugar.
export function ocupanCupo(
  registros: { status: EventRegistrationStatus }[],
): number {
  return registros.filter(
    (registro) => registro.status !== EventRegistrationStatus.CANCELADO,
  ).length;
}

export async function cargarEventos(desde = new Date()) {
  const prisma = await getPrisma();

  const [proximos, pasados] = await Promise.all([
    prisma.event.findMany({
      where: { startsAt: { gte: desde } },
      orderBy: { startsAt: "asc" },
      select: seleccionDeLista,
    }),
    prisma.event.findMany({
      where: { startsAt: { lt: desde } },
      orderBy: { startsAt: "desc" },
      take: 20,
      select: seleccionDeLista,
    }),
  ]);

  return { proximos, pasados };
}

const seleccionDeLista = {
  id: true,
  kind: true,
  title: true,
  startsAt: true,
  location: true,
  capacity: true,
  phases: true,
  publishedAt: true,
  cancelledAt: true,
  registrations: { select: { status: true } },
} as const;

export async function cargarEvento(eventId: string) {
  const prisma = await getPrisma();

  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      kind: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      location: true,
      capacity: true,
      phases: true,
      publishedAt: true,
      cancelledAt: true,
      createdBy: { select: { fullName: true } },
      registrations: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          note: true,
          attendedAt: true,
          learnerId: true,
          attendedBy: { select: { fullName: true } },
          learner: {
            select: {
              phase: true,
              person: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });
}

export type DatosEvento = NonNullable<Awaited<ReturnType<typeof cargarEvento>>>;

/// El próximo evento publicado al que esta persona puede ir: o está inscrita,
/// o su fase está dentro de la segmentación (§10, §14).
export async function proximoEventoDe(learnerId: string, fase: Phase, ahora = new Date()) {
  const prisma = await getPrisma();

  const evento = await prisma.event.findFirst({
    where: {
      startsAt: { gte: ahora },
      publishedAt: { not: null },
      cancelledAt: null,
      OR: [
        { registrations: { some: { learnerId } } },
        { phases: { isEmpty: true } },
        { phases: { has: fase } },
      ],
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      kind: true,
      title: true,
      startsAt: true,
      location: true,
      registrations: {
        where: { learnerId },
        select: { status: true },
      },
    },
  });

  if (!evento) return null;

  return {
    kind: evento.kind,
    titulo: evento.title,
    fecha: evento.startsAt,
    lugar: evento.location,
    inscripcion: evento.registrations[0]?.status ?? null,
  };
}
