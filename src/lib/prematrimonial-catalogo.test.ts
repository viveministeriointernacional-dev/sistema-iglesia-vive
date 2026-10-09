import assert from "node:assert/strict";
import { test } from "node:test";

import {
  avancePre,
  compararRespuestas,
  cuantasComparables,
  esOrdenCompleto,
  estadoTallerPre,
  estadoTemaPareja,
  listoParaDestapar,
  puestoPorOpcion,
  casillasEscritas,
  preguntasQueFaltan,
  respondidaPre,
  sePuedeComparar,
  terminoElPrematrimonial,
  type PreguntaPre,
  type RespuestaPre,
} from "./prematrimonial-catalogo";

const abierta = (id: string, n = 1): PreguntaPre => ({
  id,
  number: n,
  kind: "ABIERTA",
  prompt: "¿Qué es el matrimonio para usted?",
  options: [],
  fields: [],
});

const siNo = (id: string, n = 19): PreguntaPre => ({
  id,
  number: n,
  kind: "SI_NO",
  prompt: "Encuentra un versículo que diga que el matrimonio es para ser feliz.",
  options: ["Sí", "No"],
  fields: [],
});

/// La 14 del taller 1, con sus ocho opciones reales.
const multiple = (id: string, n = 14): PreguntaPre => ({
  id,
  number: n,
  kind: "MULTIPLE",
  prompt: "Marque las respuestas que considere correctas",
  options: [
    "Dormir juntos.",
    "Vivir bajo un mismo techo.",
    "Orar juntos.",
    "Cada uno toma sus decisiones.",
    "Luchar por sus propios sueños.",
    "Tener una visión conjunta.",
    "Cada uno maneja su dinero.",
    "Cada uno tiene su espacio.",
  ],
  fields: [],
});

/// La 21 del taller 1: las seis prioridades.
const orden = (id: string, n = 21): PreguntaPre => ({
  id,
  number: n,
  kind: "ORDEN",
  prompt: "¿Cuál es el orden de las prioridades en el matrimonio?",
  options: [
    "Esposo.",
    "Hijos.",
    "Dios.",
    "Familia extendida (papá, mamá y hermanos).",
    "Iglesia.",
    "Trabajo.",
  ],
  fields: [],
});

const r = (questionId: string, extra: Partial<RespuestaPre> = {}): RespuestaPre => ({
  questionId,
  text: null,
  choice: null,
  choices: [],
  ordering: [],
  texts: [],
  ...extra,
});

// ---------------------------------------------------------------------------
// ¿Está respondida?
// ---------------------------------------------------------------------------

test("una abierta necesita algo escrito, aunque sea corto", () => {
  const p = abierta("a");
  assert.equal(respondidaPre(p, undefined), false);
  // ⚠️ Esta prueba afirmaba lo contrario hasta el 9-oct-2026: con el mínimo de
  // 10 caracteres, «no sé» no valía. Y eso bloqueó a alguien con el taller
  // entero contestado — ver la prueba de «Dios» más abajo. Una respuesta corta
  // la juzga el pastor al leerla; el sistema solo impide enviar en blanco.
  assert.equal(respondidaPre(p, r("a", { text: "no sé" })), true);
  assert.equal(
    respondidaPre(p, r("a", { text: "Es un pacto para toda la vida." })),
    true,
  );
});

test("⚠️ MARCAR VARIAS admite CERO marcas: no marcar nada es una respuesta", () => {
  // En la 14, alguien puede no considerar correcta ninguna de las ocho. Exigir
  // al menos una lo obligaría a mentir para poder enviar el taller.
  const p = multiple("m");
  assert.equal(respondidaPre(p, r("m", { choices: [] })), true);
  assert.equal(respondidaPre(p, r("m", { choices: [0, 2, 5] })), true);
  // Pero una pregunta que nadie tocó sigue sin responder.
  assert.equal(respondidaPre(p, undefined), false);
  // Y un índice que no existe no vale.
  assert.equal(respondidaPre(p, r("m", { choices: [0, 99] })), false);
});

test("⚠️ ORDENAR exige el orden COMPLETO, sin repetir ni dejar fuera", () => {
  const p = orden("o");
  assert.equal(respondidaPre(p, r("o", { ordering: [2, 0, 1, 3, 4, 5] })), true);
  // A medias no se puede comparar posición por posición, que es para lo único
  // que sirve.
  assert.equal(respondidaPre(p, r("o", { ordering: [2, 0, 1] })), false);
  // Repetida.
  assert.equal(respondidaPre(p, r("o", { ordering: [2, 2, 1, 3, 4, 5] })), false);
  assert.equal(esOrdenCompleto([0, 1, 2], 3), true);
  assert.equal(esOrdenCompleto([0, 1, 1], 3), false);
  assert.equal(esOrdenCompleto([], 0), true);
});

