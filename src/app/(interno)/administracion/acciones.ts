"use server";

import { revalidatePath } from "next/cache";
import {
  LearnerStatus,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { HITOS_EDITABLES } from "@/lib/administracion";
import { auditar } from "@/lib/audit";
import {
  DONDE_PUEDE_MENTOREAR,
  ErrorDePermiso,
  requerirRolEnAccion,
  ROLES_ADMIN,
  type UsuarioSesion,
} from "@/lib/auth";
import { correoCredenciales, correoMentorAsignado } from "@/lib/correo";
import { nombreCompleto } from "@/lib/dominio";
import { exportarDatosPersona } from "@/lib/highlevel-salida";
import { getPrisma } from "@/lib/prisma";
import { crearSupabaseAdmin } from "@/lib/supabase/admin";

export type ResultadoAdmin = { ok: true } | { ok: false; mensaje: string };

/// Envuelve una acción de admin: exige el rol y traduce el error de permiso en
/// un mensaje para el formulario.
async function conAdmin(
  ejecutar: (usuario: UsuarioSesion) => Promise<ResultadoAdmin>,
): Promise<ResultadoAdmin> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_ADMIN);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }
  return ejecutar(usuario);
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DatosPersona = {
  firstName: string;
  lastName: string;
  gender: "MUJER" | "HOMBRE" | "";
  birthDate: string;
  callPhone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  prayerRequest: string;
};

/// Actualiza los datos de una persona y los refleja en HighLevel.
export async function guardarDatosPersona(
  personId: string,
  datos: DatosPersona,
): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
    if (!datos.firstName.trim()) {
      return { ok: false, mensaje: "El nombre es obligatorio." };
    }
    if (datos.email.trim() && !CORREO.test(datos.email.trim())) {
      return { ok: false, mensaje: "El correo no tiene un formato válido." };
    }
    if (datos.birthDate && Number.isNaN(Date.parse(datos.birthDate))) {
      return { ok: false, mensaje: "La fecha de nacimiento no es válida." };
    }

    const prisma = await getPrisma();
    const persona = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, learnerProfile: { select: { id: true } } },
    });
    if (!persona) return { ok: false, mensaje: "No se encontró la persona." };

    await prisma.person.update({
      where: { id: personId },
      data: {
        firstName: datos.firstName.trim(),
        lastName: datos.lastName.trim() || null,
        gender: datos.gender || null,
        birthDate: datos.birthDate ? new Date(datos.birthDate) : null,
        callPhone: datos.callPhone.trim() || null,
        whatsappPhone: datos.whatsappPhone.trim() || null,
        email: datos.email.trim() || null,
        address: datos.address.trim() || null,
        prayerRequest: datos.prayerRequest.trim() || null,
      },
    });

    await auditar(prisma, {
      actorId: usuario.id,
      action: "administracion.datos_actualizados",
      entityType: "person",
      entityId: personId,
    });

    // Reflejo hacia HighLevel (best-effort, fuera de la edición).
    if (persona.learnerProfile) {
      await exportarDatosPersona(persona.learnerProfile.id);
    }

    revalidatePath(`/administracion/${personId}`);
    revalidatePath("/administracion");
    return { ok: true };
  });
}

export type RolYPermisos = {
  role: Role;
  capacity: number;
  active: boolean;
  canLeadAlpha: boolean;
  canLeadFaithHouse: boolean;
  canMentor: boolean;
  coordinatesConsolidation: boolean;
};

/// Actualiza el rol y los permisos de una cuenta ya existente.
export async function guardarRolYPermisos(
  userId: string,
  datos: RolYPermisos,
): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
    // Nadie se quita a sí mismo el acceso o el rol de admin: evita quedar fuera.
    if (userId === usuario.id && (datos.role !== Role.ADMIN || !datos.active)) {
      return {
        ok: false,
        mensaje: "No puedes quitarte a ti mismo el rol de administrador ni desactivarte.",
      };
    }
    const capacidad = Number.isFinite(datos.capacity)
      ? Math.max(0, Math.trunc(datos.capacity))
      : 12;

    const prisma = await getPrisma();
    const cuenta = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, personId: true },
    });
    if (!cuenta) return { ok: false, mensaje: "No se encontró la cuenta." };

    await prisma.appUser.update({
      where: { id: userId },
      data: {
        role: datos.role,
        capacity: capacidad,
        active: datos.active,
        canLeadAlpha: datos.canLeadAlpha,
        canLeadFaithHouse: datos.canLeadFaithHouse,
        canMentor: datos.canMentor,
        coordinatesConsolidation: datos.coordinatesConsolidation,
      },
    });

    await auditar(prisma, {
      actorId: usuario.id,
      action: "administracion.rol_actualizado",
      entityType: "app_user",
      entityId: userId,
      metadata: {
        role: datos.role,
        canLeadAlpha: datos.canLeadAlpha,
        canLeadFaithHouse: datos.canLeadFaithHouse,
        canMentor: datos.canMentor,
        coordinatesConsolidation: datos.coordinatesConsolidation,
        active: datos.active,
      },
    });

    if (cuenta.personId) revalidatePath(`/administracion/${cuenta.personId}`);
    revalidatePath("/administracion");
    return { ok: true };
  });
}

