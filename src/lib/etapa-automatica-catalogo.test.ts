import assert from "node:assert/strict";
import test from "node:test";
import { Phase } from "@iglesia/prisma-client";
import {
  ETAPA_POR_MOTIVO,
  etapaQueCorresponde,
  NOTA_POR_MOTIVO,
  ORDEN_DE_FASES,
} from "./etapa-automatica-catalogo";

test("Casa de Fe y Alfa llevan a Fortalecer, la Escuela a Entrenar", () => {
  assert.equal(ETAPA_POR_MOTIVO.CASA_DE_FE, Phase.FORTALECER);
  assert.equal(ETAPA_POR_MOTIVO.ALFA, Phase.FORTALECER);
  assert.equal(ETAPA_POR_MOTIVO.ESCUELA, Phase.ENTRENAR);
});

test("mueve a quien está más atrás en el recorrido", () => {
  assert.equal(etapaQueCorresponde(Phase.GANAR, "CASA_DE_FE"), Phase.FORTALECER);
  assert.equal(etapaQueCorresponde(Phase.GANAR, "ALFA"), Phase.FORTALECER);
  // Dos etapas de un salto: es lo que pidió el usuario, y lo que el botón de
  // la ficha no permite hacer.
  assert.equal(etapaQueCorresponde(Phase.GANAR, "ESCUELA"), Phase.ENTRENAR);
  assert.equal(etapaQueCorresponde(Phase.FORTALECER, "ESCUELA"), Phase.ENTRENAR);
});

test("NUNCA mueve hacia atrás ni deja un cambio en el sitio", () => {
  // Quien ya está en Fortalecer y entra a otra Casa de Fe no se mueve.
  assert.equal(etapaQueCorresponde(Phase.FORTALECER, "CASA_DE_FE"), null);
  // Y quien acompaña un grupo desde más adelante no retrocede: es el caso que
  // de verdad existe — el 27-oct-2026 había 2 personas en MULTIPLICAR y 6 en
  // ENTRENAR dentro de una Casa de Fe.
  assert.equal(etapaQueCorresponde(Phase.ENTRENAR, "CASA_DE_FE"), null);
  assert.equal(etapaQueCorresponde(Phase.ENTRENAR, "ALFA"), null);
  assert.equal(etapaQueCorresponde(Phase.ENTRENAR, "ESCUELA"), null);
  assert.equal(etapaQueCorresponde(Phase.MULTIPLICAR, "CASA_DE_FE"), null);
  assert.equal(etapaQueCorresponde(Phase.MULTIPLICAR, "ESCUELA"), null);
});

test("el recorrido tiene las cuatro etapas, en orden y sin repetir", () => {
  assert.deepEqual([...ORDEN_DE_FASES], [
    Phase.GANAR,
    Phase.FORTALECER,
    Phase.ENTRENAR,
    Phase.MULTIPLICAR,
  ]);
  assert.equal(new Set(ORDEN_DE_FASES).size, ORDEN_DE_FASES.length);
});

test("si nace un motivo nuevo, no se olvida ni su etapa ni su nota", () => {
  for (const motivo of Object.keys(ETAPA_POR_MOTIVO) as (keyof typeof ETAPA_POR_MOTIVO)[]) {
    assert.ok(ORDEN_DE_FASES.includes(ETAPA_POR_MOTIVO[motivo]));
    assert.ok(NOTA_POR_MOTIVO[motivo]?.trim());
  }
});
