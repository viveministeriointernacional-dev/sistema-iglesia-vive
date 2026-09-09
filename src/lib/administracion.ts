import {
  LearnerStatus,
  MilestoneKind,
  MilestoneStatus,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { ESTADO_SOLICITUD } from "@/lib/baja";
import { nombreCompleto, normalizarBusqueda } from "@/lib/dominio";
import { edadDesde } from "@/lib/op72";
import { getPrisma } from "@/lib/prisma";

/// Hitos que un administrador puede marcar o quitar a mano desde el panel.
/// `REGISTRO` y `OPERACION_72` los maneja el sistema y no se editan aquí.
export const HITOS_EDITABLES: MilestoneKind[] = [
  MilestoneKind.ALPHA,
  MilestoneKind.FOCUS_DAY,
  MilestoneKind.CASA_DE_FE,
  MilestoneKind.ENCUENTRO,
  MilestoneKind.BAUTISMO,
  MilestoneKind.EVALUACION_CIERRE,
  MilestoneKind.ENTRADA_ESCUELA,
  MilestoneKind.SERVICIO,
  MilestoneKind.GRADUACION,
  MilestoneKind.VALIDACION_PASTORAL,
  MilestoneKind.MULTIPLICACION,
];

export const ETIQUETA_HITO: Record<MilestoneKind, string> = {
  REGISTRO: "Registro",
  OPERACION_72: "Operación 72",
  ALPHA: "Alpha",
  FOCUS_DAY: "Focus Day",
  CASA_DE_FE: "Casa de Fe",
  ENCUENTRO: "Encuentro",
  BAUTISMO: "Bautismo",
  EVALUACION_CIERRE: "Evaluación de cierre",
  GRADUACION: "Graduación",
  VALIDACION_PASTORAL: "Validación pastoral",
  ENTRADA_ESCUELA: "Entró a la Escuela",
  SERVICIO: "Está sirviendo",
  MULTIPLICACION: "Multiplicación",
};

export const FASES: Phase[] = [
  Phase.GANAR,
  Phase.FORTALECER,
  Phase.ENTRENAR,
  Phase.MULTIPLICAR,
];

export type FilaAdmin = {
  personId: string;
  learnerId: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  rol: Role | null;
  activo: boolean;
  fase: Phase | null;
  tieneAcceso: boolean;
  /// Dada de baja (Retirada). Solo aparece en el listado al buscarla.
  retirado: boolean;
  asistente: boolean;
};

/// Tamaños de página que ofrece el listado de personas.
export const TAMANOS_PAGINA = [10, 20, 50] as const;

export type PaginaAdmin = {
  filas: FilaAdmin[];
  total: number;
  page: number;
  size: number;
  paginas: number;
};

/// Busca personas para el panel, paginado. Sin consulta trae las más recientes.
export async function buscarPersonasAdmin(
  consulta: string,
  page = 1,
  size = 20,
): Promise<PaginaAdmin> {
  const texto = consulta.trim();
  const buscando = texto.length >= 2;
  const tam = (TAMANOS_PAGINA as readonly number[]).includes(size) ? size : 20;
  const prisma = await getPrisma();

  const where = {
    active: true,
    // Búsqueda tolerante (sin importar mayúsculas, tildes ni exactitud) sobre
    // nombre, correo y teléfonos a la vez. En el listado normal no se muestran
    // los dados de baja (Retirados); solo aparecen cuando se buscan.
    ...(buscando
      ? { searchText: { contains: normalizarBusqueda(texto) } }
      : { NOT: { learnerProfile: { status: LearnerStatus.RETIRADO } } }),
  };

  const total = await prisma.person.count({ where });
  const paginas = Math.max(1, Math.ceil(total / tam));
  const pag = Math.min(Math.max(1, Math.trunc(page) || 1), paginas);

  const personas = await prisma.person.findMany({
    where,
    orderBy: buscando ? { firstName: "asc" } : { createdAt: "desc" },
    skip: (pag - 1) * tam,
    take: tam,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      callPhone: true,
      email: true,
      learnerProfile: { select: { id: true, phase: true, status: true } },
      user: { select: { role: true, active: true } },
    },
  });

  return {
    total,
    paginas,
    page: pag,
    size: tam,
    filas: personas.map((persona) => ({
      personId: persona.id,
      learnerId: persona.learnerProfile?.id ?? null,
      nombre: nombreCompleto(persona),
      telefono: persona.callPhone,
      email: persona.email,
      rol: persona.user?.role ?? null,
      activo: persona.user?.active ?? true,
      fase: persona.learnerProfile?.phase ?? null,
      tieneAcceso: Boolean(persona.user),
      retirado: persona.learnerProfile?.status === LearnerStatus.RETIRADO,
      asistente: persona.learnerProfile?.status === LearnerStatus.ASISTENTE,
    })),
  };
}

