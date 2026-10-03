"use server";

import { revalidatePath } from "next/cache";
import { LearnerStatus, Role } from "@iglesia/prisma-client";

import { ErrorDePermiso, obtenerUsuarioActual, requerirVistaEnAccion } from "@/lib/auth";
import { nombreCompleto, telefonoLegible } from "@/lib/dominio";
import { getPrisma } from "@/lib/prisma";
import {
  cerrarPareja,
  crearPareja,
  destaparTema,
  puedeLlevarPrematrimonial,
  revisarTema,
} from "@/lib/prematrimonial";

export type ResultadoPrematrimonial =
  | { ok: true; aviso?: string }
  | { ok: false; mensaje: string };

async function usuarioDelPrematrimonial() {
  await requerirVistaEnAccion("escuela");
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!puedeLlevarPrematrimonial(usuario)) throw new ErrorDePermiso();
  return usuario;
}

export type CandidatoPrematrimonial = {
  learnerId: string;
  nombre: string;
  telefono: string | null;
  yaEnOtro: boolean;
};

/// Personas activas para armar una pareja.
///
/// ⚠️ **Se devuelven también las que YA están en un prematrimonial abierto**,
/// marcadas. Esconderlas dejaría al pastor buscando un nombre que no aparece
/// sin saber por qué — es la regla del 16-sep al derecho: si no se puede
/// elegir, hay que decir el motivo, no borrar el renglón.
export async function buscarCandidatosPrematrimonial(
  consulta: string,
): Promise<CandidatoPrematrimonial[]> {
  await usuarioDelPrematrimonial();

  const texto = consulta.trim();
  if (texto.length < 2) return [];

  const prisma = await getPrisma();
  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      status: LearnerStatus.ACTIVO,
      person: {
        OR: [
          { firstName: { contains: texto, mode: "insensitive" as const } },
          { lastName: { contains: texto, mode: "insensitive" as const } },
        ],
      },
    },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      person: { select: { firstName: true, lastName: true, callPhone: true } },
      prematrimonialComoA: { where: { closedAt: null }, select: { id: true } },
      prematrimonialComoB: { where: { closedAt: null }, select: { id: true } },
    },
  });

  return aprendices.map((a) => ({
    learnerId: a.id,
    nombre: nombreCompleto(a.person),
    telefono: telefonoLegible(a.person.callPhone),
    yaEnOtro: a.prematrimonialComoA.length > 0 || a.prematrimonialComoB.length > 0,
  }));
}

export type PastorPosible = { id: string; fullName: string };

/// Quién puede acompañar una pareja: las cuentas activas de pastor y
/// administración, que es a quienes el usuario les abrió el prematrimonial.
export async function pastoresPosibles(): Promise<PastorPosible[]> {
  await usuarioDelPrematrimonial();
  const prisma = await getPrisma();
  return prisma.appUser.findMany({
    where: { active: true, role: { in: [Role.PASTOR, Role.ADMIN] } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
}

export async function abrirPareja(
  learnerAId: string,
  learnerBId: string,
  leaderId: string | null,
): Promise<ResultadoPrematrimonial> {
  const usuario = await usuarioDelPrematrimonial();
  const r = await crearPareja(usuario, { learnerAId, learnerBId, leaderId });
  if (!r.ok) return r;
  revalidatePath("/escuela/prematrimonial");
  return { ok: true };
}

export async function alternarCierre(
  coupleId: string,
  abrir: boolean,
): Promise<ResultadoPrematrimonial> {
  const usuario = await usuarioDelPrematrimonial();
  const r = await cerrarPareja(usuario, coupleId, abrir);
  if (!r.ok) return r;
  revalidatePath("/escuela/prematrimonial");
  revalidatePath(`/escuela/prematrimonial/${coupleId}`);
  return { ok: true };
}

export async function destapar(
  coupleId: string,
  topicId: string,
): Promise<ResultadoPrematrimonial> {
  const usuario = await usuarioDelPrematrimonial();
  const r = await destaparTema(usuario, coupleId, topicId);
  if (!r.ok) return r;
  revalidatePath(`/escuela/prematrimonial/${coupleId}`);
  revalidatePath(`/escuela/prematrimonial/${coupleId}/${topicId}`);
  return {
    ok: true,
    aviso:
      "Listo: los dos ya pueden ver lo que respondió el otro. Esto no se puede deshacer.",
  };
}

export async function revisar(
  coupleId: string,
  topicId: string,
  aprobado: boolean,
  nota: string,
  devueltoA: string | null,
): Promise<ResultadoPrematrimonial> {
  const usuario = await usuarioDelPrematrimonial();
  const r = await revisarTema(usuario, {
    coupleId,
    topicId,
    aprobado,
    nota,
    devueltoA,
  });
  if (!r.ok) return r;
  revalidatePath("/escuela/prematrimonial");
  revalidatePath(`/escuela/prematrimonial/${coupleId}`);
  revalidatePath(`/escuela/prematrimonial/${coupleId}/${topicId}`);
  return {
    ok: true,
    aviso: r.datos.completoLosDoce
      ? "Terminaron los 12 temas. Les quedó el hito del prematrimonial en el expediente a los dos."
      : undefined,
  };
}
