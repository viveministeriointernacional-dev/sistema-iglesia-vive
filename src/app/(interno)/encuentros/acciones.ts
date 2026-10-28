"use server";

/// **Registrar, corregir y borrar un encuentro.** Uno solo para los cuatro
/// procesos: la tabla es una, el permiso es el del grupo, y tres archivos
/// gemelos son tres sitios donde olvidarse un guardia (§12.6).

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import {
  ErrorDePermiso,
  obtenerUsuarioActual,
  type UsuarioSesion,
} from "@/lib/auth";
import { paraPermiso } from "@/lib/encargados-catalogo";
import { puedeAdministrarGrupo, puedeVerAlpha } from "@/lib/alpha";
import { puedeAdministrarCasaDeFe, puedeVerCasaDeFe } from "@/lib/casa-de-fe";
import {
  borrarEncuentro,
  type DeQueGrupo,
  guardarEncuentro,
  type LoQueSeGuarda,
} from "@/lib/encuentros";

export type ResultadoDeEncuentro = { ok: true } | { ok: false; mensaje: string };

/// Lo que manda el navegador. Se valida entero aquí: lo que llega de un
/// formulario es texto, y un número de tema inventado escribiría en la base
/// un tema que no existe.
export type EncuentroDelFormulario = {
  dia: string;
  temaNumero: number | null;
  temaEscrito: string;
  seDio: boolean;
  nota: string;
  marcas: { learnerId: string; vino: boolean; nota: string }[];
};

/// **De qué grupo es, y si esta cuenta puede tocarlo.**
///
/// Devuelve `null` en los dos casos que el navegador no debe distinguir: que
/// el grupo no exista y que no sea suyo. Decir «existe pero no es tuyo» es
/// contar algo de un grupo ajeno.
async function grupoQuePuedeTocar(
  de: DeQueGrupo,
): Promise<{ usuario: UsuarioSesion; cerrado: boolean } | null> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorDePermiso("Tu sesión expiró. Vuelve a entrar.");

  const prisma = await getPrisma();
  const seleccion = {
    leaderId: true,
    createdById: true,
    closedAt: true,
    coLeaders: { select: { userId: true } },
  } as const;

  if ("programId" in de) {
    if (!puedeVerAlpha(usuario)) throw new ErrorDePermiso();
    const grupo = await prisma.alphaProgram.findUnique({
      where: { id: de.programId },
      select: seleccion,
    });
    if (!grupo) return null;
    if (!(await puedeAdministrarGrupo(usuario, paraPermiso(grupo)))) return null;
    return { usuario, cerrado: grupo.closedAt !== null };
  }

  if (!puedeVerCasaDeFe(usuario)) throw new ErrorDePermiso();
  const grupo = await prisma.faithHouseGroup.findUnique({
    where: { id: de.groupId },
    select: seleccion,
  });
  if (!grupo) return null;
  if (!(await puedeAdministrarCasaDeFe(usuario, paraPermiso(grupo)))) return null;
  return { usuario, cerrado: grupo.closedAt !== null };
}

function rutaDelGrupo(de: DeQueGrupo): string {
  return "programId" in de
    ? `/alpha/${de.programId}`
    : `/casa-de-fe/${de.groupId}`;
}

