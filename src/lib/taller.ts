import {
  FaithHouseStatus,
  MilestoneKind,
  MilestoneStatus,
  type Prisma,
} from "@iglesia/prisma-client";

import { auditar } from "@/lib/audit";
import { Role } from "@iglesia/prisma-client";
import { type UsuarioSesion, veTodaLaRed } from "@/lib/auth";
import { quienesLoLlevan } from "@/lib/encargados-catalogo";
import { accesoAExpediente } from "@/lib/expediente";
import { getPrisma } from "@/lib/prisma";
import { lideresDeMiRama } from "@/lib/red";
import {
  LARGO_MINIMO_NOTA,
  avanceDelTaller,
  colaDelCelular,
  estadoDelTaller,
  generarCodigo,
  puedeEnviarse,
  terminoLosDoce,
  type EstadoDelTaller,
  type PreguntaDelTaller,
  type RespuestaDelTaller,
} from "@/lib/taller-catalogo";

export type ResultadoTaller<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { datos: T }))
  | { ok: false; mensaje: string };

// ---------------------------------------------------------------------------
// Identificar a quien escanea el QR
// ---------------------------------------------------------------------------

/// Reconoce a la persona **sin cuenta ni contraseña**, con la misma llave que
/// el formulario de liderazgo: primero el celular; si no aparece, correo Y
/// fecha de nacimiento.
///
/// ⚠️ **Los dos datos del segundo camino son obligatorios**, y la razón está
/// medida (CLAUDE.md, 7-sep-2026): hay fichas con el correo de otra persona, así
/// que buscar solo por correo escribiría sobre quien no es. Con las dos cosas,
/// hoy no existe un solo caso ambiguo en toda la base.
///
/// ⚠️ **NO EXIGE ESTAR INSCRITO EN UNA CASA DE FE.** Medido el 26-sep-2026: de
/// las 4 personas con avance en los temas, **3 no están inscritas en ninguna**.
/// Exigirlo dejaría fuera a quienes ya lo están usando.
export async function identificarParaTaller(datos: {
  celular: string;
  correo?: string;
  nacimiento?: string;
}): Promise<ResultadoTaller<{ learnerId: string; nombre: string; token: string }>> {
  const prisma = await getPrisma();
  const cola = colaDelCelular(datos.celular);
  const correo = (datos.correo ?? "").trim().toLowerCase();

  const CAMPOS = {
    id: true,
    firstName: true,
    lastName: true,
    learnerProfile: { select: { id: true } },
  } as const;

  let candidatas: {
    id: string;
    firstName: string;
    lastName: string | null;
    learnerProfile: { id: string } | null;
  }[] = [];
  let porCorreo = false;

  if (cola) {
    candidatas = await prisma.person.findMany({
      where: {
        OR: [
          { callPhone: { endsWith: cola } },
          { whatsappPhone: { endsWith: cola } },
        ],
      },
      select: CAMPOS,
    });
  }

  if (candidatas.length === 0 && correo && datos.nacimiento) {
    candidatas = await prisma.person.findMany({
      where: {
        email: { equals: correo, mode: "insensitive" },
        birthDate: new Date(datos.nacimiento),
      },
      select: CAMPOS,
    });
    porCorreo = candidatas.length > 0;
  }

  // Dos fichas que casan: se para y se avisa, antes que escribir sobre la
  // persona equivocada.
  if (candidatas.length > 1) {
    return {
      ok: false,
      mensaje: porCorreo
        ? "Encontramos más de una ficha con ese correo y esa fecha. Avísale a tu líder para que lo revisen."
        : "Encontramos más de una ficha con ese celular. Avísale a tu líder para que lo revisen.",
    };
  }

  const persona = candidatas[0];
  if (!persona) {
    return {
      ok: false,
      mensaje: cola
        ? "No encontramos tu ficha con ese celular. Prueba con tu correo y tu fecha de nacimiento, o avísale a tu líder."
        : "Escribe tu celular completo, con los 10 dígitos.",
    };
  }

  if (!persona.learnerProfile) {
    return {
      ok: false,
      mensaje: "Tu ficha existe pero todavía no tiene proceso abierto. Avísale a tu líder.",
    };
  }

  const learnerId = persona.learnerProfile.id;
  const token = await tokenDeRegreso(learnerId);
  const nombre = `${persona.firstName} ${persona.lastName ?? ""}`.trim();

  return { ok: true, datos: { learnerId, nombre, token } };
}