export type FilaBaja = {
  learnerId: string;
  personId: string;
  nombre: string;
  telefono: string | null;
  motivo: string | null;
  fecha: Date | null;
  por: string | null;
  /// Quién pidió la baja, cuando salió de una solicitud del equipo de
  /// consolidación. Nulo si la dio directamente un administrador.
  pedidaPor: string | null;
};

export type FilaSolicitudDeBaja = {
  solicitudId: string;
  learnerId: string;
  personId: string;
  nombre: string;
  telefono: string | null;
  motivo: string;
  nota: string | null;
  pedidaPor: string;
  fecha: Date;
  estadoOp72: string | null;
  llamadas: number;
};

/// Las solicitudes de baja que están esperando respuesta, de la más antigua a
/// la más nueva: la que lleva más tiempo esperando es la que más urge.
export async function listarSolicitudesDeBaja(): Promise<FilaSolicitudDeBaja[]> {
  const prisma = await getPrisma();
  const solicitudes = await prisma.bajaRequest.findMany({
    where: { status: ESTADO_SOLICITUD.pendiente },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      learnerId: true,
      reason: true,
      note: true,
      createdAt: true,
      requestedBy: { select: { fullName: true } },
      learner: {
        select: {
          operation72: { select: { id: true, status: true } },
          person: {
            select: { id: true, firstName: true, lastName: true, callPhone: true },
          },
        },
      },
    },
  });

  const operacionIds = solicitudes
    .map((solicitud) => solicitud.learner.operation72?.id)
    .filter((id): id is string => Boolean(id));
  const llamadas = operacionIds.length
    ? await prisma.contactAttempt.groupBy({
        by: ["operation72Id"],
        where: {
          operation72Id: { in: operacionIds },
          type: { in: ["LLAMADA", "INTENTO_LLAMADA"] },
        },
        _count: { _all: true },
      })
    : [];
  const llamadasPorOperacion = new Map(
    llamadas.map((fila) => [fila.operation72Id, fila._count._all]),
  );

  return solicitudes.map((solicitud) => ({
    solicitudId: solicitud.id,
    learnerId: solicitud.learnerId,
    personId: solicitud.learner.person.id,
    nombre: nombreCompleto(solicitud.learner.person),
    telefono: solicitud.learner.person.callPhone,
    motivo: solicitud.reason,
    nota: solicitud.note,
    pedidaPor: solicitud.requestedBy.fullName,
    fecha: solicitud.createdAt,
    estadoOp72: solicitud.learner.operation72?.status ?? null,
    llamadas: solicitud.learner.operation72
      ? (llamadasPorOperacion.get(solicitud.learner.operation72.id) ?? 0)
      : 0,
  }));
}

/// El listado aparte de personas dadas de baja (Retiradas), con el motivo, la
/// fecha y quién la dio de baja. Es el «listado afuera» que pidió la iglesia.
export async function listarDadosDeBaja(): Promise<FilaBaja[]> {
  const prisma = await getPrisma();
  const aprendices = await prisma.learnerProfile.findMany({
    where: { status: LearnerStatus.RETIRADO },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      person: {
        select: { id: true, firstName: true, lastName: true, callPhone: true },
      },
      statusChanges: {
        where: { toStatus: LearnerStatus.RETIRADO },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          reason: true,
          createdAt: true,
          decidedBy: { select: { fullName: true } },
        },
      },
      // Quién la pidió, cuando la baja vino de una solicitud autorizada. Así
      // el listado dice las dos manos que intervinieron, no solo la última.
      bajaRequests: {
        where: { status: ESTADO_SOLICITUD.autorizada },
        orderBy: { resolvedAt: "desc" },
        take: 1,
        select: { requestedBy: { select: { fullName: true } } },
      },
    },
  });

  return aprendices.map((aprendiz) => {
    const baja = aprendiz.statusChanges[0] ?? null;
    return {
      learnerId: aprendiz.id,
      personId: aprendiz.person.id,
      nombre: nombreCompleto(aprendiz.person),
      telefono: aprendiz.person.callPhone,
      motivo: baja?.reason ?? null,
      fecha: baja?.createdAt ?? null,
      por: baja?.decidedBy.fullName ?? null,
      pedidaPor: aprendiz.bajaRequests[0]?.requestedBy.fullName ?? null,
    };
  });
}