export type NuevoAcceso = {
  email: string;
  password: string;
} & RolYPermisos;

/// Crea el acceso (cuenta de Supabase + usuario del sistema) para una persona
/// que hoy no tiene login, y le asigna su rol y permisos.
export async function crearAcceso(
  personId: string,
  datos: NuevoAcceso,
): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
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
      select: { id: true, firstName: true, lastName: true, user: { select: { id: true } } },
    });
    if (!persona) return { ok: false, mensaje: "No se encontró la persona." };
    if (persona.user) {
      return { ok: false, mensaje: "Esta persona ya tiene un acceso. Edita su rol." };
    }

    const yaUsado = await prisma.appUser.findUnique({
      where: { email },
      select: { id: true },
    });
    if (yaUsado) {
      return { ok: false, mensaje: "Ya existe una cuenta con ese correo." };
    }

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

    const capacidad = Number.isFinite(datos.capacity)
      ? Math.max(0, Math.trunc(datos.capacity))
      : 12;

    try {
      await prisma.appUser.create({
        data: {
          authUserId: creado.data.user.id,
          email,
          fullName: nombreCompleto(persona),
          role: datos.role,
          capacity: capacidad,
          active: datos.active,
          canLeadAlpha: datos.canLeadAlpha,
          canLeadFaithHouse: datos.canLeadFaithHouse,
          canMentor: datos.canMentor,
          coordinatesConsolidation: datos.coordinatesConsolidation,
          personId: persona.id,
        },
      });
    } catch (error) {
      // Si falla el alta en el sistema, se deshace la cuenta de Supabase para no
      // dejar un acceso huérfano.
      await admin.auth.admin.deleteUser(creado.data.user.id).catch(() => {});
      throw error;
    }

    await auditar(prisma, {
      actorId: usuario.id,
      action: "administracion.acceso_creado",
      entityType: "person",
      entityId: personId,
      metadata: { email, role: datos.role },
    });

    // Le avisamos por correo sus datos de ingreso (best-effort).
    await correoCredenciales({
      to: email,
      nombre: nombreCompleto(persona),
      email,
      password: datos.password,
    });

    revalidatePath(`/administracion/${personId}`);
    revalidatePath("/administracion");
    return { ok: true };
  });
}

/// Cambia la fase (proceso) de una persona y deja el registro del cambio.
export async function cambiarFase(
  learnerId: string,
  fase: Phase,
): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
    const prisma = await getPrisma();
    const aprendiz = await prisma.learnerProfile.findUnique({
      where: { id: learnerId },
      select: { id: true, phase: true, personId: true },
    });
    if (!aprendiz) return { ok: false, mensaje: "No se encontró el proceso de la persona." };
    if (aprendiz.phase === fase) return { ok: true };

    const ahora = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.learnerProfile.update({
        where: { id: learnerId },
        data: { phase: fase, phaseStartedAt: ahora },
      });
      await tx.phaseChange.create({
        data: {
          learnerId,
          fromPhase: aprendiz.phase,
          toPhase: fase,
          decidedById: usuario.id,
          note: "Ajuste desde administración",
        },
      });
      await auditar(tx, {
        actorId: usuario.id,
        action: "fase.cambiada",
        entityType: "learner_profile",
        entityId: learnerId,
        metadata: { de: aprendiz.phase, a: fase, origen: "administracion" },
      });
    });

    revalidatePath(`/administracion/${aprendiz.personId}`);
    return { ok: true };
  });
}

