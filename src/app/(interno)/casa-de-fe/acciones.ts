"use server";

import { revalidatePath } from "next/cache";
import { LearnerStatus, Phase } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import {
  normalizarReunion,
  REUNION_VACIA,
  type DatosDeReunion,
} from "@/lib/reunion-catalogo";
import { guardarReunionDeGrupo } from "@/lib/reunion";
import { nombreCompleto } from "@/lib/dominio";
import { auditar } from "@/lib/audit";
import {
  ErrorDePermiso,
  obtenerUsuarioActual,
  requerirVistaEnAccion,
} from "@/lib/auth";
import {
  puedeAdministrarCasaDeFe,
  lideresPosiblesCasaDeFe,
  puedeCrearCasaDeFe,
  puedeVerCasaDeFe,
} from "@/lib/casa-de-fe";
import { paraPermiso } from "@/lib/encargados-catalogo";
import {
  anadirEncargadoAlGrupo,
  cambiarLiderDelGrupo,
  quitarEncargadoDelGrupo,
} from "@/lib/encargados";

export type Resultado = { ok: true } | { ok: false; mensaje: string };

async function usuarioQueAbreCasas() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeCrearCasaDeFe(usuario)) throw new ErrorDePermiso();
  return usuario;
}

/// La Casa de Fe que esta persona puede administrar: la que lleva, o cualquiera
/// si es de dirección.
async function casaPropia(groupId: string) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeVerCasaDeFe(usuario)) throw new ErrorDePermiso();
  const prisma = await getPrisma();
  const grupo = await prisma.faithHouseGroup.findUnique({
    where: { id: groupId },
    // `createdById`: quien la abrió debe poder operarla aunque la lleve otra
    // persona.
    select: {
      id: true,
      leaderId: true,
      createdById: true,
      closedAt: true,
      coLeaders: { select: { userId: true } },
    },
  });
  if (!grupo) return { usuario, grupo: null };
  if (!(await puedeAdministrarCasaDeFe(usuario, paraPermiso(grupo))))
    return { usuario, grupo: null };
  return { usuario, grupo };
}

/// Abrir una Casa de Fe es de dirección; llevarla, de quien tenga el permiso.
/// Por eso se elige el líder al crearla, en vez de asignárselo a quien la abre.
export async function crearCasaDeFe(
  nombre: string,
  inicio: string,
  liderId: string,
  reunion: DatosDeReunion = REUNION_VACIA,
): Promise<Resultado> {
  const usuario = await usuarioQueAbreCasas();

  if (nombre.trim().length < 3) {
    return { ok: false, mensaje: "Ponle un nombre a la Casa de Fe." };
  }
  if (Number.isNaN(Date.parse(inicio))) {
    return { ok: false, mensaje: "La fecha de inicio no es válida." };
  }

  const limpia = normalizarReunion(reunion);
  if (!limpia.ok) return { ok: false, mensaje: limpia.mensaje };

  const prisma = await getPrisma();
  const lider = await prisma.appUser.findFirst({
    where: { id: liderId, active: true, canLeadFaithHouse: true },
    select: { id: true, teamId: true },
  });
  if (!lider) {
    return {
      ok: false,
      mensaje: "Elige quién la lleva, entre quienes tienen el permiso.",
    };
  }

  const grupo = await prisma.faithHouseGroup.create({
    data: {
      name: nombre.trim(),
      startDate: new Date(inicio),
      leaderId: lider.id,
      createdById: usuario.id,
      teamId: lider.teamId ?? usuario.teamId,
      ...limpia.datos,
    },
    select: { id: true },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "casa_de_fe.grupo_abierto",
    entityType: "faith_house_group",
    entityId: grupo.id,
    metadata: { liderId: lider.id },
  });

  revalidatePath("/alpha");
  return { ok: true };
}

export async function inscribirEnCasaDeFe(
  groupId: string,
  learnerId: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Esta Casa de Fe no es tuya." };
  if (grupo.closedAt) return { ok: false, mensaje: "La Casa de Fe ya está cerrada." };

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { id: true },
  });
  if (!aprendiz) return { ok: false, mensaje: "Esa persona no existe." };

  const yaEsta = await prisma.faithHouseGroupMember.findUnique({
    where: { groupId_learnerId: { groupId, learnerId } },
    select: { id: true },
  });
  if (yaEsta) return { ok: false, mensaje: "Ya está en la Casa de Fe." };

  await prisma.faithHouseGroupMember.create({ data: { groupId, learnerId } });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "casa_de_fe.miembro_inscrito",
    entityType: "faith_house_group",
    entityId: groupId,
    metadata: { learnerId },
  });

  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

export async function retirarDeCasaDeFe(
  groupId: string,
  membershipId: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Esta Casa de Fe no es tuya." };

  const prisma = await getPrisma();
  const miembro = await prisma.faithHouseGroupMember.findUnique({
    where: { id: membershipId },
    select: { id: true, groupId: true, learnerId: true },
  });
  // Se comprueba contra el grupo pedido: sin esto, el líder de una Casa podría
  // retirar a alguien de otra.
  if (!miembro || miembro.groupId !== groupId) {
    return { ok: false, mensaje: "Esa persona no está en esta Casa de Fe." };
  }

  await prisma.faithHouseGroupMember.delete({ where: { id: membershipId } });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "casa_de_fe.miembro_retirado",
    entityType: "faith_house_group",
    entityId: groupId,
    metadata: { learnerId: miembro.learnerId },
  });

  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// Cierra o reabre una Casa de Fe. Cerrarla no borra nada: solo deja de admitir