/// Los hitos que resumen «hasta dónde llegó» una persona, en el orden del
/// recorrido. Es un subconjunto a propósito: la tira tiene que leerse de un
/// vistazo, así que quedan fuera los hitos internos (validación pastoral,
/// evaluación de cierre) que no significan nada para quien mira la lista.
export const HITOS_DEL_RECORRIDO: { kind: MilestoneKind; etiqueta: string }[] = [
  { kind: MilestoneKind.REGISTRO, etiqueta: "Registro" },
  { kind: MilestoneKind.OPERACION_72, etiqueta: "Operación 72" },
  { kind: MilestoneKind.ALPHA, etiqueta: "Alpha" },
  { kind: MilestoneKind.CASA_DE_FE, etiqueta: "Casa de Fe" },
  { kind: MilestoneKind.BAUTISMO, etiqueta: "Bautismo" },
  { kind: MilestoneKind.ENCUENTRO, etiqueta: "Encuentro" },
  { kind: MilestoneKind.ENTRADA_ESCUELA, etiqueta: "Escuela" },
];

/// Cuánto silencio se considera demasiado. Tres meses es el plazo que fijó el
/// usuario: es lo que separa «no quiere proceso» de «nadie volvió a saber de
/// esta persona», que son dos cosas muy distintas.
export const DIAS_SIN_CONTACTO = 90;

export type FilaAsistente = {
  learnerId: string;
  personId: string;
  nombre: string;
  telefono: string | null;
  edad: number | null;
  consolidador: string | null;
  desde: Date | null;
  motivo: string | null;
  nota: string | null;
  anotadaPor: string | null;
  ultimoContacto: Date | null;
  hitos: { etiqueta: string; conseguido: boolean; fecha: Date | null }[];
  conseguidos: number;
  sinContacto: boolean;
};

/// Los asistentes de la iglesia, con lo que llevan hecho hasta el momento.
///
/// Todo sale de UNA consulta con sus relaciones: son pocas personas y el
/// pooler de Supabase cobra por viaje, no por tamaño (§9 del CLAUDE.md).
export async function listarAsistentes(): Promise<FilaAsistente[]> {
  const prisma = await getPrisma();
  const ahora = new Date();
  const aprendices = await prisma.learnerProfile.findMany({
    where: { status: LearnerStatus.ASISTENTE },
    orderBy: { attendeeSince: "desc" },
    select: {
      id: true,
      attendeeSince: true,
      attendeeReason: true,
      attendeeNote: true,
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          callPhone: true,
          birthDate: true,
        },
      },
      consolidator: { select: { fullName: true } },
      milestones: {
        where: { status: MilestoneStatus.COMPLETADO },
        select: { kind: true, achievedAt: true },
      },
      // Quién la marcó como asistente: es el que sabe contar el caso.
      statusChanges: {
        where: { toStatus: LearnerStatus.ASISTENTE },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { decidedBy: { select: { fullName: true } } },
      },
      // El último movimiento real que alguien registró sobre esta persona.
      operation72: {
        select: {
          attempts: {
            orderBy: { occurredAt: "desc" },
            take: 1,
            select: { occurredAt: true },
          },
        },
      },
    },
  });

  return aprendices.map((aprendiz) => {
    const logrados = new Map(
      aprendiz.milestones.map((hito) => [hito.kind, hito.achievedAt]),
    );
    const hitos = HITOS_DEL_RECORRIDO.map((hito) => ({
      etiqueta: hito.etiqueta,
      conseguido: logrados.has(hito.kind),
      fecha: logrados.get(hito.kind) ?? null,
    }));
    const ultimoContacto = aprendiz.operation72?.attempts[0]?.occurredAt ?? null;
    // Sin ningún registro también cuenta como silencio: no es que se le haya
    // hablado hace mucho, es que no consta que se le haya hablado nunca.
    const dias = ultimoContacto
      ? (ahora.getTime() - ultimoContacto.getTime()) / 86_400_000
      : Infinity;

    return {
      learnerId: aprendiz.id,
      personId: aprendiz.person.id,
      nombre: nombreCompleto(aprendiz.person),
      telefono: aprendiz.person.callPhone,
      edad: edadDesde(aprendiz.person.birthDate, ahora),
      consolidador: aprendiz.consolidator?.fullName ?? null,
      desde: aprendiz.attendeeSince,
      motivo: aprendiz.attendeeReason,
      nota: aprendiz.attendeeNote,
      anotadaPor: aprendiz.statusChanges[0]?.decidedBy.fullName ?? null,
      ultimoContacto,
      hitos,
      conseguidos: hitos.filter((h) => h.conseguido).length,
      sinContacto: dias > DIAS_SIN_CONTACTO,
    };
  });
}


export type SolicitudDeBajaDetalle = NonNullable<
  Awaited<ReturnType<typeof cargarSolicitudDeBaja>>
>;