/// Marca o quita un hito del recorrido (Casa de Fe, Encuentro, sirviendo, …).
export async function alternarHito(
  learnerId: string,
  kind: MilestoneKind,
  completado: boolean,
): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
    if (!HITOS_EDITABLES.includes(kind)) {
      return { ok: false, mensaje: "Ese hito no se edita a mano." };
    }
    const prisma = await getPrisma();
    const aprendiz = await prisma.learnerProfile.findUnique({
      where: { id: learnerId },
      select: { id: true, personId: true },
    });
    if (!aprendiz) return { ok: false, mensaje: "No se encontró el proceso de la persona." };

    const ahora = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.milestone.upsert({
        where: { learnerId_kind: { learnerId, kind } },
        create: {
          learnerId,
          kind,
          status: completado ? MilestoneStatus.COMPLETADO : MilestoneStatus.PENDIENTE,
          achievedAt: completado ? ahora : null,
          recordedById: usuario.id,
        },
        update: {
          status: completado ? MilestoneStatus.COMPLETADO : MilestoneStatus.PENDIENTE,
          achievedAt: completado ? ahora : null,
          recordedById: usuario.id,
        },
      });
      await auditar(tx, {
        actorId: usuario.id,
        action: "administracion.hito_editado",
        entityType: "learner_profile",
        entityId: learnerId,
        metadata: { hito: kind, completado },
      });
    });

    revalidatePath(`/administracion/${aprendiz.personId}`);
    return { ok: true };
  });
}

/// Asigna manualmente un mentor a una persona. El mentor debe ser válido:
/// mentor o pastor en fase de Multiplicación. Con id vacío se le quita el
/// mentor. Cierra la relación anterior y abre la nueva, sin borrar el historial.
export async function asignarMentor(
  learnerId: string,
  mentorUserId: string,
): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
    const prisma = await getPrisma();
    const aprendiz = await prisma.learnerProfile.findUnique({
      where: { id: learnerId },
      select: {
        id: true,
        personId: true,
        person: {
          select: {
            firstName: true,
            lastName: true,
            callPhone: true,
            whatsappPhone: true,
            email: true,
            prayerRequest: true,
          },
        },
      },
    });
    if (!aprendiz) {
      return { ok: false, mensaje: "No se encontró el proceso de la persona." };
    }

    const ahora = new Date();

    if (!mentorUserId) {
      await prisma.mentorRelationship.updateMany({
        where: { learnerId, endedAt: null },
        data: { endedAt: ahora },
      });
      await auditar(prisma, {
        actorId: usuario.id,
        action: "administracion.mentor_asignado",
        entityType: "learner_profile",
        entityId: learnerId,
        metadata: { mentorId: null },
      });
      revalidatePath(`/administracion/${aprendiz.personId}`);
      return { ok: true };
    }

    const mentor = await prisma.appUser.findFirst({
      where: {
        id: mentorUserId,
        active: true,
        ...DONDE_PUEDE_MENTOREAR,
      },
      select: { id: true, email: true, fullName: true },
    });
    if (!mentor) {
      return {
        ok: false,
        mensaje:
          "Ese mentor no es válido: debe tener rol de mentor, pastor o administrador y estar activo.",
      };
    }

    const yaEs = await prisma.mentorRelationship.findFirst({
      where: { learnerId, endedAt: null, mentorId: mentorUserId },
      select: { id: true },
    });
    if (yaEs) return { ok: true };

    await prisma.$transaction(async (tx) => {
      await tx.mentorRelationship.updateMany({
        where: { learnerId, endedAt: null },
        data: { endedAt: ahora },
      });
      await tx.mentorRelationship.create({
        data: {
          learnerId,
          mentorId: mentorUserId,
          reason: "Asignación manual desde administración",
          authorizedById: usuario.id,
        },
      });
      await auditar(tx, {
        actorId: usuario.id,
        action: "administracion.mentor_asignado",
        entityType: "learner_profile",
        entityId: learnerId,
        metadata: { mentorId: mentorUserId },
      });
    });

    // Le avisamos al mentor por correo la persona que le fue asignada.
    await correoMentorAsignado({
      to: mentor.email,
      mentorNombre: mentor.fullName,
      personaNombre: nombreCompleto(aprendiz.person),
      telefono: aprendiz.person.callPhone ?? aprendiz.person.whatsappPhone,
      correoPersona: aprendiz.person.email,
      detalle: aprendiz.person.prayerRequest,
    });

    revalidatePath(`/administracion/${aprendiz.personId}`);
    return { ok: true };
  });
}