export async function registrarEncuentro(
  de: DeQueGrupo,
  encuentroId: string | null,
  formulario: EncuentroDelFormulario,
): Promise<ResultadoDeEncuentro> {
  const permiso = await grupoQuePuedeTocar(de);
  if (!permiso) return { ok: false, mensaje: "Este grupo no es tuyo." };
  if (permiso.cerrado && !encuentroId) {
    return { ok: false, mensaje: "El grupo ya está cerrado." };
  }

  // La fecha llega de un `<input type="date">`, que manda «AAAA-MM-DD» sin
  // zona. Se guarda tal cual contra una columna `@db.Date`: pasarla por
  // `new Date(...)` con hora la correría un día (§12.1).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formulario.dia)) {
    return { ok: false, mensaje: "La fecha no es válida." };
  }
  if (Number.isNaN(Date.parse(`${formulario.dia}T00:00:00Z`))) {
    return { ok: false, mensaje: "La fecha no es válida." };
  }

  let topicNumber: number | null = null;
  if (formulario.temaNumero !== null) {
    const prisma = await getPrisma();
    const tema = await prisma.faithHouseTopic.findUnique({
      where: { number: formulario.temaNumero },
      select: { number: true },
    });
    if (!tema) return { ok: false, mensaje: "Ese tema no existe." };
    topicNumber = tema.number;
  }

  const escrito = formulario.temaEscrito.replace(/\s+/g, " ").trim();
  const datos: LoQueSeGuarda = {
    dia: formulario.dia,
    topicNumber,
    topic: topicNumber === null ? escrito || null : null,
    seDio: formulario.seDio,
    nota: formulario.nota.trim() || null,
    // ⚠️ Si el encuentro NO se dio, nadie vino: guardar marcas de asistencia
    // en un encuentro que no ocurrió diría que fueron a algo que no pasó. La
    // observación de cada persona sí se conserva.
    marcas: formulario.marcas.map((marca) => ({
      learnerId: marca.learnerId,
      vino: formulario.seDio ? marca.vino : false,
      nota: marca.nota.trim() || null,
    })),
  };

  const guardado = await guardarEncuentro(
    de,
    permiso.usuario.id,
    datos,
    encuentroId,
  );

  const prisma = await getPrisma();
  await auditar(prisma, {
    actorId: permiso.usuario.id,
    action: encuentroId
      ? "encuentro.corregido"
      : "encuentro.registrado",
    entityType: "group_meeting",
    entityId: guardado.id,
    metadata: {
      clase: "programId" in de ? "alpha" : "casa-de-fe",
      grupoId: "programId" in de ? de.programId : de.groupId,
      dia: datos.dia,
      seDio: datos.seDio,
      // Se auditan los números, no los nombres: la observación puede ser
      // pastoral y la auditoría la lee quien administra (§12.6).
      vinieron: datos.marcas.filter((m) => m.vino).length,
      deCuantos: datos.marcas.length,
    },
  });

  revalidatePath(rutaDelGrupo(de));
  return { ok: true };
}

export async function quitarEncuentro(
  de: DeQueGrupo,
  encuentroId: string,
): Promise<ResultadoDeEncuentro> {
  const permiso = await grupoQuePuedeTocar(de);
  if (!permiso) return { ok: false, mensaje: "Este grupo no es tuyo." };

  // ⚠️ La auditoría se escribe ANTES del borrado, con el día dentro: después
  // no queda ni la fecha, y `entity_id` apunta a algo que ya no existe
  // (§12.6, la lección de borrar grupos).
  const prisma = await getPrisma();
  const encuentro = await prisma.groupMeeting.findUnique({
    where: { id: encuentroId },
    select: {
      number: true,
      date: true,
      groupId: true,
      programId: true,
      _count: { select: { attendance: true } },
    },
  });
  if (!encuentro) return { ok: false, mensaje: "Ese encuentro ya no existe." };

  await auditar(prisma, {
    actorId: permiso.usuario.id,
    action: "encuentro.borrado",
    entityType: "group_meeting",
    entityId: encuentroId,
    metadata: {
      clase: "programId" in de ? "alpha" : "casa-de-fe",
      grupoId: "programId" in de ? de.programId : de.groupId,
      numero: encuentro.number,
      dia: encuentro.date.toISOString().slice(0, 10),
      marcas: encuentro._count.attendance,
    },
  });

  const borrado = await borrarEncuentro(de, encuentroId);
  if (!borrado) return { ok: false, mensaje: "Ese encuentro no es de este grupo." };

  revalidatePath(rutaDelGrupo(de));
  return { ok: true };
}