test("el avance cuenta sobre los cuatro tipos", () => {
  const preguntas = [abierta("a"), siNo("s"), multiple("m"), orden("o")];
  const avance = avancePre(preguntas, [
    r("a", { text: "Un pacto para toda la vida." }),
    r("s", { choice: 0 }),
    r("m", { choices: [] }),
  ]);
  assert.equal(avance.respondidas, 3);
  assert.equal(avance.faltan, 1);
  assert.equal(avance.completo, false);
});

// ---------------------------------------------------------------------------
// La comparación
// ---------------------------------------------------------------------------

test("⚠️ una ABIERTA nunca recibe veredicto, por larga que sea la respuesta", () => {
  // Medir si dos párrafos dicen lo mismo es el juicio pastoral para el que
  // existe la pantalla. Decir «coinciden» donde hay un desacuerdo de fondo
  // haría que el pastor dejara de leerlas.
  const p = abierta("a");
  const misma = "Es un pacto para toda la vida delante de Dios.";
  const c = compararRespuestas(p, r("a", { text: misma }), r("a", { text: misma }));
  assert.equal(c.veredicto, "NO_COMPARABLE");
});

test("sí/no coincide o no", () => {
  const p = siNo("s");
  assert.equal(
    compararRespuestas(p, r("s", { choice: 0 }), r("s", { choice: 0 })).veredicto,
    "COINCIDEN",
  );
  assert.equal(
    compararRespuestas(p, r("s", { choice: 0 }), r("s", { choice: 1 })).veredicto,
    "DISTINTO",
  );
});

test("⚠️ MARCAR VARIAS dice QUÉ marcó cada uno que el otro no", () => {
  // Es lo que hace útil la 14: no basta «distinto», hay que ver que él entiende
  // unidad como «cada uno maneja su dinero» y ella no.
  const p = multiple("m");
  const c = compararRespuestas(
    p,
    r("m", { choices: [0, 1, 2, 6] }), // él: + «cada uno maneja su dinero»
    r("m", { choices: [0, 1, 2, 5] }), // ella: + «tener una visión conjunta»
  );
  assert.equal(c.veredicto, "DISTINTO");
  assert.deepEqual(c.soloA, [6]);
  assert.deepEqual(c.soloB, [5]);
});

test("MARCAR VARIAS coincide aunque las marcas vengan en otro orden", () => {
  const p = multiple("m");
  const c = compararRespuestas(
    p,
    r("m", { choices: [2, 0, 5] }),
    r("m", { choices: [5, 2, 0] }),
  );
  assert.equal(c.veredicto, "COINCIDEN");
  assert.deepEqual(c.soloA, []);
  assert.deepEqual(c.soloB, []);
});

test("los dos sin marcar nada coinciden", () => {
  const p = multiple("m");
  const c = compararRespuestas(p, r("m", { choices: [] }), r("m", { choices: [] }));
  assert.equal(c.veredicto, "COINCIDEN");
});

test("⚠️ ORDENAR compara EL PUESTO DE CADA OPCIÓN, no la lista en crudo", () => {
  // El caso que motiva la pregunta 21: él pone a Dios primero, ella a los
  // hijos. Lo que importa es el puesto de «Dios», no en qué casilla de la lista
  // quedó.
  const p = orden("o");
  // Opciones: 0 Esposo · 1 Hijos · 2 Dios · 3 Familia · 4 Iglesia · 5 Trabajo
  const el = r("o", { ordering: [2, 0, 1, 4, 3, 5] }); // Dios, Esposo, Hijos…
  const ella = r("o", { ordering: [1, 0, 2, 4, 3, 5] }); // Hijos, Esposo, Dios…
  const c = compararRespuestas(p, el, ella);
  assert.equal(c.veredicto, "DISTINTO");
  // Cambiaron de puesto Dios (2) e Hijos (1); Esposo, Iglesia, Familia y
  // Trabajo se quedaron igual.
  assert.deepEqual(c.posicionesDistintas, [1, 2]);
});

test("ORDENAR idéntico coincide", () => {
  const p = orden("o");
  const mismo = r("o", { ordering: [2, 0, 1, 4, 3, 5] });
  const c = compararRespuestas(p, mismo, { ...mismo });
  assert.equal(c.veredicto, "COINCIDEN");
  assert.deepEqual(c.posicionesDistintas, []);
});