/// Da de baja a una persona que no quiere seguir ningún proceso. La marca como
/// Retirada con un motivo, cierra su relación de mentoría y su Operación 72
/// abiertas (para que salga de las listas y tableros), y desactiva su acceso al
/// sistema si tenía. No se borra nada: el expediente y el historial quedan.
export async function darDeBaja(
  learnerId: string,
  motivo: string,
): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
    const razon = motivo.trim();
    if (razon.length < 3) {
      return { ok: false, mensaje: "Escribe el motivo por el que se da de baja." };
    }

    const prisma = await getPrisma();
    const aprendiz = await prisma.learnerProfile.findUnique({
      where: { id: learnerId },
      select: {
        id: true,
        status: true,
        personId: true,
        person: { select: { user: { select: { id: true, active: true } } } },
      },
    });
    if (!aprendiz) {
      return { ok: false, mensaje: "No se encontró el proceso de la persona." };
    }
    if (aprendiz.status === LearnerStatus.RETIRADO) {
      return { ok: false, mensaje: "Esta persona ya está dada de baja." };
    }

    const ahora = new Date();
    const cuenta = aprendiz.person.user;
    // No se desactiva a sí mismo: evita quedar fuera por accidente.
    const desactivarAcceso = Boolean(cuenta && cuenta.active && cuenta.id !== usuario.id);

    await prisma.$transaction(async (tx) => {
      await tx.learnerProfile.update({
        where: { id: learnerId },
        data: { status: LearnerStatus.RETIRADO },
      });

      await tx.learnerStatusChange.create({
        data: {
          learnerId,
          fromStatus: aprendiz.status,
          toStatus: LearnerStatus.RETIRADO,
          reason: razon,
          decidedById: usuario.id,
        },
      });

      // Sale de las listas activas: se cierra la mentoría y la Operación 72.
      await tx.mentorRelationship.updateMany({
        where: { learnerId, endedAt: null },
        data: { endedAt: ahora, reason: "Dado de baja" },
      });
      await tx.operation72.updateMany({
        where: {
          learnerId,
          status: {
            notIn: [Operation72Status.ENTREGADA, Operation72Status.CERRADA],
          },
        },
        data: { status: Operation72Status.CERRADA, detail: "Dado de baja" },
      });

      if (desactivarAcceso && cuenta) {
        await tx.appUser.update({
          where: { id: cuenta.id },
          data: { active: false },
        });
      }

      await auditar(tx, {
        actorId: usuario.id,
        action: "administracion.dado_de_baja",
        entityType: "learner_profile",
        entityId: learnerId,
        metadata: { motivo: razon, accesoDesactivado: desactivarAcceso },
      });
    });

    revalidatePath(`/administracion/${aprendiz.personId}`);
    revalidatePath("/administracion");
    revalidatePath("/administracion/dados-de-baja");
    return { ok: true };
  });
}

/// Reactiva a una persona que había sido dada de baja: vuelve a estado Activo,
/// deja registro de la reactivación y le devuelve el acceso al sistema si lo
/// tenía. No restaura sola la mentoría ni la Operación 72: eso se reasigna a
/// mano si la persona retoma su proceso.
export async function reactivar(learnerId: string): Promise<ResultadoAdmin> {
  return conAdmin(async (usuario) => {
    const prisma = await getPrisma();
    const aprendiz = await prisma.learnerProfile.findUnique({
      where: { id: learnerId },
      select: {
        id: true,
        status: true,
        personId: true,
        person: { select: { user: { select: { id: true, active: true } } } },
      },
    });
    if (!aprendiz) {
      return { ok: false, mensaje: "No se encontró el proceso de la persona." };
    }
    if (aprendiz.status !== LearnerStatus.RETIRADO) {
      return { ok: false, mensaje: "Esta persona no está dada de baja." };
    }

    const cuenta = aprendiz.person.user;

    await prisma.$transaction(async (tx) => {
      await tx.learnerProfile.update({
        where: { id: learnerId },
        data: { status: LearnerStatus.ACTIVO },
      });

      await tx.learnerStatusChange.create({
        data: {
          learnerId,
          fromStatus: LearnerStatus.RETIRADO,
          toStatus: LearnerStatus.ACTIVO,
          reason: "Reactivada",
          decidedById: usuario.id,
        },
      });

      if (cuenta && !cuenta.active) {
        await tx.appUser.update({
          where: { id: cuenta.id },
          data: { active: true },
        });
      }

      await auditar(tx, {
        actorId: usuario.id,
        action: "administracion.reactivado",
        entityType: "learner_profile",
        entityId: learnerId,
      });
    });

    revalidatePath(`/administracion/${aprendiz.personId}`);
    revalidatePath("/administracion");
    revalidatePath("/administracion/dados-de-baja");
    return { ok: true };
  });
}
