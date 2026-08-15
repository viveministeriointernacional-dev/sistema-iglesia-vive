import { Gender, Operation72Status, Role, type Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ESTADOS_EN_TABLERO } from "@/lib/op72";

type ClientePrisma = Prisma.TransactionClient | typeof prisma;

export type CargaDeUsuario = {
  id: string;
  fullName: string;
  teamName: string | null;
  capacity: number;
  carga: number;
};

async function candidatosConCarga(
  db: ClientePrisma,
  rol: Role,
  genero: Gender,
  contarCarga: (ids: string[]) => Promise<Map<string, number>>,
): Promise<CargaDeUsuario[]> {
  const candidatos = await db.appUser.findMany({
    where: { role: rol, active: true, person: { gender: genero } },
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

/// Consolidadores disponibles del mismo género, con su carga actual
/// (personas con Operación 72 en curso).
export async function consolidadoresDisponibles(
  db: ClientePrisma,
  genero: Gender,
) {
  return candidatosConCarga(db, Role.CONSOLIDADOR, genero, async (ids) => {
    const grupos = await db.learnerProfile.groupBy({
      by: ["consolidatorId"],
      where: {
        consolidatorId: { in: ids },
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
export async function mentoresDisponibles(db: ClientePrisma, genero: Gender) {
  return candidatosConCarga(db, Role.MENTOR, genero, async (ids) => {
    const grupos = await db.mentorRelationship.groupBy({
      by: ["mentorId"],
      where: { mentorId: { in: ids }, endedAt: null },
      _count: { _all: true },
    });
    return new Map(grupos.map((g) => [g.mentorId, g._count._all]));
  });
}

/// Elige el candidato con menor carga; a igual carga, el de mayor capacidad
/// libre. Devuelve `null` si nadie del mismo género tiene cupo: en ese caso la
/// asignación la resuelve un líder, no el sistema.
export function elegirPorCarga(candidatos: CargaDeUsuario[]) {
  const conCupo = candidatos.filter((c) => c.carga < c.capacity);
  if (conCupo.length === 0) return null;
  return conCupo.reduce((mejor, actual) => {
    if (actual.carga !== mejor.carga) return actual.carga < mejor.carga ? actual : mejor;
    return actual.capacity - actual.carga > mejor.capacity - mejor.carga
      ? actual
      : mejor;
  });
}

/// Asignación automática de consolidador: respeta el género y balancea carga
/// (ESPECIFICACION_PRODUCTO.md §5.4).
export async function asignarConsolidador(db: ClientePrisma, genero: Gender) {
  const candidatos = await consolidadoresDisponibles(db, genero);
  return elegirPorCarga(candidatos);
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

export { Operation72Status };
