import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { test } from "node:test";

import {
  MATERIAL_POR_TEMA,
  carpetaDelMaterial,
  materialDelTema,
  rutaDeDiapositiva,
  rutaDelPdf,
  tamanoLegible,
} from "./prematrimonial-material";

test("un tema sin material no inventa ninguno", () => {
  assert.equal(materialDelTema(7), null);
  assert.equal(materialDelTema(0), null);
});

test("el tema 1 tiene sus 18 diapositivas", () => {
  const m = materialDelTema(1);
  assert.ok(m);
  assert.equal(m.diapositivas, 18);
});

test("el numero de la carpeta va con DOS cifras", () => {
  // ⚠️ Es la trampa de este modulo: `tema-1` da 404 y la pantalla se queda con
  // huecos en blanco sin decir por que.
  assert.equal(carpetaDelMaterial(1), "/prematrimonial/tema-01");
  assert.equal(carpetaDelMaterial(12), "/prematrimonial/tema-12");
  assert.equal(rutaDeDiapositiva(1, 1), "/prematrimonial/tema-01/diapositiva-01.webp");
  assert.equal(rutaDeDiapositiva(1, 18), "/prematrimonial/tema-01/diapositiva-18.webp");
  assert.equal(rutaDelPdf(1), "/prematrimonial/tema-01/material.pdf");
});

test("el tamano se lee como lo leeria una persona", () => {
  assert.equal(tamanoLegible(270481), "264 KB");
  assert.equal(tamanoLegible(1024 * 1024 * 1.25), "1,3 MB");
  // Por debajo de 1 MB nunca se dice en MB: «0,3 MB» no responde la pregunta
  // que de verdad se hace quien lo va a bajar con sus datos.
  assert.equal(tamanoLegible(1024 * 300), "300 KB");
  assert.equal(tamanoLegible(0), "");
});

/// ⚠️ **La prueba que de verdad importa: que los archivos EXISTAN y que sean
/// tantos como dice el catalogo.**
///
/// El catalogo y la carpeta se escriben en dos sitios distintos (esta lista a
/// mano, las imagenes con `scripts/diapositivas.py`), asi que se pueden separar
/// sin que nada avise: un 404 en una imagen no rompe la pagina, deja un hueco
/// en blanco. Ningun `tsc` ni `eslint` lo ve.
test("cada tema del catalogo tiene sus archivos en public/", () => {
  for (const [numero, material] of Object.entries(MATERIAL_POR_TEMA)) {
    const n = Number(numero);

    const pdf = `public${rutaDelPdf(n)}`;
    assert.ok(existsSync(pdf), `falta ${pdf}`);
    assert.equal(
      statSync(pdf).size,
      material.bytes,
      `el tamano del tema ${n} en el catalogo no es el del archivo`,
    );

    for (let i = 1; i <= material.diapositivas; i += 1) {
      const imagen = `public${rutaDeDiapositiva(n, i)}`;
      assert.ok(existsSync(imagen), `falta ${imagen}`);
    }

    // Y al reves: ninguna diapositiva de mas, que seria material que nadie ve.
    const sobrante = `public${rutaDeDiapositiva(n, material.diapositivas + 1)}`;
    assert.ok(
      !existsSync(sobrante),
      `el tema ${n} tiene mas diapositivas que las que dice el catalogo`,
    );
  }
});
