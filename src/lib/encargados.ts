import { auditar } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { LARGO_MINIMO_NOTA } from "@/lib/encargados-catalogo";
import type { TipoDeGrupo } from "@/lib/reunion";

/// **Quién lleva el grupo: cambiar el líder, y poner o quitar encargados.**
///
/// Compartido por Alpha y Casa de Fe, como `reunion.ts`: las dos pantallas
/// hacen exactamente lo mismo, y un archivo `"use server"` solo puede exportar
/// funciones `async` (la regla que tumbó el tablero el 12-sep-2026).
///
/// Aquí NO se comprueba ningún permiso a propósito: eso lo hace cada
/// `acciones.ts` con `puedeAdministrarGrupo` / `puedeAdministrarCasaDeFe`
/// antes de llamar, que es donde ya vive esa decisión.

export type ResultadoEncargados = { ok: true } | { ok: false; mensaje: string };

/// Lo que se sabe de un grupo para estas tres operaciones.
type GrupoConEncargados = {
  leaderId: string;
  coLeaders: { userId: string }[];
};

const ENTIDAD = {
  alpha: "alpha_program",
  "casa-de-fe": "faith_house_group",
} as const;

async function leerGrupo(
  tipo: TipoDeGrupo,
  grupoId: string,
): Promise<GrupoConEncargados | null> {
  const prisma = await getPrisma();
  const seleccion = {
    leaderId: true,
    coLeaders: { select: { userId: true } },
  } as const;

  return tipo === "alpha"
    ? prisma.alphaProgram.findUnique({ where: { id: grupoId }, select: seleccion })
    : prisma.faithHouseGroup.findUnique({ where: { id: grupoId }, select: seleccion });
}

/// **Una cuenta que de verdad puede llevar este tipo de grupo.**
///
/// ⚠️ Se comprueba en el servidor aunque el formulario solo ofrezca las
/// correctas: un `<select>` es una sugerencia del navegador, no una garantía.
/// Sin esto se podría poner de líder a una cuenta desactivada, y el grupo
/// quedaría a nombre de alguien que ni siquiera puede entrar.
async function cuentaQuePuedeLlevar(tipo: TipoDeGrupo, userId: string) {
  const prisma = await getPrisma();
  return prisma.appUser.findFirst({
    where: {
      id: userId,
      active: true,
      ...(tipo === "alpha"
        ? { canLeadAlpha: true }
        : { canLeadFaithHouse: true }),
    },
    select: { id: true, fullName: true },
  });
}

/// **Cambia el líder del grupo.**
///
/// ⚠️ **El líder saliente NO pierde el grupo: pasa a encargado** (decisión del
/// usuario, 21-sep-2026). Casi siempre esto es pasar la batuta dentro de la
/// pareja que ya lleva la casa, y sacarlo de un tirón se lo borraría de su
/// lista y de su calendario sin que nadie lo hubiera pedido. Si de verdad hay
/// que sacarlo, se le quita después con un clic.
///
/// ⚠️ Y **si el líder nuevo ya era encargado, deja de serlo**: si no, quedaría
/// dos veces en la ficha, y el índice único de la base rechazaría el renglón.
export async function cambiarLiderDelGrupo(
  tipo: TipoDeGrupo,
  grupoId: string,
  actorId: string,
  nuevoLiderId: string,
  nota: string,
): Promise<ResultadoEncargados> {
  const limpia = nota.trim();
  if (limpia.length < LARGO_MINIMO_NOTA) {
    return {
      ok: false,
      mensaje:
        "Escribe por qué cambia el líder (al menos una frase). Es lo único que le explica el cambio a quien abra el grupo dentro de seis meses.",
    };
  }

  const grupo = await leerGrupo(tipo, grupoId);
  if (!grupo) return { ok: false, mensaje: "No se encontró el grupo." };

  if (grupo.leaderId === nuevoLiderId) {
    return { ok: false, mensaje: "Esa persona ya es el líder del grupo." };
  }

  const nuevo = await cuentaQuePuedeLlevar(tipo, nuevoLiderId);
  if (!nuevo) {
    return {
      ok: false,
      mensaje:
        "Esa cuenta no puede llevar este grupo. Revisa en Administración que esté activa y tenga el permiso.",
    };
  }

  const prisma = await getPrisma();
  const anterior = await prisma.appUser.findUnique({
    where: { id: grupo.leaderId },
    select: { fullName: true },
  });

  // Todo junto: si algo falla, el grupo no puede quedar con líder nuevo y la
  // lista de encargados a medias.
  await prisma.$transaction(async (tx) => {
    if (tipo === "alpha") {
      await tx.alphaProgram.update({
        where: { id: grupoId },
        data: { leaderId: nuevoLiderId },
      });
      await tx.alphaCoLeader.deleteMany({
        where: { programId: grupoId, userId: nuevoLiderId },
      });
      await tx.alphaCoLeader.create({
        data: { programId: grupoId, userId: grupo.leaderId, addedById: actorId },
      });
    } else {
      await tx.faithHouseGroup.update({
        where: { id: grupoId },
        data: { leaderId: nuevoLiderId },
      });
      await tx.faithHouseCoLeader.deleteMany({
        where: { groupId: grupoId, userId: nuevoLiderId },
      });
      await tx.faithHouseCoLeader.create({
        data: { groupId: grupoId, userId: grupo.leaderId, addedById: actorId },
      });
    }
  });

  await auditar(prisma, {
    actorId,
    action: tipo === "alpha" ? "alpha.lider_cambiado" : "casa_de_fe.lider_cambiado",
    entityType: ENTIDAD[tipo],
    entityId: grupoId,
    metadata: {
      // Los dos nombres, no solo el nuevo: sin el «antes» la bitácora no dice
      // a quién se le quitó el grupo, que es justo lo que alguien va a querer
      // entender dentro de seis meses.
      antes: anterior?.fullName ?? null,
      antesId: grupo.leaderId,
      ahora: nuevo.fullName,
      ahoraId: nuevoLiderId,
      quedaDeEncargado: true,
      nota: limpia,
    },
  });

  return { ok: true };
}

