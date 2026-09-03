import { Gender, Phase, Role } from "@iglesia/prisma-client";
import type { ClientePrisma } from "@/lib/prisma";
import { ESTADOS_EN_TABLERO } from "@/lib/op72";

export type CargaDeUsuario = {
  id: string;
  fullName: string;
  teamName: string | null;
  capacity: number;
  carga: number;
};

/// `genero` nulo = no se conoce el de la persona. En ese caso la regla del
/// mismo género (§5.4) no se puede aplicar y queda solo el criterio de menor
/// carga; un líder puede reasignar después.
async function candidatosConCarga(
  db: ClientePrisma,
  rol: Role,
  genero: Gender | null,
  contarCarga: (ids: string[]) => Promise<Map<string, number>>,
): Promise<CargaDeUsuario[]> {
  const candidatos = await db.appUser.findMany({
    where: {
      role: rol,
      active: true,
      ...(genero ? { person: { gender: genero } } : {}),
    },
    select: {
      id: true,
      fullName: true,
      capacity: true,
      team: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });

  if (candidatos.length === 0) return [];

  const carga = await contarCarga(candidatos.map((c) => c.id));

  return candidatos.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    teamName: c.team?.name ?? null,
    capacity: c.capacity,
    carga: carga.get(c.id) ?? 0,
  }));
}

/// Consolidadores disponibles del mismo género, con su carga actual.
///
/// Carga = personas **en fase GANAR** con su Operación 72 en curso. Al pasar a
/// FORTALECER la persona deja de ser de consolidación (la acompaña su mentor),
/// así que deja de pesar aquí aunque su Operación 72 hubiera quedado abierta.
export async function consolidadoresDisponibles(
  db: ClientePrisma,
  genero: Gender | null,
) {
  return candidatosConCarga(db, Role.CONSOLIDADOR, genero, async (ids) => {
    const grupos = await db.learnerProfile.groupBy({
      by: ["consolidatorId"],
      where: {
        consolidatorId: { in: ids },
        phase: Phase.GANAR,
        operation72: { status: { in: [...ESTADOS_EN_TABLERO] } },
      },
      _count: { _all: true },
    });
    return new Map(
      grupos
        .filter((g): g is typeof g & { consolidatorId: string } =>
          Boolean(g.consolidatorId),
        )
        .map((g) => [g.consolidatorId, g._count._all]),
    );
  });
}

/// Mentores del mismo género con su carga actual (relaciones de discipulado
/// abiertas).
export async function mentoresDisponibles(db: ClientePrisma, genero: Gender | null) {
  return candidatosConCarga(db, Role.MENTOR, genero, async (ids) => {
    const grupos = await db.mentorRelationship.groupBy({
      by: ["mentorId"],
      where: { mentorId: { in: ids }, endedAt: null },
      _count: { _all: true },
    });
    return new Map(grupos.map((g) => [g.mentorId, g._count._all]));
  });
}

/// El de menor carga; a igual carga, el de mayor capacidad libre. Sin filtrar
/// por cupo: reparte entre los que haya.
function menorCarga(candidatos: CargaDeUsuario[]) {
  if (candidatos.length === 0) return null;
  return candidatos.reduce((mejor, actual) => {
    if (actual.carga !== mejor.carga) return actual.carga < mejor.carga ? actual : mejor;
    return actual.capacity - actual.carga > mejor.capacity - mejor.carga
      ? actual
      : mejor;
  });
}

/// Elige respetando el cupo: solo entre quienes tienen espacio libre. Devuelve
/// `null` si nadie del mismo género tiene cupo, y entonces la asignación la
/// resuelve un líder.
///
/// El tope (24) es la regla de la MENTORÍA: un mentor acompaña hasta 24
/// discípulos en fase de multiplicación. Por eso solo se usa para mentores; la
/// consolidación reparte sin tope (ver `elegirPorMenorCarga`).
export function elegirPorCarga(candidatos: CargaDeUsuario[]) {
  return menorCarga(candidatos.filter((c) => c.carga < c.capacity));
}

