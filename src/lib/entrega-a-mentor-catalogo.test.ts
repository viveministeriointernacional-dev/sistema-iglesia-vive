import assert from "node:assert/strict";
import test from "node:test";

import { variableDeWhatsAppDeLaEntrega } from "@/lib/entrega-a-mentor-catalogo";

test("dice «asignada» con una mujer y nombra el celular", () => {
  const texto = variableDeWhatsAppDeLaEntrega({
    personaNombre: "Ana Maria Rocha Caliman",
    genero: "MUJER",
    celular: "322 469 3417",
  });
  assert.match(texto, /queda asignada a tu mentoría/);
  assert.match(texto, /Su celular es 322 469 3417\./);
  assert.match(texto, /llamarla y presentarte/);
});

test("dice «asignado» con un hombre", () => {
  const texto = variableDeWhatsAppDeLaEntrega({
    personaNombre: "Edwin Samir Motato",
    genero: "HOMBRE",
    celular: "313 542 1109",
  });
  assert.match(texto, /queda asignado a tu mentoría/);
  assert.match(texto, /llamarlo y presentarte/);
});

test("sin el género NO supone ninguno, y tampoco deja un hueco", () => {
  const texto = variableDeWhatsAppDeLaEntrega({
    personaNombre: "Yulieth Vanesa Cortez",
    genero: null,
    celular: "313 445 4856",
  });
  // Son 36 de 171 personas: la frase tiene que leerse bien, no solo no fallar.
  assert.match(texto, /pasa a tu mentoría/);
  assert.match(texto, /Lo primero es llamar y presentarte/);
  assert.doesNotMatch(texto, /asignad[oa]/);
  assert.doesNotMatch(texto, /llamarl[oa]/);
});

test("sin celular lo DICE, en vez de dejar un hueco o un «null»", () => {
  const texto = variableDeWhatsAppDeLaEntrega({
    personaNombre: "Sandra Milena",
    genero: null,
    celular: null,
  });
  assert.match(texto, /No tenemos su celular en el sistema/);
  assert.doesNotMatch(texto, /null|undefined|Su celular es\s*\./);
});

test("⚠️ NUNCA deja un salto de línea, un tabulador ni espacios de sobra", () => {
  // Es la restricción que gobierna todo esto: el valor de una variable de
  // plantilla no los admite, y los nombres los teclea el equipo (§6).
  const texto = variableDeWhatsAppDeLaEntrega({
    personaNombre: "  Ana\nMaria\tRocha   Caliman  ",
    genero: "MUJER",
    celular: " 322 469 3417 ",
  });
  assert.doesNotMatch(texto, /[\n\r\t]/);
  assert.doesNotMatch(texto, / {2}/);
  assert.match(texto, /^Ana Maria Rocha Caliman terminó/);
});

test("un nombre vacío no produce una frase que empiece por el verbo", () => {
  const texto = variableDeWhatsAppDeLaEntrega({
    personaNombre: "   ",
    genero: null,
    celular: "300 000 0000",
  });
  assert.match(texto, /^Una persona terminó Operación 72/);
});

test("cabe en una variable de WhatsApp con el nombre más largo que hay hoy", () => {
  // El más largo de las 171 entregas ronda los 30 caracteres; se prueba con
  // uno peor para que el margen se vea, no se suponga.
  const texto = variableDeWhatsAppDeLaEntrega({
    personaNombre: "Maria Fernanda Alejandra Rodriguez de la Espriella",
    genero: "MUJER",
    celular: "322 469 3417",
  });
  assert.ok(
    texto.length < 400,
    `el mensaje se fue a ${texto.length} caracteres: ${texto}`,
  );
});
