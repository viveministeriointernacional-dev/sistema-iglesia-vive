import { MilestoneKind, MilestoneStatus, Role, type Prisma } from "@iglesia/prisma-client";

import { auditar } from "@/lib/audit";
import { veTodaLaRed, type UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";
import { getPrisma } from "@/lib/prisma";
import { generarCodigo } from "@/lib/taller-catalogo";
import {
  LARGO_MINIMO_NOTA_PRE,
  TOTAL_DE_TEMAS_PRE,
  avancePre,
  compararRespuestas,
  cuantasComparables,
  esOrdenCompleto,
  estadoTallerPre,
  estadoTemaPareja,
  listoParaDestapar,
  respondidaPre,
  sePuedeComparar,
  terminoElPrematrimonial,
  type Comparacion,
  type EstadoTallerPre,
  type EstadoTemaPareja,
  type PreguntaPre,
  type RespuestaPre,
} from "@/lib/prematrimonial-catalogo";

export type ResultadoPre<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { datos: T }))
  | { ok: false; mensaje: string };

// ---------------------------------------------------------------------------
// Quién lleva el prematrimonial
// ---------------------------------------------------------------------------

/// **Solo pastores y administración** (decisión del usuario, 3-oct-2026).
///
/// No es un permiso acumulable como «Lleva GI» a propósito: lo que se ve aquí
/// es lo más íntimo que guarda el sistema —deudas que no se han contado,
/// temores, motivaciones para casarse— y el usuario eligió cerrarlo al rol.
export function puedeLlevarPrematrimonial(usuario: UsuarioSesion): boolean {
  return usuario.role === Role.PASTOR || usuario.role === Role.ADMIN;
}

/// **Quién ve TODAS las parejas**: administración y quien coordina.
///
/// ⚠️ Un pastor ve **las que acompaña y las que abrió**, no todas. Es la línea
/// del 11-sep-2026 con «Mi red», y aquí pesa más que en ninguna otra pantalla:
/// el taller 1 ya pregunta por relaciones sexuales previas y por embarazos.
/// Que un pastor pueda abrirlo no significa que deba leerlo de cualquiera.
export function veTodoElPrematrimonial(usuario: UsuarioSesion): boolean {
  return usuario.role === Role.ADMIN || veTodaLaRed(usuario);
}

function alcanceDeParejas(usuario: UsuarioSesion): Prisma.PremaritalCoupleWhereInput {
  if (veTodoElPrematrimonial(usuario)) return {};
  return { OR: [{ leaderId: usuario.id }, { createdById: usuario.id }] };
}

// ---------------------------------------------------------------------------
// Abrir y cerrar una pareja
// ---------------------------------------------------------------------------