/// **Pone a alguien de encargado**: lo administra igual que el líder.
export async function anadirEncargadoAlGrupo(
  tipo: TipoDeGrupo,
  grupoId: string,
  actorId: string,
  userId: string,
): Promise<ResultadoEncargados> {
  const grupo = await leerGrupo(tipo, grupoId);
  if (!grupo) return { ok: false, mensaje: "No se encontró el grupo." };

  if (grupo.leaderId === userId) {
    return {
      ok: false,
      mensaje: "Esa persona ya es el líder del grupo, no hace falta añadirla.",
    };
  }
  if (grupo.coLeaders.some((encargado) => encargado.userId === userId)) {
    return { ok: false, mensaje: "Esa persona ya está de encargada." };
  }

  const cuenta = await cuentaQuePuedeLlevar(tipo, userId);
  if (!cuenta) {
    return {
      ok: false,
      mensaje:
        "Esa cuenta no puede llevar este grupo. Revisa en Administración que esté activa y tenga el permiso.",
    };
  }

  const prisma = await getPrisma();
  if (tipo === "alpha") {
    await prisma.alphaCoLeader.create({
      data: { programId: grupoId, userId, addedById: actorId },
    });
  } else {
    await prisma.faithHouseCoLeader.create({
      data: { groupId: grupoId, userId, addedById: actorId },
    });
  }

  await auditar(prisma, {
    actorId,
    action:
      tipo === "alpha" ? "alpha.encargado_anadido" : "casa_de_fe.encargado_anadido",
    entityType: ENTIDAD[tipo],
    entityId: grupoId,
    metadata: { encargado: cuenta.fullName, encargadoId: userId },
  });

  return { ok: true };
}

/// **Quita a un encargado.** No toca al líder: para eso está el cambio de
/// líder, que además deja constancia de por qué.
export async function quitarEncargadoDelGrupo(
  tipo: TipoDeGrupo,
  grupoId: string,
  actorId: string,
  userId: string,
): Promise<ResultadoEncargados> {
  const grupo = await leerGrupo(tipo, grupoId);
  if (!grupo) return { ok: false, mensaje: "No se encontró el grupo." };

  if (!grupo.coLeaders.some((encargado) => encargado.userId === userId)) {
    return { ok: false, mensaje: "Esa persona no está de encargada." };
  }

  const prisma = await getPrisma();
  const cuenta = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { fullName: true },
  });

  if (tipo === "alpha") {
    await prisma.alphaCoLeader.deleteMany({
      where: { programId: grupoId, userId },
    });
  } else {
    await prisma.faithHouseCoLeader.deleteMany({
      where: { groupId: grupoId, userId },
    });
  }

  await auditar(prisma, {
    actorId,
    action:
      tipo === "alpha" ? "alpha.encargado_quitado" : "casa_de_fe.encargado_quitado",
    entityType: ENTIDAD[tipo],
    entityId: grupoId,
    metadata: { encargado: cuenta?.fullName ?? null, encargadoId: userId },
  });

  return { ok: true };
}
