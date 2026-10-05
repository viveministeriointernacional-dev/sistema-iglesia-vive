import { Role, type Prisma } from "@iglesia/prisma-client";

import { auditar } from "@/lib/audit";
import { type UsuarioSesion } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { codigoDeMiembro } from "@/lib/taller";
import {
  LARGO_MINIMO_NOTA_QUIZ,
  avanceQuiz,
  calificar,
  cuantasSeCalifican,
  dominaLosDoce,
  estadoDelQuiz,
  estadoDelTemaQuiz,
  pideAtencionQuiz,
  puedeEnviarseQuiz,
  resultadoDeOpcion,
  temasAprobadosQuiz,
  ultimaRevision,
  verLaCalificacion,
  type Calificacion,
  type EstadoQuiz,
  type EstadoTemaQuiz,
  type PreguntaQuiz,
  type RespuestaQuiz,
} from "@/lib/cuestionario-catalogo";

/// Núcleo del **Cuestionario de Dominio para Líderes**. Lo puro vive en
/// `cuestionario-catalogo.ts`; aquí está lo que toca la base.

export type ResultadoQuiz<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { datos: T }))
  | { ok: false; mensaje: string };

// ---------------------------------------------------------------------------
// Quién revisa
// ---------------------------------------------------------------------------

/// **Solo pastores y administración** (decisión del usuario).
///
/// ⚠️ **No se hereda del permiso de la vista «Escuela», y sin esto habría una
/// fuga.** Esa vista la ve también el rol MENTOR (lo mismo que pasó con el
/// prematrimonial el 3-oct-2026), y aquí se decide **quién queda habilitado
/// para enseñar doctrina a la iglesia**: eso es una decisión del liderazgo
/// pastoral, no del acompañamiento personal.
export function puedeRevisarCuestionario(usuario: UsuarioSesion): boolean {
  return usuario.role === Role.PASTOR || usuario.role === Role.ADMIN;
}

// ---------------------------------------------------------------------------
// Llenar el cuestionario (desde el celular, sin cuenta)
// ---------------------------------------------------------------------------

const SELECT_PREGUNTAS = {
  orderBy: { number: "asc" },
  select: {
    id: true,
    number: true,
    kind: true,
    prompt: true,
    options: true,
    correctChoice: true,
    explanation: true,
  },
} satisfies Prisma.LeaderQuizTopic$questionsArgs;

export type TemaDelQuiz = {
  id: string;
  number: number;
  name: string;
  subtitle: string | null;
  leaderNote: string | null;
};

export type QuizAbierto = {
  quizId: string;
  tema: TemaDelQuiz;
  preguntas: PreguntaQuiz[];
  respuestas: RespuestaQuiz[];
  estado: EstadoQuiz;
  /// La nota del coordinador, **solo si lo devolvió**: es lo que le dice qué
  /// repasar.
  notaDelCoordinador: string | null;
  vecesDevuelto: number;
  avance: ReturnType<typeof avanceQuiz>;
  puedeEnviar: boolean;
  /// ⚠️ **La calificación solo viaja al navegador cuando está APROBADO** (ver
  /// `verLaCalificacion`). Mientras no lo esté, estos dos van vacíos: si la
  /// respuesta correcta llegara al navegador «oculta», bastaría abrir el
  /// código de la página para copiarla.
  calificaciones: Record<string, Calificacion>;
  resultado: ReturnType<typeof resultadoDeOpcion> | null;
};

