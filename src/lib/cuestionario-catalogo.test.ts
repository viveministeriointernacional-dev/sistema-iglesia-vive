import assert from "node:assert/strict";
import { test } from "node:test";

import {
  avanceQuiz,
  calificar,
  cuantasSeCalifican,
  dominaLosDoce,
  estadoDelQuiz,
  estadoDelTemaQuiz,
  LARGO_MINIMO_RESPUESTA_QUIZ,
  pideAtencionQuiz,
  puedeEnviarseQuiz,
  respondidaQuiz,
  resultadoDeOpcion,
  temasAprobadosQuiz,
  verLaCalificacion,
  type PreguntaQuiz,
  type RespuestaQuiz,
} from "./cuestionario-catalogo";

/// Las dos de opción reales del tema 3 del documento, con su respuesta
/// marcada: la 4 («¿Cuál NO es uno de los cinco roles…», correcta
/// «Espectador») y la 5 («La intimidad… se compara con la postura de»,
/// correcta «Juan recostado en el pecho de Jesús»).
const ABIERTA: PreguntaQuiz = {
  id: "a",
  number: 1,
  kind: "ABIERTA",
  prompt: "Explica con tus palabras la diferencia entre comunión e intimidad.",
  options: [],
  correctChoice: null,
  explanation: null,
};

const ROLES: PreguntaQuiz = {
  id: "r",
  number: 4,
  kind: "OPCION",
  prompt: "¿Cuál de estos NO es uno de los cinco roles de Dios?",
  options: ["Padre", "Rey", "Juez", "Espectador"],
  correctChoice: 3,
  explanation: "El capítulo enumera Padre, Rey, Proveedor, Protector y Juez.",
};

const INTIMIDAD: PreguntaQuiz = {
  id: "i",
  number: 5,
  kind: "OPCION",
  prompt: "La intimidad con Dios se compara con la postura de:",
  options: [
    "Moisés ante la zarza ardiente",
    "Juan recostado en el pecho de Jesús",
    "Los fariseos orando en la plaza",
    "Jonás huyendo a Tarsis",
  ],
  correctChoice: 1,
  explanation: "Juan 13:23 ilustra la cercanía, confianza y vulnerabilidad.",
};

const TEMA_3 = [ABIERTA, ROLES, INTIMIDAD];

function texto(id: string, t: string): RespuestaQuiz {
  return { questionId: id, text: t, choice: null };
}
function marca(id: string, i: number): RespuestaQuiz {
  return { questionId: id, text: null, choice: i };
}

// ---------------------------------------------------------------------------
// Responder
// ---------------------------------------------------------------------------

test("una abierta necesita más que una frase suelta", () => {
  assert.equal(respondidaQuiz(ABIERTA, undefined), false);
  assert.equal(respondidaQuiz(ABIERTA, texto("a", "no sé")), false);
  // Justo por debajo y justo encima del mínimo.
  assert.equal(respondidaQuiz(ABIERTA, texto("a", "x".repeat(LARGO_MINIMO_RESPUESTA_QUIZ - 1))), false);
  assert.equal(respondidaQuiz(ABIERTA, texto("a", "x".repeat(LARGO_MINIMO_RESPUESTA_QUIZ))), true);
});

test("los espacios no cuentan como respuesta", () => {
  assert.equal(respondidaQuiz(ABIERTA, texto("a", " ".repeat(40))), false);
});

test("una de opción se responde marcando, y solo dentro del rango", () => {
  assert.equal(respondidaQuiz(ROLES, marca("r", 0)), true);
  assert.equal(respondidaQuiz(ROLES, marca("r", 3)), true);
  assert.equal(respondidaQuiz(ROLES, marca("r", 4)), false);
  assert.equal(respondidaQuiz(ROLES, marca("r", -1)), false);
  assert.equal(respondidaQuiz(ROLES, texto("r", "la cuarta, el espectador")), false);
});