test("puestoPorOpcion numera desde 1, como lo pide el libro", () => {
  const m = puestoPorOpcion([2, 0, 1]);
  assert.equal(m.get(2), 1);
  assert.equal(m.get(0), 2);
  assert.equal(m.get(1), 3);
});

test("⚠️ si falta una de las dos respuestas, no hay veredicto", () => {
  const p = siNo("s");
  assert.equal(
    compararRespuestas(p, r("s", { choice: 0 }), undefined).veredicto,
    "NO_COMPARABLE",
  );
});

test("el conteo de comparables deja fuera las abiertas", () => {
  // El taller 1 real: 18 abiertas + sí/no + marcar varias + ordenar.
  const preguntas = [
    ...Array.from({ length: 18 }, (_, i) => abierta(`a${i}`, i + 1)),
    siNo("s"),
    multiple("m"),
    orden("o"),
  ];
  assert.equal(preguntas.length, 21);
  assert.equal(cuantasComparables(preguntas), 3);
});

// ---------------------------------------------------------------------------
// Los estados
// ---------------------------------------------------------------------------

const EL = "learner-el";
const ELLA = "learner-ella";

test("sin enviar es borrador; enviado y sin revisar, enviado", () => {
  assert.equal(estadoTallerPre(EL, null, []), "BORRADOR");
  assert.equal(estadoTallerPre(EL, new Date("2026-10-01"), []), "ENVIADO");
});

test("⚠️ una devolución es de UNA persona: al otro no se le marca devuelto", () => {
  // El pastor devuelve el taller de quien respondió a medias. Marcar al otro
  // como devuelto lo obligaría a rehacer algo que hizo bien.
  const revisiones = [
    {
      approved: false,
      reviewedAt: new Date("2026-10-02T15:00:00Z"),
      returnedToLearnerId: EL,
    },
  ];
  const enviado = new Date("2026-10-01T10:00:00Z");
  assert.equal(estadoTallerPre(EL, enviado, revisiones), "DEVUELTO");
  assert.equal(estadoTallerPre(ELLA, enviado, revisiones), "ENVIADO");
});

test("⚠️ reenviar después de que lo devolvieron lo saca de DEVUELTO", () => {
  const revisiones = [
    {
      approved: false,
      reviewedAt: new Date("2026-10-02T15:00:00Z"),
      returnedToLearnerId: EL,
    },
  ];
  assert.equal(
    estadoTallerPre(EL, new Date("2026-10-03T09:00:00Z"), revisiones),
    "ENVIADO",
  );
});

test("la aprobación es del tema, así que vale para los dos", () => {
  const revisiones = [
    {
      approved: true,
      reviewedAt: new Date("2026-10-02T15:00:00Z"),
      returnedToLearnerId: null,
    },
  ];
  const enviado = new Date("2026-10-01T10:00:00Z");
  assert.equal(estadoTallerPre(EL, enviado, revisiones), "APROBADO");
  assert.equal(estadoTallerPre(ELLA, enviado, revisiones), "APROBADO");
});

test("el estado del tema de la pareja distingue «falta uno» de «por revisar»", () => {
  const ayer = new Date("2026-10-01T10:00:00Z");
  assert.equal(
    estadoTemaPareja({ envioA: null, envioB: null, revisiones: [] }),
    "SIN_EMPEZAR",
  );
  assert.equal(
    estadoTemaPareja({ envioA: ayer, envioB: null, revisiones: [] }),
    "UNO_ENVIO",
  );
  assert.equal(
    estadoTemaPareja({ envioA: ayer, envioB: ayer, revisiones: [] }),
    "ESPERANDO",
  );
});

test("⚠️ un reenvío posterior devuelve el tema a la cola del pastor", () => {
  const revisiones = [
    {
      approved: false,
      reviewedAt: new Date("2026-10-02T15:00:00Z"),
      returnedToLearnerId: EL,
    },
  ];
  assert.equal(
    estadoTemaPareja({
      envioA: new Date("2026-10-03T09:00:00Z"),
      envioB: new Date("2026-10-01T10:00:00Z"),
      revisiones,
    }),
    "ESPERANDO",
  );
  assert.equal(
    estadoTemaPareja({
      envioA: new Date("2026-10-01T10:00:00Z"),
      envioB: new Date("2026-10-01T10:00:00Z"),
      revisiones,
    }),
    "DEVUELTO",
  );
});

