import assert from "node:assert/strict";
import test from "node:test";
import { CallOutcome, ContactType } from "@iglesia/prisma-client";
import {
  esVisitaCumplida,
  textoChip,
  tituloDelMovimiento,
  VISITA_ACORDADA,
  VISITA_CUMPLIDA,
} from "./op72";

const HORA = 3_600_000;

test("el chip dice qué mide: lo que queda o desde cuándo venció", () => {
  const ahora = new Date("2026-09-03T12:00:00Z");
  assert.equal(textoChip(new Date(ahora.getTime() + 64 * HORA), ahora), "QUEDAN 64 H");
  assert.equal(textoChip(new Date(ahora.getTime() - 5 * HORA), ahora), "VENCIÓ HACE 5 H");
  assert.equal(textoChip(new Date(ahora.getTime() - 30 * HORA), ahora), "VENCIÓ HACE 1 DÍA");
  assert.equal(textoChip(new Date(ahora.getTime() - 5 * 24 * HORA), ahora), "VENCIÓ HACE 5 DÍAS");
});

test("el movimiento nombra el hecho y numera los intentos", () => {
  assert.equal(
    tituloDelMovimiento({ type: ContactType.LLAMADA, outcome: CallOutcome.CONTESTO_BIEN, result: null }),
    "Llamada · contestó bien",
  );
  assert.equal(
    tituloDelMovimiento({
      type: ContactType.INTENTO_LLAMADA,
      outcome: CallOutcome.NO_CONTESTO,
      result: null,
      intentosPrevios: 2,
    }),
    "3.er intento · no contestó",
  );
  assert.equal(
    tituloDelMovimiento({ type: ContactType.VISITA, outcome: null, result: "Visita agendada" }),
    "Visita agendada",
  );
});

/// **Acordar una visita y cumplirla son dos hechos distintos.** Las dos se
/// guardan con `type = VISITA` y solo las separa `result`, así que estas
/// pruebas son lo único que impide volver a contar promesas como visitas
/// (el indicador del informe inflaba casi cuatro veces, 16-oct-2026).
test("una visita cumplida no se llama igual que una acordada", () => {
  assert.equal(
    tituloDelMovimiento({
      type: ContactType.VISITA,
      outcome: null,
      result: VISITA_CUMPLIDA,
    }),
    "Visita realizada",
  );
  assert.equal(
    tituloDelMovimiento({
      type: ContactType.VISITA,
      outcome: null,
      result: VISITA_ACORDADA,
    }),
    "Visita agendada",
  );
  // Reprogramar deja un `result` largo con su propio prefijo: sigue siendo una
  // visita acordada, no una cumplida.
  assert.equal(
    tituloDelMovimiento({
      type: ContactType.VISITA,
      outcome: null,
      result: "Visita reprogramada · antes era el 8 de oct, 2:00 p. m.",
    }),
    "Visita agendada",
  );
});

test("esVisitaCumplida solo acepta la visita que se hizo", () => {
  assert.equal(
    esVisitaCumplida({ type: ContactType.VISITA, result: VISITA_CUMPLIDA }),
    true,
  );
  assert.equal(
    esVisitaCumplida({ type: ContactType.VISITA, result: VISITA_ACORDADA }),
    false,
  );
  assert.equal(esVisitaCumplida({ type: ContactType.VISITA, result: null }), false);
  // Y al revés: el mismo texto en otro tipo de intento no es una visita.
  assert.equal(
    esVisitaCumplida({ type: ContactType.LLAMADA, result: VISITA_CUMPLIDA }),
    false,
  );
  assert.equal(
    esVisitaCumplida({ type: ContactType.INTENTO_VISITA, result: VISITA_CUMPLIDA }),
    false,
  );
});
