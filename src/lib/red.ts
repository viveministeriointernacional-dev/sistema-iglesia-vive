import {
  FaithHouseStatus,
  LearnerStatus,
  Operation72Status,
  Phase,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { veTodaLaRed, type UsuarioSesion } from "@/lib/auth";
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
  /// De las de Operación 72, a cuántas se les pasó el plazo.
  operacion72Vencida: number;
  sinContacto: number;
  paraRevision: number;
  /// Cuántas hay en cada fase. Sale de `personas`, sin consultar de nuevo.
  porFase: Record<Phase, number>;
  esVistaCompleta: boolean;
};

const ALERTA_OP72_VENCIDA = "Operación 72 vencida";

function diasDesde(fecha: Date | null, ahora: Date) {
  if (!fecha) return null;
  return Math.floor((ahora.getTime() - fecha.getTime()) / 86_400_000);
}

/// **Los learnerId que cuelgan de quien mira, en cascada.**
///
/// La jerarquía no es un campo: sale de `MentorRelationship`, y una persona
/// acompañada puede a su vez acompañar a otras (su expediente y su cuenta se
/// enlazan por `person_id`). Así que la red de un mentor no son sus discípulos
/// directos: es **todo lo que cuelga de él**, tan hondo como llegue.
///
/// Va en SQL y no en varias consultas de Prisma porque el recorrido es
/// recursivo y no se sabe de antemano cuántos niveles tiene: con
/// `PrismaPg max: 1` cada nivel sería un viaje más al pooler, en fila.
///
/// `UNION` (no `UNION ALL`) corta cualquier ciclo: si por un error de datos A
/// acompaña a B y B a A, el recorrido termina en vez de colgarse. Es la misma
/// salvaguarda que `visitados` en `cargarArbol`.
export async function ramaDeLaRed(
  mentorId: string,
): Promise<Map<string, number>> {
  const prisma = await getPrisma();
  const filas = await prisma.$queryRaw<{ learner_id: string; nivel: number }[]>`
    WITH RECURSIVE rama AS (
      SELECT mr.learner_id, 1 AS nivel
      FROM mentor_relationship mr
      WHERE mr.mentor_id = ${mentorId} AND mr.ended_at IS NULL
      UNION
      SELECT mr.learner_id, r.nivel + 1
      FROM rama r
      JOIN learner_profile lp ON lp.id = r.learner_id
      JOIN app_user u ON u.person_id = lp.person_id
      JOIN mentor_relationship mr
        ON mr.mentor_id = u.id AND mr.ended_at IS NULL
    )
    SELECT learner_id, MIN(nivel)::int AS nivel FROM rama GROUP BY learner_id
  `;
  return new Map(filas.map((f) => [f.learner_id, Number(f.nivel)]));
}

/// **A qué profundidad está un expediente bajo un líder** (nulo si no cuelga
/// de él). Es `ramaDeLaRed` al revés: sube por la cadena de mentores desde la
/// persona hasta encontrar al líder.
///
/// Se sube en vez de bajar a propósito: para autorizar UN expediente sobra
/// traer la rama entera del líder, y la cadena hacia arriba tiene tantos pasos
/// como niveles tenga la iglesia (hoy 4), no tantos como personas.
export async function nivelEnLaRamaDe(
  mentorId: string,
  learnerId: string,
): Promise<number | null> {
  const prisma = await getPrisma();
  const filas = await prisma.$queryRaw<{ nivel: number }[]>`
    WITH RECURSIVE cadena AS (
      SELECT mr.mentor_id, 1 AS nivel
      FROM mentor_relationship mr
      WHERE mr.learner_id = ${learnerId} AND mr.ended_at IS NULL
      UNION
      SELECT mr.mentor_id, c.nivel + 1
      FROM cadena c
      JOIN app_user u ON u.id = c.mentor_id
      JOIN learner_profile lp ON lp.person_id = u.person_id
      JOIN mentor_relationship mr
        ON mr.learner_id = lp.id AND mr.ended_at IS NULL
    )
    SELECT MIN(nivel)::int AS nivel
    FROM cadena
    WHERE mentor_id = ${mentorId}
  `;
  const nivel = filas[0]?.nivel;
  return nivel == null ? null : Number(nivel);
}

/// La red de acompañamiento de quien mira.
///
/// **Pastor y administración ven toda la iglesia**
/// (ESPECIFICACION_PRODUCTO.md §11 y §12). **Cualquier otro ve su rama y nada
/// más**: a quien acompaña, y a quien acompañan ellos, en cascada.
///
/// ⚠️ Antes esta lista traía **solo los discípulos directos**, mientras el
/// árbol de la misma pantalla ya bajaba en cascada. O sea que las dos vistas
/// de «Mi red» enseñaban redes distintas, y la lista se quedaba corta justo
/// donde importa: un mentor no veía a la gente que sus discípulos ya están
/// liderando, que es precisamente lo que tiene que acompañar.
export async function cargarRed(
  usuario: UsuarioSesion,
  ahora = new Date(),
): Promise<ResumenDeLaRed> {
  const prisma = await getPrisma();
  const esVistaCompleta = veTodaLaRed(usuario);

  // La rama solo se calcula cuando hace falta recortar: quien ve todo no tiene
  // rama que recorrer.
  const rama = esVistaCompleta ? null : await ramaDeLaRed(usuario.id);

  const aprendices = await prisma.learnerProfile.findMany({
    // Quien está dado de baja (Retirado) no aparece en la red: vive en el
    // listado aparte de administración.
    where: {
      status: { not: LearnerStatus.RETIRADO },
      ...(rama ? { id: { in: [...rama.keys()] } } : {}),
    },
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
      alertas.push(ALERTA_OP72_VENCIDA);
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
      // Decir quién acompaña sobra solo cuando es quien mira. En la rama
      // heredada —alguien a quien acompaña uno de sus discípulos— es el dato
      // que hace falta: sin él la lista no distingue a los propios de los que
      // vienen de más abajo.
      avance: enOperacion72
        ? `Operación 72 · ${Math.max(horasRestantes(op72.deadlineAt, ahora), 0)} h`
        : aprendiz.phase === Phase.FORTALECER
          ? `Casa de Fe ${temasCompletados}/12`
          : esVistaCompleta || (rama?.get(aprendiz.id) ?? 1) > 1
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

  const porFase: Record<Phase, number> = {
    [Phase.GANAR]: 0,
    [Phase.FORTALECER]: 0,
    [Phase.ENTRENAR]: 0,
    [Phase.MULTIPLICAR]: 0,
  };
  for (const persona of personas) porFase[persona.fase] += 1;

  return {
    personas,
    porFase,
    acompanadas: personas.length,
    conAlertas: personas.filter((p) => p.alertas.length > 0).length,
    operacion72: personas.filter((p) => p.avance.startsWith("Operación 72")).length,
    operacion72Vencida: personas.filter((p) =>
      p.alertas.includes(ALERTA_OP72_VENCIDA),
    ).length,
    sinContacto: personas.filter(
      (p) => p.diasSinContacto !== null && p.diasSinContacto >= DIAS_SIN_CONTACTO,
    ).length,
    paraRevision: personas.filter((p) => p.listaParaRevision).length,
    esVistaCompleta,
  };
}
