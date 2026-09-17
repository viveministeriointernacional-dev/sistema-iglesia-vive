import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { veTodaLaRed, type UsuarioSesion } from "@/lib/auth";
import { lideresDeMiRama } from "@/lib/red";
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
  return (
    usuario.canLeadFaithHouse ||
    usuario.veTodosLosGrupos ||
    puedeCrearCasaDeFe(usuario)
  );
}

/// **Quién ve TODAS las Casas de Fe de la iglesia.** Misma regla que Alpha y
/// que «Mi red»: el rol PASTOR ya no las abre todas.
///
/// Y, desde el 16-sep-2026, el permiso acumulable **«ve todos los grupos»**.
/// Pedido del usuario para el **líder de intercesión**: «que en su perfil pueda
/// ver todas las casas de fe». Como no acompaña a nadie, su rama está vacía y
/// la sección le quedaba en blanco — el permiso es la única forma de abrirla
/// sin devolverle la vista completa a todos los pastores.
export function esVistaCompletaDeCasaDeFe(usuario: UsuarioSesion) {
  return veTodaLaRed(usuario) || usuario.veTodosLosGrupos;
}

/// **Quién administra una Casa de Fe concreta**: su líder, quien la abrió, la
/// administración, o el líder que tiene al líder del grupo en su rama.
/// `createdById` entra por la misma razón que en Alpha: sin él, quien abre una
/// Casa de Fe y se la asigna a otra persona se queda sin poder tocarla.
export async function puedeAdministrarCasaDeFe(
  usuario: UsuarioSesion,
  grupo: { leaderId: string; createdById?: string | null },
) {
  if (grupo.leaderId === usuario.id) return true;
  if (grupo.createdById && grupo.createdById === usuario.id) return true;
  // `veTodaLaRed` y no `esVistaCompletaDeCasaDeFe`: ver todos los grupos es un
  // permiso de mirar, no de administrar. Ver la nota en `alpha.ts`.
  if (veTodaLaRed(usuario)) return true;
  return (await lideresDeMiRama(usuario.id)).includes(grupo.leaderId);
}

/// **Quién puede ABRIR la ficha de una Casa de Fe concreta**, aunque no pueda
/// tocarla.
///
/// Sin esto, el permiso «ve todos los grupos» sería una lista de nombres que al
/// pulsarlos dan 404 — peor que no verlos. Es la misma lección del 11-sep con
/// la rama heredada de «Mi red»: si se enseña, tiene que abrir.
export async function puedeEntrarACasaDeFe(
  usuario: UsuarioSesion,
  grupo: { leaderId: string; createdById?: string | null },
) {
  if (esVistaCompletaDeCasaDeFe(usuario)) return true;
  return puedeAdministrarCasaDeFe(usuario, grupo);
}

export async function cargarCasasDeFe(usuario: UsuarioSesion) {
  const prisma = await getPrisma();

  // La administración ve todas. Cualquier otro ve las que lleva, las que abrió,
  // y **las que lleva alguien de su rama**.
  const deLaRama = esVistaCompletaDeCasaDeFe(usuario)
    ? []
    : await lideresDeMiRama(usuario.id);

  return prisma.faithHouseGroup.findMany({
    where: esVistaCompletaDeCasaDeFe(usuario)
      ? {}
      : {
          OR: [
            { leaderId: usuario.id },
            { createdById: usuario.id },
            { leaderId: { in: deLaRama } },
          ],
        },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      weekday: true,
      meetingTime: true,
      everyNWeeks: true,
      durationMinutes: true,
      address: true,
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
      weekday: true,
      meetingTime: true,
      everyNWeeks: true,
      durationMinutes: true,
      address: true,
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