test("el avance cuenta las respondidas de los dos tipos", () => {
  const a = avanceQuiz(TEMA_3, [texto("a", "x".repeat(30)), marca("r", 3)]);
  assert.deepEqual(a, { respondidas: 2, total: 3, faltan: 1, completo: false });

  const b = avanceQuiz(TEMA_3, [texto("a", "x".repeat(30)), marca("r", 3), marca("i", 0)]);
  assert.equal(b.completo, true);
});

test("no se puede enviar a medias, ni dos veces, ni ya aprobado", () => {
  const medias = [texto("a", "x".repeat(30))];
  const todas = [texto("a", "x".repeat(30)), marca("r", 3), marca("i", 1)];

  assert.equal(puedeEnviarseQuiz(TEMA_3, medias, "BORRADOR"), false);
  assert.equal(puedeEnviarseQuiz(TEMA_3, todas, "BORRADOR"), true);
  // Devuelto SÍ se puede volver a enviar: es justamente lo que se le pide.
  assert.equal(puedeEnviarseQuiz(TEMA_3, todas, "DEVUELTO"), true);
  assert.equal(puedeEnviarseQuiz(TEMA_3, todas, "ENVIADO"), false);
  assert.equal(puedeEnviarseQuiz(TEMA_3, todas, "APROBADO"), false);
});

// ---------------------------------------------------------------------------
// Calificar
// ---------------------------------------------------------------------------

test("el sistema NO califica las abiertas, ni aunque estén respondidas", () => {
  assert.equal(calificar(ABIERTA, texto("a", "x".repeat(50))), "NO_SE_CALIFICA");
  assert.equal(calificar(ABIERTA, undefined), "NO_SE_CALIFICA");
});

test("una de opción sin respuesta correcta guardada tampoco se califica", () => {
  // Red de seguridad: si algún día entra una de opción sin su marca, se
  // calla en vez de inventarse que la persona falló.
  const huerfana: PreguntaQuiz = { ...ROLES, correctChoice: null };
  assert.equal(calificar(huerfana, marca("r", 0)), "NO_SE_CALIFICA");
});

test("acierto, fallo y sin responder", () => {
  assert.equal(calificar(ROLES, marca("r", 3)), "ACERTO");
  assert.equal(calificar(ROLES, marca("r", 0)), "FALLO");
  assert.equal(calificar(ROLES, undefined), "SIN_RESPONDER");
  assert.equal(calificar(ROLES, texto("r", "espectador")), "SIN_RESPONDER");
});

test("el denominador son solo las calificables, nunca el total de preguntas", () => {
  // El caso real del mockup: acertó la de los roles y falló la de intimidad.
  const r = resultadoDeOpcion(TEMA_3, [
    texto("a", "x".repeat(40)),
    marca("r", 3),
    marca("i", 0),
  ]);
  assert.deepEqual(r, { aciertos: 1, fallos: 1, calificables: 2 });
  // Son 3 preguntas pero solo 2 se califican: la abierta no entra ni como
  // acierto ni como fallo ni en el denominador.
  assert.equal(r.aciertos + r.fallos, r.calificables);
  assert.equal(cuantasSeCalifican(TEMA_3), 2);
});

test("una de opción sin marcar no cuenta como fallo, pero sí como calificable", () => {
  const r = resultadoDeOpcion(TEMA_3, [marca("r", 3)]);
  assert.deepEqual(r, { aciertos: 1, fallos: 0, calificables: 2 });
});

// ---------------------------------------------------------------------------
// ⚠️ La regla que sostiene que esto mida algo
// ---------------------------------------------------------------------------

test("la calificación SOLO se le enseña al líder cuando está aprobado", () => {
  assert.equal(verLaCalificacion("APROBADO"), true);
  // Al enviar no, porque podría reenviar con la respuesta copiada.
  assert.equal(verLaCalificacion("ENVIADO"), false);
  // Al devolverlo tampoco, por lo mismo: corregir sería copiar.
  assert.equal(verLaCalificacion("DEVUELTO"), false);
  assert.equal(verLaCalificacion("BORRADOR"), false);
});