/// El token con el que vuelve durante la semana. Se reusa el que ya tenga: uno
/// nuevo en cada visita dejaría la cookie anterior muerta y la persona tendría
/// que identificarse otra vez cada vez.
async function tokenDeRegreso(learnerId: string): Promise<string> {
  const prisma = await getPrisma();
  const existente = await prisma.faithHouseTallerToken.findUnique({
    where: { learnerId },
    select: { token: true },
  });
  if (existente) {
    await prisma.faithHouseTallerToken.update({
      where: { learnerId },
      data: { usedAt: new Date() },
    });
    return existente.token;
  }
  const creado = await prisma.faithHouseTallerToken.create({
    data: { learnerId, token: generarCodigo(), usedAt: new Date() },
    select: { token: true },
  });
  return creado.token;
}

export async function learnerPorToken(token: string): Promise<
  { learnerId: string; nombre: string } | null
> {
  if (!token) return null;
  const prisma = await getPrisma();
  const fila = await prisma.faithHouseTallerToken.findUnique({
    where: { token },
    select: {
      learnerId: true,
      learner: {
        select: { person: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!fila) return null;
  const p = fila.learner.person;
  return {
    learnerId: fila.learnerId,
    nombre: `${p.firstName} ${p.lastName ?? ""}`.trim(),
  };
}

// ---------------------------------------------------------------------------
// El taller que ve la persona
// ---------------------------------------------------------------------------

export type TallerAbierto = {
  workshopId: string;
  tema: {
    id: string;
    number: number;
    name: string;
    subtitle: string | null;
    memoryVerse: string | null;
  };
  dias: { number: number; action: string }[];
  preguntas: PreguntaDelTaller[];
  respuestas: RespuestaDelTaller[];
  estado: EstadoDelTaller;
  /// La nota de la última revisión, para que quien recibe un taller devuelto
  /// sepa qué corregir. Sin ella, «devuelto» no dice nada.
  notaDeLaRevision: string | null;
  avance: ReturnType<typeof avanceDelTaller>;
  puedeEnviar: boolean;
};

/// Abre (o retoma) el taller de un tema para una persona.
export async function abrirTaller(
  qrCode: string,
  learnerId: string,
): Promise<ResultadoTaller<TallerAbierto>> {
  const prisma = await getPrisma();

  const tema = await prisma.faithHouseTopic.findUnique({
    where: { qrCode },
    select: {
      id: true,
      number: true,
      name: true,
      subtitle: true,
      memoryVerse: true,
      days: { orderBy: { number: "asc" }, select: { number: true, action: true } },
      questions: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, kind: true, prompt: true, options: true },
      },
    },
  });

  // Un código desconocido devuelve lo mismo que uno de otra iglesia: nada que
  // permita adivinar si existe.
  if (!tema) return { ok: false, mensaje: "Ese código no corresponde a ningún taller." };

  const taller = await prisma.faithHouseWorkshop.upsert({
    where: { learnerId_topicId: { learnerId, topicId: tema.id } },
    create: { learnerId, topicId: tema.id },
    update: {},
    select: {
      id: true,
      submittedAt: true,
      answers: { select: { questionId: true, text: true, choice: true } },
      reviews: {
        orderBy: { reviewedAt: "desc" },
        select: { approved: true, reviewedAt: true, note: true },
      },
    },
  });

  const estado = estadoDelTaller(taller.submittedAt, taller.reviews);
  const avance = avanceDelTaller(tema.questions, taller.answers);

  return {
    ok: true,
    datos: {
      workshopId: taller.id,
      tema: {
        id: tema.id,
        number: tema.number,
        name: tema.name,
        subtitle: tema.subtitle,
        memoryVerse: tema.memoryVerse,
      },
      dias: tema.days,
      preguntas: tema.questions,
      respuestas: taller.answers,
      estado,
      notaDeLaRevision: estado === "DEVUELTO" ? (taller.reviews[0]?.note ?? null) : null,
      avance,
      puedeEnviar: puedeEnviarse(tema.questions, taller.answers, estado),
    },
  };
}

/// Guarda UNA respuesta. Se llama mientras la persona escribe, así que es lo
/// que hace posible «guardar e ir volviendo» sin cuenta.
export async function guardarRespuesta(
  workshopId: string,
  learnerId: string,
  questionId: string,
  valor: { text?: string; choice?: number },
): Promise<ResultadoTaller> {
  const prisma = await getPrisma();

  const taller = await prisma.faithHouseWorkshop.findUnique({
    where: { id: workshopId },
    select: {
      learnerId: true,
      topicId: true,
      submittedAt: true,
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
    },
  });

  // El taller es de quien lo abrió. El id viaja por el navegador, así que se
  // comprueba en el servidor: sin esto, cambiar un id escribiría en el taller
  // de otra persona.
  if (!taller || taller.learnerId !== learnerId) {
    return { ok: false, mensaje: "Ese taller no es tuyo." };
  }

  const estado = estadoDelTaller(taller.submittedAt, taller.reviews);
  if (estado === "ENVIADO" || estado === "APROBADO") {
    return {
      ok: false,
      mensaje:
        estado === "APROBADO"
          ? "Este taller ya fue aprobado: no se puede cambiar."
          : "Ya lo enviaste. Espera a que tu líder lo revise.",
    };
  }

  // La pregunta tiene que ser de ESTE tema.
  const pregunta = await prisma.faithHouseTopicQuestion.findUnique({
    where: { id: questionId },
    select: { topicId: true, kind: true, options: true },
  });
  if (!pregunta || pregunta.topicId !== taller.topicId) {
    return { ok: false, mensaje: "Esa pregunta no es de este taller." };
  }

  const texto = (valor.text ?? "").trim();
  let choice: number | null = null;
  if (pregunta.kind === "OPCION") {
    const elegida = valor.choice;
    if (
      elegida === undefined ||
      !Number.isInteger(elegida) ||
      elegida < 0 ||
      elegida >= pregunta.options.length
    ) {
      return { ok: false, mensaje: "Esa opción no existe." };
    }
    choice = elegida;
  }

  await prisma.faithHouseAnswer.upsert({
    where: { workshopId_questionId: { workshopId, questionId } },
    create: {
      workshopId,
      questionId,
      text: pregunta.kind === "OPCION" ? null : texto || null,
      choice,
    },
    update: {
      text: pregunta.kind === "OPCION" ? null : texto || null,
      choice,
    },
  });

  return { ok: true };
}

/// Envía el taller al líder. Deja el tema **EN PROCESO** — el estado que ya
/// existía, sin inventar uno nuevo (decisión del usuario, 27-sep-2026).
export async function enviarTaller(
  workshopId: string,
  learnerId: string,
): Promise<ResultadoTaller> {
  const prisma = await getPrisma();

  const taller = await prisma.faithHouseWorkshop.findUnique({
    where: { id: workshopId },
    select: {
      learnerId: true,
      topicId: true,
      submittedAt: true,
      answers: { select: { questionId: true, text: true, choice: true } },
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
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

  const estado = estadoDelTaller(taller.submittedAt, taller.reviews);

  // ⚠️ La misma regla que apaga el botón, comprobada en el SERVIDOR. Un botón
  // deshabilitado es una sugerencia del navegador, no una garantía.
  if (!puedeEnviarse(taller.topic.questions, taller.answers, estado)) {
    return {
      ok: false,
      mensaje:
        estado === "ENVIADO" || estado === "APROBADO"
          ? "Este taller ya está enviado."
          : "Te faltan preguntas por responder.",
    };
  }

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.faithHouseWorkshop.update({
      where: { id: workshopId },
      data: { submittedAt: ahora },
    });

    // El tema pasa a EN PROCESO. `recordedById` se queda NULO a propósito: lo
    // envió la persona desde la calle, no una cuenta del sistema, y poner ahí
    // a alguien diría que un líder lo registró.
    await tx.faithHouseProgress.upsert({
      where: { learnerId_topicId: { learnerId, topicId: taller.topicId } },
      create: {
        learnerId,
        topicId: taller.topicId,
        status: FaithHouseStatus.EN_PROCESO,
      },
      update: { status: FaithHouseStatus.EN_PROCESO },
    });

    await auditar(tx, {
      actorId: null,
      action: "casa_de_fe.taller_enviado",
      entityType: "learner_profile",
      entityId: learnerId,
      metadata: { tema: taller.topic.number, nombre: taller.topic.name },
    });
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// La revisión del líder
// ---------------------------------------------------------------------------

/// **Quién puede aprobar o devolver un taller** (decisión del usuario,
/// 27-sep-2026): quien ya puede escribir en su expediente —su mentor, su
/// consolidador, el pastor, coordinación y administración— **más el líder o
/// encargado de la Casa de Fe donde está**.
///
/// ⚠️ La segunda mitad no es un adorno: **3 de las 4 personas con avance no
/// están inscritas en ninguna casa**, así que con solo la primera mitad
/// bastaría, pero con solo la segunda sus talleres se quedarían sin nadie que
/// los apruebe. Las dos, unidas, cubren los dos casos.
export async function puedeRevisarTaller(
  usuario: UsuarioSesion,
  learnerId: string,
): Promise<boolean> {
  // ⚠️ **Atajo antes de tocar la base, y no es cosmético.** Quien escribe en
  // CUALQUIER expediente —administración, pastor y quien coordina la
  // consolidación— pasa sin consultar nada. Sin este corte, la cola haría una
  // consulta por taller para gente que iba a pasar igual, y con
  // `PrismaPg max:1` (§7) esas consultas se hacen EN FILA: veinte talleres
  // serían veinte latencias seguidas.
  if (
    usuario.role === Role.ADMIN ||
    usuario.role === Role.PASTOR ||
    veTodaLaRed(usuario)
  ) {
    return true;
  }

  const acceso = await accesoAExpediente(usuario, learnerId);
  if (acceso.puedeEscribir) return true;

  const prisma = await getPrisma();
  const grupos = await prisma.faithHouseGroupMember.findMany({
    where: { learnerId, group: { closedAt: null } },
    select: {
      group: {
        select: {
          leaderId: true,
          createdById: true,
          coLeaders: { select: { userId: true } },
        },
      },
    },
  });

  const deLaRama = await lideresDeMiRama(usuario.id);

  return grupos.some((g) => {
    const grupo = {
      leaderId: g.group.leaderId,
      createdById: g.group.createdById,
      coLeaderIds: g.group.coLeaders.map((c) => c.userId),
    };
    if (grupo.leaderId === usuario.id) return true;
    if (grupo.coLeaderIds.includes(usuario.id)) return true;
    if (grupo.createdById === usuario.id) return true;
    return quienesLoLlevan(grupo).some((id) => deLaRama.includes(id));
  });
}

/// Aprueba o devuelve un taller.
///
/// ⚠️ **La revisión SE APILA, NO SE PISA** (la regla del 10-sep-2026 con las
/// visitas reprogramadas): cuántas veces le devolvieron un taller a alguien es
/// justo la señal de que algo no va bien con esa persona, y sobrescribir la
/// anterior la borraría.
export async function revisarTaller(
  usuario: UsuarioSesion,
  workshopId: string,
  aprobado: boolean,
  nota: string,
): Promise<ResultadoTaller<{ completoLosDoce: boolean; temasCompletados: number }>> {
  const prisma = await getPrisma();

  const taller = await prisma.faithHouseWorkshop.findUnique({
    where: { id: workshopId },
    select: {
      learnerId: true,
      topicId: true,
      submittedAt: true,
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
      topic: { select: { number: true, name: true } },
    },
  });

  if (!taller) return { ok: false, mensaje: "Ese taller no existe." };

  if (!(await puedeRevisarTaller(usuario, taller.learnerId))) {
    return { ok: false, mensaje: "No puedes revisar los talleres de esta persona." };
  }

  const estado = estadoDelTaller(taller.submittedAt, taller.reviews);
  if (estado !== "ENVIADO") {
    return {
      ok: false,
      mensaje:
        estado === "BORRADOR"
          ? "Todavía no lo ha enviado."
          : "Ese taller ya está revisado.",
    };
  }

  const limpia = nota.trim();
  // Devolver sin decir por qué deja a la persona sin saber qué corregir.
  if (!aprobado && limpia.length < LARGO_MINIMO_NOTA) {
    return {
      ok: false,
      mensaje: `Escribe qué debe corregir (mínimo ${LARGO_MINIMO_NOTA} caracteres).`,
    };
  }

  const ahora = new Date();
  let temasCompletados = 0;
  let completoLosDoce = false;

  await prisma.$transaction(async (tx) => {
    await tx.faithHouseWorkshopReview.create({
      data: {
        workshopId,
        approved: aprobado,
        note: limpia || null,
        reviewedById: usuario.id,
        reviewedAt: ahora,
      },
    });

    await tx.faithHouseProgress.upsert({
      where: {
        learnerId_topicId: { learnerId: taller.learnerId, topicId: taller.topicId },
      },
      create: {
        learnerId: taller.learnerId,
        topicId: taller.topicId,
        status: aprobado ? FaithHouseStatus.COMPLETADO : FaithHouseStatus.EN_PROCESO,
        completedAt: aprobado ? ahora : null,
        assessment: limpia || null,
        recordedById: usuario.id,
      },
      update: {
        status: aprobado ? FaithHouseStatus.COMPLETADO : FaithHouseStatus.EN_PROCESO,
        completedAt: aprobado ? ahora : null,
        assessment: limpia || null,
        recordedById: usuario.id,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: aprobado ? "casa_de_fe.taller_aprobado" : "casa_de_fe.taller_devuelto",
      entityType: "learner_profile",
      entityId: taller.learnerId,
      metadata: { tema: taller.topic.number, nombre: taller.topic.name },
    });

    if (aprobado) {
      temasCompletados = await tx.faithHouseProgress.count({
        where: { learnerId: taller.learnerId, status: FaithHouseStatus.COMPLETADO },
      });
      completoLosDoce = terminoLosDoce(temasCompletados);
      if (completoLosDoce) {
        await marcarHitoCasaDeFe(tx, taller.learnerId, usuario.id, ahora);
      }
    }
  });

  return { ok: true, datos: { completoLosDoce, temasCompletados } };
}

/// Pone el hito CASA DE FE al aprobar el doceavo tema.
///
/// ⚠️ **Esto cierra un agujero medido**: el 26-sep-2026 Luis Carlos tenía los
/// 12 temas completados y el hito en blanco, porque completar los temas no lo
/// ponía. Alguien tenía que acordarse de ir a Administración.
///
/// ⚠️ **La FASE no se mueve, y es a propósito.** Pasar de Fortalecer a Entrenar
/// pide además bautismo y encuentro, y es una decisión pastoral con su nota y
/// su responsable (`cambiarDeFase`). Un hito no es un ascenso.
///
/// Si el hito ya estaba conseguido, no se toca: su fecha original vale más que
/// la de hoy (la regla de las fusiones, CLAUDE.md §8).
async function marcarHitoCasaDeFe(
  tx: Prisma.TransactionClient,
  learnerId: string,
  actorId: string,
  cuando: Date,
) {
  const existente = await tx.milestone.findFirst({
    where: { learnerId, kind: MilestoneKind.CASA_DE_FE },
    select: { id: true, status: true },
  });

  if (existente?.status === MilestoneStatus.COMPLETADO) return;

  const datos = {
    status: MilestoneStatus.COMPLETADO,
    achievedAt: cuando,
    detail: "Terminó los 12 temas de Casa de Fe",
    recordedById: actorId,
  };

  if (existente) {
    await tx.milestone.update({ where: { id: existente.id }, data: datos });
  } else {
    await tx.milestone.create({
      data: { learnerId, kind: MilestoneKind.CASA_DE_FE, ...datos },
    });
  }

  await auditar(tx, {
    actorId,
    action: "casa_de_fe.recorrido_terminado",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: { temas: 12 },
  });
}

// ---------------------------------------------------------------------------
// La cola de «por revisar»
// ---------------------------------------------------------------------------

export type TallerEnLaCola = {
  workshopId: string;
  learnerId: string;
  nombre: string;
  tema: number;
  temaNombre: string;
  enviadoEl: Date;
  respondidas: number;
  total: number;
  casa: string | null;
};

/// Los talleres esperando revisión, **dentro del alcance de quien mira**.
///
/// ⚠️ Se filtra en memoria, después de traerlos, y eso está pensado: los
/// talleres enviados y sin revisar son unas pocas decenas como mucho, mientras
/// que armar el alcance en SQL pediría cruzar la rama de la red con los grupos
/// en la misma consulta. Con `PrismaPg max:1` cada viaje de más es una latencia
/// de más, y aquí son **dos viajes fijos** en vez de uno por persona.
export async function cargarPorRevisar(
  usuario: UsuarioSesion,
): Promise<TallerEnLaCola[]> {
  const prisma = await getPrisma();

  const enviados = await prisma.faithHouseWorkshop.findMany({
    where: { submittedAt: { not: null } },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      learnerId: true,
      submittedAt: true,
      answers: { select: { questionId: true, text: true, choice: true } },
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
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
      learner: {
        select: {
          person: { select: { firstName: true, lastName: true } },
          faithHouseGroups: {
            where: { group: { closedAt: null } },
            select: { group: { select: { name: true } } },
            take: 1,
          },
        },
      },
    },
  });

  const esperando = enviados.filter(
    (t) => estadoDelTaller(t.submittedAt, t.reviews) === "ENVIADO",
  );

  const cola: TallerEnLaCola[] = [];
  for (const t of esperando) {
    if (!(await puedeRevisarTaller(usuario, t.learnerId))) continue;
    const avance = avanceDelTaller(t.topic.questions, t.answers);
    const p = t.learner.person;
    cola.push({
      workshopId: t.id,
      learnerId: t.learnerId,
      nombre: `${p.firstName} ${p.lastName ?? ""}`.trim(),
      tema: t.topic.number,
      temaNombre: t.topic.name,
      enviadoEl: t.submittedAt as Date,
      respondidas: avance.respondidas,
      total: avance.total,
      casa: t.learner.faithHouseGroups[0]?.group.name ?? null,
    });
  }

  return cola;
}
