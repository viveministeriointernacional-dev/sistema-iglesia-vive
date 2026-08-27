import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import type { UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";

/// Abrir y cerrar Casas de Fe es de dirección (pastor o mentor); llevarlas es de
/// quien tiene el permiso. Igual que en Alpha, se elige el líder al abrirla.
export function puedeCrearCasaDeFe(usuario: UsuarioSesion) {
  return (
    usuario.role === Role.MENTOR ||
    usuario.role === Role.PASTOR ||
    usuario.role === Role.ADMIN
  );
}

/// Quién puede ver la sección de Casa de Fe: quien tiene el permiso de llevarla
/// y quien puede abrir grupos.
export function puedeVerCasaDeFe(usuario: UsuarioSesion) {
  return usuario.canLeadFaithHouse || puedeCrearCasaDeFe(usuario);
}

export function esVistaCompletaDeCasaDeFe(usuario: UsuarioSesion) {
  return usuario.role === Role.PASTOR || usuario.role === Role.ADMIN;
}

/// Quién administra una Casa de Fe concreta: su líder asignado, o la dirección.
export function puedeAdministrarCasaDeFe(
  usuario: UsuarioSesion,
  grupo: { leaderId: string },
) {
  return grupo.leaderId === usuario.id || esVistaCompletaDeCasaDeFe(usuario);
}

export async function cargarCasasDeFe(usuario: UsuarioSesion) {
  const prisma = await getPrisma();

  return prisma.faithHouseGroup.findMany({
    // El pastor y la administración ven todas. Un mentor ve las que abrió; un
    // líder, las que lleva.
    where: esVistaCompletaDeCasaDeFe(usuario)
      ? {}
      : { OR: [{ leaderId: usuario.id }, { createdById: usuario.id }] },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      closedAt: true,
      leader: { select: { fullName: true } },
      _count: { select: { members: true } },
    },
  });
}

export async function cargarCasaDeFe(groupId: string) {
  const prisma = await getPrisma();

  return prisma.faithHouseGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      startDate: true,
      closedAt: true,
      leaderId: true,
      createdById: true,
      leader: { select: { fullName: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          learnerId: true,
          joinedAt: true,
          learner: {
            select: {
              phase: true,
              person: {
                select: { firstName: true, lastName: true, callPhone: true },
              },
            },
          },
        },
      },
    },
  });
}

export type DatosCasaDeFe = NonNullable<
  Awaited<ReturnType<typeof cargarCasaDeFe>>
>;

export type MiembroCasaDeFe = {
  membershipId: string;
  learnerId: string;
  nombre: string;
  fase: string;
  telefono: string | null;
};

export function construirMiembros(grupo: DatosCasaDeFe): MiembroCasaDeFe[] {
  return grupo.members.map((miembro) => ({
    membershipId: miembro.id,
    learnerId: miembro.learnerId,
    nombre: nombreCompleto(miembro.learner.person),
    fase: miembro.learner.phase,
    telefono: miembro.learner.person.callPhone,
  }));
}

/// Quién puede quedar como líder de una Casa de Fe: cualquiera con el permiso.
export async function lideresPosiblesCasaDeFe() {
  const prisma = await getPrisma();
  return prisma.appUser.findMany({
    where: { active: true, canLeadFaithHouse: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true },
  });
}