/// Todo lo que un administrador necesita para responder una solicitud sin
/// tener que salir a buscarlo: el motivo, lo que escribió el consolidador, y
/// **lo que dice el sistema** — las llamadas registradas en el formulario, las
/// marcaciones reales del discador y el horario en que la persona pidió que la
/// llamaran. Ese cruce es lo que deja ver si de verdad se intentó.
export async function cargarSolicitudDeBaja(solicitudId: string) {
  const prisma = await getPrisma();
  const solicitud = await prisma.bajaRequest.findUnique({
    where: { id: solicitudId },
    select: {
      id: true,
      status: true,
      reason: true,
      note: true,
      createdAt: true,
      resolutionNote: true,
      resolvedAt: true,
      requestedBy: { select: { fullName: true } },
      resolvedBy: { select: { fullName: true } },
      learner: {
        select: {
          id: true,
          consolidator: { select: { fullName: true } },
          operation72: { select: { id: true, status: true } },
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              callPhone: true,
              whatsappPhone: true,
              callSchedules: true,
              callScheduleNote: true,
              highLevelContacts: { select: { contactId: true } },
            },
          },
        },
      },
    },
  });
  if (!solicitud) return null;

  const operacionId = solicitud.learner.operation72?.id ?? null;
  const intentos = operacionId
    ? await prisma.contactAttempt.findMany({
        where: { operation72Id: operacionId },
        orderBy: { occurredAt: "desc" },
        take: 12,
        select: {
          type: true,
          outcome: true,
          note: true,
          occurredAt: true,
          byUser: { select: { fullName: true } },
        },
      })
    : [];

  // Las marcaciones del discador. No mueven Operación 72, pero son la prueba
  // de que se llamó (o de que no) al margen de lo que se haya registrado.
  const contactIds = solicitud.learner.person.highLevelContacts.map(
    (contacto) => contacto.contactId,
  );
  const marcaciones = contactIds.length
    ? await prisma.callLog.findMany({
        where: { contactId: { in: contactIds } },
        orderBy: { startedAt: "desc" },
        take: 20,
        select: { startedAt: true, answered: true, status: true, callerName: true },
      })
    : [];

  return {
    id: solicitud.id,
    estado: solicitud.status,
    motivo: solicitud.reason,
    nota: solicitud.note,
    pedidaPor: solicitud.requestedBy.fullName,
    fecha: solicitud.createdAt,
    resueltaPor: solicitud.resolvedBy?.fullName ?? null,
    resueltaEn: solicitud.resolvedAt,
    observacion: solicitud.resolutionNote,
    learnerId: solicitud.learner.id,
    personId: solicitud.learner.person.id,
    nombre: nombreCompleto(solicitud.learner.person),
    telefono:
      solicitud.learner.person.callPhone ?? solicitud.learner.person.whatsappPhone,
    horarios: solicitud.learner.person.callSchedules,
    horarioNota: solicitud.learner.person.callScheduleNote,
    consolidador: solicitud.learner.consolidator?.fullName ?? null,
    estadoOp72: solicitud.learner.operation72?.status ?? null,
    intentos,
    marcaciones,
  };
}

export type PersonaAdmin = NonNullable<
  Awaited<ReturnType<typeof cargarPersonaAdmin>>
>;

/// Carga el detalle completo de una persona para el editor del panel.
export async function cargarPersonaAdmin(personId: string) {
  const prisma = await getPrisma();

  const persona = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      birthDate: true,
      callPhone: true,
      whatsappPhone: true,
      email: true,
      address: true,
      prayerRequest: true,
      learnerProfile: {
        select: {
          id: true,
          phase: true,
          status: true,
          milestones: { select: { kind: true, status: true } },
          mentorRelationships: {
            where: { endedAt: null },
            select: { mentorId: true, mentor: { select: { fullName: true } } },
          },
          statusChanges: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              reason: true,
              createdAt: true,
              decidedBy: { select: { fullName: true } },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
          capacity: true,
          canLeadAlpha: true,
          canLeadFaithHouse: true,
          canMentor: true,
          coordinatesConsolidation: true,
        },
      },
    },
  });

  if (!persona) return null;

  const hitosCompletados = new Set(
    (persona.learnerProfile?.milestones ?? [])
      .filter((hito) => hito.status === MilestoneStatus.COMPLETADO)
      .map((hito) => hito.kind),
  );

  const ultimoCambioEstado = persona.learnerProfile?.statusChanges[0] ?? null;

  return {
    ...persona,
    nombre: nombreCompleto(persona),
    hitosCompletados,
    estado: persona.learnerProfile?.status ?? null,
    baja: ultimoCambioEstado
      ? {
          motivo: ultimoCambioEstado.reason,
          fecha: ultimoCambioEstado.createdAt,
          por: ultimoCambioEstado.decidedBy.fullName,
        }
      : null,
    mentorActual:
      persona.learnerProfile?.mentorRelationships[0]?.mentor.fullName ?? null,
    mentorActualId:
      persona.learnerProfile?.mentorRelationships[0]?.mentorId ?? null,
  };
}
