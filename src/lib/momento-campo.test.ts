import assert from "node:assert/strict";
import test from "node:test";
import { momentoDesdeCampo, momentoParaCampo } from "./dominio";

test("lo que escribe el campo se guarda en hora de Colombia, no en UTC", () => {
  // El caso real que reportó el usuario: 4:30 de la tarde se guardaba como
  // 11:30 de la mañana, cinco horas menos.
  const cuando = momentoDesdeCampo("2026-09-12T16:30");
  assert.ok(cuando);
  assert.equal(cuando.toISOString(), "2026-09-12T21:30:00.000Z");
});

test("aguanta segundos, espacio en vez de T, y texto en blanco", () => {
  assert.equal(
    momentoDesdeCampo("2026-09-12T16:30:00")?.toISOString(),
    "2026-09-12T21:30:00.000Z",
  );
  assert.equal(
    momentoDesdeCampo("2026-09-12 16:30")?.toISOString(),
    "2026-09-12T21:30:00.000Z",
  );
  assert.equal(momentoDesdeCampo("  "), null);
  assert.equal(momentoDesdeCampo("mañana por la tarde"), null);
});

test("un valor que YA trae zona se respeta tal cual", () => {
  assert.equal(
    momentoDesdeCampo("2026-09-12T21:30:00Z")?.toISOString(),
    "2026-09-12T21:30:00.000Z",
  );
  assert.equal(
    momentoDesdeCampo("2026-09-12T16:30:00-05:00")?.toISOString(),
    "2026-09-12T21:30:00.000Z",
  );
});

test("ida y vuelta: lo que se pinta en el campo es lo que se vuelve a guardar", () => {
  // Es la prueba que importa: la reprogramación rellena el campo con
  // `momentoParaCampo` y lo guarda con `momentoDesdeCampo`. Si las dos mitades
  // no cuadran, abrir el panel y guardar sin tocar nada corre la hora.
  for (const iso of [
    "2026-09-12T21:30:00.000Z", // 4:30 p. m. en Colombia
    "2026-09-16T02:00:00.000Z", // el día anterior a las 9 de la noche
    "2026-09-12T13:00:00.000Z", // 8 de la mañana
  ]) {
    const original = new Date(iso);
    const campo = momentoParaCampo(original);
    assert.equal(momentoDesdeCampo(campo)?.toISOString(), iso, campo);
  }
});

test("la medianoche y el mediodía de Colombia no se confunden", () => {
  assert.equal(
    momentoDesdeCampo("2026-09-12T00:00")?.toISOString(),
    "2026-09-12T05:00:00.000Z",
  );
  assert.equal(
    momentoDesdeCampo("2026-09-12T12:00")?.toISOString(),
    "2026-09-12T17:00:00.000Z",
  );
});
