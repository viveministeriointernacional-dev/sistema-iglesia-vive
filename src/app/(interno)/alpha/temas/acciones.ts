"use server";

import { revalidatePath } from "next/cache";

import { auditar } from "@/lib/audit";
import {
  ErrorDePermiso,
  ROLES_ADMIN,
  requerirRolEnAccion,
  type UsuarioSesion,
} from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { generarCodigo } from "@/lib/taller-catalogo";

export type ResultadoTema = { ok: true } | { ok: false; mensaje: string };

/// ⚠️ **Editar el catálogo de temas es SOLO de administración**, aunque la
/// pantalla la vea cualquiera que vea Alpha y Casa de Fe. Los 12 temas son los
/// mismos para toda la iglesia: si cada líder pudiera renombrarlos, dejarían de
/// significar lo mismo para todos y el avance de una persona no se podría
/// comparar con el de otra.
async function conAdmin(
  ejecutar: (usuario: UsuarioSesion) => Promise<ResultadoTema>,
): Promise<ResultadoTema> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_ADMIN);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }
  return ejecutar(usuario);
}

export async function guardarTema(
  topicId: string,
  datos: { nombre: string; subtitulo: string; versiculo: string },
): Promise<ResultadoTema> {
  return conAdmin(async (usuario) => {
    const prisma = await getPrisma();
    const nombre = datos.nombre.trim();
    if (nombre.length < 3) {
      return { ok: false, mensaje: "El nombre del tema no puede quedar vacío." };
    }

    const antes = await prisma.faithHouseTopic.findUnique({
      where: { id: topicId },
      select: { number: true, name: true },
    });
    if (!antes) return { ok: false, mensaje: "Ese tema no existe." };

    await prisma.$transaction(async (tx) => {
      await tx.faithHouseTopic.update({
        where: { id: topicId },
        data: {
          name: nombre,
          subtitle: datos.subtitulo.trim() || null,
          memoryVerse: datos.versiculo.trim() || null,
        },
      });

      // ⚠️ Se guarda el nombre ANTERIOR. Sin él, la bitácora no diría de qué a
      // qué cambió, y renombrar un tema es justo lo que reasigna el
      // significado de lo que la gente ya tiene marcado.
      await auditar(tx, {
        actorId: usuario.id,
        action: "casa_de_fe.tema_renombrado",
        entityType: "faith_house_topic",
        entityId: topicId,
        metadata: { tema: antes.number, antes: antes.name, ahora: nombre },
      });
    });

    revalidatePath("/alpha/temas");
    return { ok: true };
  });
}

/// Rehace el código del QR de un tema.
///
/// ⚠️ **Esto INVALIDA los carteles ya impresos de ese tema**, y por eso la
/// pantalla lo dice antes de dejar pulsarlo. Sirve cuando un código se filtró
/// donde no debía; no es un botón de todos los días.
export async function rehacerCodigo(topicId: string): Promise<ResultadoTema> {
  return conAdmin(async (usuario) => {
    const prisma = await getPrisma();
    const tema = await prisma.faithHouseTopic.findUnique({
      where: { id: topicId },
      select: { number: true, name: true },
    });
    if (!tema) return { ok: false, mensaje: "Ese tema no existe." };

    await prisma.$transaction(async (tx) => {
      await tx.faithHouseTopic.update({
        where: { id: topicId },
        // `crypto.getRandomValues`, nunca `Math.random`: es una credencial.
        data: { qrCode: generarCodigo() },
      });
      // El código NO se escribe en la auditoría: es un secreto, como el token
      // del calendario (la regla del 17-sep-2026).
      await auditar(tx, {
        actorId: usuario.id,
        action: "casa_de_fe.tema_renombrado",
        entityType: "faith_house_topic",
        entityId: topicId,
        metadata: { tema: tema.number, antes: tema.name, ahora: tema.name, qr: "rehecho" },
      });
    });

    revalidatePath("/alpha/temas");
    return { ok: true };
  });
}
