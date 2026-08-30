"use server";

import { Prisma, Role } from "@iglesia/prisma-client";
import { obtenerUsuarioActual } from "@/lib/auth";
import { nombreCompleto, normalizarBusqueda } from "@/lib/dominio";
import { telefonoParcial } from "@/lib/expediente";
import { getPrisma } from "@/lib/prisma";

export type PersonaEncontrada = {
  learnerId: string;
  nombre: string;
  /// Enmascarado: solo los últimos dígitos, para no exponer el número entero.
  telefono: string | null;
  fase: string;
  estado: string;
};

/// Busca aprendices por nombre o teléfono, limitado a lo que el rol puede ver.
///
/// El alcance refleja `accesoAExpediente`: admin y pastor ven a todos; el mentor
/// solo a quien acompaña; el consolidador solo a sus asignados. Los demás roles
/// no reciben resultados. Así el buscador nunca abre una puerta que el
/// expediente después cerraría.
export async function buscarPersonas(
  consulta: string,
): Promise<PersonaEncontrada[]> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return [];

  const texto = consulta.trim();
  if (texto.length < 2) return [];

  const puedeVerTodo =
    usuario.role === Role.ADMIN ||
    usuario.role === Role.PASTOR ||
    usuario.coordinaConsolidacion;
  const acompana =
    usuario.role === Role.MENTOR || usuario.role === Role.CONSOLIDADOR;
  if (!puedeVerTodo && !acompana) return [];

  const alcance: Prisma.LearnerProfileWhereInput = puedeVerTodo
    ? {}
    : {
        OR: [
          { consolidatorId: usuario.id },
          {
            mentorRelationships: {
              some: { endedAt: null, mentorId: usuario.id },
            },
          },
        ],
      };

  // Búsqueda tolerante: sin importar mayúsculas, tildes ni exactitud, y sobre
  // nombre, correo y teléfonos a la vez (todo vive en `search_text`).
  const consultaNormalizada = normalizarBusqueda(texto);

  const prisma = await getPrisma();
  const aprendices = await prisma.learnerProfile.findMany({
    where: {
      AND: [
        alcance,
        {
          person: {
            active: true,
            searchText: { contains: consultaNormalizada },
          },
        },
      ],
    },
    take: 8,
    orderBy: { person: { firstName: "asc" } },
    select: {
      id: true,
      phase: true,
      status: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          callPhone: true,
          whatsappPhone: true,
        },
      },
    },
  });

  return aprendices.map((aprendiz) => ({
    learnerId: aprendiz.id,
    nombre: nombreCompleto(aprendiz.person),
    telefono: telefonoParcial(
      aprendiz.person.callPhone ?? aprendiz.person.whatsappPhone,
    ),
    fase: aprendiz.phase,
    estado: aprendiz.status,
  }));
}
