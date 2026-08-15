"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  InvitationKind,
  MilestoneKind,
  MilestoneStatus,
  Role,
  type Prisma,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import { ErrorDePermiso, requerirRolEnAccion, ROLES_CONSOLIDACION } from "@/lib/auth";
import { asignarConsolidador } from "@/lib/asignacion";
import { nombreCompleto, normalizarTelefono } from "@/lib/dominio";
import { DURACION_OPERACION_72_HORAS } from "@/lib/op72";
import { esquemaRegistro, type DatosRegistro } from "@/lib/validacion-registro";

export type PosibleDuplicado = {
  id: string;
  nombre: string;
  telefono: string | null;
  motivo: string;
};

export type ResultadoRegistro =
  | { ok: true }
  | { ok: false; errores: Record<string, string>; mensaje?: string }
  | { ok: false; duplicados: PosibleDuplicado[] };

export type InvitadorEncontrado = {
  id: string;
  nombre: string;
  telefono: string | null;
  linea: string | null;
};

/// Busca por nombre o teléfono a la persona que invitó. Devuelve la línea que
/// se conservaría al entregar a mentor.
export async function buscarInvitador(
  consulta: string,
): Promise<InvitadorEncontrado[]> {
  await requerirRolEnAccion(ROLES_CONSOLIDACION);

  const texto = consulta.trim();
  if (texto.length < 2) return [];

  const digitos = normalizarTelefono(texto);
  const prisma = await getPrisma();

  const personas = await prisma.person.findMany({
    where: {
      active: true,
      OR: [
        { firstName: { contains: texto, mode: "insensitive" } },
        { lastName: { contains: texto, mode: "insensitive" } },
        ...(digitos
          ? [
              { callPhone: { contains: digitos } },
              { whatsappPhone: { contains: digitos } },
            ]
          : []),
      ],
    },
    take: 6,
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      callPhone: true,
      user: { select: { fullName: true, role: true } },
      learnerProfile: {
        select: {
          mentorRelationships: {
            where: { endedAt: null },
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { mentor: { select: { fullName: true } } },
          },
        },
      },
    },
  });

  return personas.map((persona) => {
    const nombre = nombreCompleto(persona);
    const mentor =
      persona.learnerProfile?.mentorRelationships[0]?.mentor.fullName ?? null;
    const esMentora = persona.user?.role === Role.MENTOR;

    return {
      id: persona.id,
      nombre,
      telefono: persona.callPhone,
      linea: mentor
        ? `Se conserva su línea: ${mentor} → ${nombre}`
        : esMentora
          ? `Se conserva su línea: ${nombre}`
          : null,
    };
  });
}

/// Detecta duplicados por teléfono (normalizado) y por correo, antes de crear
/// un expediente (ESPECIFICACION_PRODUCTO.md §5.3 y §20).
async function buscarDuplicados(datos: {
  callPhone: string;
  whatsappPhone: string | null;
  email: string | null;
}): Promise<PosibleDuplicado[]> {
  const telefonos = [
    normalizarTelefono(datos.callPhone),
    normalizarTelefono(datos.whatsappPhone),
  ].filter((valor): valor is string => Boolean(valor));

  if (telefonos.length === 0 && !datos.email) return [];

  const prisma = await getPrisma();
  const filas = await prisma.$queryRaw<
    { id: string; first_name: string; last_name: string; call_phone: string | null; por_telefono: boolean }[]
  >`
    SELECT id, first_name, last_name, call_phone,
           (regexp_replace(coalesce(call_phone, ''), '\\D', '', 'g') = ANY(${telefonos})
            OR regexp_replace(coalesce(whatsapp_phone, ''), '\\D', '', 'g') = ANY(${telefonos})) AS por_telefono
    FROM person
    WHERE active = true
      AND (
        regexp_replace(coalesce(call_phone, ''), '\\D', '', 'g') = ANY(${telefonos})
        OR regexp_replace(coalesce(whatsapp_phone, ''), '\\D', '', 'g') = ANY(${telefonos})
        OR (${datos.email}::text IS NOT NULL AND lower(email) = ${datos.email})
      )
    LIMIT 5
  `;

  return filas.map((fila) => ({
    id: fila.id,
    nombre: `${fila.first_name} ${fila.last_name}`.trim(),
    telefono: fila.call_phone,
    motivo: fila.por_telefono
      ? "Mismo teléfono registrado"
      : "Mismo correo registrado",
  }));
}

