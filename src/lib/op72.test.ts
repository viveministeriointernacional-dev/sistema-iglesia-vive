import assert from "node:assert/strict";
import test from "node:test";
import { CallOutcome, ContactType } from "@iglesia/prisma-client";
import { textoChip, tituloDelMovimiento } from "./op72";

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
