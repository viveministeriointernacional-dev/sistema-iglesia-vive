/// **Los encuentros de un grupo, contra la base.** Los textos y las cuentas
/// viven en `encuentros-catalogo.ts`, que sí lo lee el navegador (§12.4).
///
/// Una sola tabla sirve a los cuatro procesos (`group_meeting`, con
/// `program_id` para Alpha y `group_id` para los tres de `faith_house_group`),
/// así que aquí hay un solo juego de funciones y no dos. El `where` se arma a
/// partir de cuál de los dos viene.

import { getPrisma } from "@/lib/prisma";
import { nombreCompleto } from "@/lib/dominio";
import { diaISO } from "@/lib/reunion-catalogo";

/// De qué grupo se habla. **Exactamente uno de los dos**, igual que el CHECK
/// de la tabla.
export type DeQueGrupo = { programId: string } | { groupId: string };

export function dondeDelGrupo(de: DeQueGrupo) {
  return "programId" in de
    ? { programId: de.programId }
    : { groupId: de.groupId };
}

export type EncuentroCargado = {
  id: string;
  numero: number;
  dia: string;
  seDio: boolean;
  topic: string | null;
  topicNumber: number | null;
  nota: string | null;
  quienLoApunto: string | null;
  /// Las marcas de ese encuentro, por aprendiz.
  marcas: { learnerId: string; vino: boolean; nota: string | null }[];
};

/// Todos los encuentros del grupo, del más viejo al más nuevo.
///
/// Un solo viaje a la base: con `max: 1` las consultas se serializan, así que
/// pedir el encuentro y luego su asistencia costaría una latencia por
/// encuentro (§12.5).
export async function cargarEncuentros(
  de: DeQueGrupo,
): Promise<EncuentroCargado[]> {
  const prisma = await getPrisma();
  const filas = await prisma.groupMeeting.findMany({
    where: dondeDelGrupo(de),
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      date: true,
      happened: true,
      topic: true,
      topicNumber: true,
      note: true,
      recordedBy: { select: { fullName: true } },
      attendance: { select: { learnerId: true, present: true, note: true } },
    },
  });

  return filas.map((fila) => ({
    id: fila.id,
    numero: fila.number,
    // `date` es `@db.Date`: se pasa a texto sin zona, o se corre un día (§12.1).
    dia: diaISO(fila.date),
    seDio: fila.happened,
    topic: fila.topic,
    topicNumber: fila.topicNumber,
    nota: fila.note,
    quienLoApunto: fila.recordedBy?.fullName ?? null,
    marcas: fila.attendance.map((marca) => ({
      learnerId: marca.learnerId,
      vino: marca.present,
      nota: marca.note,
    })),
  }));
}

/// Los 12 temas de la cartilla de Casa de Fe, para el desplegable.
///
/// Solo se piden cuando el grupo tiene cartilla: en Alpha, Restaurados y las
/// mentorías el tema se escribe a mano, y traer 12 filas que nadie va a usar
/// sería un viaje de más en una pantalla que se abre todo el día.
export async function temasDeLaCartilla() {
  const prisma = await getPrisma();
  const temas = await prisma.faithHouseTopic.findMany({
    orderBy: { number: "asc" },
    select: { number: true, name: true },
  });
  return temas.map((tema) => ({ numero: tema.number, nombre: tema.name }));
}

export type LoQueSeGuarda = {
  /// El día civil «AAAA-MM-DD».
  dia: string;
  /// El número del tema de la cartilla, o `null` si va escrito a mano.
  topicNumber: number | null;
  /// El tema escrito a mano, o `null` si salió de la cartilla.
  topic: string | null;
  seDio: boolean;
  nota: string | null;
  /// Una entrada por persona del grupo. Quien no esté aquí no deja marca.
  marcas: { learnerId: string; vino: boolean; nota: string | null }[];
};