export async function crearPareja(
  usuario: UsuarioSesion,
  datos: { learnerAId: string; learnerBId: string; leaderId: string | null },
): Promise<ResultadoPre<{ coupleId: string }>> {
  if (!puedeLlevarPrematrimonial(usuario)) {
    return { ok: false, mensaje: "No puedes abrir un prematrimonial." };
  }
  if (datos.learnerAId === datos.learnerBId) {
    return { ok: false, mensaje: "Son la misma persona. Elige a los dos." };
  }

  const prisma = await getPrisma();

  const fichas = await prisma.learnerProfile.findMany({
    where: { id: { in: [datos.learnerAId, datos.learnerBId] } },
    select: { id: true, person: { select: { firstName: true, lastName: true } } },
  });
  if (fichas.length !== 2) {
    return { ok: false, mensaje: "Alguna de las dos fichas no existe." };
  }

  // ⚠️ Nadie en dos prematrimoniales abiertos a la vez. La base lo vigila con
  // dos índices únicos parciales, pero se comprueba aquí para poder decir
  // QUIÉN está repetido — un error del índice no le dice nada a nadie.
  const yaEstan = await prisma.premaritalCouple.findMany({
    where: {
      closedAt: null,
      OR: [
        { learnerAId: { in: [datos.learnerAId, datos.learnerBId] } },
        { learnerBId: { in: [datos.learnerAId, datos.learnerBId] } },
      ],
    },
    select: {
      learnerA: { select: { id: true, person: { select: { firstName: true, lastName: true } } } },
      learnerB: { select: { id: true, person: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (yaEstan.length > 0) {
    const pedidos = new Set([datos.learnerAId, datos.learnerBId]);
    const repetida = yaEstan
      .flatMap((p) => [p.learnerA, p.learnerB])
      .find((l) => pedidos.has(l.id));
    return {
      ok: false,
      mensaje: repetida
        ? `${nombreCompleto(repetida.person)} ya está en un prematrimonial abierto.`
        : "Alguno de los dos ya está en un prematrimonial abierto.",
    };
  }

  if (datos.leaderId) {
    const pastor = await prisma.appUser.findFirst({
      where: { id: datos.leaderId, active: true },
      select: { id: true },
    });
    if (!pastor) return { ok: false, mensaje: "Esa cuenta no puede acompañarlos." };
  }

  const pareja = await prisma.premaritalCouple.create({
    data: {
      learnerAId: datos.learnerAId,
      learnerBId: datos.learnerBId,
      leaderId: datos.leaderId ?? usuario.id,
      createdById: usuario.id,
    },
    select: { id: true },
  });

  await auditar(prisma, {
    actorId: usuario.id,
    action: "prematrimonial.pareja_abierta",
    entityType: "premarital_couple",
    entityId: pareja.id,
    metadata: { learnerAId: datos.learnerAId, learnerBId: datos.learnerBId },
  });

  return { ok: true, datos: { coupleId: pareja.id } };
}

export async function cerrarPareja(
  usuario: UsuarioSesion,
  coupleId: string,
  abrir = false,
): Promise<ResultadoPre> {
  const prisma = await getPrisma();
  const pareja = await prisma.premaritalCouple.findFirst({
    where: { id: coupleId, ...alcanceDeParejas(usuario) },
    select: { id: true },
  });
  if (!pareja || !puedeLlevarPrematrimonial(usuario)) {
    return { ok: false, mensaje: "Este prematrimonial no es tuyo." };
  }

  await prisma.premaritalCouple.update({
    where: { id: coupleId },
    data: { closedAt: abrir ? null : new Date() },
  });
  await auditar(prisma, {
    actorId: usuario.id,
    action: abrir ? "prematrimonial.pareja_reabierta" : "prematrimonial.pareja_cerrada",
    entityType: "premarital_couple",
    entityId: coupleId,
    metadata: {},
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lo que ve el pastor
// ---------------------------------------------------------------------------

export type ParejaEnLista = {
  id: string;
  nombreA: string;
  nombreB: string;
  learnerAId: string;
  learnerBId: string;
  pastor: string | null;
  empezaron: Date;
  cerrada: boolean;
  aprobados: number;
  porDestapar: number;
  porRevisar: number;
};

/// Las parejas dentro del alcance de quien mira, con lo que piden atención.
///
/// ⚠️ **Todo en UN `$transaction`**: con `PrismaPg max:1` (§7) cada consulta
/// suelta es una latencia en fila.
export async function cargarParejas(usuario: UsuarioSesion): Promise<ParejaEnLista[]> {
  const prisma = await getPrisma();

  const [parejas, talleres, revisiones, destapes] = await prisma.$transaction([
    prisma.premaritalCouple.findMany({
      where: alcanceDeParejas(usuario),
      orderBy: [{ closedAt: "asc" }, { startedAt: "desc" }],
      select: {
        id: true,
        learnerAId: true,
        learnerBId: true,
        startedAt: true,
        closedAt: true,
        leader: { select: { fullName: true } },
        learnerA: { select: { person: { select: { firstName: true, lastName: true } } } },
        learnerB: { select: { person: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.premaritalWorkshop.findMany({
      where: { submittedAt: { not: null } },
      select: { coupleId: true, topicId: true, learnerId: true, submittedAt: true },
    }),
    prisma.premaritalReview.findMany({
      select: {
        coupleId: true,
        topicId: true,
        approved: true,
        reviewedAt: true,
        returnedToLearnerId: true,
      },
    }),
    prisma.premaritalReveal.findMany({ select: { coupleId: true, topicId: true } }),
  ]);

  const destapados = new Set(destapes.map((d) => `${d.coupleId}|${d.topicId}`));

  return parejas.map((p) => {
    const mios = talleres.filter((t) => t.coupleId === p.id);
    const temas = new Set(mios.map((t) => t.topicId));
    let aprobados = 0;
    let porDestapar = 0;
    let porRevisar = 0;

    for (const topicId of temas) {
      const envioA =
        mios.find((t) => t.topicId === topicId && t.learnerId === p.learnerAId)?.submittedAt ?? null;
      const envioB =
        mios.find((t) => t.topicId === topicId && t.learnerId === p.learnerBId)?.submittedAt ?? null;
      const delTema = revisiones.filter((r) => r.coupleId === p.id && r.topicId === topicId);
      const estado = estadoTemaPareja({ envioA, envioB, revisiones: delTema });

      if (estado === "APROBADO") aprobados += 1;
      if (estado === "ESPERANDO") porRevisar += 1;
      if (
        listoParaDestapar({
          envioA,
          envioB,
          destapadoEl: destapados.has(`${p.id}|${topicId}`) ? new Date() : null,
        })
      ) {
        porDestapar += 1;
      }
    }

    return {
      id: p.id,
      learnerAId: p.learnerAId,
      learnerBId: p.learnerBId,
      nombreA: nombreCompleto(p.learnerA.person),
      nombreB: nombreCompleto(p.learnerB.person),
      pastor: p.leader?.fullName ?? null,
      empezaron: p.startedAt,
      cerrada: Boolean(p.closedAt),
      aprobados,
      porDestapar,
      porRevisar,
    };
  });
}

export type TemaDeLaPareja = {
  topicId: string;
  number: number;
  name: string;
  code: string;
  /// Un tema sin preguntas todavía no se puede llenar: el libro no ha llegado.
  disponible: boolean;
  estado: EstadoTemaPareja;
  envioA: Date | null;
  envioB: Date | null;
  destapadoEl: Date | null;
  listoParaDestapar: boolean;
  vecesDevuelto: number;
  notaUltima: string | null;
};

export type FichaDePareja = {
  id: string;
  nombreA: string;
  nombreB: string;
  learnerAId: string;
  learnerBId: string;
  codigoA: string | null;
  codigoB: string | null;
  pastor: string | null;
  empezaron: Date;
  cerrada: boolean;
  temas: TemaDeLaPareja[];
  aprobados: number;
  total: number;
};

export async function cargarPareja(
  usuario: UsuarioSesion,
  coupleId: string,
): Promise<FichaDePareja | null> {
  const prisma = await getPrisma();

  const pareja = await prisma.premaritalCouple.findFirst({
    where: { id: coupleId, ...alcanceDeParejas(usuario) },
    select: {
      id: true,
      learnerAId: true,
      learnerBId: true,
      startedAt: true,
      closedAt: true,
      leader: { select: { fullName: true } },
      learnerA: {
        select: {
          person: {
            select: {
              firstName: true,
              lastName: true,
              memberCode: { select: { code: true } },
            },
          },
        },
      },
      learnerB: {
        select: {
          person: {
            select: {
              firstName: true,
              lastName: true,
              memberCode: { select: { code: true } },
            },
          },
        },
      },
    },
  });
  if (!pareja) return null;

  const [temas, talleres, revisiones, destapes] = await prisma.$transaction([
    prisma.premaritalTopic.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        name: true,
        code: true,
        _count: { select: { questions: true } },
      },
    }),
    prisma.premaritalWorkshop.findMany({
      where: { coupleId },
      select: { topicId: true, learnerId: true, submittedAt: true },
    }),
    prisma.premaritalReview.findMany({
      where: { coupleId },
      orderBy: { reviewedAt: "desc" },
      select: {
        topicId: true,
        approved: true,
        reviewedAt: true,
        note: true,
        returnedToLearnerId: true,
      },
    }),
    prisma.premaritalReveal.findMany({
      where: { coupleId },
      select: { topicId: true, revealedAt: true },
    }),
  ]);

  const renglones: TemaDeLaPareja[] = temas.map((t) => {
    const envioA =
      talleres.find((w) => w.topicId === t.id && w.learnerId === pareja.learnerAId)?.submittedAt ??
      null;
    const envioB =
      talleres.find((w) => w.topicId === t.id && w.learnerId === pareja.learnerBId)?.submittedAt ??
      null;
    const delTema = revisiones.filter((r) => r.topicId === t.id);
    const destapadoEl = destapes.find((d) => d.topicId === t.id)?.revealedAt ?? null;
    const estado = estadoTemaPareja({ envioA, envioB, revisiones: delTema });

    return {
      topicId: t.id,
      number: t.number,
      name: t.name,
      code: t.code,
      disponible: t._count.questions > 0,
      estado,
      envioA,
      envioB,
      destapadoEl,
      listoParaDestapar: listoParaDestapar({ envioA, envioB, destapadoEl }),
      vecesDevuelto: delTema.filter((r) => !r.approved).length,
      notaUltima: estado === "DEVUELTO" ? (delTema[0]?.note ?? null) : null,
    };
  });

  return {
    id: pareja.id,
    learnerAId: pareja.learnerAId,
    learnerBId: pareja.learnerBId,
    nombreA: nombreCompleto(pareja.learnerA.person),
    nombreB: nombreCompleto(pareja.learnerB.person),
    codigoA: pareja.learnerA.person.memberCode?.code ?? null,
    codigoB: pareja.learnerB.person.memberCode?.code ?? null,
    pastor: pareja.leader?.fullName ?? null,
    empezaron: pareja.startedAt,
    cerrada: Boolean(pareja.closedAt),
    temas: renglones,
    aprobados: renglones.filter((r) => r.estado === "APROBADO").length,
    total: TOTAL_DE_TEMAS_PRE,
  };
}

// ---------------------------------------------------------------------------
// La comparación, que es el punto de todo
// ---------------------------------------------------------------------------

export type RenglonComparado = {
  questionId: string;
  number: number;
  kind: string;
  prompt: string;
  options: string[];
  respuestaA: RespuestaPre | null;
  respuestaB: RespuestaPre | null;
  comparacion: Comparacion;
};

export type ComparacionDelTema = {
  coupleId: string;
  topicId: string;
  numero: number;
  nombreTema: string;
  nombreA: string;
  nombreB: string;
  learnerAId: string;
  learnerBId: string;
  estado: EstadoTemaPareja;
  destapadoEl: Date | null;
  comparables: number;
  distintas: number;
  renglones: RenglonComparado[];
};

/// Pone las dos respuestas lado a lado.
///
/// ⚠️ **Devuelve `null` mientras falte uno de los dos envíos.** Media
/// comparación no dice nada, y enseñarla obligaría al pastor a juzgar con un
/// solo lado — que es justo lo que el ejercicio quiere evitar.
export async function cargarComparacion(
  usuario: UsuarioSesion,
  coupleId: string,
  topicId: string,
): Promise<ComparacionDelTema | null> {
  if (!puedeLlevarPrematrimonial(usuario)) return null;

  const prisma = await getPrisma();
  const pareja = await prisma.premaritalCouple.findFirst({
    where: { id: coupleId, ...alcanceDeParejas(usuario) },
    select: {
      id: true,
      learnerAId: true,
      learnerBId: true,
      learnerA: { select: { person: { select: { firstName: true, lastName: true } } } },
      learnerB: { select: { person: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!pareja) return null;

  const [tema, talleres, revisiones, destape] = await prisma.$transaction([
    prisma.premaritalTopic.findUnique({
      where: { id: topicId },
      select: {
        id: true,
        number: true,
        name: true,
        questions: {
          orderBy: { number: "asc" },
          select: { id: true, number: true, kind: true, prompt: true, options: true },
        },
      },
    }),
    prisma.premaritalWorkshop.findMany({
      where: { coupleId, topicId },
      select: {
        learnerId: true,
        submittedAt: true,
        answers: {
          select: {
            questionId: true,
            text: true,
            choice: true,
            choices: true,
            ordering: true,
          },
        },
      },
    }),
    prisma.premaritalReview.findMany({
      where: { coupleId, topicId },
      orderBy: { reviewedAt: "desc" },
      select: { approved: true, reviewedAt: true, returnedToLearnerId: true },
    }),
    prisma.premaritalReveal.findFirst({
      where: { coupleId, topicId },
      select: { revealedAt: true },
    }),
  ]);
  if (!tema) return null;

  const deA = talleres.find((t) => t.learnerId === pareja.learnerAId) ?? null;
  const deB = talleres.find((t) => t.learnerId === pareja.learnerBId) ?? null;

  if (!sePuedeComparar(deA?.submittedAt ?? null, deB?.submittedAt ?? null)) return null;

  const mapaA = new Map(deA!.answers.map((r) => [r.questionId, r]));
  const mapaB = new Map(deB!.answers.map((r) => [r.questionId, r]));

  const renglones: RenglonComparado[] = tema.questions.map((q) => {
    const a = mapaA.get(q.id) ?? null;
    const b = mapaB.get(q.id) ?? null;
    return {
      questionId: q.id,
      number: q.number,
      kind: q.kind,
      prompt: q.prompt,
      options: q.options,
      respuestaA: a,
      respuestaB: b,
      comparacion: compararRespuestas(q as PreguntaPre, a ?? undefined, b ?? undefined),
    };
  });

  return {
    coupleId,
    topicId,
    numero: tema.number,
    nombreTema: tema.name,
    nombreA: nombreCompleto(pareja.learnerA.person),
    nombreB: nombreCompleto(pareja.learnerB.person),
    learnerAId: pareja.learnerAId,
    learnerBId: pareja.learnerBId,
    estado: estadoTemaPareja({
      envioA: deA?.submittedAt ?? null,
      envioB: deB?.submittedAt ?? null,
      revisiones,
    }),
    destapadoEl: destape?.revealedAt ?? null,
    comparables: cuantasComparables(tema.questions as PreguntaPre[]),
    distintas: renglones.filter((r) => r.comparacion.veredicto === "DISTINTO").length,
    renglones,
  };
}

// ---------------------------------------------------------------------------
// Revisar y destapar
// ---------------------------------------------------------------------------

export async function revisarTema(
  usuario: UsuarioSesion,
  datos: {
    coupleId: string;
    topicId: string;
    aprobado: boolean;
    nota: string;
    /// Solo al devolver: a quién se le pide que corrija.
    devueltoA?: string | null;
  },
): Promise<ResultadoPre<{ completoLosDoce: boolean }>> {
  if (!puedeLlevarPrematrimonial(usuario)) {
    return { ok: false, mensaje: "No puedes revisar este prematrimonial." };
  }

  const prisma = await getPrisma();
  const pareja = await prisma.premaritalCouple.findFirst({
    where: { id: datos.coupleId, ...alcanceDeParejas(usuario) },
    select: { id: true, learnerAId: true, learnerBId: true },
  });
  if (!pareja) return { ok: false, mensaje: "Este prematrimonial no es tuyo." };

  const limpia = datos.nota.trim();
  if (!datos.aprobado && limpia.length < LARGO_MINIMO_NOTA_PRE) {
    return {
      ok: false,
      mensaje: `Escribe qué debe corregir (mínimo ${LARGO_MINIMO_NOTA_PRE} caracteres).`,
    };
  }

  const devueltoA = datos.aprobado ? null : (datos.devueltoA ?? null);
  if (!datos.aprobado && devueltoA && ![pareja.learnerAId, pareja.learnerBId].includes(devueltoA)) {
    return { ok: false, mensaje: "Esa persona no es de esta pareja." };
  }

  // Los dos tienen que haber enviado: no se revisa media comparación.
  const talleres = await prisma.premaritalWorkshop.findMany({
    where: { coupleId: datos.coupleId, topicId: datos.topicId },
    select: { learnerId: true, submittedAt: true },
  });
  const envioA = talleres.find((t) => t.learnerId === pareja.learnerAId)?.submittedAt ?? null;
  const envioB = talleres.find((t) => t.learnerId === pareja.learnerBId)?.submittedAt ?? null;
  if (!sePuedeComparar(envioA, envioB)) {
    return { ok: false, mensaje: "Todavía falta que uno de los dos lo envíe." };
  }

  const ahora = new Date();
  let completoLosDoce = false;

  await prisma.$transaction(async (tx) => {
    await tx.premaritalReview.create({
      data: {
        coupleId: datos.coupleId,
        topicId: datos.topicId,
        approved: datos.aprobado,
        note: limpia || null,
        returnedToLearnerId: devueltoA,
        reviewedById: usuario.id,
        reviewedAt: ahora,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: datos.aprobado ? "prematrimonial.tema_aprobado" : "prematrimonial.tema_devuelto",
      entityType: "premarital_couple",
      entityId: datos.coupleId,
      metadata: { topicId: datos.topicId, devueltoA },
    });

    if (datos.aprobado) {
      const aprobados = await contarTemasAprobados(tx, datos.coupleId);
      completoLosDoce = terminoElPrematrimonial(aprobados);
      if (completoLosDoce) {
        await marcarHito(tx, pareja.learnerAId, usuario.id, ahora);
        await marcarHito(tx, pareja.learnerBId, usuario.id, ahora);
        await auditar(tx, {
          actorId: usuario.id,
          action: "prematrimonial.recorrido_terminado",
          entityType: "premarital_couple",
          entityId: datos.coupleId,
          metadata: { temas: TOTAL_DE_TEMAS_PRE },
        });
      }
    }
  });

  return { ok: true, datos: { completoLosDoce } };
}

/// Cuántos temas tiene aprobados la pareja hoy, derivando el estado como lo
/// hace la pantalla: la última revisión de cada tema, y solo si nadie reenvió
/// después.
async function contarTemasAprobados(
  tx: Prisma.TransactionClient,
  coupleId: string,
): Promise<number> {
  const [revisiones, talleres] = await Promise.all([
    tx.premaritalReview.findMany({
      where: { coupleId },
      select: {
        topicId: true,
        approved: true,
        reviewedAt: true,
        returnedToLearnerId: true,
      },
    }),
    tx.premaritalWorkshop.findMany({
      where: { coupleId, submittedAt: { not: null } },
      select: { topicId: true, learnerId: true, submittedAt: true },
    }),
  ]);

  const temas = new Set(revisiones.map((r) => r.topicId));
  let aprobados = 0;
  for (const topicId of temas) {
    const envios = talleres.filter((t) => t.topicId === topicId);
    const estado = estadoTemaPareja({
      envioA: envios[0]?.submittedAt ?? null,
      envioB: envios[1]?.submittedAt ?? null,
      revisiones: revisiones.filter((r) => r.topicId === topicId),
    });
    if (estado === "APROBADO") aprobados += 1;
  }
  return aprobados;
}

/// Pone el hito del prematrimonial a cada uno.
///
/// ⚠️ **La FASE no se mueve**, igual que en Casa de Fe: casarse no es un
/// ascenso del recorrido, y la fase es una decisión pastoral con su nota y su
/// responsable. Y si el hito ya estaba conseguido **no se pisa**: su fecha
/// original vale más que la de hoy (la regla de las fusiones, §8).
async function marcarHito(
  tx: Prisma.TransactionClient,
  learnerId: string,
  actorId: string,
  cuando: Date,
) {
  const existente = await tx.milestone.findFirst({
    where: { learnerId, kind: MilestoneKind.PREMATRIMONIAL },
    select: { id: true, status: true },
  });
  if (existente?.status === MilestoneStatus.COMPLETADO) return;

  const datos = {
    status: MilestoneStatus.COMPLETADO,
    achievedAt: cuando,
    detail: "Terminó los 12 temas del prematrimonial",
    recordedById: actorId,
  };
  if (existente) {
    await tx.milestone.update({ where: { id: existente.id }, data: datos });
  } else {
    await tx.milestone.create({
      data: { learnerId, kind: MilestoneKind.PREMATRIMONIAL, ...datos },
    });
  }
}

/// Destapa la comparación **para la pareja**.
///
/// ⚠️ El pastor ya la ve desde que los dos envían; esto es el permiso para que
/// ellos la vean, y se da cuando van a conversarla con él (decisión del
/// usuario, 3-oct-2026).
export async function destaparTema(
  usuario: UsuarioSesion,
  coupleId: string,
  topicId: string,
): Promise<ResultadoPre> {
  if (!puedeLlevarPrematrimonial(usuario)) {
    return { ok: false, mensaje: "No puedes destapar este tema." };
  }

  const prisma = await getPrisma();
  const pareja = await prisma.premaritalCouple.findFirst({
    where: { id: coupleId, ...alcanceDeParejas(usuario) },
    select: { id: true, learnerAId: true, learnerBId: true },
  });
  if (!pareja) return { ok: false, mensaje: "Este prematrimonial no es tuyo." };

  const talleres = await prisma.premaritalWorkshop.findMany({
    where: { coupleId, topicId },
    select: { learnerId: true, submittedAt: true },
  });
  const envioA = talleres.find((t) => t.learnerId === pareja.learnerAId)?.submittedAt ?? null;
  const envioB = talleres.find((t) => t.learnerId === pareja.learnerBId)?.submittedAt ?? null;
  if (!sePuedeComparar(envioA, envioB)) {
    return { ok: false, mensaje: "Todavía falta que uno de los dos lo envíe." };
  }

  await prisma.premaritalReveal.upsert({
    where: { coupleId_topicId: { coupleId, topicId } },
    create: { coupleId, topicId, revealedById: usuario.id },
    update: {},
  });
  await auditar(prisma, {
    actorId: usuario.id,
    action: "prematrimonial.comparacion_destapada",
    entityType: "premarital_couple",
    entityId: coupleId,
    metadata: { topicId },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lo que ve cada uno de los dos
// ---------------------------------------------------------------------------

export type MiTemaPre = {
  topicId: string;
  number: number;
  name: string;
  code: string;
  disponible: boolean;
  /// El estado del taller **de esta persona**, no el de la pareja.
  mio: EstadoTallerPre;
  /// El estado del tema para los dos: es lo que deja ver «ya envié, falta ella».
  dePareja: EstadoTemaPareja;
  yoEnvie: boolean;
  elOtroEnvio: boolean;
  destapado: boolean;
  notaDelPastor: string | null;
};

export type MiPrematrimonial = {
  coupleId: string;
  learnerId: string;
  nombre: string;
  nombreDelOtro: string;
  codigo: string | null;
  temas: MiTemaPre[];
  aprobados: number;
  total: number;
};

export async function cargarMiPrematrimonial(
  learnerId: string,
): Promise<MiPrematrimonial | null> {
  const prisma = await getPrisma();

  const pareja = await prisma.premaritalCouple.findFirst({
    where: {
      closedAt: null,
      OR: [{ learnerAId: learnerId }, { learnerBId: learnerId }],
    },
    select: {
      id: true,
      learnerAId: true,
      learnerBId: true,
      learnerA: {
        select: {
          person: {
            select: { firstName: true, lastName: true, memberCode: { select: { code: true } } },
          },
        },
      },
      learnerB: {
        select: {
          person: {
            select: { firstName: true, lastName: true, memberCode: { select: { code: true } } },
          },
        },
      },
    },
  });
  if (!pareja) return null;

  const soyA = pareja.learnerAId === learnerId;
  const yo = soyA ? pareja.learnerA : pareja.learnerB;
  const otro = soyA ? pareja.learnerB : pareja.learnerA;
  const otroId = soyA ? pareja.learnerBId : pareja.learnerAId;

  const [temas, talleres, revisiones, destapes] = await prisma.$transaction([
    prisma.premaritalTopic.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        name: true,
        code: true,
        _count: { select: { questions: true } },
      },
    }),
    prisma.premaritalWorkshop.findMany({
      where: { coupleId: pareja.id },
      select: { topicId: true, learnerId: true, submittedAt: true },
    }),
    prisma.premaritalReview.findMany({
      where: { coupleId: pareja.id },
      orderBy: { reviewedAt: "desc" },
      select: {
        topicId: true,
        approved: true,
        reviewedAt: true,
        note: true,
        returnedToLearnerId: true,
      },
    }),
    prisma.premaritalReveal.findMany({
      where: { coupleId: pareja.id },
      select: { topicId: true },
    }),
  ]);

  const destapados = new Set(destapes.map((d) => d.topicId));

  const renglones: MiTemaPre[] = temas.map((t) => {
    const mio = talleres.find((w) => w.topicId === t.id && w.learnerId === learnerId);
    const suyo = talleres.find((w) => w.topicId === t.id && w.learnerId === otroId);
    const delTema = revisiones.filter((r) => r.topicId === t.id);
    const estadoMio = estadoTallerPre(learnerId, mio?.submittedAt ?? null, delTema);

    return {
      topicId: t.id,
      number: t.number,
      name: t.name,
      code: t.code,
      disponible: t._count.questions > 0,
      mio: estadoMio,
      dePareja: estadoTemaPareja({
        envioA: mio?.submittedAt ?? null,
        envioB: suyo?.submittedAt ?? null,
        revisiones: delTema,
      }),
      yoEnvie: Boolean(mio?.submittedAt),
      elOtroEnvio: Boolean(suyo?.submittedAt),
      destapado: destapados.has(t.id),
      // ⚠️ La nota solo se le enseña a quien se le devolvió: al otro no se le
      // muestra una corrección que no es suya.
      notaDelPastor: estadoMio === "DEVUELTO" ? (delTema[0]?.note ?? null) : null,
    };
  });

  return {
    coupleId: pareja.id,
    learnerId,
    nombre: nombreCompleto(yo.person),
    nombreDelOtro: nombreCompleto(otro.person),
    codigo: yo.person.memberCode?.code ?? null,
    temas: renglones,
    aprobados: renglones.filter((r) => r.dePareja === "APROBADO").length,
    total: TOTAL_DE_TEMAS_PRE,
  };
}

// ---------------------------------------------------------------------------
// Llenar el taller
// ---------------------------------------------------------------------------

export type TallerPreAbierto = {
  workshopId: string;
  coupleId: string;
  tema: { id: string; number: number; name: string };
  preguntas: PreguntaPre[];
  respuestas: RespuestaPre[];
  estado: EstadoTallerPre;
  notaDelPastor: string | null;
  avance: ReturnType<typeof avancePre>;
  puedeEnviar: boolean;
};

export async function abrirTallerPre(
  code: string,
  learnerId: string,
): Promise<ResultadoPre<TallerPreAbierto>> {
  const prisma = await getPrisma();

  const tema = await prisma.premaritalTopic.findUnique({
    where: { code },
    select: {
      id: true,
      number: true,
      name: true,
      questions: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, kind: true, prompt: true, options: true },
      },
    },
  });
  if (!tema) return { ok: false, mensaje: "Ese código no corresponde a ningún taller." };
  if (tema.questions.length === 0) {
    return {
      ok: false,
      mensaje: "Este tema todavía no está disponible. Tu pastor te avisa cuando lo esté.",
    };
  }

  const pareja = await prisma.premaritalCouple.findFirst({
    where: { closedAt: null, OR: [{ learnerAId: learnerId }, { learnerBId: learnerId }] },
    select: { id: true },
  });
  if (!pareja) {
    return { ok: false, mensaje: "No estás en un prematrimonial abierto. Avísale a tu pastor." };
  }

  const taller = await prisma.premaritalWorkshop.upsert({
    where: {
      coupleId_learnerId_topicId: {
        coupleId: pareja.id,
        learnerId,
        topicId: tema.id,
      },
    },
    create: { coupleId: pareja.id, learnerId, topicId: tema.id },
    update: {},
    select: {
      id: true,
      submittedAt: true,
      answers: {
        select: {
          questionId: true,
          text: true,
          choice: true,
          choices: true,
          ordering: true,
        },
      },
    },
  });

  const revisiones = await prisma.premaritalReview.findMany({
    where: { coupleId: pareja.id, topicId: tema.id },
    orderBy: { reviewedAt: "desc" },
    select: { approved: true, reviewedAt: true, note: true, returnedToLearnerId: true },
  });

  const estado = estadoTallerPre(learnerId, taller.submittedAt, revisiones);
  const preguntas = tema.questions as PreguntaPre[];
  const avance = avancePre(preguntas, taller.answers);

  return {
    ok: true,
    datos: {
      workshopId: taller.id,
      coupleId: pareja.id,
      tema: { id: tema.id, number: tema.number, name: tema.name },
      preguntas,
      respuestas: taller.answers,
      estado,
      notaDelPastor: estado === "DEVUELTO" ? (revisiones[0]?.note ?? null) : null,
      avance,
      puedeEnviar:
        estado !== "ENVIADO" && estado !== "APROBADO" && avance.completo,
    },
  };
}

export async function guardarRespuestaPre(
  workshopId: string,
  learnerId: string,
  questionId: string,
  valor: { text?: string; choice?: number; choices?: number[]; ordering?: number[] },
): Promise<ResultadoPre> {
  const prisma = await getPrisma();

  const taller = await prisma.premaritalWorkshop.findUnique({
    where: { id: workshopId },
    select: {
      learnerId: true,
      coupleId: true,
      topicId: true,
      submittedAt: true,
    },
  });
  // El taller es de quien lo abrió. El id viaja por el navegador, así que se
  // comprueba en el servidor: sin esto, cambiar un id escribiría en el taller
  // de la otra persona — que es justo lo que este ejercicio no puede permitir.
  if (!taller || taller.learnerId !== learnerId) {
    return { ok: false, mensaje: "Ese taller no es tuyo." };
  }

  const revisiones = await prisma.premaritalReview.findMany({
    where: { coupleId: taller.coupleId, topicId: taller.topicId },
    orderBy: { reviewedAt: "desc" },
    select: { approved: true, reviewedAt: true, returnedToLearnerId: true },
  });
  const estado = estadoTallerPre(learnerId, taller.submittedAt, revisiones);
  if (estado === "ENVIADO" || estado === "APROBADO") {
    return {
      ok: false,
      mensaje:
        estado === "APROBADO"
          ? "Este taller ya fue aprobado: no se puede cambiar."
          : "Ya lo enviaste. Espera a que tu pastor lo revise.",
    };
  }

  const pregunta = await prisma.premaritalQuestion.findUnique({
    where: { id: questionId },
    select: { topicId: true, kind: true, options: true },
  });
  if (!pregunta || pregunta.topicId !== taller.topicId) {
    return { ok: false, mensaje: "Esa pregunta no es de este taller." };
  }

  const limpio = normalizarRespuesta(pregunta, valor);
  if (!limpio.ok) return limpio;

  await prisma.premaritalAnswer.upsert({
    where: { workshopId_questionId: { workshopId, questionId } },
    create: { workshopId, questionId, ...limpio.datos },
    update: limpio.datos,
  });

  return { ok: true };
}

/// Valida lo que llega del navegador según el tipo de pregunta.
///
/// ⚠️ **Se valida en el SERVIDOR aunque la pantalla solo ofrezca lo correcto**:
/// un desplegable es una sugerencia del navegador, no una garantía.
function normalizarRespuesta(
  pregunta: { kind: string; options: string[] },
  valor: { text?: string; choice?: number; choices?: number[]; ordering?: number[] },
): ResultadoPre<{
  text: string | null;
  choice: number | null;
  choices: number[];
  ordering: number[];
}> {
  const vacio = { text: null, choice: null, choices: [], ordering: [] };

  switch (pregunta.kind) {
    case "SI_NO":
    case "OPCION": {
      const i = valor.choice;
      if (i === undefined || !Number.isInteger(i) || i < 0 || i >= pregunta.options.length) {
        return { ok: false, mensaje: "Esa opción no existe." };
      }
      return { ok: true, datos: { ...vacio, choice: i } };
    }

    case "MULTIPLE": {
      const marcas = valor.choices ?? [];
      if (
        marcas.some((i) => !Number.isInteger(i) || i < 0 || i >= pregunta.options.length)
      ) {
        return { ok: false, mensaje: "Alguna de esas opciones no existe." };
      }
      // Sin repetidos y en orden, para que comparar sea comparar conjuntos.
      const unicas = [...new Set(marcas)].sort((a, b) => a - b);
      return { ok: true, datos: { ...vacio, choices: unicas } };
    }

    case "ORDEN": {
      const orden = valor.ordering ?? [];
      // Se acepta un orden incompleto mientras llena (puede guardar e irse),
      // pero NO uno con repetidos o inventados: eso sí es un dato corrupto.
      if (orden.some((i) => !Number.isInteger(i) || i < 0 || i >= pregunta.options.length)) {
        return { ok: false, mensaje: "Ese orden no es válido." };
      }
      if (new Set(orden).size !== orden.length) {
        return { ok: false, mensaje: "No puedes repetir una opción en el orden." };
      }
      return { ok: true, datos: { ...vacio, ordering: orden } };
    }

    default:
      return { ok: true, datos: { ...vacio, text: (valor.text ?? "").trim() || null } };
  }
}

export async function enviarTallerPre(
  workshopId: string,
  learnerId: string,
): Promise<ResultadoPre> {
  const prisma = await getPrisma();

  const taller = await prisma.premaritalWorkshop.findUnique({
    where: { id: workshopId },
    select: {
      learnerId: true,
      coupleId: true,
      topicId: true,
      submittedAt: true,
      answers: {
        select: {
          questionId: true,
          text: true,
          choice: true,
          choices: true,
          ordering: true,
        },
      },
      topic: {
        select: {
          number: true,
          name: true,
          questions: {
            orderBy: { number: "asc" },
            select: { id: true, number: true, kind: true, prompt: true, options: true },
          },
        },
      },
    },
  });
  if (!taller || taller.learnerId !== learnerId) {
    return { ok: false, mensaje: "Ese taller no es tuyo." };
  }

  const revisiones = await prisma.premaritalReview.findMany({
    where: { coupleId: taller.coupleId, topicId: taller.topicId },
    orderBy: { reviewedAt: "desc" },
    select: { approved: true, reviewedAt: true, returnedToLearnerId: true },
  });
  const estado = estadoTallerPre(learnerId, taller.submittedAt, revisiones);
  if (estado === "ENVIADO" || estado === "APROBADO") {
    return { ok: false, mensaje: "Este taller ya está enviado." };
  }

  // ⚠️ La misma regla que apaga el botón, comprobada en el SERVIDOR.
  const preguntas = taller.topic.questions as PreguntaPre[];
  if (!avancePre(preguntas, taller.answers).completo) {
    return { ok: false, mensaje: "Te faltan preguntas por responder." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.premaritalWorkshop.update({
      where: { id: workshopId },
      data: { submittedAt: new Date() },
    });
    await auditar(tx, {
      // Sin actor a propósito: lo envió la persona desde su celular, no una
      // cuenta del sistema (la misma decisión que en Casa de Fe).
      actorId: null,
      action: "prematrimonial.taller_enviado",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { tema: taller.topic.number, nombre: taller.topic.name },
    });
  });

  return { ok: true };
}

/// Los temas esperando revisión, dentro del alcance de quien mira.
export type TemaEnLaCola = {
  coupleId: string;
  topicId: string;
  numero: number;
  nombreTema: string;
  nombreA: string;
  nombreB: string;
  ultimoEnvio: Date;
  destapado: boolean;
};

export async function cargarPorRevisarPre(
  usuario: UsuarioSesion,
): Promise<TemaEnLaCola[]> {
  if (!puedeLlevarPrematrimonial(usuario)) return [];
  const parejas = await cargarParejas(usuario);
  if (parejas.length === 0) return [];

  const prisma = await getPrisma();
  const ids = parejas.map((p) => p.id);

  const [temas, talleres, revisiones, destapes] = await prisma.$transaction([
    prisma.premaritalTopic.findMany({ select: { id: true, number: true, name: true } }),
    prisma.premaritalWorkshop.findMany({
      where: { coupleId: { in: ids }, submittedAt: { not: null } },
      select: { coupleId: true, topicId: true, learnerId: true, submittedAt: true },
    }),
    prisma.premaritalReview.findMany({
      where: { coupleId: { in: ids } },
      select: {
        coupleId: true,
        topicId: true,
        approved: true,
        reviewedAt: true,
        returnedToLearnerId: true,
      },
    }),
    prisma.premaritalReveal.findMany({
      where: { coupleId: { in: ids } },
      select: { coupleId: true, topicId: true },
    }),
  ]);

  const porTema = new Map(temas.map((t) => [t.id, t]));
  const destapados = new Set(destapes.map((d) => `${d.coupleId}|${d.topicId}`));
  const cola: TemaEnLaCola[] = [];

  for (const pareja of parejas) {
    if (pareja.cerrada) continue;
    const suyos = talleres.filter((t) => t.coupleId === pareja.id);
    for (const topicId of new Set(suyos.map((t) => t.topicId))) {
      const envioA =
        suyos.find((t) => t.topicId === topicId && t.learnerId === pareja.learnerAId)
          ?.submittedAt ?? null;
      const envioB =
        suyos.find((t) => t.topicId === topicId && t.learnerId === pareja.learnerBId)
          ?.submittedAt ?? null;
      if (!sePuedeComparar(envioA, envioB)) continue;

      const delTema = revisiones.filter(
        (r) => r.coupleId === pareja.id && r.topicId === topicId,
      );
      if (estadoTemaPareja({ envioA, envioB, revisiones: delTema }) !== "ESPERANDO") continue;

      const tema = porTema.get(topicId);
      if (!tema) continue;
      cola.push({
        coupleId: pareja.id,
        topicId,
        numero: tema.number,
        nombreTema: tema.name,
        nombreA: pareja.nombreA,
        nombreB: pareja.nombreB,
        ultimoEnvio: new Date(Math.max(envioA!.getTime(), envioB!.getTime())),
        destapado: destapados.has(`${pareja.id}|${topicId}`),
      });
    }
  }

  // Lo que más lleva esperando, primero.
  cola.sort((a, b) => a.ultimoEnvio.getTime() - b.ultimoEnvio.getTime());
  return cola;
}

/// Re-exportado para que las pantallas no tengan que importar de dos sitios.
export { generarCodigo, esOrdenCompleto, respondidaPre };
