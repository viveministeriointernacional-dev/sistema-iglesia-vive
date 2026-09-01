import {
  FaithHouseStatus,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import type { UsuarioSesion } from "@/lib/auth";
import { ZONA_HORARIA } from "@/lib/dominio";
import { horasRestantes, urgenciaDe } from "@/lib/op72";

export const FASES: { valor: Phase; etiqueta: string }[] = [
  { valor: Phase.GANAR, etiqueta: "GANAR" },
  { valor: Phase.FORTALECER, etiqueta: "FORTALECER" },
  { valor: Phase.ENTRENAR, etiqueta: "ENTRENAR" },
  { valor: Phase.MULTIPLICAR, etiqueta: "MULTIPLICAR" },
];

/// Los ocho hitos del recorrido, en el orden del diseño. Casa de Fe muestra el
/// avance de los 12 temas en vez de una fecha.
export const HITOS_DEL_RECORRIDO: { kind: MilestoneKind; etiqueta: string }[] = [
  { kind: MilestoneKind.REGISTRO, etiqueta: "REGISTRO" },
  { kind: MilestoneKind.OPERACION_72, etiqueta: "OPERACIÓN 72" },
  { kind: MilestoneKind.ALPHA, etiqueta: "ALPHA" },
  { kind: MilestoneKind.FOCUS_DAY, etiqueta: "FOCUS DAY" },
  { kind: MilestoneKind.ENCUENTRO, etiqueta: "ENCUENTRO" },
  { kind: MilestoneKind.BAUTISMO, etiqueta: "BAUTISMO" },
  { kind: MilestoneKind.CASA_DE_FE, etiqueta: "CASA DE FE" },
  { kind: MilestoneKind.VALIDACION_PASTORAL, etiqueta: "VALIDACIÓN" },
];

/// Hitos que un mentor puede marcar por su cuenta. El cierre de fase y la
/// validación pastoral no están aquí: implican autoridad pastoral y la regla de
/// aprobación todavía no está definida (ESPECIFICACION_PRODUCTO.md §20).
export const HITOS_REGISTRABLES: MilestoneKind[] = [
  MilestoneKind.ALPHA,
  MilestoneKind.FOCUS_DAY,
  MilestoneKind.ENCUENTRO,
  MilestoneKind.BAUTISMO,
  MilestoneKind.SERVICIO,
];

export const ETIQUETA_HITO: Record<MilestoneKind, string> = {
  REGISTRO: "Registro",
  OPERACION_72: "Operación 72",
  ALPHA: "Alpha",
  FOCUS_DAY: "Focus Day",
  CASA_DE_FE: "Casa de Fe",
  BAUTISMO: "Bautismo",
  ENCUENTRO: "Encuentro",
  EVALUACION_CIERRE: "Evaluación de cierre",
  GRADUACION: "Graduación",
  VALIDACION_PASTORAL: "Validación pastoral",
  ENTRADA_ESCUELA: "Entrada a Escuela Ser Líder",
  SERVICIO: "Servicio",
  MULTIPLICACION: "Multiplicación",
};

export type AccesoExpediente = {
  puedeVer: boolean;
  /// Las notas pastorales son privadas frente al aprendiz. Las ven su mentor,
  /// su consolidador y los líderes responsables de la línea.
  puedeVerNotas: boolean;
  puedeEscribir: boolean;
  /// El expediente es la herramienta de quien acompaña. Cuando quien mira es la
  /// propia persona, su pantalla es «Mi proceso» (§10), no esta.
  esPropio: boolean;
};

/// Resuelve qué puede hacer esta persona con este expediente.
export async function accesoAExpediente(
  usuario: UsuarioSesion,
  learnerId: string,
): Promise<AccesoExpediente> {
  const prisma = await getPrisma();

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: {
      personId: true,
      consolidatorId: true,
      mentorRelationships: {
        where: { endedAt: null },
        select: { mentorId: true },
      },
    },
  });

  const esPropio = Boolean(usuario.personId && usuario.personId === aprendiz?.personId);

  if (!aprendiz) {
    return { puedeVer: false, puedeVerNotas: false, puedeEscribir: false, esPropio };
  }

  // Pastor, administrador y el consolidador coordinador (revisa a todos) ven y
  // operan cualquier expediente.
  if (
    usuario.role === Role.ADMIN ||
    usuario.role === Role.PASTOR ||
    usuario.coordinaConsolidacion
  ) {
    return { puedeVer: true, puedeVerNotas: true, puedeEscribir: true, esPropio };
  }

  const esSuMentor = aprendiz.mentorRelationships.some(
    (relacion) => relacion.mentorId === usuario.id,
  );
  const esSuConsolidador = aprendiz.consolidatorId === usuario.id;

  if (esSuMentor || esSuConsolidador) {
    return { puedeVer: true, puedeVerNotas: true, puedeEscribir: true, esPropio };
  }

  // El aprendiz no entra a su expediente: su pantalla es «Mi proceso».
  if (esPropio) {
    return { puedeVer: false, puedeVerNotas: false, puedeEscribir: false, esPropio };
  }

  return { puedeVer: false, puedeVerNotas: false, puedeEscribir: false, esPropio };
}

