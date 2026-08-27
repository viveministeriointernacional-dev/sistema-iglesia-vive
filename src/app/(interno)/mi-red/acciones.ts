"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@iglesia/prisma-client";
import { auditar } from "@/lib/audit";
import {
  ErrorDePermiso,
  requerirRolEnAccion,
  type UsuarioSesion,
} from "@/lib/auth";
import { correoCredenciales } from "@/lib/correo";
import { nombreCompleto } from "@/lib/dominio";
import { puedeGestionarEquipoDe } from "@/lib/equipo";
import { getPrisma } from "@/lib/prisma";
import { crearSupabaseAdmin } from "@/lib/supabase/admin";

/// Quién puede designar líderes en su equipo: mentor, pastor y administrador.
const ROLES_EQUIPO: Role[] = [Role.MENTOR, Role.PASTOR, Role.ADMIN];

export type ResultadoLider =
  | { ok: true }
  | { ok: false; mensaje: string }
  /// La persona no tiene cuenta: hay que crearla para poder darle el permiso.
  | { ok: false; necesitaCuenta: true; nombre: string };

export type TipoLider = "alpha" | "casa";

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function conEquipo(
  personId: string,
  ejecutar: (usuario: UsuarioSesion) => Promise<ResultadoLider>,
): Promise<ResultadoLider> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_EQUIPO);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }
  if (!(await puedeGestionarEquipoDe(usuario, personId))) {
    return { ok: false, mensaje: "Esta persona no está en tu equipo." };
  }
  return ejecutar(usuario);
}

/// Marca o quita a alguien de tu equipo como líder de Alpha o de Casa de Fe.
/// Si no tiene cuenta y lo estás activando, devuelve `necesitaCuenta` para que
/// la interfaz pida crear el acceso.
export async function marcarLider(
  personId: string,
  tipo: TipoLider,
  activo: boolean,
): Promise<ResultadoLider> {
  return conEquipo(personId, async (usuario) => {
    const prisma = await getPrisma();
    const persona = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        firstName: true,
        lastName: true,
        user: { select: { id: true } },
      },
    });
    if (!persona) return { ok: false, mensaje: "No se encontró la persona." };

    if (!persona.user) {
      if (!activo) return { ok: true };
      return {
        ok: false,
        necesitaCuenta: true,
        nombre: nombreCompleto(persona),
      };
    }

    await prisma.appUser.update({
      where: { id: persona.user.id },
      data:
        tipo === "alpha"
          ? { canLeadAlpha: activo }
          : { canLeadFaithHouse: activo },
    });

    await auditar(prisma, {
      actorId: usuario.id,
      action: "equipo.lider_asignado",
      entityType: "app_user",
      entityId: persona.user.id,
      metadata: { tipo, activo, porMentor: usuario.id },
    });

    revalidatePath("/mi-red");
    return { ok: true };
  });
}

/// Crea el acceso de un integrante del equipo y, de una vez, lo deja como líder
/// de Alpha o de Casa de Fe. Se usa cuando la persona todavía no tiene login.
export async function crearAccesoLider(
  personId: string,
  datos: { email: string; password: string; tipo: TipoLider },
): Promise<ResultadoLider> {
  return conEquipo(personId, async (usuario) => {
    const email = datos.email.trim().toLowerCase();
    if (!CORREO.test(email)) {
      return { ok: false, mensaje: "Escribe un correo válido para el acceso." };
    }
    if (datos.password.length < 6) {
      return { ok: false, mensaje: "La contraseña debe tener al menos 6 caracteres." };
    }

    const prisma = await getPrisma();
    const persona = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { id: true } },
      },
    });
    if (!persona) return { ok: false, mensaje: "No se encontró la persona." };
    if (persona.user) {
      // Ya tiene cuenta: no se crea otra, solo se marca el permiso.
      return marcarLider(personId, datos.tipo, true);
    }

    const yaUsado = await prisma.appUser.findUnique({
      where: { email },
      select: { id: true },
    });
    if (yaUsado) return { ok: false, mensaje: "Ya existe una cuenta con ese correo." };

    const admin = await crearSupabaseAdmin();
    if (!admin) {
      return {
        ok: false,
        mensaje:
          "Falta configurar el secreto SUPABASE_SERVICE_ROLE_KEY en el Worker para poder crear accesos.",
      };
    }

    const creado = await admin.auth.admin.createUser({
      email,
      password: datos.password,
      email_confirm: true,
    });
    if (creado.error || !creado.data.user) {
      return {
        ok: false,
        mensaje: `No se pudo crear el acceso: ${creado.error?.message ?? "error desconocido"}`,
      };
    }

    try {
      await prisma.appUser.create({
        data: {
          authUserId: creado.data.user.id,
          email,
          fullName: nombreCompleto(persona),
          // Ser líder es un permiso, no un rol: sigue siendo aprendiz en su
          // propio proceso.
          role: Role.APRENDIZ,
          canLeadAlpha: datos.tipo === "alpha",
          canLeadFaithHouse: datos.tipo === "casa",
          personId: persona.id,
        },
      });
    } catch (error) {
      await admin.auth.admin.deleteUser(creado.data.user.id).catch(() => {});
      throw error;
    }

    await auditar(prisma, {
      actorId: usuario.id,
      action: "equipo.acceso_creado",
      entityType: "person",
      entityId: personId,
      metadata: { email, tipo: datos.tipo, porMentor: usuario.id },
    });

    // Le avisamos por correo sus datos de ingreso (best-effort).
    await correoCredenciales({
      to: email,
      nombre: nombreCompleto(persona),
      email,
      password: datos.password,
    });

    revalidatePath("/mi-red");
    return { ok: true };
  });
}