/// Elige al de menor carga SIN aplicar el cupo como tope. La consolidación
/// nunca se puede quedar sin repartir: si todos los consolidadores están sobre
/// su capacidad, la persona igual se asigna al que menos tenga (la capacidad
/// queda como referencia para los líderes, no como bloqueo).
export function elegirPorMenorCarga(candidatos: CargaDeUsuario[]) {
  return menorCarga(candidatos);
}

/// Asignación automática de consolidador: respeta el género y balancea carga
/// (ESPECIFICACION_PRODUCTO.md §5.4).
///
/// No aplica el cupo como tope: el tope de 24 es de la mentoría, no de la
/// consolidación. Si todos están por encima de su capacidad, la persona igual
/// se asigna al de menor carga en vez de quedar sin consolidador.
export async function asignarConsolidador(db: ClientePrisma, genero: Gender | null) {
  const candidatos = await consolidadoresDisponibles(db, genero);
  return elegirPorMenorCarga(candidatos);
}

export type PropuestaDeMentor = {
  mentorId: string | null;
  titulo: string;
  detalle: string;
  conservaLinea: boolean;
};

/// Propuesta de entrega a mentor.
///
/// A. Con invitador conocido se conserva la línea: se propone el mentor que
///    acompaña al invitador.
/// B. Sin línea conocida se propone por perfil (género, carga, disponibilidad)
///    y la decisión final la confirma un líder.
export async function proponerMentor(
  db: ClientePrisma,
  learnerId: string,
): Promise<PropuestaDeMentor> {
  const aprendiz = await db.learnerProfile.findUniqueOrThrow({
    where: { id: learnerId },
    select: {
      invitedByPersonId: true,
      person: { select: { gender: true } },
    },
  });

  if (aprendiz.invitedByPersonId) {
    const mentorDeLinea = await mentorDeLaLinea(db, aprendiz.invitedByPersonId);
    if (mentorDeLinea) {
      return {
        mentorId: mentorDeLinea.id,
        titulo: `Mentor propuesto: ${mentorDeLinea.fullName}`,
        detalle: [
          mentorDeLinea.teamName,
          `carga ${mentorDeLinea.carga} de ${mentorDeLinea.capacity}`,
        ]
          .filter(Boolean)
          .join(" · "),
        conservaLinea: true,
      };
    }
  }

  const candidatos = await mentoresDisponibles(db, aprendiz.person.gender);
  const conCupo = candidatos.filter((c) => c.carga < c.capacity);
  const elegido = elegirPorCarga(candidatos);

  return {
    mentorId: elegido?.id ?? null,
    titulo: elegido
      ? `Sugerido: ${elegido.fullName}`
      : "Sin mentor con cupo · escalar a un líder",
    detalle: conCupo.length
      ? `${conCupo.length} ${conCupo.length === 1 ? "mentor" : "mentores"} con capacidad · confirma un líder`
      : "Ningún mentor del mismo género tiene cupo · confirma un líder",
    conservaLinea: false,
  };
}

/// Mentor que acompaña hoy a la persona invitadora. Si la invitadora es ella
/// misma mentora, la línea se conserva en ella.
async function mentorDeLaLinea(db: ClientePrisma, invitadorPersonId: string) {
  const usuarioInvitador = await db.appUser.findFirst({
    where: { personId: invitadorPersonId, active: true, role: Role.MENTOR },
    select: {
      id: true,
      fullName: true,
      capacity: true,
      team: { select: { name: true } },
    },
  });

  const candidato =
    usuarioInvitador ??
    (
      await db.mentorRelationship.findFirst({
        where: { learner: { personId: invitadorPersonId }, endedAt: null },
        orderBy: { startedAt: "desc" },
        select: {
          mentor: {
            select: {
              id: true,
              fullName: true,
              capacity: true,
              active: true,
              team: { select: { name: true } },
            },
          },
        },
      })
    )?.mentor;

  if (!candidato || ("active" in candidato && !candidato.active)) return null;

  const carga = await db.mentorRelationship.count({
    where: { mentorId: candidato.id, endedAt: null },
  });

  return {
    id: candidato.id,
    fullName: candidato.fullName,
    capacity: candidato.capacity,
    teamName: candidato.team?.name ?? null,
    carga,
  };
}
