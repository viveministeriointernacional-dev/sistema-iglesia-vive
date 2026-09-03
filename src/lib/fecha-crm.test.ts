import assert from "node:assert/strict";
import test from "node:test";
import { fechaDesdeCrm } from "./registro";

test("una fecha sin hora del CRM no se corre un día atrás en Colombia", () => {
  const fecha = fechaDesdeCrm("2026-08-29");
  assert.ok(fecha);
  assert.equal(fecha.toISOString(), "2026-08-29T17:00:00.000Z"); // mediodía en Bogotá
  assert.equal(fechaDesdeCrm("29/08/2026")?.toISOString(), "2026-08-29T17:00:00.000Z");
  assert.equal(fechaDesdeCrm("2026-08-29T16:00:00-05:00")?.toISOString(), "2026-08-29T21:00:00.000Z");
  assert.equal(fechaDesdeCrm("{{contact.fecha_visita}}"), null);
  assert.equal(fechaDesdeCrm(null), null);
});
