"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@iglesia/prisma-client";
import { auditar } from "@/lib/audit";
import { ErrorDePermiso, requerirRolEnAccion, ROLES_ADMIN } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  esVistaConocida,
  VISTA_POR_ID,
  type VistaId,
} from "@/lib/vistas-catalogo";

export type ResultadoVistas = { ok: true } | { ok: false; mensaje: string };

async function conAdmin(
  ejecutar: (usuarioId: string) => Promise<ResultadoVistas>,
): Promise<ResultadoVistas> {
  try {
    const usuario = await requerirRolEnAccion(ROLES_ADMIN);
    return await ejecutar(usuario.id);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }
}

/// Valida que la vista exista en el catálogo.
///
/// ⚠️ No es una formalidad: el id llega del navegador. Sin esto se podrían
/// guardar filas para pantallas que no existen, que nadie vería nunca y que
/// ensuciarían la tabla para siempre.
function vistaValida(valor: string): VistaId | null {
  return esVistaConocida(valor) ? valor : null;
}

/// Enciende o apaga una pantalla para **todo un rol**.
export async function guardarVistaDeRol(
  vistaCruda: string,
  rolCrudo: string,
  encendida: boolean,
): Promise<ResultadoVistas> {
  return conAdmin(async (usuarioId) => {
    const vista = vistaValida(vistaCruda);
    if (!vista) return { ok: false, mensaje: "Esa pantalla no existe." };

    const rol = Object.values(Role).find((r) => r === rolCrudo);
    if (!rol) return { ok: false, mensaje: "Ese perfil no existe." };

    const prisma = await getPrisma();
    await prisma.viewRoleAccess.upsert({
      where: { view_role: { view: vista, role: rol } },
      create: { view: vista, role: rol, enabled: encendida, updatedById: usuarioId },
      update: { enabled: encendida, updatedById: usuarioId },
    });

    await auditar(prisma, {
      actorId: usuarioId,
      action: "vistas.rol_cambiado",
      entityType: "view_role_access",
      entityId: null,
      metadata: {
        vista,
        nombreVista: VISTA_POR_ID.get(vista)?.nombre ?? vista,
        rol,
        encendida,
      },
    });

    // El menú se arma en el layout con la sesión, así que hay que repintar
    // todo el árbol: a quien esté dentro le cambia la barra superior.
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/// La excepción de **una cuenta**: encendida, apagada, o que vuelva a seguir a
/// su rol (`null`, que borra la fila).
export async function guardarExcepcionDeVista(
  userId: string,
  vistaCruda: string,
  encendida: boolean | null,
): Promise<ResultadoVistas> {
  return conAdmin(async (usuarioId) => {
    const vista = vistaValida(vistaCruda);
    if (!vista) return { ok: false, mensaje: "Esa pantalla no existe." };

    const prisma = await getPrisma();
    const cuenta = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, personId: true },
    });
    if (!cuenta) return { ok: false, mensaje: "No se encontró la cuenta." };

    if (encendida === null) {
      // Quitar la excepción NO es apagarla: la cuenta vuelve a seguir a su rol.
      await prisma.viewUserAccess.deleteMany({ where: { userId, view: vista } });
    } else {
      await prisma.viewUserAccess.upsert({
        where: { view_userId: { view: vista, userId } },
        create: { view: vista, userId, enabled: encendida, updatedById: usuarioId },
        update: { enabled: encendida, updatedById: usuarioId },
      });
    }

    await auditar(prisma, {
      actorId: usuarioId,
      action: "vistas.excepcion_cambiada",
      entityType: "app_user",
      entityId: userId,
      metadata: {
        vista,
        nombreVista: VISTA_POR_ID.get(vista)?.nombre ?? vista,
        encendida,
      },
    });

    if (cuenta.personId) revalidatePath(`/administracion/${cuenta.personId}`);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