const FORMATO_CITA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

export type HitoLineaDeTiempo = {
  fecha: Date;
  titulo: string;
  detalle: string | null;
  tono: "verde" | "azul";
};

export type DatosExpediente = NonNullable<
  Awaited<ReturnType<typeof cargarExpediente>>
>;

export async function cargarExpediente(learnerId: string) {
  const prisma = await getPrisma();

  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: {
      id: true,
      phase: true,
      status: true,
      phaseStartedAt: true,
      createdAt: true,
      entryPoint: true,
      entryPointOther: true,
      churchAttendance: true,
      churchName: true,
      invitationKind: true,
      lineOfOrigin: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          birthDate: true,
          callPhone: true,
          whatsappPhone: true,
          email: true,
          address: true,
          prayerRequest: true,
          callSchedules: true,
          callScheduleNote: true,
        },
      },
      team: { select: { name: true } },
      consolidator: { select: { fullName: true } },
      invitedBy: { select: { firstName: true, lastName: true } },
      operation72: {
        select: {
          status: true,
          deadlineAt: true,
          detail: true,
          deliveredAt: true,
          attempts: {
            orderBy: { occurredAt: "desc" },
            select: {
              type: true,
              outcome: true,
              result: true,
              note: true,
              scheduledAt: true,
              place: true,
              isVirtual: true,
              occurredAt: true,
              byUser: { select: { fullName: true } },
            },
          },
        },
      },
      mentorRelationships: {
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          endedAt: true,
          reason: true,
          keepsLine: true,
          mentor: { select: { fullName: true } },
          authorizedBy: { select: { fullName: true } },
        },
      },
      milestones: {
        select: {
          kind: true,
          status: true,
          achievedAt: true,
          detail: true,
          recordedBy: { select: { fullName: true } },
        },
      },
      faithHouseProgress: {
        select: {
          status: true,
          completedAt: true,
          notes: true,
          assessment: true,
          task: true,
          evidence: true,
          recordedBy: { select: { fullName: true } },
          topic: { select: { id: true, number: true, name: true } },
        },
      },
    },
  });

  if (!aprendiz) return null;

  const temas = await prisma.faithHouseTopic.findMany({
    orderBy: { number: "asc" },
    select: { id: true, number: true, name: true },
  });

  return { ...aprendiz, temas };
}