test("⚠️ no se compara hasta que los DOS enviaron", () => {
  const ayer = new Date("2026-10-01");
  assert.equal(sePuedeComparar(ayer, null), false);
  assert.equal(sePuedeComparar(null, ayer), false);
  assert.equal(sePuedeComparar(ayer, ayer), true);
});

test("«listo para destapar» es tener los dos envíos y no haberlo destapado", () => {
  const ayer = new Date("2026-10-01");
  assert.equal(
    listoParaDestapar({ envioA: ayer, envioB: ayer, destapadoEl: null }),
    true,
  );
  assert.equal(
    listoParaDestapar({ envioA: ayer, envioB: null, destapadoEl: null }),
    false,
  );
  // Ya destapado: deja de pedir atención.
  assert.equal(
    listoParaDestapar({ envioA: ayer, envioB: ayer, destapadoEl: new Date() }),
    false,
  );
});

test("el recorrido se termina con los 12", () => {
  assert.equal(terminoElPrematrimonial(11), false);
  assert.equal(terminoElPrematrimonial(12), true);
});


// ---------------------------------------------------------------------------
// Preguntas con casillas (SUBCAMPOS) · el taller 2
// ---------------------------------------------------------------------------

/// La 1 del taller 2: 7 áreas × 2 columnas = 14 casillas bajo UN número.
const casillas = (id: string, n = 1): PreguntaPre => ({
  id,
  number: n,
  kind: "SUBCAMPOS",
  prompt: "Escriba las diferencias y similitudes con su novio(a).",
  options: [],
  fields: [
    "Espiritual · Similitudes",
    "Espiritual · Diferencias",
    "Física · Similitudes",
    "Física · Diferencias",
  ],
});

test("una pregunta con casillas no está respondida si están todas en blanco", () => {
  assert.equal(respondidaPre(casillas("q"), r("q", { texts: ["", "", "", ""] })), false);
  assert.equal(respondidaPre(casillas("q"), undefined), false);
});

test("basta UNA casilla escrita para poder enviar", () => {
  assert.equal(
    respondidaPre(casillas("q"), r("q", { texts: ["Oramos juntos", "", "", ""] })),
    true,
  );
});

test("los espacios en blanco no cuentan como casilla escrita", () => {
  assert.equal(respondidaPre(casillas("q"), r("q", { texts: ["   ", "", "", ""] })), false);
});

test("cuenta cuántas casillas van, para poder decir «2 de 4»", () => {
  assert.equal(casillasEscritas(r("q", { texts: ["a", "", "b", " "] })), 2);
  assert.equal(casillasEscritas(undefined), 0);
});

test("una pregunta con casillas NO la compara el sistema: es texto", () => {
  const dos = ["Oramos juntos", "", "", ""];
  assert.equal(
    compararRespuestas(casillas("q"), r("q", { texts: dos }), r("q", { texts: dos }))
      .veredicto,
    "NO_COMPARABLE",
  );
});

test("las casillas no entran en el conteo de comparables", () => {
  assert.equal(cuantasComparables([abierta("a"), casillas("b"), siNo("c")]), 1);
});

// ---------------------------------------------------------------------------
// Lo que bloqueó a Paola el 9-oct-2026
// ---------------------------------------------------------------------------

test("«Dios» es una respuesta válida a «¿Quién creó el matrimonio?»", () => {
  // Cuatro caracteres. Con el mínimo viejo de 10 esto no dejaba enviar el
  // taller entero, y es la respuesta correcta y completa.
  assert.equal(respondidaPre(abierta("q8", 8), r("q8", { text: "Dios" })), true);
});

test("una respuesta en blanco sigue sin valer", () => {
  assert.equal(respondidaPre(abierta("q"), r("q", { text: "   " })), false);
  assert.equal(respondidaPre(abierta("q"), r("q", { text: null })), false);
});

test("dice QUÉ preguntas faltan, no solo cuántas", () => {
  const preguntas = [abierta("a", 1), abierta("b", 2), siNo("c", 3)];
  const respuestas = [r("a", { text: "algo" })];
  assert.deepEqual(preguntasQueFaltan(preguntas, respuestas), [2, 3]);
});

test("sin preguntas que falten, la lista viene vacía", () => {
  const preguntas = [abierta("a", 1), siNo("c", 3)];
  const respuestas = [r("a", { text: "algo" }), r("c", { choice: 0 })];
  assert.deepEqual(preguntasQueFaltan(preguntas, respuestas), []);
});
