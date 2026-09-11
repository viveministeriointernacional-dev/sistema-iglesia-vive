"use server";

import { Prisma, Role } from "@iglesia/prisma-client";
import { obtenerUsuarioActual, tieneRed } from "@/lib/auth";
import { nombreCompleto, normalizarBusqueda } from "@/lib/dominio";
import { getPrisma } from "@/lib/prisma";
import { ramaDeLaRed } from "@/lib/red";

export type PersonaEncontrada = {
  learnerId: string;
  nombre: string;
  telefono: string | null;
  fase: string;
  estado: string;
};

/// Busca aprendices por nombre o teléfono, limitado a lo que el rol puede ver.
///
/// El alcance refleja `accesoAExpediente`: admin y pastor ven a todos; el
/// mentor ve **su rama en cascada** —a quien acompaña y a quien acompañan
/// ellos—; el consolidador, sus asignados. Los demás roles no reciben
/// resultados. Así el buscador nunca abre una puerta que el expediente después
/// cerraría, ni esconde a alguien que la lista de «Mi red» sí muestra.
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
    tieneRed(usuario) || usuario.role === Role.CONSOLIDADOR;
  if (!puedeVerTodo && !acompana) return [];

  // La rama en cascada sale de una sola consulta recursiva; sin ella el
  // buscador se quedaría en los discípulos directos y no encontraría a la
  // gente que los propios discípulos ya están liderando.
  const rama = puedeVerTodo ? null : await ramaDeLaRed(usuario.id);

  const alcance: Prisma.LearnerProfileWhereInput = puedeVerTodo
    ? {}
    : {
        OR: [
          { consolidatorId: usuario.id },
          { id: { in: rama ? [...rama.keys()] : [] } },
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
    telefono: aprendiz.person.callPhone ?? aprendiz.person.whatsappPhone ?? null,
    fase: aprendiz.phase,
    estado: aprendiz.status,
  }));
}