// ---------------------------------------------------------------------------
// El estado derivado
// ---------------------------------------------------------------------------

test("sin enviar es borrador, y enviado sin revisar es enviado", () => {
  assert.equal(estadoDelQuiz(null, []), "BORRADOR");
  assert.equal(estadoDelQuiz(new Date("2026-10-05T10:00:00Z"), []), "ENVIADO");
});

test("un reenvío posterior a la devolución vuelve a la cola, no se queda en DEVUELTO", () => {
  const devuelto = { approved: false, reviewedAt: new Date("2026-10-02T10:00:00Z") };
  // Reenviado DESPUÉS de que lo devolvieran.
  assert.equal(estadoDelQuiz(new Date("2026-10-04T10:00:00Z"), [devuelto]), "ENVIADO");
  // Enviado ANTES de la revisión: sigue devuelto.
  assert.equal(estadoDelQuiz(new Date("2026-10-01T10:00:00Z"), [devuelto]), "DEVUELTO");
});

test("manda la revisión más reciente, no la primera que llegue en la lista", () => {
  const revisiones = [
    { approved: true, reviewedAt: new Date("2026-10-03T10:00:00Z") },
    { approved: false, reviewedAt: new Date("2026-10-01T10:00:00Z") },
  ];
  assert.equal(estadoDelQuiz(new Date("2026-09-30T10:00:00Z"), revisiones), "APROBADO");
});

// ---------------------------------------------------------------------------
// Los 12 temas de una persona
// ---------------------------------------------------------------------------

test("abrir un tema para mirarlo no es haberlo empezado", () => {
  assert.equal(estadoDelTemaQuiz({ quiz: null }), "SIN_EMPEZAR");
  assert.equal(
    estadoDelTemaQuiz({ quiz: { submittedAt: null, revisiones: [], respondidas: 0 } }),
    "SIN_EMPEZAR",
  );
  assert.equal(
    estadoDelTemaQuiz({ quiz: { submittedAt: null, revisiones: [], respondidas: 1 } }),
    "EMPEZADO",
  );
});

test("el estado del renglón sigue al del cuestionario", () => {
  const enviado = new Date("2026-10-04T10:00:00Z");
  assert.equal(
    estadoDelTemaQuiz({ quiz: { submittedAt: enviado, revisiones: [], respondidas: 5 } }),
    "ESPERANDO",
  );
  assert.equal(
    estadoDelTemaQuiz({
      quiz: {
        submittedAt: enviado,
        revisiones: [{ approved: true, reviewedAt: new Date("2026-10-05T10:00:00Z") }],
        respondidas: 5,
      },
    }),
    "APROBADO",
  );
  assert.equal(
    estadoDelTemaQuiz({
      quiz: {
        submittedAt: enviado,
        revisiones: [{ approved: false, reviewedAt: new Date("2026-10-05T10:00:00Z") }],
        respondidas: 5,
      },
    }),
    "DEVUELTO",
  );
});

test("el contador cuenta lo aprobado, no lo enviado", () => {
  assert.equal(
    temasAprobadosQuiz(["APROBADO", "ESPERANDO", "APROBADO", "DEVUELTO", "SIN_EMPEZAR"]),
    2,
  );
  assert.equal(temasAprobadosQuiz([]), 0);
});

test("solo lo devuelto sube al bloque de arriba", () => {
  assert.equal(pideAtencionQuiz("DEVUELTO"), true);
  assert.equal(pideAtencionQuiz("ESPERANDO"), false);
  assert.equal(pideAtencionQuiz("APROBADO"), false);
  assert.equal(pideAtencionQuiz("EMPEZADO"), false);
  assert.equal(pideAtencionQuiz("SIN_EMPEZAR"), false);
});

test("domina el libro con los 12, no con 11", () => {
  assert.equal(dominaLosDoce(11), false);
  assert.equal(dominaLosDoce(12), true);
  assert.equal(dominaLosDoce(13), true);
});
