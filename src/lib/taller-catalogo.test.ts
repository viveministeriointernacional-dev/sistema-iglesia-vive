import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LARGO_MINIMO_RESPUESTA,
  codigoLegible,
  generarCodigoDeMiembro,
  normalizarCodigo,
  avanceDelTaller,
  colaDelCelular,
  estadoDelTaller,
  generarCodigo,
  preguntaRespondida,
  puedeEnviarse,
  terminoLosDoce,
  ultimaRevision,
  type PreguntaDelTaller,
  type RespuestaDelTaller,
} from "./taller-catalogo";

const abierta = (id: string, n: number): PreguntaDelTaller => ({
  id,
  number: n,
  kind: "ABIERTA",
  prompt: `Pregunta ${n}`,
  options: [],
});

const opcion = (id: string, n: number): PreguntaDelTaller => ({
  id,
  number: n,
  kind: "OPCION",
  prompt: `Pregunta ${n}`,
  options: ["Libertinaje", "Santidad práctica", "Orgullo", "Aislamiento"],
});

const dibujo = (id: string, n: number): PreguntaDelTaller => ({
  id,
  number: n,
  kind: "DIBUJO",
  prompt: "Representa dentro del recuadro…",
  options: [],
});

const texto = (questionId: string, t: string): RespuestaDelTaller => ({
  questionId,
  text: t,
  choice: null,
});

const marca = (questionId: string, choice: number): RespuestaDelTaller => ({
  questionId,
  text: null,
  choice,
});

const fecha = (iso: string) => new Date(iso);

// ---------------------------------------------------------------- el estado

test("sin enviar es BORRADOR, aunque haya respuestas", () => {
  assert.equal(estadoDelTaller(null, []), "BORRADOR");
});

test("enviado y sin revisar es ENVIADO", () => {
  assert.equal(estadoDelTaller(fecha("2026-09-27T10:00:00Z"), []), "ENVIADO");
});

test("la última revisión manda: aprobado y devuelto", () => {
  const enviado = fecha("2026-09-27T10:00:00Z");
  assert.equal(
    estadoDelTaller(enviado, [
      { approved: true, reviewedAt: fecha("2026-09-27T12:00:00Z") },
    ]),
    "APROBADO",
  );
  assert.equal(
    estadoDelTaller(enviado, [
      { approved: false, reviewedAt: fecha("2026-09-27T12:00:00Z") },
    ]),
    "DEVUELTO",
  );
});

test("⚠️ un taller devuelto y VUELTO A ENVIAR regresa a la cola del líder", () => {
  // Es el caso que una comprobación ingenua («¿tiene revisión?») rompería: se
  // quedaría en DEVUELTO para siempre y el líder no volvería a verlo nunca.
  const revisiones = [
    { approved: false, reviewedAt: fecha("2026-09-27T12:00:00Z") },
  ];
  const reenviado = fecha("2026-09-28T09:00:00Z");
  assert.equal(estadoDelTaller(reenviado, revisiones), "ENVIADO");
});

test("con varias revisiones desordenadas se toma la más reciente", () => {
  const revisiones = [
    { approved: false, reviewedAt: fecha("2026-09-27T12:00:00Z") },
    { approved: true, reviewedAt: fecha("2026-09-29T08:00:00Z") },
    { approved: false, reviewedAt: fecha("2026-09-28T15:00:00Z") },
  ];
  assert.equal(
    estadoDelTaller(fecha("2026-09-27T10:00:00Z"), revisiones),
    "APROBADO",
  );
  assert.equal(
    ultimaRevision(revisiones)?.reviewedAt.toISOString(),
    "2026-09-29T08:00:00.000Z",
  );
});

// ----------------------------------------------------- pregunta respondida

test("una abierta necesita el mínimo de caracteres", () => {
  const p = abierta("q1", 1);
  assert.equal(preguntaRespondida(p, undefined), false);
  assert.equal(preguntaRespondida(p, texto("q1", "sí")), false);
  assert.equal(preguntaRespondida(p, texto("q1", "   ")), false);
  assert.equal(
    preguntaRespondida(p, texto("q1", "a".repeat(LARGO_MINIMO_RESPUESTA))),
    true,
  );
});

test("una de opción necesita una marca dentro del rango", () => {
  const p = opcion("q6", 6);
  assert.equal(preguntaRespondida(p, undefined), false);
  assert.equal(preguntaRespondida(p, marca("q6", 1)), true);
  assert.equal(preguntaRespondida(p, marca("q6", 0)), true);
  // Fuera de rango: el navegador puede mandar cualquier cosa.
  assert.equal(preguntaRespondida(p, marca("q6", 9)), false);
  assert.equal(preguntaRespondida(p, marca("q6", -1)), false);
  // Texto en una de opción no la responde.
  assert.equal(preguntaRespondida(p, texto("q6", "Santidad práctica")), false);
});

