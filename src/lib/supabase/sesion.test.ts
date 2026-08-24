import assert from "node:assert/strict";
import test from "node:test";
import { esRutaPublica } from "./sesion";

test("abre el formulario público y su confirmación", () => {
  assert.equal(esRutaPublica("/registro"), true);
  assert.equal(esRutaPublica("/registro/gracias"), true);
  assert.equal(esRutaPublica("/api/registro"), true);
});

test("mantiene privado el registro del equipo", () => {
  assert.equal(esRutaPublica("/registro-interno"), false);
});