/// Guarda la persona nueva e inicia Operación 72.
///
/// `confirmadoNoDuplicado` solo puede venir de una revisión humana explícita en
/// la pantalla: nunca se crea un segundo expediente en silencio.
export async function guardarRegistro(
  entrada: DatosRegistro,
  opciones: { confirmadoNoDuplicado?: boolean } = {},
): Promise<ResultadoRegistro> {
  let usuario;
  try {
    usuario = await requerirRolEnAccion(ROLES_CONSOLIDACION);
  } catch (error) {
    if (error instanceof ErrorDePermiso) {
      return { ok: false, errores: {}, mensaje: error.message };
    }
    throw error;
  }

  const analisis = esquemaRegistro.safeParse(entrada);
  if (!analisis.success) {
    const errores: Record<string, string> = {};
    for (const problema of analisis.error.issues) {
      const campo = String(problema.path[0] ?? "general");
      errores[campo] ??= problema.message;
    }
    return { ok: false, errores };
  }

  const datos = analisis.data;
  const prisma = await getPrisma();

  if (!opciones.confirmadoNoDuplicado) {
    const duplicados = await buscarDuplicados(datos);
    if (duplicados.length > 0) {
      await auditar(prisma, {
        actorId: usuario.id,
        action: "duplicado.detectado",
        entityType: "person",
        metadata: {
          telefono: datos.callPhone,
          coincidencias: duplicados.map((d) => d.id),
        },
      });
      return { ok: false, duplicados };
    }
  }

  const ahora = new Date();
  const deadlineAt = new Date(
    ahora.getTime() + DURACION_OPERACION_72_HORAS * 3_600_000,
  );

  const invitador =
    datos.invitationKind === InvitationKind.PERSONA && datos.invitedByPersonId
      ? await prisma.person.findUnique({
          where: { id: datos.invitedByPersonId },
          select: { id: true, firstName: true, lastName: true },
        })
      : null;

  await prisma.$transaction(async (tx) => {
    const persona = await tx.person.create({
      data: {
        firstName: datos.firstName,
        lastName: datos.lastName,
        gender: datos.gender,
        birthDate: datos.birthDate ? new Date(datos.birthDate) : null,
        callPhone: datos.callPhone,
        whatsappPhone: datos.whatsappPhone,
        email: datos.email,
        address: datos.address,
        prayerRequest: datos.prayerRequest,
        callSchedule: datos.callSchedule ?? null,
      },
      select: { id: true, gender: true },
    });

    const elegido = await asignarConsolidador(tx, persona.gender);

    const aprendiz = await tx.learnerProfile.create({
      data: {
        personId: persona.id,
        entryPoint: datos.entryPoint,
        invitationKind: datos.invitationKind,
        invitedByPersonId: invitador?.id ?? null,
        lineOfOrigin: invitador
          ? nombreCompleto(invitador)
          : null,
        consolidatorId: elegido?.id ?? null,
        teamId: null,
        registeredById: usuario.id,
      },
      select: { id: true },
    });

    await tx.operation72.create({
      data: {
        learnerId: aprendiz.id,
        startedAt: ahora,
        deadlineAt,
        detail: elegido
          ? "Consolidador asignado · bienvenida por WhatsApp enviada"
          : "Sin consolidador con cupo · requiere asignación de un líder",
        lineKnown: datos.invitationKind === InvitationKind.PERSONA,
      },
    });

    await tx.milestone.createMany({
      data: [
        {
          learnerId: aprendiz.id,
          kind: MilestoneKind.REGISTRO,
          status: MilestoneStatus.COMPLETADO,
          achievedAt: ahora,
          recordedById: usuario.id,
        },
        {
          learnerId: aprendiz.id,
          kind: MilestoneKind.OPERACION_72,
          status: MilestoneStatus.EN_CURSO,
          recordedById: usuario.id,
        },
      ],
    });

    const metadatosComunes: Prisma.InputJsonValue = {
      personId: persona.id,
      learnerId: aprendiz.id,
      entryPoint: datos.entryPoint,
      invitationKind: datos.invitationKind,
      duplicadoConfirmadoPorHumano: opciones.confirmadoNoDuplicado ?? false,
    };

    await auditar(tx, {
      actorId: usuario.id,
      action: "persona.registrada",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: metadatosComunes,
    });

    if (elegido) {
      await auditar(tx, {
        actorId: usuario.id,
        action: "consolidador.asignado",
        entityType: "learner_profile",
        entityId: aprendiz.id,
        metadata: {
          consolidadorId: elegido.id,
          criterio: "mismo género · menor carga",
          cargaPrevia: elegido.carga,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.iniciada",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { deadlineAt: deadlineAt.toISOString() },
    });

    await encolarEventoIntegracion(tx, "aprendiz_creado", metadatosComunes);
    await encolarEventoIntegracion(tx, "operacion72_iniciada", {
      learnerId: aprendiz.id,
      deadlineAt: deadlineAt.toISOString(),
    });
  });

  revalidatePath("/operacion-72");
  redirect("/operacion-72");
}