/// inscripciones y la marca como terminada.
export async function alternarCierreCasaDeFe(
  groupId: string,
  cerrar: boolean,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Esta Casa de Fe no es tuya." };

  const prisma = await getPrisma();
  await prisma.faithHouseGroup.update({
    where: { id: groupId },
    data: { closedAt: cerrar ? new Date() : null },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: cerrar ? "casa_de_fe.grupo_cerrado" : "casa_de_fe.grupo_abierto",
    entityType: "faith_house_group",
    entityId: groupId,
  });

  revalidatePath(`/casa-de-fe/${groupId}`);
  revalidatePath("/alpha");
  return { ok: true };
}

export type CandidatoCasaDeFe = {
  learnerId: string;
  nombre: string;
  fase: Phase;
  telefono: string | null;
};

/// Personas activas que todavía no están en esta Casa de Fe.
export async function buscarCandidatosCasaDeFe(
  groupId: string,
  consulta: string,
): Promise<CandidatoCasaDeFe[]> {
  const { grupo } = await casaPropia(groupId);
  if (!grupo) return [];

  const texto = consulta.trim();
  const prisma = await getPrisma();

  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      status: LearnerStatus.ACTIVO,
      faithHouseGroups: { none: { groupId } },
      ...(texto.length >= 2
        ? {
            person: {
              OR: [
                { firstName: { contains: texto, mode: "insensitive" as const } },
                { lastName: { contains: texto, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      phase: true,
      person: { select: { firstName: true, lastName: true, callPhone: true } },
    },
  });

  return aprendices.map((aprendiz) => ({
    learnerId: aprendiz.id,
    nombre: nombreCompleto(aprendiz.person),
    fase: aprendiz.phase,
    telefono: aprendiz.person.callPhone,
  }));
}

/// Guarda el día, la hora, la periodicidad y la dirección del grupo.
export async function guardarReunion(
  grupoId: string,
  datos: DatosDeReunion,
): Promise<Resultado> {
  let usuario;
  try {
    usuario = await requerirVistaEnAccion("grupos");
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const prisma = await getPrisma();
  const grupo = await prisma.faithHouseGroup.findUnique({
    where: { id: grupoId },
    select: {
      id: true,
      leaderId: true,
      createdById: true,
      coLeaders: { select: { userId: true } },
    },
  });
  if (!grupo) return { ok: false, mensaje: "No se encontró el grupo." };

  // Mover la reunión le cambia el calendario a todos sus miembros, así que lo
  // hace quien administra el grupo, no cualquiera que pueda verlo.
  if (!(await puedeAdministrarCasaDeFe(usuario, paraPermiso(grupo)))) {
    return { ok: false, mensaje: "No administras este grupo." };
  }

  const resultado = await guardarReunionDeGrupo(
    "casa-de-fe",
    grupoId,
    usuario.id,
    datos,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${grupoId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Quiénes lo llevan: el líder y los encargados
// ---------------------------------------------------------------------------

/// **Cambia el líder del grupo.** El anterior queda de encargado, así que no
/// pierde el grupo de su lista ni de su calendario.
export async function casaDeFeCambiarLider(
  groupId: string,
  nuevoLiderId: string,
  nota: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Esta Casa de Fe no es tuya." };

  const resultado = await cambiarLiderDelGrupo(
    "casa-de-fe",
    groupId,
    usuario.id,
    nuevoLiderId,
    nota,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// **Pone a alguien de encargado**, que administra el grupo igual que el líder.
export async function casaDeFeAnadirEncargado(
  groupId: string,
  userId: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Esta Casa de Fe no es tuya." };

  const resultado = await anadirEncargadoAlGrupo(
    "casa-de-fe",
    groupId,
    usuario.id,
    userId,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// **Quita a un encargado.** Al líder no se le quita por aquí: para eso está el
/// cambio de líder, que además pide decir por qué.
export async function casaDeFeQuitarEncargado(
  groupId: string,
  userId: string,
): Promise<Resultado> {
  const { usuario, grupo } = await casaPropia(groupId);
  if (!grupo) return { ok: false, mensaje: "Esta Casa de Fe no es tuya." };

  const resultado = await quitarEncargadoDelGrupo(
    "casa-de-fe",
    groupId,
    usuario.id,
    userId,
  );
  if (!resultado.ok) return resultado;

  revalidatePath("/alpha");
  revalidatePath(`/casa-de-fe/${groupId}`);
  return { ok: true };
}

/// **Las cuentas que pueden llevar este tipo de grupo**: activas y con el
/// permiso. Sirve para las dos listas del panel — la de líder y la de
/// encargados —, y por eso vienen TODAS: descartar aquí a quien ya lleva el
/// grupo dejaría sin candidatos al `<select>` de líder, donde un encargado
/// actual es justamente el caso normal.
///
/// Quién queda fuera de la lista de «añadir» lo decide el componente con
/// `candidatosDisponibles`, que es pura y vive en el catálogo.
export async function casaDeFeCuentasQuePuedenLlevar(
  groupId: string,
): Promise<{ id: string; fullName: string; role: string }[]> {
  const { grupo } = await casaPropia(groupId);
  if (!grupo) return [];
  return lideresPosiblesCasaDeFe();
}