/// Historia acumulativa: se arma con lo que realmente ocurrió, no con texto
/// decorativo.
///
/// `incluyePrivado` decide si el detalle puede citar notas internas —las del
/// tema de Casa de Fe y las de los contactos—. El aprendiz ve su línea de
/// tiempo, así que para él la historia va sin ese detalle.
export function construirLineaDeTiempo(
  expediente: DatosExpediente,
  incluyePrivado = false,
): HitoLineaDeTiempo[] {
  const eventos: HitoLineaDeTiempo[] = [
    {
      fecha: expediente.createdAt,
      titulo: "Registro en Iglesia Vive",
      detalle: expediente.lineOfOrigin
        ? `Invitada por ${expediente.lineOfOrigin}`
        : "Sin invitador conocido",
      tono: "azul",
    },
  ];

  for (const intento of expediente.operation72?.attempts ?? []) {
    const cita = intento.scheduledAt
      ? [
          FORMATO_CITA.format(intento.scheduledAt),
          intento.isVirtual ? "virtual" : intento.place,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    eventos.push({
      fecha: intento.occurredAt,
      titulo: intento.result ?? "Contacto registrado",
      detalle:
        [cita, intento.byUser?.fullName, incluyePrivado ? intento.note : null]
          .filter(Boolean)
          .join(" · ") || null,
      tono: "azul",
    });
  }

  for (const relacion of expediente.mentorRelationships) {
    eventos.push({
      fecha: relacion.startedAt,
      titulo: `Entregada a ${relacion.mentor.fullName}`,
      detalle: [
        relacion.keepsLine ? "Se conservó su línea" : "Asignación por perfil",
        relacion.authorizedBy ? `autorizó ${relacion.authorizedBy.fullName}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tono: "verde",
    });
    if (relacion.endedAt) {
      eventos.push({
        fecha: relacion.endedAt,
        titulo: `Cambio de mentor`,
        detalle: relacion.reason,
        tono: "azul",
      });
    }
  }

  for (const hito of expediente.milestones) {
    if (hito.status !== MilestoneStatus.COMPLETADO || !hito.achievedAt) continue;
    if (hito.kind === MilestoneKind.REGISTRO) continue; // ya está arriba
    eventos.push({
      fecha: hito.achievedAt,
      titulo: `${ETIQUETA_HITO[hito.kind]} completado`,
      detalle: [hito.detail, hito.recordedBy?.fullName].filter(Boolean).join(" · ") || null,
      tono: "verde",
    });
  }

  for (const avance of expediente.faithHouseProgress) {
    if (avance.status !== FaithHouseStatus.COMPLETADO || !avance.completedAt) continue;
    eventos.push({
      fecha: avance.completedAt,
      titulo: `Tema ${avance.topic.number} completado — «${avance.topic.name}»`,
      detalle: incluyePrivado ? avance.notes : null,
      tono: "verde",
    });
  }

  return eventos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}

/// Alertas calculadas de lo que hay en el expediente. Nada inventado: cada una
/// se puede rastrear a un dato.
export function calcularAlertas(expediente: DatosExpediente, ahora = new Date()) {
  const alertas: string[] = [];
  const op72 = expediente.operation72;

  if (op72 && op72.status !== Operation72Status.ENTREGADA && op72.status !== Operation72Status.CERRADA) {
    if (urgenciaDe(op72.deadlineAt, ahora) === "vencida") {
      alertas.push("Operación 72 vencida sin entrega a mentor");
    } else if (urgenciaDe(op72.deadlineAt, ahora) === "urgente") {
      alertas.push(`Operación 72 vence en ${Math.max(horasRestantes(op72.deadlineAt, ahora), 0)} h`);
    }
  }

  const tieneMentor = expediente.mentorRelationships.some((r) => !r.endedAt);
  if (!tieneMentor && expediente.phase !== Phase.GANAR) {
    alertas.push("Sin mentor asignado");
  }

  if (!expediente.person.callPhone) {
    alertas.push("Sin teléfono para llamadas");
  }

  return alertas;
}

/// Próximo paso, derivado del estado real del expediente.
export function proximoPaso(expediente: DatosExpediente, ahora = new Date()) {
  const op72 = expediente.operation72;

  if (op72 && op72.status !== Operation72Status.ENTREGADA && op72.status !== Operation72Status.CERRADA) {
    const restantes = horasRestantes(op72.deadlineAt, ahora);
    return {
      titulo: "Operación 72 en curso",
      detalle:
        restantes > 0
          ? `${restantes} h para completar el acompañamiento inicial`
          : "Plazo vencido · escalar a un líder",
    };
  }

  const pendientes = expediente.temas.filter(
    (tema) =>
      !expediente.faithHouseProgress.some(
        (avance) =>
          avance.topic.number === tema.number &&
          avance.status === FaithHouseStatus.COMPLETADO,
      ),
  );

  if (expediente.phase === Phase.FORTALECER && pendientes.length > 0) {
    const siguiente = pendientes[0];
    return {
      titulo: `Tema ${siguiente.number} · ${siguiente.name}`,
      detalle: `Quedan ${pendientes.length} de 12 temas de Casa de Fe`,
    };
  }

  const tieneMentor = expediente.mentorRelationships.some((r) => !r.endedAt);
  if (!tieneMentor) {
    return {
      titulo: "Asignar mentor",
      detalle: "El acompañamiento continúa cuando haya un mentor responsable",
    };
  }

  return {
    titulo: "Acompañamiento en curso",
    detalle: "Sin un siguiente paso automático: lo define su mentor",
  };
}

export function diasEnFase(desde: Date, ahora = new Date()) {
  return Math.max(1, Math.floor((ahora.getTime() - desde.getTime()) / 86_400_000));
}

export function telefonoParcial(telefono: string | null) {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 7) return telefono;
  return `${telefono.slice(0, telefono.length - 4).trimEnd()} ••• ${digitos.slice(-4)}`;
}
