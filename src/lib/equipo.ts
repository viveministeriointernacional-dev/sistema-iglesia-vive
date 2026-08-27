import { Role } from "@iglesia/prisma-client";
import type { UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";
import type { ClientePrisma } from "@/lib/prisma";
import { getPrisma } from "@/lib/prisma";

export type MentorElegible = {
  id: string;
  nombre: string;
  role: Role;
};

/// Quiénes pueden ser mentores: cualquier persona activa con rol de mentor,
/// pastor o administrador. Asignar el rol es lo que la habilita para aparecer
/// aquí; no se exige una fase, para que también entren pastores, administradores
/// y líderes sin proceso propio.
export const ROLES_MENTOR: Role[] = [Role.MENTOR, Role.PASTOR, Role.ADMIN];

export async function mentoresElegibles(
  db: ClientePrisma,
): Promise<MentorElegible[]> {
  const usuarios = await db.appUser.findMany({
    where: {
      active: true,
      role: { in: ROLES_MENTOR },
    },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
  return usuarios.map((u) => ({ id: u.id, nombre: u.fullName, role: u.role }));
}

export type MiembroEquipo = {
  personId: string;
  learnerId: string;
  nombre: string;
  tieneAcceso: boolean;
  esLiderAlpha: boolean;
  esLiderCasaFe: boolean;
};

/// Las personas que un mentor/pastor tiene asignadas a su mentoría (relación de
/// discipulado abierta), con su estado de líder de Alpha y Casa de Fe.
export async function cargarEquipo(
  usuario: UsuarioSesion,
): Promise<MiembroEquipo[]> {
  const db = await getPrisma();
  const relaciones = await db.mentorRelationship.findMany({
    where: { mentorId: usuario.id, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: {
      learner: {
        select: {
          id: true,
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: {
                select: {
                  canLeadAlpha: true,
                  canLeadFaithHouse: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return relaciones.map((relacion) => {
    const persona = relacion.learner.person;
    return {
      personId: persona.id,
      learnerId: relacion.learner.id,
      nombre: nombreCompleto(persona),
      tieneAcceso: Boolean(persona.user),
      esLiderAlpha: persona.user?.canLeadAlpha ?? false,
      esLiderCasaFe: persona.user?.canLeadFaithHouse ?? false,
    };
  });
}

/// Un administrador gestiona a cualquiera; un mentor o pastor solo a las
/// personas que tiene asignadas a su mentoría.
export async function puedeGestionarEquipoDe(
  usuario: UsuarioSesion,
  personId: string,
): Promise<boolean> {
  if (usuario.role === Role.ADMIN) return true;
  if (usuario.role === Role.MENTOR || usuario.role === Role.PASTOR) {
    const db = await getPrisma();
    const relacion = await db.mentorRelationship.findFirst({
      where: {
        mentorId: usuario.id,
        endedAt: null,
        learner: { personId },
      },
      select: { id: true },
    });
    return Boolean(relacion);
  }
  return false;
}
