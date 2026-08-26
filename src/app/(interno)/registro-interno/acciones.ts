"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import { exportarContactoNuevo } from "@/lib/highlevel-salida";
import { ErrorDePermiso, requerirRolEnAccion, ROLES_CONSOLIDACION } from "@/lib/auth";
import { nombreCompleto, normalizarTelefono } from "@/lib/dominio";
import {
  buscarDuplicados,
  crearRegistroEnTransaccion,
  type PosibleDuplicado,
} from "@/lib/registro";
import { esquemaRegistro, type DatosRegistro } from "@/lib/validacion-registro";

export type { PosibleDuplicado } from "@/lib/registro";

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
    const duplicados = await buscarDuplicados(prisma, datos);
    if (duplicados.length > 0) {
      await auditar(prisma, {
        actorId: usuario.id,
        action: "duplicado.detectado",
        entityType: "person",
        metadata: {
          telefono: datos.callPhone,
          coincidencias: duplicados.map((duplicado) => duplicado.id),
        },
      });
      return { ok: false, duplicados };
    }
  }

  const creado = await prisma.$transaction((tx) =>
    crearRegistroEnTransaccion(tx, datos, {
      actorId: usuario.id,
      duplicadoConfirmadoPorHumano:
        opciones.confirmadoNoDuplicado ?? false,
    }),
  );

  // La persona registrada en el sistema nace también como contacto en
  // HighLevel (best-effort, fuera de la transacción).
  await exportarContactoNuevo(creado.learnerId);

  revalidatePath("/operacion-72");
  redirect("/operacion-72");
}
