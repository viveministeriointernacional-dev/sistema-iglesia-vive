import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  enLaLinea,
  opcionesDeLinea,
  type GrupoConLider,
  type LineasDeLosLideres,
} from "./lineas-catalogo";

// La forma real de la iglesia, en pequeño: Juan Felipe arriba, Paola debajo de
// él, Harold debajo de Paola, y Ruth suelta (lleva casas y no cuelga de nadie).
const LINEAS: LineasDeLosLideres = {
  paola: ["felipe"],
  harold: ["paola", "felipe"],
  felipe: [],
  ruth: [],
};

const NOMBRES = {
  felipe: "Juan Felipe Carvajal",
  paola: "Paola Viveros",
  harold: "Hárold Narváez",
  ruth: "Ruth Bonilla",
};

const GRUPOS: GrupoConLider[] = [
  { tipo: "casa-de-fe", liderId: "felipe" },
  { tipo: "casa-de-fe", liderId: "paola" },
  { tipo: "casa-de-fe", liderId: "harold" },
  { tipo: "casa-de-fe", liderId: "ruth" },
  { tipo: "alpha", liderId: "paola" },
];

test("la línea de alguien lo incluye a él mismo", () => {
  assert.equal(enLaLinea("ruth", "ruth", LINEAS), true);
});

test("alcanza a quien cuelga de él, a cualquier profundidad", () => {
  assert.equal(enLaLinea("felipe", "paola", LINEAS), true);
  assert.equal(enLaLinea("felipe", "harold", LINEAS), true);
});

test("no alcanza hacia arriba ni de lado", () => {
  assert.equal(enLaLinea("paola", "felipe", LINEAS), false);
  assert.equal(enLaLinea("ruth", "paola", LINEAS), false);
});

test("un líder que no está en el mapa no rompe nada", () => {
  assert.equal(enLaLinea("felipe", "desconocido", LINEAS), false);
});

test("las líneas se solapan: la de arriba contiene a la de abajo", () => {
  const ops = opcionesDeLinea(GRUPOS, LINEAS, NOMBRES);
  const por = (id: string) => ops.find((o) => o.id === id);
  assert.deepEqual(por("felipe"), {
    id: "felipe",
    nombre: "Juan Felipe Carvajal",
    casas: 3,
    alpha: 1,
  });
  assert.deepEqual(por("paola"), {
    id: "paola",
    nombre: "Paola Viveros",
    casas: 2,
    alpha: 1,
  });
  assert.deepEqual(por("harold"), {
    id: "harold",
    nombre: "Hárold Narváez",
    casas: 1,
    alpha: 0,
  });
});

test("quien lleva un grupo y no tiene a nadie debajo también se puede elegir", () => {
  const ops = opcionesDeLinea(GRUPOS, LINEAS, NOMBRES);
  assert.deepEqual(
    ops.find((o) => o.id === "ruth"),
    { id: "ruth", nombre: "Ruth Bonilla", casas: 1, alpha: 0 },
  );
});

test("no se ofrece a nadie sin grupos en su línea", () => {
  const ops = opcionesDeLinea(
    [{ tipo: "casa-de-fe", liderId: "ruth" }],
    LINEAS,
    NOMBRES,
  );
  assert.deepEqual(ops.map((o) => o.id), ["ruth"]);
});

test("ordena de más grupos a menos, y a empate por nombre", () => {
  const ops = opcionesDeLinea(GRUPOS, LINEAS, NOMBRES);
  assert.deepEqual(ops.map((o) => o.id), ["felipe", "paola", "harold", "ruth"]);
});