test("⚠️ la de DIBUJO se responde describiéndola: si no, el tema 2 no se podría enviar", () => {
  const p = dibujo("q7", 7);
  assert.equal(preguntaRespondida(p, texto("q7", "corto")), false);
  assert.equal(
    preguntaRespondida(p, texto("q7", "Una corona y una luz que no se apaga")),
    true,
  );
});

// ------------------------------------------------------------- el avance

test("el avance cuenta bien y dice cuántas faltan", () => {
  const preguntas = [abierta("a", 1), abierta("b", 2), opcion("c", 3)];
  const avance = avanceDelTaller(preguntas, [
    texto("a", "Una respuesta suficientemente larga"),
    marca("c", 2),
  ]);
  assert.deepEqual(avance, {
    respondidas: 2,
    total: 3,
    faltan: 1,
    completo: false,
  });
});

test("una respuesta de una pregunta que no existe no infla el conteo", () => {
  const preguntas = [abierta("a", 1)];
  const avance = avanceDelTaller(preguntas, [
    texto("a", "Una respuesta suficientemente larga"),
    texto("fantasma", "Otra respuesta suficientemente larga"),
  ]);
  assert.equal(avance.respondidas, 1);
  assert.equal(avance.completo, true);
});

// ------------------------------------------------------- se puede enviar

test("⚠️ solo se envía completo, y no se reenvía lo ya enviado ni lo aprobado", () => {
  const preguntas = [abierta("a", 1), opcion("b", 2)];
  const aMedias = [texto("a", "Una respuesta suficientemente larga")];
  const todas = [...aMedias, marca("b", 1)];

  assert.equal(puedeEnviarse(preguntas, aMedias, "BORRADOR"), false);
  assert.equal(puedeEnviarse(preguntas, todas, "BORRADOR"), true);
  // Devuelto: se puede corregir y volver a enviar.
  assert.equal(puedeEnviarse(preguntas, todas, "DEVUELTO"), true);
  // Ya enviado o ya aprobado: no.
  assert.equal(puedeEnviarse(preguntas, todas, "ENVIADO"), false);
  assert.equal(puedeEnviarse(preguntas, todas, "APROBADO"), false);
});

// --------------------------------------------------------------- lo demás

test("los 12 cierran el recorrido, 11 no", () => {
  assert.equal(terminoLosDoce(11), false);
  assert.equal(terminoLosDoce(12), true);
  assert.equal(terminoLosDoce(13), true);
});

test("el código es hexadecimal, del largo pedido y no se repite", () => {
  const uno = generarCodigo();
  const otro = generarCodigo();
  assert.match(uno, /^[0-9a-f]{32}$/);
  assert.notEqual(uno, otro);
  assert.equal(generarCodigo(8).length, 16);
});

test("el celular se reduce a sus 10 dígitos, y lo corto no sirve", () => {
  assert.equal(colaDelCelular("+57 320 473 2415"), "3204732415");
  assert.equal(colaDelCelular("3204732415"), "3204732415");
  assert.equal(colaDelCelular("320 473"), null);
});

// ------------------------------------------------- el código de miembro

test("el código acepta lo que la gente escribe: con espacios o con guión", () => {
  // Se lo dictaron «418 203» y lo copió tal cual. Rechazarlo sería castigar a
  // quien copió bien.
  assert.equal(normalizarCodigo("418203"), "418203");
  assert.equal(normalizarCodigo("418 203"), "418203");
  assert.equal(normalizarCodigo("418-203"), "418203");
  assert.equal(normalizarCodigo("  418203  "), "418203");
});

test("⚠️ el código rechaza lo que no lo es, incluido el que empieza por cero", () => {
  assert.equal(normalizarCodigo("41820"), null); // corto
  assert.equal(normalizarCodigo("4182030"), null); // largo
  assert.equal(normalizarCodigo("41820a"), null); // letras
  assert.equal(normalizarCodigo(""), null);
  // Un cero a la izquierda se pierde al pegarlo en Excel, así que no existe.
  assert.equal(normalizarCodigo("018203"), null);
});

test("el código generado tiene 6 dígitos, nunca empieza por 0, y no se repite", () => {
  const vistos = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    const codigo = generarCodigoDeMiembro();
    assert.match(codigo, /^[1-9][0-9]{5}$/);
    // Y lo que genera tiene que pasar su propio validador: si no, se repartiría
    // un código que después el formulario rechaza.
    assert.equal(normalizarCodigo(codigo), codigo);
    vistos.add(codigo);
  }
  // 500 sorteos sobre 900 000: repetir más de un puñado delataría un generador
  // sesgado, no mala suerte.
  assert.ok(vistos.size > 490, `demasiados repetidos: ${vistos.size} de 500`);
});

test("el código se enseña en dos bloques para poder dictarlo", () => {
  assert.equal(codigoLegible("418203"), "418 203");
});