export async function abrirCuestionario(
  code: string,
  learnerId: string,
): Promise<ResultadoQuiz<QuizAbierto>> {
  const prisma = await getPrisma();

  const tema = await prisma.leaderQuizTopic.findUnique({
    where: { code },
    select: {
      id: true,
      number: true,
      name: true,
      subtitle: true,
      leaderNote: true,
      questions: SELECT_PREGUNTAS,
    },
  });
  if (!tema) {
    return { ok: false, mensaje: "Ese código no corresponde a ningún tema." };
  }
  // Un tema sin preguntas no se puede llenar, y la pantalla lo dice en vez de
  // dar 404: la persona llegó con su enlace bueno.
  if (tema.questions.length === 0) {
    return {
      ok: false,
      mensaje:
        "Este tema todavía no tiene su cuestionario. Tu coordinador te avisa cuando esté.",
    };
  }

  const quiz = await prisma.leaderQuiz.upsert({
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

  const estado = estadoDelQuiz(quiz.submittedAt, quiz.reviews);
  const preguntas = tema.questions as PreguntaQuiz[];
  const avance = avanceQuiz(preguntas, quiz.answers);
  const ultima = ultimaRevision(quiz.reviews);

  const seVe = verLaCalificacion(estado);
  const calificaciones: Record<string, Calificacion> = {};
  if (seVe) {
    const porPregunta = new Map(quiz.answers.map((r) => [r.questionId, r]));
    for (const p of preguntas) {
      calificaciones[p.id] = calificar(p, porPregunta.get(p.id));
    }
  }

  return {
    ok: true,
    datos: {
      quizId: quiz.id,
      tema: {
        id: tema.id,
        number: tema.number,
        name: tema.name,
        subtitle: tema.subtitle,
        leaderNote: tema.leaderNote,
      },
      // ⚠️ Sin la calificación a la vista, la respuesta correcta y su
      // explicación **se borran antes de salir del servidor**.
      preguntas: seVe
        ? preguntas
        : preguntas.map((p) => ({ ...p, correctChoice: null, explanation: null })),
      respuestas: quiz.answers,
      estado,
      notaDelCoordinador: estado === "DEVUELTO" ? (ultima?.note ?? null) : null,
      vecesDevuelto: quiz.reviews.filter((r) => !r.approved).length,
      avance,
      puedeEnviar: puedeEnviarseQuiz(preguntas, quiz.answers, estado),
      calificaciones,
      resultado: seVe ? resultadoDeOpcion(preguntas, quiz.answers) : null,
    },
  };
}

export async function guardarRespuestaQuiz(
  quizId: string,
  learnerId: string,
  questionId: string,
  valor: { text?: string; choice?: number },
): Promise<ResultadoQuiz> {
  const prisma = await getPrisma();

  const quiz = await prisma.leaderQuiz.findUnique({
    where: { id: quizId },
    select: {
      learnerId: true,
      topicId: true,
      submittedAt: true,
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
    },
  });
  // El cuestionario es de quien lo abrió. El id viaja por el navegador, así
  // que se comprueba en el servidor: sin esto, cambiar un id escribiría en el
  // examen de otro líder.
  if (!quiz || quiz.learnerId !== learnerId) {
    return { ok: false, mensaje: "Ese cuestionario no es tuyo." };
  }

  const estado = estadoDelQuiz(quiz.submittedAt, quiz.reviews);
  if (estado === "ENVIADO" || estado === "APROBADO") {
    return {
      ok: false,
      mensaje:
        estado === "APROBADO"
          ? "Este tema ya quedó aprobado: no se puede cambiar."
          : "Ya lo enviaste. Espera a que tu coordinador lo revise.",
    };
  }

  const pregunta = await prisma.leaderQuizQuestion.findUnique({
    where: { id: questionId },
    select: { topicId: true, kind: true, options: true },
  });
  if (!pregunta || pregunta.topicId !== quiz.topicId) {
    return { ok: false, mensaje: "Esa pregunta no es de este tema." };
  }

  // ⚠️ Se valida en el SERVIDOR aunque la pantalla solo ofrezca las cuatro
  // opciones: un radio es una sugerencia del navegador, no una garantía.
  let datos: { text: string | null; choice: number | null };
  if (pregunta.kind === "OPCION") {
    const i = valor.choice;
    if (i === undefined || !Number.isInteger(i) || i < 0 || i >= pregunta.options.length) {
      return { ok: false, mensaje: "Esa opción no existe." };
    }
    datos = { text: null, choice: i };
  } else {
    datos = { text: (valor.text ?? "").trim() || null, choice: null };
  }

  await prisma.leaderQuizAnswer.upsert({
    where: { quizId_questionId: { quizId, questionId } },
    create: { quizId, questionId, ...datos },
    update: datos,
  });

  return { ok: true };
}

export async function enviarCuestionario(
  quizId: string,
  learnerId: string,
): Promise<ResultadoQuiz> {
  const prisma = await getPrisma();

  const quiz = await prisma.leaderQuiz.findUnique({
    where: { id: quizId },
    select: {
      learnerId: true,
      submittedAt: true,
      answers: { select: { questionId: true, text: true, choice: true } },
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
      topic: { select: { id: true, number: true, name: true, questions: SELECT_PREGUNTAS } },
    },
  });
  if (!quiz || quiz.learnerId !== learnerId) {
    return { ok: false, mensaje: "Ese cuestionario no es tuyo." };
  }

  const preguntas = quiz.topic.questions as PreguntaQuiz[];
  const estado = estadoDelQuiz(quiz.submittedAt, quiz.reviews);
  if (!puedeEnviarseQuiz(preguntas, quiz.answers, estado)) {
    return {
      ok: false,
      mensaje:
        estado === "APROBADO"
          ? "Este tema ya quedó aprobado."
          : estado === "ENVIADO"
            ? "Ya lo enviaste. Espera a que tu coordinador lo revise."
            : "Te faltan preguntas por responder.",
    };
  }

  await prisma.leaderQuiz.update({
    where: { id: quizId },
    data: { submittedAt: new Date() },
  });

  // ⚠️ **Sin actor a propósito**: no lo envió nadie del equipo, lo envió el
  // líder desde su celular (la regla del taller, 27-sep-2026).
  await auditar(prisma, {
    actorId: null,
    action: "cuestionario.enviado",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: { tema: quiz.topic.number, temaNombre: quiz.topic.name, quizId },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// «Mi cuestionario»: los 12 temas de un líder
// ---------------------------------------------------------------------------

export type MiTemaQuiz = {
  topicId: string;
  code: string;
  number: number;
  name: string;
  subtitle: string | null;
  estado: EstadoTemaQuiz;
  notaDelCoordinador: string | null;
  aprobadoEl: Date | null;
  quienAprobo: string | null;
  vecesDevuelto: number;
  /// Cuántas preguntas tiene. Cero = todavía no está el material.
  preguntas: number;
};

export type MiCuestionario = {
  /// Su código de miembro, para que lo tenga a la vista si entra desde otro
  /// teléfono. Es el MISMO de Casa de Fe: un solo código para todo (2-oct).
  codigo: string;
  temas: MiTemaQuiz[];
  aprobados: number;
  total: number;
  porCorregir: MiTemaQuiz[];
  resto: MiTemaQuiz[];
};

export async function cargarMiCuestionario(
  learnerId: string,
): Promise<MiCuestionario> {
  const prisma = await getPrisma();

  // ⚠️ **UN solo `$transaction` con las dos consultas**: con `PrismaPg max:1`
  // dos sueltas serían dos latencias en fila (la decisión de `NodoDeRed`,
  // 23-sep-2026).
  const [aprendiz, temas, quizzes] = await prisma.$transaction([
    prisma.learnerProfile.findUnique({
      where: { id: learnerId },
      select: { personId: true },
    }),
    prisma.leaderQuizTopic.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        code: true,
        number: true,
        name: true,
        subtitle: true,
        _count: { select: { questions: true } },
      },
    }),
    prisma.leaderQuiz.findMany({
      where: { learnerId },
      select: {
        topicId: true,
        submittedAt: true,
        _count: { select: { answers: true } },
        reviews: {
          orderBy: { reviewedAt: "desc" },
          select: {
            approved: true,
            reviewedAt: true,
            note: true,
            reviewedBy: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  const porTema = new Map(quizzes.map((q) => [q.topicId, q]));

  const lista: MiTemaQuiz[] = temas.map((t) => {
    const quiz = porTema.get(t.id) ?? null;
    const estado = estadoDelTemaQuiz({
      quiz: quiz
        ? {
            submittedAt: quiz.submittedAt,
            revisiones: quiz.reviews,
            // Las respuestas en blanco no se guardan, así que contar las filas
            // es contar lo que de verdad escribió.
            respondidas: quiz._count.answers,
          }
        : null,
    });
    const ultima = quiz ? ultimaRevision(quiz.reviews) : null;
    return {
      topicId: t.id,
      code: t.code,
      number: t.number,
      name: t.name,
      subtitle: t.subtitle,
      estado,
      notaDelCoordinador: estado === "DEVUELTO" ? (ultima?.note ?? null) : null,
      aprobadoEl: estado === "APROBADO" ? (ultima?.reviewedAt ?? null) : null,
      quienAprobo: estado === "APROBADO" ? (ultima?.reviewedBy?.fullName ?? null) : null,
      vecesDevuelto: quiz ? quiz.reviews.filter((r) => !r.approved).length : 0,
      preguntas: t._count.questions,
    };
  });

  return {
    // `codigoDeMiembro` lo crea si faltara: la pantalla no puede enseñar un
    // hueco donde va lo único que le sirve para volver a entrar.
    codigo: aprendiz ? await codigoDeMiembro(aprendiz.personId) : "",
    temas: lista,
    aprobados: temasAprobadosQuiz(lista.map((t) => t.estado)),
    total: lista.length,
    porCorregir: lista.filter((t) => pideAtencionQuiz(t.estado)),
    resto: lista.filter((t) => !pideAtencionQuiz(t.estado)),
  };
}

// ---------------------------------------------------------------------------
// El panel del coordinador
// ---------------------------------------------------------------------------

export type QuizEnLaCola = {
  quizId: string;
  learnerId: string;
  nombre: string;
  tema: number;
  temaNombre: string;
  enviadoEl: Date;
  /// Qué tan bien le fue en las de opción. **El coordinador SÍ lo ve siempre**
  /// —es su trabajo— al contrario que el líder, que solo lo ve al quedar
  /// aprobado.
  aciertos: number;
  calificables: number;
  /// Cuántas abiertas hay que leer. Es lo que de verdad cuesta tiempo, así que
  /// se dice antes de entrar.
  abiertas: number;
  /// Si es un reenvío. Un líder al que ya le devolvieron este tema merece
  /// mirarse con más calma.
  vuelta: number;
};

export type LiderEnElPanel = {
  learnerId: string;
  nombre: string;
  aprobados: number;
  esperando: number;
  devueltos: number;
  empezados: number;
  /// ⚠️ Si está inscrito en la Escuela Ser Líder abierta. **Se enseña porque
  /// el cuestionario NO exige estar inscrito** (ver `abrirCuestionario`), así
  /// que puede haber quien lo esté llenando sin estar en la escuela — y el
  /// coordinador tiene que poder verlo para inscribirlo o para preguntarle.
  inscrito: boolean;
  dominaElLibro: boolean;
};

export type AvanceDelTema = {
  topicId: string;
  number: number;
  name: string;
  preguntas: number;
  aprobados: number;
  esperando: number;
  devueltos: number;
  empezados: number;
};

export type PanelDelCuestionario = {
  /// ⚠️ **Va ARRIBA DEL TODO en la pantalla.** Es lo único que le pide algo al
  /// coordinador ahora mismo: un líder que envió su cuestionario y espera que
  /// alguien lo revise no puede dictar el tema hasta que eso pase, y si el
  /// bloque quedara mezclado en la lista se queda esperando una revisión que
  /// nadie recuerda hacer (la regla del prematrimonial, 3-oct-2026).
  esperando: QuizEnLaCola[];
  lideres: LiderEnElPanel[];
  temas: AvanceDelTema[];
  /// La escuela abierta, para decir de qué promoción se está hablando.
  escuela: { id: string; name: string } | null;
  totalDeTemas: number;
  /// Cuántas preguntas tienen material. Si algún tema llegara sin preguntas, la
  /// pantalla lo dice en vez de enseñar un cero que parece un error.
  temasSinMaterial: number;
};

/// Todo el panel en **UN solo `$transaction`**: cuatro consultas sueltas serían
/// cuatro latencias en fila con `PrismaPg max:1`.
export async function cargarPanelDelCuestionario(): Promise<PanelDelCuestionario> {
  const prisma = await getPrisma();

  const [temas, quizzes, escuela, inscritos] = await prisma.$transaction([
    prisma.leaderQuizTopic.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        name: true,
        _count: { select: { questions: true } },
        questions: SELECT_PREGUNTAS,
      },
    }),
    prisma.leaderQuiz.findMany({
      orderBy: { submittedAt: "asc" },
      select: {
        id: true,
        learnerId: true,
        topicId: true,
        submittedAt: true,
        answers: { select: { questionId: true, text: true, choice: true } },
        reviews: {
          orderBy: { reviewedAt: "desc" },
          select: { approved: true, reviewedAt: true },
        },
        learner: {
          select: { person: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
    prisma.trainingProgram.findFirst({
      where: { closedAt: null },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true },
    }),
    prisma.trainingEnrollment.findMany({
      where: { program: { closedAt: null } },
      select: {
        learnerId: true,
        learner: {
          select: { person: { select: { firstName: true, lastName: true } } },
        },
      },
    }),
  ]);

  const preguntasPorTema = new Map(
    temas.map((t) => [t.id, t.questions as PreguntaQuiz[]]),
  );
  const nombreDelTema = new Map(temas.map((t) => [t.id, t]));

  // El estado de cada cuestionario, una sola vez.
  const conEstado = quizzes.map((q) => ({
    ...q,
    estado: estadoDelQuiz(q.submittedAt, q.reviews),
    nombre: nombreDePersona(q.learner.person),
  }));

  const esperando: QuizEnLaCola[] = conEstado
    .filter((q) => q.estado === "ENVIADO")
    .map((q) => {
      const preguntas = preguntasPorTema.get(q.topicId) ?? [];
      const r = resultadoDeOpcion(preguntas, q.answers);
      const t = nombreDelTema.get(q.topicId);
      return {
        quizId: q.id,
        learnerId: q.learnerId,
        nombre: q.nombre,
        tema: t?.number ?? 0,
        temaNombre: t?.name ?? "",
        enviadoEl: q.submittedAt as Date,
        aciertos: r.aciertos,
        calificables: r.calificables,
        abiertas: preguntas.length - cuantasSeCalifican(preguntas),
        // La vuelta en la que va: la primera vez es 1.
        vuelta: q.reviews.filter((x) => !x.approved).length + 1,
      };
    });

  // ⚠️ **La lista son los inscritos MÁS cualquiera que haya respondido**, y la
  // unión importa en los dos sentidos: un inscrito que no ha empezado tiene
  // que aparecer (es a quien hay que recordarle), y quien respondió sin estar
  // inscrito también (si no, estaría llenando el cuestionario y el coordinador
  // no lo vería en ninguna parte).
  const porLider = new Map<string, LiderEnElPanel>();
  const asegurar = (learnerId: string, nombre: string, inscrito: boolean) => {
    const ya = porLider.get(learnerId);
    if (ya) {
      if (inscrito) ya.inscrito = true;
      return ya;
    }
    const nuevo: LiderEnElPanel = {
      learnerId,
      nombre,
      aprobados: 0,
      esperando: 0,
      devueltos: 0,
      empezados: 0,
      inscrito,
      dominaElLibro: false,
    };
    porLider.set(learnerId, nuevo);
    return nuevo;
  };

  for (const i of inscritos) {
    asegurar(i.learnerId, nombreDePersona(i.learner.person), true);
  }

  for (const q of conEstado) {
    const l = asegurar(q.learnerId, q.nombre, false);
    if (q.estado === "APROBADO") l.aprobados += 1;
    else if (q.estado === "ENVIADO") l.esperando += 1;
    else if (q.estado === "DEVUELTO") l.devueltos += 1;
    else if (q.answers.length > 0) l.empezados += 1;
  }
  for (const l of porLider.values()) l.dominaElLibro = dominaLosDoce(l.aprobados);

  const porTema = new Map(
    temas.map((t) => [
      t.id,
      {
        topicId: t.id,
        number: t.number,
        name: t.name,
        preguntas: t._count.questions,
        aprobados: 0,
        esperando: 0,
        devueltos: 0,
        empezados: 0,
      } satisfies AvanceDelTema,
    ]),
  );
  for (const q of conEstado) {
    const t = porTema.get(q.topicId);
    if (!t) continue;
    if (q.estado === "APROBADO") t.aprobados += 1;
    else if (q.estado === "ENVIADO") t.esperando += 1;
    else if (q.estado === "DEVUELTO") t.devueltos += 1;
    else if (q.answers.length > 0) t.empezados += 1;
  }

  return {
    esperando,
    // Primero quien tiene algo esperando, luego quien va más adelantado, y a
    // igualdad por nombre: el coordinador abre esta pantalla para revisar.
    lideres: [...porLider.values()].sort(
      (a, b) =>
        b.esperando - a.esperando ||
        b.aprobados - a.aprobados ||
        a.nombre.localeCompare(b.nombre, "es"),
    ),
    temas: [...porTema.values()],
    escuela,
    totalDeTemas: temas.length,
    temasSinMaterial: temas.filter((t) => t._count.questions === 0).length,
  };
}

function nombreDePersona(persona: { firstName: string; lastName: string | null }) {
  return `${persona.firstName} ${persona.lastName ?? ""}`.trim();
}

/// El distintivo de la pestaña: cuántos cuestionarios esperan revisión.
///
/// ⚠️ **Solo se consulta si la cuenta puede revisar** (lo decide quien llama):
/// a los demás no se les pinta la pestaña, así que sería una latencia para
/// nada (la decisión del prematrimonial, 3-oct-2026).
export async function pendientesDelCuestionario(): Promise<number> {
  const prisma = await getPrisma();

  // Se traen solo los enviados —unas pocas decenas como mucho— y se filtra en
  // memoria, porque «esperando» no es una columna: se deriva de comparar el
  // envío con la última revisión.
  const enviados = await prisma.leaderQuiz.findMany({
    where: { submittedAt: { not: null } },
    select: {
      submittedAt: true,
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
    },
  });

  return enviados.filter((q) => estadoDelQuiz(q.submittedAt, q.reviews) === "ENVIADO")
    .length;
}

// ---------------------------------------------------------------------------
// Revisar un cuestionario
// ---------------------------------------------------------------------------

export type RenglonRevisado = {
  questionId: string;
  number: number;
  kind: string;
  prompt: string;
  options: string[];
  /// Lo que escribió, en las abiertas.
  texto: string | null;
  /// Lo que marcó, en las de opción.
  marcada: number | null;
  correcta: number | null;
  explicacion: string | null;
  calificacion: Calificacion;
};

export type RevisionDelQuiz = {
  quizId: string;
  learnerId: string;
  nombre: string;
  inscrito: boolean;
  tema: TemaDelQuiz;
  estado: EstadoQuiz;
  enviadoEl: Date | null;
  renglones: RenglonRevisado[];
  resultado: ReturnType<typeof resultadoDeOpcion>;
  /// Cuántas abiertas tiene que juzgar a mano. La pantalla lo dice en el
  /// encabezado: el sistema no las califica y eso no se disimula.
  abiertas: number;
  /// ⚠️ **El historial completo, porque las revisiones SE APILAN.** Es lo que
  /// le dice al coordinador que a este líder ya le devolvió este mismo tema
  /// —una vez, o tres— y que quizá el problema no es el cuestionario.
  historial: {
    approved: boolean;
    note: string | null;
    reviewedAt: Date;
    quien: string | null;
  }[];
  vuelta: number;
};

export async function cargarRevisionDelQuiz(
  quizId: string,
): Promise<RevisionDelQuiz | null> {
  const prisma = await getPrisma();

  const quiz = await prisma.leaderQuiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      learnerId: true,
      submittedAt: true,
      answers: { select: { questionId: true, text: true, choice: true } },
      reviews: {
        orderBy: { reviewedAt: "desc" },
        select: {
          approved: true,
          note: true,
          reviewedAt: true,
          reviewedBy: { select: { fullName: true } },
        },
      },
      topic: {
        select: {
          id: true,
          number: true,
          name: true,
          subtitle: true,
          leaderNote: true,
          questions: SELECT_PREGUNTAS,
        },
      },
      learner: {
        select: {
          person: { select: { firstName: true, lastName: true } },
          trainingEnrollments: {
            where: { program: { closedAt: null } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!quiz) return null;

  const preguntas = quiz.topic.questions as PreguntaQuiz[];
  const porPregunta = new Map(quiz.answers.map((r) => [r.questionId, r]));

  const renglones: RenglonRevisado[] = preguntas.map((p) => {
    const r = porPregunta.get(p.id);
    return {
      questionId: p.id,
      number: p.number,
      kind: p.kind,
      prompt: p.prompt,
      options: p.options,
      texto: r?.text ?? null,
      marcada: r?.choice ?? null,
      correcta: p.correctChoice,
      explicacion: p.explanation,
      calificacion: calificar(p, r),
    };
  });

  return {
    quizId: quiz.id,
    learnerId: quiz.learnerId,
    nombre: nombreDePersona(quiz.learner.person),
    inscrito: quiz.learner.trainingEnrollments.length > 0,
    tema: {
      id: quiz.topic.id,
      number: quiz.topic.number,
      name: quiz.topic.name,
      subtitle: quiz.topic.subtitle,
      leaderNote: quiz.topic.leaderNote,
    },
    estado: estadoDelQuiz(quiz.submittedAt, quiz.reviews),
    enviadoEl: quiz.submittedAt,
    renglones,
    resultado: resultadoDeOpcion(preguntas, quiz.answers),
    abiertas: preguntas.length - cuantasSeCalifican(preguntas),
    historial: quiz.reviews.map((r) => ({
      approved: r.approved,
      note: r.note,
      reviewedAt: r.reviewedAt,
      quien: r.reviewedBy?.fullName ?? null,
    })),
    vuelta: quiz.reviews.filter((r) => !r.approved).length + 1,
  };
}

/// Aprobar o devolver el cuestionario de un tema.
///
/// ⚠️ **La revisión se APILA, no se pisa** (decisión del usuario: «se apila,
/// queda cada vuelta»). Sobrescribir la anterior borraría cuántas veces le
/// devolvieron este tema a este líder, que es justo la señal de que todavía no
/// está listo para dictarlo.
export async function revisarCuestionario(
  quizId: string,
  aprobado: boolean,
  nota: string,
  usuario: UsuarioSesion,
): Promise<ResultadoQuiz> {
  if (!puedeRevisarCuestionario(usuario)) {
    return { ok: false, mensaje: "No tienes permiso para revisar cuestionarios." };
  }

  const limpia = nota.trim();
  // ⚠️ La nota es **obligatoria al devolver** y opcional al aprobar: devolver
  // sin decir por qué deja al líder sin saber qué repasar.
  if (!aprobado && limpia.length < LARGO_MINIMO_NOTA_QUIZ) {
    return {
      ok: false,
      mensaje: `Escribe qué tiene que repasar (al menos ${LARGO_MINIMO_NOTA_QUIZ} caracteres).`,
    };
  }

  const prisma = await getPrisma();

  const quiz = await prisma.leaderQuiz.findUnique({
    where: { id: quizId },
    select: {
      learnerId: true,
      submittedAt: true,
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
      topic: { select: { number: true, name: true } },
    },
  });
  if (!quiz) return { ok: false, mensaje: "Ese cuestionario no existe." };

  const estado = estadoDelQuiz(quiz.submittedAt, quiz.reviews);
  // Solo se revisa lo que está esperando. Sin esto se podría «devolver» un
  // tema que el líder todavía está llenando, o revisar dos veces el mismo
  // envío desde dos pestañas abiertas.
  if (estado !== "ENVIADO") {
    return {
      ok: false,
      mensaje:
        estado === "BORRADOR"
          ? "Este líder todavía no ha enviado este tema."
          : estado === "APROBADO"
            ? "Este tema ya está aprobado."
            : "Este tema ya fue devuelto. Espera a que lo vuelva a enviar.",
    };
  }

  // Cuántos llevaba aprobados antes, para saber si este es el que cierra los
  // doce. Se cuenta aquí y no después para no depender del orden de escritura.
  const aprobadosAntes = aprobado ? await contarAprobados(quiz.learnerId) : 0;

  await prisma.$transaction(async (tx) => {
    await tx.leaderQuizReview.create({
      data: {
        quizId,
        approved: aprobado,
        note: limpia || null,
        reviewedById: usuario.id,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: aprobado ? "cuestionario.aprobado" : "cuestionario.devuelto",
      entityType: "learner_profile",
      entityId: quiz.learnerId,
      metadata: {
        tema: quiz.topic.number,
        temaNombre: quiz.topic.name,
        quizId,
        vuelta: quiz.reviews.filter((r) => !r.approved).length + 1,
      },
    });

    if (aprobado && dominaLosDoce(aprobadosAntes + 1)) {
      // ⚠️ **No se marca ningún hito, y es a propósito.** No existe un hito
      // para «domina el libro» y crear un valor nuevo del enum obligaría a un
      // ALTER TYPE; además, dominar el cuestionario **no es un paso del
      // recorrido del discípulo** —es una habilitación para enseñar—, así que
      // no tiene sitio en la línea de tiempo de su expediente. Queda en la
      // bitácora, que es donde el liderazgo lo consulta.
      await auditar(tx, {
        actorId: usuario.id,
        action: "cuestionario.libro_dominado",
        entityType: "learner_profile",
        entityId: quiz.learnerId,
        metadata: { temas: aprobadosAntes + 1 },
      });
    }
  });

  return { ok: true };
}

async function contarAprobados(learnerId: string): Promise<number> {
  const prisma = await getPrisma();
  const quizzes = await prisma.leaderQuiz.findMany({
    where: { learnerId },
    select: {
      submittedAt: true,
      reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
    },
  });
  return quizzes.filter((q) => estadoDelQuiz(q.submittedAt, q.reviews) === "APROBADO")
    .length;
}

// ---------------------------------------------------------------------------
// El renglón del cuestionario dentro de «Mis talleres»
// ---------------------------------------------------------------------------

export type ResumenDelCuestionario = {
  aprobados: number;
  total: number;
  porCorregir: number;
  esperando: number;
};

/// Lo que se enseña en «Mis talleres» para que quien ya tiene el enlace de
/// Casa de Fe encuentre también su cuestionario (la decisión del 2-oct-2026:
/// un solo enlace para todo).
///
/// ⚠️ **Devuelve `null` a quien no es de la Escuela Ser Líder**, y es lo que
/// evita ensuciarle la pantalla a los miembros de las casas: Ser Líder es el
/// discipulado de quienes YA SIRVEN en un ministerio, no es para todos. Se
/// considera que le toca si está inscrito en la escuela abierta **o** si ya
/// empezó algún tema (porque entonces alguien le dio el QR).
export async function resumenDelCuestionario(
  learnerId: string,
): Promise<ResumenDelCuestionario | null> {
  const prisma = await getPrisma();

  const [inscrito, temas, quizzes] = await prisma.$transaction([
    prisma.trainingEnrollment.count({
      where: { learnerId, program: { closedAt: null } },
    }),
    prisma.leaderQuizTopic.count(),
    prisma.leaderQuiz.findMany({
      where: { learnerId },
      select: {
        submittedAt: true,
        reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
      },
    }),
  ]);

  if (inscrito === 0 && quizzes.length === 0) return null;

  const estados = quizzes.map((q) => estadoDelQuiz(q.submittedAt, q.reviews));
  return {
    aprobados: estados.filter((e) => e === "APROBADO").length,
    total: temas,
    porCorregir: estados.filter((e) => e === "DEVUELTO").length,
    esperando: estados.filter((e) => e === "ENVIADO").length,
  };
}
