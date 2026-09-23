"use server";

import { revalidatePath } from "next/cache";
import { LearnerStatus } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar } from "@/lib/audit";
import {
  ErrorDePermiso,
  puedeAsignarGi,
  requerirVistaEnAccion,
} from "@/lib/auth";
import { accesoAGi } from "@/lib/gi";
import { LARGO_MINIMO_OBSERVACION } from "@/lib/gi-catalogo";
import { hoyEnColombia, nombreCompleto, normalizarBusqueda } from "@/lib/dominio";
import { edadDesde } from "@/lib/op72";

/// Una fecha civil «AAAA-MM-DD» como la quiere una columna `@db.Date`.
///
/// ⚠️ Se ancla al **mediodía de Colombia**, no a medianoche UTC: a medianoche
/// UTC son las 7 de la tarde del día ANTERIOR en Neiva, y el devocional del
/// martes quedaría guardado como el del lunes. Es la trampa del 8-sep-2026.
function comoFechaCivil(dia: string): Date | null {
  const fecha = new Date(`${dia}T12:00:00-05:00`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export type Resultado = { ok: true } | { ok: false; mensaje: string };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/// **Quién marca el devocional de este joven.**
///
/// ⚠️ Marcar es **solo de su líder de GI** (decisión del usuario): el mentor y
/// el pastor de la línea miran, no registran. Quien habla con el joven todos
/// los días es el líder, y que dos personas marquen lo mismo desde sitios
/// distintos volvería el dato inservible.
async function quienMarca(learnerId: string) {
  const usuario = await requerirVistaEnAccion("gi");
  const acceso = await accesoAGi(usuario, learnerId);
  if (!acceso.puedeMarcar) {
    throw new ErrorDePermiso(
      "Solo el líder de GI de esta persona puede marcar su devocional.",
    );
  }
  return usuario;
}

/// **Marca (o desmarca) el devocional de un día.**
///
/// ⚠️ Un día que todavía no ha llegado NO se puede marcar, y se comprueba aquí
/// además de en la pantalla: los botones del futuro salen apagados, pero un
/// botón apagado es una sugerencia del navegador, no una garantía. Sin esta
/// línea, el domingo por la mañana se podría dejar marcada la semana entera y
/// el conteo diría que el movimiento va al 100 % por un clic.
export async function marcarDevocional(
  learnerId: string,
  dia: string,
  marcar: boolean,
): Promise<Resultado> {
  if (!FECHA.test(dia)) return { ok: false, mensaje: "Ese día no es válido." };

  const hoy = hoyEnColombia();
  if (dia > hoy) {
    return {
      ok: false,
      mensaje: "Ese día todavía no ha llegado. El devocional se marca cuando pasa.",
    };
  }

  const usuario = await quienMarca(learnerId);
  const prisma = await getPrisma();
  const fecha = comoFechaCivil(dia);
  if (!fecha) return { ok: false, mensaje: "Ese día no es válido." };

  if (marcar) {
    // Dos toques seguidos no pueden dejar dos renglones: el índice único de la
    // base lo impide, y aquí se ignora en silencio porque el resultado que
    // quería quien pulsó ya está puesto.
    await prisma.giDevotional.upsert({
      where: { learnerId_day: { learnerId, day: fecha } },
      create: { learnerId, day: fecha, markedById: usuario.id },
      update: {},
    });
  } else {
    await prisma.giDevotional.deleteMany({ where: { learnerId, day: fecha } });
  }

  // ⚠️ **Esto NO se audita a propósito**, y es una decisión medida: son 18
  // jóvenes × 7 días, o sea más de 120 movimientos por semana, y ahogarían
  // «Actividad del día» —que hoy tiene 2 290 filas desde agosto— hasta dejarla
  // inservible. El dato ya se registra solo: cada marca guarda quién la puso y
  // cuándo (`marked_by_id`, `marked_at`).

  revalidatePath("/gi");
  revalidatePath(`/gi/${learnerId}`);
  return { ok: true };
}

/// **Escribe una observación sobre un joven un día concreto.**
///
/// Vive aparte del devocional porque el caso normal es justo el que no cuadra
/// con una marca: el joven que esta semana no marcó ni un día y sobre el que
/// el líder sí tiene algo que decir.
export async function guardarObservacionDeGi(
  learnerId: string,
  dia: string,
  texto: string,
): Promise<Resultado> {
  if (!FECHA.test(dia)) return { ok: false, mensaje: "Ese día no es válido." };

  const limpio = texto.trim();
  if (limpio.length < LARGO_MINIMO_OBSERVACION) {
    return {
      ok: false,
      mensaje:
        "Escribe la observación completa (al menos una frase). La leen los pastores de GI y su mentor.",
    };
  }

  const usuario = await quienMarca(learnerId);
  const prisma = await getPrisma();
  const fecha = comoFechaCivil(dia);
  if (!fecha) return { ok: false, mensaje: "Ese día no es válido." };

  await prisma.giNote.create({
    data: { learnerId, day: fecha, body: limpio, authorId: usuario.id },
  });

  revalidatePath("/gi");
  revalidatePath(`/gi/${learnerId}`);
  return { ok: true };
}

/// **Pone a un joven a cargo de un líder de GI.**
///
/// Lo hace quien coordina GI. Si el joven ya tenía líder, la asignación
/// anterior **se cierra, no se borra**: quién lo acompañó hasta hoy es
/// historia, y borrarla dejaría sin dueño los devocionales de hace tres meses.
export async function asignarJovenAGi(
  learnerId: string,
  leaderId: string,
): Promise<Resultado> {
  const usuario = await requerirVistaEnAccion("gi");
  if (!puedeAsignarGi(usuario)) throw new ErrorDePermiso();

  const prisma = await getPrisma();

  // La cuenta se comprueba en el servidor aunque el desplegable solo ofrezca
  // las correctas: un `<select>` es una sugerencia del navegador.
  const lider = await prisma.appUser.findFirst({
    where: { id: leaderId, active: true, OR: [{ canLeadGi: true }, { coordinatesGi: true }] },
    select: { id: true, fullName: true },
  });
  if (!lider) {
    return {
      ok: false,
      mensaje:
        "Esa cuenta no lleva GI. Enciéndele el permiso en Administración y vuelve a intentarlo.",
    };
  }

  const joven = await prisma.learnerProfile.findFirst({
    where: { id: learnerId, status: { not: LearnerStatus.RETIRADO } },
    select: { id: true, person: { select: { firstName: true, lastName: true } } },
  });
  if (!joven) {
    return { ok: false, mensaje: "No se encontró a esa persona, o está dada de baja." };
  }

  // Cerrar la anterior y abrir la nueva van juntas: si se quedara a medias, el
  // índice único parcial de la base rechazaría la segunda y el joven acabaría
  // sin líder de GI.
  await prisma.$transaction(async (tx) => {
    await tx.giAssignment.updateMany({
      where: { learnerId, endedAt: null },
      data: { endedAt: new Date() },
    });
    await tx.giAssignment.create({
      data: { learnerId, leaderId, assignedById: usuario.id },
    });
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "gi.joven_asignado",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: {
      joven: nombreCompleto(joven.person),
      lider: lider.fullName,
      liderId: lider.id,
    },
  });

  revalidatePath("/gi");
  return { ok: true };
}

/// **Saca a un joven de GI.** No borra nada de lo marcado: se cierra la
/// asignación y su calendario se queda como quedó.
export async function quitarJovenDeGi(learnerId: string): Promise<Resultado> {
  const usuario = await requerirVistaEnAccion("gi");
  if (!puedeAsignarGi(usuario)) throw new ErrorDePermiso();

  const prisma = await getPrisma();
  const asignacion = await prisma.giAssignment.findFirst({
    where: { learnerId, endedAt: null },
    select: {
      id: true,
      leader: { select: { fullName: true } },
      learner: {
        select: { person: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!asignacion) {
    return { ok: false, mensaje: "Esa persona no está en GI." };
  }

  await prisma.giAssignment.update({
    where: { id: asignacion.id },
    data: { endedAt: new Date() },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "gi.joven_quitado",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: {
      joven: nombreCompleto(asignacion.learner.person),
      lider: asignacion.leader.fullName,
    },
  });

  revalidatePath("/gi");
  return { ok: true };
}

export type CandidatoDeGi = {
  learnerId: string;
  nombre: string;
  edad: number | null;
  liderActual: string | null;
};

/// **Busca a quién meter en GI.** Se busca por nombre y no se lista a toda la
/// iglesia: son 361 personas, y una lista así no se lee.
export async function buscarJovenesParaGi(
  texto: string,
): Promise<CandidatoDeGi[]> {
  const usuario = await requerirVistaEnAccion("gi");
  if (!puedeAsignarGi(usuario)) throw new ErrorDePermiso();

  const buscado = normalizarBusqueda(texto.trim());
  if (buscado.length < 3) return [];

  const prisma = await getPrisma();
  const encontrados = await prisma.learnerProfile.findMany({
    where: {
      status: { not: LearnerStatus.RETIRADO },
      person: { searchText: { contains: buscado } },
    },
    take: 12,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      person: { select: { firstName: true, lastName: true, birthDate: true } },
      giAssignments: {
        where: { endedAt: null },
        select: { leader: { select: { fullName: true } } },
      },
    },
  });

  return encontrados.map((persona) => ({
    learnerId: persona.id,
    nombre: nombreCompleto(persona.person),
    edad: edadDesde(persona.person.birthDate),
    liderActual: persona.giAssignments[0]?.leader.fullName ?? null,
  }));
}

/// Las cuentas que pueden llevar GI, para el desplegable de asignación.
export async function cuentasQueLlevanGi(): Promise<
  { id: string; nombre: string }[]
> {
  const usuario = await requerirVistaEnAccion("gi");
  if (!puedeAsignarGi(usuario)) throw new ErrorDePermiso();

  const prisma = await getPrisma();
  const cuentas = await prisma.appUser.findMany({
    where: { active: true, OR: [{ canLeadGi: true }, { coordinatesGi: true }] },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
  return cuentas.map((c) => ({ id: c.id, nombre: c.fullName }));
}
