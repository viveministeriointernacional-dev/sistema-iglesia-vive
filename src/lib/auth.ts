import { cache } from "react";
import { redirect } from "next/navigation";
import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UsuarioSesion = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  personId: string | null;
  teamId: string | null;
  /// Permiso para llevar grupos de Alpha, independiente del rol.
  canLeadAlpha: boolean;
  /// Permiso para llevar Casa de Fe, independiente del rol.
  canLeadFaithHouse: boolean;
  /// Coordina la consolidación: consolidador que revisa a todos, no solo lo
  /// suyo. Independiente del rol.
  coordinaConsolidacion: boolean;
  /// Permiso para acompañar como mentor, independiente del rol: deja que un
  /// consolidador tenga discípulos sin dejar de ser consolidador.
  canMentor: boolean;
};

/// Quién administra el sistema: personas, roles, permisos y procesos.
export const ROLES_ADMIN: Role[] = [Role.ADMIN];

export const ETIQUETA_ROL: Record<Role, string> = {
  APRENDIZ: "Aprendiz",
  CONSOLIDADOR: "Consolidador",
  LIDER_ALPHA: "Líder Alpha",
  MENTOR: "Mentor",
  PASTOR: "Pastor",
  ADMIN: "Administrador",
};

/// Quién puede operar el tablero de Operación 72 y registrar personas nuevas.
export const ROLES_CONSOLIDACION: Role[] = [
  Role.CONSOLIDADOR,
  Role.PASTOR,
  Role.ADMIN,
];

/// Quiénes acompañan como mentores POR SU ROL. Además, cualquiera con el
/// permiso `canMentor` también acompaña: ser mentor es acumulable, igual que
/// liderar Alpha o Casa de Fe. Usa `puedeMentorear` en vez de esta lista.
export const ROLES_MENTOR: Role[] = [Role.MENTOR, Role.PASTOR, Role.ADMIN];

/// Acompaña discípulos: por su rol, o por el permiso acumulable `canMentor`.
/// Así un consolidador puede ser mentor sin dejar de ser consolidador.
export function puedeMentorear(usuario: UsuarioSesion): boolean {
  return ROLES_MENTOR.includes(usuario.role) || usuario.canMentor;
}

/// Filtro de Prisma equivalente a `puedeMentorear`, para consultar candidatos.
export const DONDE_PUEDE_MENTOREAR = {
  OR: [{ role: { in: ROLES_MENTOR } }, { canMentor: true }],
};

/// Quién tiene una red de acompañamiento que mirar.
export const ROLES_CON_RED: Role[] = [Role.MENTOR, Role.PASTOR, Role.ADMIN];

/// Tiene red que mirar: por rol, o porque acompaña como mentor por permiso.
export function tieneRed(usuario: UsuarioSesion): boolean {
  return ROLES_CON_RED.includes(usuario.role) || usuario.canMentor;
}

/// Quién puede buscar personas y abrir expedientes desde el buscador. Coincide
/// con quienes `accesoAExpediente` deja ver algún expediente: los aprendices y
/// líderes Alpha no buscan (no abren expedientes ajenos).
export const ROLES_BUSCADOR: Role[] = [
  Role.CONSOLIDADOR,
  Role.MENTOR,
  Role.PASTOR,
  Role.ADMIN,
];

/// Quién puede confirmar la entrega a mentor. La asignación la propone el
/// sistema; la decisión final la confirma un líder
/// (ESPECIFICACION_PRODUCTO.md §5.6).
/// Usa `puedeConfirmarEntrega`: el permiso `canMentor` también habilita.
export const ROLES_CONFIRMAN_ENTREGA: Role[] = [
  Role.MENTOR,
  Role.PASTOR,
  Role.ADMIN,
];

/// Confirma la entrega a mentor: por rol, o por el permiso `canMentor`.
export function puedeConfirmarEntrega(usuario: UsuarioSesion): boolean {
  return ROLES_CONFIRMAN_ENTREGA.includes(usuario.role) || usuario.canMentor;
}

/// Usuario autenticado en Supabase resuelto contra `app_user`.
///
/// El acceso es por invitación: el correo debe existir en `app_user` con un rol
/// asignado. En el primer inicio de sesión se enlaza el `auth_user_id`.
export const obtenerUsuarioActual = cache(
  async (): Promise<UsuarioSesion | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    // Solo se abre conexión a Postgres cuando hay sesión que resolver.
    const prisma = await getPrisma();

    const registro = await prisma.appUser.findUnique({
      where: { email: user.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        personId: true,
        teamId: true,
        canLeadAlpha: true,
        canLeadFaithHouse: true,
        canMentor: true,
        coordinatesConsolidation: true,
        active: true,
        authUserId: true,
      },
    });

    if (!registro || !registro.active) return null;

    if (registro.authUserId !== user.id) {
      if (registro.authUserId && registro.authUserId !== user.id) {
        // Otro usuario de Supabase ya está enlazado a este registro: no se
        // reasigna en silencio.
        return null;
      }
      await prisma.appUser.update({
        where: { id: registro.id },
        data: { authUserId: user.id },
      });
    }

    return {
      id: registro.id,
      email: registro.email,
      fullName: registro.fullName,
      role: registro.role,
      personId: registro.personId,
      teamId: registro.teamId,
      canLeadAlpha: registro.canLeadAlpha,
      canLeadFaithHouse: registro.canLeadFaithHouse,
      coordinaConsolidacion: registro.coordinatesConsolidation,
      canMentor: registro.canMentor,
    };
  },
);

/// Quién ve y opera toda la consolidación: pastor y administrador siempre, y el
/// consolidador con permiso de coordinación. El consolidador común solo ve lo
/// que tiene asignado.
export function veTodaLaConsolidacion(usuario: UsuarioSesion): boolean {
  return (
    usuario.role === Role.PASTOR ||
    usuario.role === Role.ADMIN ||
    usuario.coordinaConsolidacion
  );
}

export async function requerirUsuario(): Promise<UsuarioSesion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/ingresar?motivo=sin-acceso");
  return usuario;
}

export async function requerirRol(roles: Role[]): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();
  if (!roles.includes(usuario.role)) redirect("/sin-permiso");
  return usuario;
}

/// Para lo que se autoriza por permiso y no por rol, como llevar Alpha.
export async function requerirPermiso(
  tienePermiso: (usuario: UsuarioSesion) => boolean,
): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();
  if (!tienePermiso(usuario)) redirect("/sin-permiso");
  return usuario;
}

export class ErrorDePermiso extends Error {
  constructor(mensaje = "No tienes permiso para esta acción.") {
    super(mensaje);
    this.name = "ErrorDePermiso";
  }
}

/// Variante para Server Actions: lanza en vez de redirigir, para poder
/// devolver el error al formulario.
export async function requerirRolEnAccion(roles: Role[]): Promise<UsuarioSesion> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");
  if (!roles.includes(usuario.role)) throw new ErrorDePermiso();
  return usuario;
}
