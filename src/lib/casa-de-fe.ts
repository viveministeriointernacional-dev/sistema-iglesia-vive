import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { veTodaLaRed, type UsuarioSesion } from "@/lib/auth";
import { lideresDeMiRama } from "@/lib/red";
import { nombreCompleto } from "@/lib/dominio";
import {
  quienesLoLlevan,
  type GrupoParaPermiso,
} from "@/lib/encargados-catalogo";

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
  grupo: GrupoParaPermiso,
) {
  if (grupo.leaderId === usuario.id) return true;
  // Un encargado la administra IGUAL que el líder: inscribe, retira, cambia
  // día, hora y lugar. Es la decisión del usuario del 21-sep-2026, y la razón
  // de ser de la figura: las casas se llevan en pareja.
  if (grupo.coLeaderIds.includes(usuario.id)) return true;
  if (grupo.createdById && grupo.createdById === usuario.id) return true;
  // `veTodaLaRed` y no `esVistaCompletaDeCasaDeFe`: ver todos los grupos es un
  // permiso de mirar, no de administrar. Ver la nota en `alpha.ts`.
  if (veTodaLaRed(usuario)) return true;
  const deLaRama = await lideresDeMiRama(usuario.id);
  return quienesLoLlevan(grupo).some((id) => deLaRama.includes(id));
}

/// **Quién puede ABRIR la ficha de una Casa de Fe concreta**, aunque no pueda
/// tocarla.
///
/// Sin esto, el permiso «ve todos los grupos» sería una lista de nombres que al
/// pulsarlos dan 404 — peor que no verlos. Es la misma lección del 11-sep con
/// la rama heredada de «Mi red»: si se enseña, tiene que abrir.
export async function puedeEntrarACasaDeFe(
  usuario: UsuarioSesion,
  grupo: GrupoParaPermiso,
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
            // Las que lleva como ENCARGADO, y las que encarga alguien de su
            // rama. Sin estas dos, poner a alguien de encargado le daría el
            // permiso de administrar una casa que no le sale en la lista.
            { coLeaders: { some: { userId: usuario.id } } },
            { coLeaders: { some: { userId: { in: deLaRama } } } },
          ],
        },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      // El tipo de grupo: la pantalla pinta un bloque por cada uno. Las tres
      // consultas de este archivo traen los TRES tipos juntos a propósito —
      // son la misma tabla y el mismo alcance, y partirlas en tres daría tres
      // viajes a la base donde hoy hay uno (§12.5).
      kind: true,
      startDate: true,
      weekday: true,
      meetingTime: true,
      everyNWeeks: true,
      durationMinutes: true,
      latitude: true,
      longitude: true,
      address: true,
      closedAt: true,
      leaderId: true,
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
      kind: true,
      startDate: true,
      weekday: true,
      meetingTime: true,
      everyNWeeks: true,
      durationMinutes: true,
      latitude: true,
      longitude: true,
      address: true,
      closedAt: true,
      leaderId: true,
      createdById: true,
      leader: { select: { id: true, fullName: true, role: true } },
      coLeaders: {
        orderBy: { addedAt: "asc" },
        select: {
          id: true,
          userId: true,
          addedAt: true,
          user: { select: { fullName: true, role: true } },
        },
      },
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
                select: {
                  firstName: true,
                  lastName: true,
                  callPhone: true,
                  // El código entra en el MISMO viaje que ya se hacía. Pedirlo
                  // aparte sería una consulta por miembro y, con `max: 1`, una
                  // latencia por miembro (§7).
                  memberCode: { select: { code: true } },
                },
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
  /// Su código de miembro, el de 6 dígitos con el que entra al taller.
  /// `null` solo si esa ficha todavía no tiene uno — «Mandarle su código» lo
  /// crea (`codigoDeMiembro`), así que la pantalla lo dice en vez de callarlo.
  codigo: string | null;
};

export function construirMiembros(grupo: DatosCasaDeFe): MiembroCasaDeFe[] {
  return grupo.members.map((miembro) => ({
    membershipId: miembro.id,
    learnerId: miembro.learnerId,
    nombre: nombreCompleto(miembro.learner.person),
    fase: miembro.learner.phase,
    telefono: miembro.learner.person.callPhone,
    codigo: miembro.learner.person.memberCode?.code ?? null,
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
