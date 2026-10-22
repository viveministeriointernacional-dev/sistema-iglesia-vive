/// **Renombrar y borrar un grupo**, compartido por Alpha y por Casa de Fe.
///
/// Vive aquí por la misma razón que `guardarReunionDeGrupo`: las dos pantallas
/// hacen exactamente lo mismo, y un archivo `"use server"` solo puede exportar
/// funciones `async` (§12.4).
///
/// El texto de la confirmación y el porqué del diseño están en
/// `borrar-grupo-catalogo.ts`, que sí lo lee el navegador.

import { auditar } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { nombreCompleto } from "@/lib/dominio";
import {
  type ClaseDeGrupo,
  GRUPO_VACIO,
  type LoQueTieneElGrupo,
  nombreCoincide,
  NOMBRE_QUE_NO_COINCIDE,
} from "@/lib/borrar-grupo-catalogo";

export type ResultadoDeGrupo = { ok: true } | { ok: false; mensaje: string };

/// **Qué tiene el grupo dentro**, para poder decirlo antes de borrarlo.
///
/// Un solo viaje a la base por clase de grupo: con `max: 1` las consultas se
/// serializan, así que pedir los miembros y luego las sesiones costaría dos
/// latencias en una pantalla que se abre todo el día (§12.5).
export async function loQueTieneElGrupo(
  clase: ClaseDeGrupo,
  grupoId: string,
): Promise<{ nombre: string; tiene: LoQueTieneElGrupo } | null> {
  const prisma = await getPrisma();

  if (clase === "alpha") {
    const grupo = await prisma.alphaProgram.findUnique({
      where: { id: grupoId },
      select: {
        name: true,
        _count: { select: { sessions: true, coLeaders: true } },
        enrollments: {
          select: {
            validationNote: true,
            _count: { select: { attendance: true } },
            learner: {
              select: { person: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
    if (!grupo) return null;

    return {
      nombre: grupo.name,
      tiene: {
        personas: grupo.enrollments.map((inscripcion) =>
          nombreCompleto(inscripcion.learner.person),
        ),
        encargados: grupo._count.coLeaders,
        sesiones: grupo._count.sessions,
        asistencias: grupo.enrollments.reduce(
          (total, inscripcion) => total + inscripcion._count.attendance,
          0,
        ),
        notasDeValidacion: grupo.enrollments.filter(
          (inscripcion) => (inscripcion.validationNote ?? "").trim().length > 0,
        ).length,
      },
    };
  }

  const grupo = await prisma.faithHouseGroup.findUnique({
    where: { id: grupoId },
    select: {
      name: true,
      _count: { select: { coLeaders: true } },
      members: {
        select: {
          learner: {
            select: { person: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
  if (!grupo) return null;

  return {
    nombre: grupo.name,
    tiene: {
      ...GRUPO_VACIO,
      personas: grupo.members.map((miembro) => nombreCompleto(miembro.learner.person)),
      encargados: grupo._count.coLeaders,
    },
  };
}

/// **Cambiar el nombre del grupo.**
///
/// Hasta hoy el nombre solo se escribía al crearlo, así que un dedazo se
/// quedaba para siempre — y los nombres los teclea el equipo: hay casas con dos
/// espacios seguidos y en minúscula.
export async function renombrarGrupo(
  clase: ClaseDeGrupo,
  grupoId: string,
  actorId: string,
  crudo: string,
): Promise<ResultadoDeGrupo> {
  const nombre = crudo.replace(/\s+/g, " ").trim();
  if (!nombre) return { ok: false, mensaje: "El nombre no puede quedar vacío." };
  if (nombre.length > 120) {
    return { ok: false, mensaje: "El nombre es muy largo: máximo 120 letras." };
  }

  const prisma = await getPrisma();
  const antes =
    clase === "alpha"
      ? await prisma.alphaProgram.findUnique({ where: { id: grupoId }, select: { name: true } })
      : await prisma.faithHouseGroup.findUnique({ where: { id: grupoId }, select: { name: true } });
  if (!antes) return { ok: false, mensaje: "No se encontró el grupo." };
  if (antes.name === nombre) return { ok: true };

  if (clase === "alpha") {
    await prisma.alphaProgram.update({ where: { id: grupoId }, data: { name: nombre } });
  } else {
    await prisma.faithHouseGroup.update({ where: { id: grupoId }, data: { name: nombre } });
  }

  await auditar(prisma, {
    actorId,
    action: clase === "alpha" ? "alpha.grupo_renombrado" : "casa_de_fe.grupo_renombrado",
    entityType: clase === "alpha" ? "alpha_program" : "faith_house_group",
    entityId: grupoId,
    metadata: { antes: antes.name, ahora: nombre },
  });

  return { ok: true };
}

/// **Borrar el grupo.**
///
/// ⚠️ **La auditoría se escribe ANTES del `delete`, y con todo dentro.** Una
/// vez borrado el grupo no queda ni su nombre: la fila de `audit_log` es el
/// único rastro, y `entity_id` apunta a algo que ya no existe (no hay clave
/// ajena, así que la fila sobrevive). Si el metadato sale corto, nadie podrá
/// reconstruir después qué se perdió.
///
/// Se exige **escribir el nombre** y se comprueba otra vez en servidor: la
/// pantalla puede estar desactualizada, y esto no puede pasar por accidente —
/// la misma razón por la que `validarAlpha` revalida sus condiciones.
export async function borrarGrupo(
  clase: ClaseDeGrupo,
  grupoId: string,
  actorId: string,
  nombreEscrito: string,
): Promise<ResultadoDeGrupo> {
  const datos = await loQueTieneElGrupo(clase, grupoId);
  if (!datos) return { ok: false, mensaje: "No se encontró el grupo." };
  if (!nombreCoincide(nombreEscrito, datos.nombre)) {
    return { ok: false, mensaje: NOMBRE_QUE_NO_COINCIDE };
  }

  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await auditar(tx, {
      actorId,
      action: clase === "alpha" ? "alpha.grupo_borrado" : "casa_de_fe.grupo_borrado",
      entityType: clase === "alpha" ? "alpha_program" : "faith_house_group",
      entityId: grupoId,
      metadata: {
        nombre: datos.nombre,
        // Los nombres y no los ids: quien lea esto dentro de un año necesita
        // leer a quién tenía dentro, no ir a buscar 4 expedientes.
        personas: datos.tiene.personas,
        encargados: datos.tiene.encargados,
        sesiones: datos.tiene.sesiones,
        asistencias: datos.tiene.asistencias,
        notasDeValidacion: datos.tiene.notasDeValidacion,
      },
    });

    // En cascada se van los miembros (o las inscripciones, su asistencia y las
    // sesiones) y los encargados. **El expediente de cada persona no se toca**:
    // el taller, el código y el enlace cuelgan del aprendiz.
    if (clase === "alpha") {
      await tx.alphaProgram.delete({ where: { id: grupoId } });
    } else {
      await tx.faithHouseGroup.delete({ where: { id: grupoId } });
    }
  });

  return { ok: true };
}
