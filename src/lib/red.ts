import {
  FaithHouseStatus,
  Operation72Status,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import type { UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";
import { horasRestantes, urgenciaDe } from "@/lib/op72";

/// Días sin ningún registro tras los que una persona se considera sin contacto
/// reciente. Es un umbral operativo, no una regla pastoral: se puede ajustar.
export const DIAS_SIN_CONTACTO = 21;

export type PersonaDeLaRed = {
  learnerId: string;
  nombre: string;
  fase: Phase;
  avance: string;
  ultimoContacto: Date | null;
  diasSinContacto: number | null;
  alertas: string[];
  listaParaRevision: boolean;
};

export type ResumenDeLaRed = {
  personas: PersonaDeLaRed[];
  acompanadas: number;
  conAlertas: number;
  operacion72: number;
  sinContacto: number;
  paraRevision: number;
  esVistaCompleta: boolean;
};

function diasDesde(fecha: Date | null, ahora: Date) {
  if (!fecha) return null;
  return Math.floor((ahora.getTime() - fecha.getTime()) / 86_400_000);
}

/// La red de acompañamiento de quien mira: un mentor ve a sus aprendices;
/// pastor y administración ven toda la iglesia (ESPECIFICACION_PRODUCTO.md §11
/// y §12).
export async function cargarRed(
  usuario: UsuarioSesion,
  ahora = new Date(),
): Promise<ResumenDeLaRed> {
  const prisma = await getPrisma();
  const esVistaCompleta = usuario.role === Role.PASTOR || usuario.role === Role.ADMIN;

  const aprendices = await prisma.learnerProfile.findMany({
    where: esVistaCompleta
      ? {}
      : { mentorRelationships: { some: { mentorId: usuario.id, endedAt: null } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phase: true,
      person: { select: { firstName: true, lastName: true } },
      operation72: { select: { status: true, deadlineAt: true } },
      faithHouseProgress: {
        select: { status: true, completedAt: true },
      },
      milestones: {
        where: { achievedAt: { not: null } },
        orderBy: { achievedAt: "desc" },
        take: 1,
        select: { achievedAt: true },
      },
      privateNotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      mentorRelationships: {
        where: { endedAt: null },
        select: { startedAt: true, mentor: { select: { fullName: true } } },
      },
    },
  });

  const contactos = await prisma.contactAttempt.groupBy({
    by: ["operation72Id"],
    _max: { occurredAt: true },
  });

  const operaciones = await prisma.operation72.findMany({
    select: { id: true, learnerId: true },
  });
  const op72PorAprendiz = new Map(operaciones.map((o) => [o.learnerId, o.id]));
  const ultimoIntento = new Map(
    contactos.map((c) => [c.operation72Id, c._max.occurredAt]),
  );

  const personas: PersonaDeLaRed[] = aprendices.map((aprendiz) => {
    const temasCompletados = aprendiz.faithHouseProgress.filter(
      (a) => a.status === FaithHouseStatus.COMPLETADO,
    ).length;

    const op72 = aprendiz.operation72;
    const enOperacion72 =
      op72 &&
      op72.status !== Operation72Status.ENTREGADA &&
      op72.status !== Operation72Status.CERRADA;

    const fechas = [
      aprendiz.milestones[0]?.achievedAt ?? null,
      aprendiz.privateNotes[0]?.createdAt ?? null,
      ultimoIntento.get(op72PorAprendiz.get(aprendiz.id) ?? "") ?? null,
      ...aprendiz.faithHouseProgress.map((a) => a.completedAt),
    ].filter((f): f is Date => f instanceof Date);

    const ultimoContacto = fechas.length
      ? new Date(Math.max(...fechas.map((f) => f.getTime())))
      : null;
    const dias = diasDesde(ultimoContacto, ahora);

    const alertas: string[] = [];
    if (enOperacion72 && urgenciaDe(op72.deadlineAt, ahora) === "vencida") {
      alertas.push("Operación 72 vencida");
    } else if (enOperacion72 && urgenciaDe(op72.deadlineAt, ahora) === "urgente") {
      alertas.push(`Operación 72 · ${Math.max(horasRestantes(op72.deadlineAt, ahora), 0)} h`);
    }
    if (dias !== null && dias >= DIAS_SIN_CONTACTO) {
      alertas.push(`${dias} días sin registro`);
    }
    if (!aprendiz.mentorRelationships.length && aprendiz.phase !== Phase.GANAR) {
      alertas.push("Sin mentor asignado");
    }

    return {
      learnerId: aprendiz.id,
      nombre: nombreCompleto(aprendiz.person),
      fase: aprendiz.phase,
      // En la vista propia sobra decir quién acompaña: es quien mira.
      avance: enOperacion72
        ? `Operación 72 · ${Math.max(horasRestantes(op72.deadlineAt, ahora), 0)} h`
        : aprendiz.phase === Phase.FORTALECER
          ? `Casa de Fe ${temasCompletados}/12`
          : esVistaCompleta
            ? aprendiz.mentorRelationships[0]
              ? `Con ${aprendiz.mentorRelationships[0].mentor.fullName}`
              : "Sin mentor"
            : "Acompañamiento en curso",
      ultimoContacto,
      diasSinContacto: dias,
      alertas,
      // Terminó los 12 temas: le corresponde revisión de cierre de fase, que
      // decide un líder.
      listaParaRevision:
        aprendiz.phase === Phase.FORTALECER && temasCompletados === 12,
    };
  });

  return {
    personas,
    acompanadas: personas.length,
    conAlertas: personas.filter((p) => p.alertas.length > 0).length,
    operacion72: personas.filter((p) => p.avance.startsWith("Operación 72")).length,
    sinContacto: personas.filter(
      (p) => p.diasSinContacto !== null && p.diasSinContacto >= DIAS_SIN_CONTACTO,
    ).length,
    paraRevision: personas.filter((p) => p.listaParaRevision).length,
    esVistaCompleta,
  };
}