/// **Guardar un encuentro, nuevo o corregido, de una sola vez.**
///
/// Todo en una transacción: un encuentro a medias —guardado pero sin sus
/// marcas— se vería en la rejilla como «no vino nadie», que es una afirmación
/// falsa, no un hueco.
export async function guardarEncuentro(
  de: DeQueGrupo,
  actorId: string,
  datos: LoQueSeGuarda,
  encuentroId: string | null,
): Promise<{ ok: true; id: string }> {
  const prisma = await getPrisma();
  const donde = dondeDelGrupo(de);

  return prisma.$transaction(async (tx) => {
    let id = encuentroId;

    if (id) {
      await tx.groupMeeting.update({
        where: { id },
        data: {
          date: new Date(`${datos.dia}T00:00:00Z`),
          topic: datos.topic,
          topicNumber: datos.topicNumber,
          happened: datos.seDio,
          note: datos.nota,
          recordedById: actorId,
        },
      });
    } else {
      // El número se calcula DENTRO de la transacción: dos líderes del mismo
      // grupo guardando a la vez se pisarían el número, y el índice único lo
      // rechazaría con un error que no dice nada.
      const ultimo = await tx.groupMeeting.findFirst({
        where: donde,
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const creado = await tx.groupMeeting.create({
        data: {
          ...donde,
          number: (ultimo?.number ?? 0) + 1,
          date: new Date(`${datos.dia}T00:00:00Z`),
          topic: datos.topic,
          topicNumber: datos.topicNumber,
          happened: datos.seDio,
          note: datos.nota,
          recordedById: actorId,
        },
        select: { id: true },
      });
      id = creado.id;
    }

    for (const marca of datos.marcas) {
      await tx.groupAttendance.upsert({
        where: { meetingId_learnerId: { meetingId: id, learnerId: marca.learnerId } },
        create: {
          meetingId: id,
          learnerId: marca.learnerId,
          present: marca.vino,
          note: marca.nota,
        },
        update: { present: marca.vino, note: marca.nota },
      });
    }

    return { ok: true as const, id };
  });
}

export async function borrarEncuentro(de: DeQueGrupo, encuentroId: string) {
  const prisma = await getPrisma();
  // El `where` lleva **además** el grupo: sin él, un id de otro grupo borraría
  // un encuentro ajeno con el permiso de este. El guardia va en la acción y
  // también aquí (§12.6).
  const borradas = await prisma.groupMeeting.deleteMany({
    where: { id: encuentroId, ...dondeDelGrupo(de) },
  });
  return borradas.count > 0;
}

/// **Cuándo se reunió cada grupo por última vez, y en qué semanas.**
///
/// Es lo que alimenta «Cómo va mi línea». Trae los días de los encuentros de
/// los grupos que se le pasen, en **una sola consulta** para los dos tipos de
/// tabla — recorrer grupo por grupo serían 62 viajes (§12.5).
export async function diasDeEncuentroDeVariosGrupos(
  idsDeGrupos: string[],
  idsDeProgramas: string[],
  desde: string,
): Promise<Map<string, string[]>> {
  const prisma = await getPrisma();
  if (idsDeGrupos.length === 0 && idsDeProgramas.length === 0) return new Map();

  const filas = await prisma.groupMeeting.findMany({
    where: {
      date: { gte: new Date(`${desde}T00:00:00Z`) },
      OR: [
        { groupId: { in: idsDeGrupos } },
        { programId: { in: idsDeProgramas } },
      ],
    },
    orderBy: { date: "asc" },
    select: { groupId: true, programId: true, date: true },
  });

  const porGrupo = new Map<string, string[]>();
  for (const fila of filas) {
    const clave = fila.groupId ?? fila.programId;
    if (!clave) continue;
    const dias = porGrupo.get(clave) ?? [];
    dias.push(diaISO(fila.date));
    porGrupo.set(clave, dias);
  }
  return porGrupo;
}

/// Quiénes están hoy en el grupo, para pintar la rejilla y la ventana.
///
/// ⚠️ **La rejilla enseña además a quien YA NO está pero sí vino alguna vez**,
/// y por eso esto devuelve también los aprendices que solo aparecen en marcas
/// viejas. Borrar de la vista a quien se retiró haría que los encuentros
/// pasados dijeran que vino menos gente de la que vino.
export async function personasDeLaRejilla(
  de: DeQueGrupo,
  miembros: { learnerId: string; nombre: string; fase: string }[],
  encuentros: EncuentroCargado[],
): Promise<{ learnerId: string; nombre: string; fase: string; sigue: boolean }[]> {
  const dentro = new Set(miembros.map((m) => m.learnerId));
  const fuera = new Set<string>();
  for (const encuentro of encuentros) {
    for (const marca of encuentro.marcas) {
      if (!dentro.has(marca.learnerId)) fuera.add(marca.learnerId);
    }
  }

  const lista = miembros.map((m) => ({ ...m, sigue: true }));
  if (fuera.size === 0) return lista;

  const prisma = await getPrisma();
  const otros = await prisma.learnerProfile.findMany({
    where: { id: { in: [...fuera] } },
    select: {
      id: true,
      phase: true,
      person: { select: { firstName: true, lastName: true } },
    },
  });

  return [
    ...lista,
    ...otros.map((otro) => ({
      learnerId: otro.id,
      nombre: nombreCompleto(otro.person),
      fase: otro.phase,
      sigue: false,
    })),
  ];
}
