import assert from "node:assert/strict";
import test from "node:test";
import { fechaDesdeCrm, horaConocidaDelCrm, horaDesdeCrm } from "./registro";

test("una fecha sin hora del CRM no se corre un día atrás en Colombia", () => {
  const fecha = fechaDesdeCrm("2026-08-29");
  assert.ok(fecha);
  assert.equal(fecha.toISOString(), "2026-08-29T17:00:00.000Z"); // mediodía en Bogotá
  assert.equal(fechaDesdeCrm("29/08/2026")?.toISOString(), "2026-08-29T17:00:00.000Z");
  assert.equal(fechaDesdeCrm("2026-08-29T16:00:00-05:00")?.toISOString(), "2026-08-29T21:00:00.000Z");
  assert.equal(fechaDesdeCrm("{{contact.fecha_visita}}"), null);
  assert.equal(fechaDesdeCrm(null), null);
});

test("la hora de la visita llega en un campo aparte y se junta con el día", () => {
  // Como la escribe la línea en el formulario, en sus varias formas.
  assert.equal(horaDesdeCrm("16:30"), "16:30:00");
  assert.equal(horaDesdeCrm("4:30 pm"), "16:30:00");
  assert.equal(horaDesdeCrm("4 p. m."), "16:00:00");
  assert.equal(horaDesdeCrm("8am"), "08:00:00");
  assert.equal(horaDesdeCrm("09:05"), "09:05:00");
  // Las dos excepciones del reloj de 12 horas.
  assert.equal(horaDesdeCrm("12 am"), "00:00:00");
  assert.equal(horaDesdeCrm("12 pm"), "12:00:00");
  // Lo que no se reconoce no inventa una hora.
  assert.equal(horaDesdeCrm("en la tarde"), null);
  assert.equal(horaDesdeCrm("{{contact.hora_visita}}"), null);
  assert.equal(horaDesdeCrm("25:00"), null);
  assert.equal(horaDesdeCrm(""), null);
  assert.equal(horaDesdeCrm(null), null);

  // Día + hora: 4:30 p. m. en Bogotá son las 21:30 UTC.
  assert.equal(
    fechaDesdeCrm("2026-09-15", "4:30 pm")?.toISOString(),
    "2026-09-15T21:30:00.000Z",
  );
  // Sin hora reconocible se conserva el mediodía de siempre.
  assert.equal(
    fechaDesdeCrm("2026-09-15", "en la tarde")?.toISOString(),
    "2026-09-15T17:00:00.000Z",
  );
  // Si el día ya trae su propia hora, esa manda: el campo aparte no la pisa.
  assert.equal(
    fechaDesdeCrm("2026-09-15T08:00:00-05:00", "4:30 pm")?.toISOString(),
    "2026-09-15T13:00:00.000Z",
  );
});

test("se distingue la hora que alguien dijo del mediodía de relleno", () => {
  // Lo que llegó de verdad el 11-sep: día en un campo, hora en otro.
  assert.equal(horaConocidaDelCrm("2026-09-14", "5 p.m"), true);
  assert.equal(horaConocidaDelCrm("14/09/2026", "4:00 pm"), true);
  // Sin hora, o con un texto que no nombra ninguna: es el mediodía de relleno.
  assert.equal(horaConocidaDelCrm("2026-09-14", null), false);
  assert.equal(horaConocidaDelCrm("2026-09-14", "está por confirmar"), false);
  assert.equal(horaConocidaDelCrm("2026-09-14", "{{contact.hora_visita}}"), false);
  // Un valor que ya trae la hora dentro no necesita el campo aparte.
  assert.equal(horaConocidaDelCrm("2026-09-14T16:00:00-05:00", null), true);
  assert.equal(horaConocidaDelCrm(null, "5 p.m"), false);
});
