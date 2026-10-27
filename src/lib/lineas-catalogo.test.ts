import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  enLaLinea,
  opcionesDeLinea,
  renglonDeLinea,
  repartirPorLinea,
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
  { tipo: "CASA_DE_FE", liderId: "felipe" },
  { tipo: "CASA_DE_FE", liderId: "paola" },
  { tipo: "CASA_DE_FE", liderId: "harold" },
  { tipo: "CASA_DE_FE", liderId: "ruth" },
  { tipo: "ALPHA", liderId: "paola" },
  // Los dos tipos que nacieron el 27-oct-2026. Van en la muestra para que el
  // desplegable tenga que contarlos: antes el renglón solo sabía de casas y
  // de Alpha, y una línea que solo lleva mentorías habría salido «0 casas».
  { tipo: "MENTORIA", liderId: "harold" },
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
    total: 5,
    porTipo: [
      { clave: "ALPHA", todos: 1, directas: 0 },
      { clave: "CASA_DE_FE", todos: 3, directas: 1 },
      { clave: "MENTORIA", todos: 1, directas: 0 },
    ],
  });
  assert.deepEqual(por("paola"), {
    id: "paola",
    nombre: "Paola Viveros",
    total: 4,
    porTipo: [
      { clave: "ALPHA", todos: 1, directas: 1 },
      { clave: "CASA_DE_FE", todos: 2, directas: 1 },
      { clave: "MENTORIA", todos: 1, directas: 0 },
    ],
  });
  assert.deepEqual(por("harold"), {
    id: "harold",
    nombre: "Hárold Narváez",
    total: 2,
    porTipo: [
      { clave: "CASA_DE_FE", todos: 1, directas: 1 },
      { clave: "MENTORIA", todos: 1, directas: 1 },
    ],
  });
});

test("un tipo del que la línea no tiene nada NO sale en el renglón", () => {
  const ops = opcionesDeLinea(GRUPOS, LINEAS, NOMBRES);
  const harold = ops.find((o) => o.id === "harold");
  assert.equal(
    harold?.porTipo.some((c) => c.clave === "ALPHA"),
    false,
    "Hárold no tiene ningún Alpha y el renglón no puede decir «0 Alpha»",
  );
  assert.equal(
    harold?.porTipo.some((c) => c.clave === "RESTAURADOS"),
    false,
  );
});

test("el renglón del desplegable se lee, y solo dice «suyas» cuando no son todas", () => {
  const ops = opcionesDeLinea(GRUPOS, LINEAS, NOMBRES);
  const texto = (id: string) => renglonDeLinea(ops.find((o) => o.id === id)!);

  assert.equal(
    texto("felipe"),
    "Juan Felipe Carvajal · 1 Alpha (0 suyos) · 3 casas (1 suya) · 1 mentoría (0 suyas)",
  );
  // Hárold lleva él mismo las dos, así que no se repite la cifra.
  assert.equal(texto("harold"), "Hárold Narváez · 1 casa · 1 mentoría");
  assert.equal(texto("ruth"), "Ruth Bonilla · 1 casa");
  // ⚠️ «1 suya», en singular. El renglón de antes decía «1 suyas» siempre, y
  // no se notaba porque las líneas medidas tenían 15, 8 o 5 propias.
  assert.match(texto("felipe"), /3 casas \(1 suya\)/);
  assert.doesNotMatch(texto("felipe"), /1 suyas/);
});

test("quien lleva un grupo y no tiene a nadie debajo también se puede elegir", () => {
  const ops = opcionesDeLinea(GRUPOS, LINEAS, NOMBRES);
  assert.deepEqual(
    ops.find((o) => o.id === "ruth"),
    {
      id: "ruth",
      nombre: "Ruth Bonilla",
      total: 1,
      porTipo: [{ clave: "CASA_DE_FE", todos: 1, directas: 1 }],
    },
  );
});

test("no se ofrece a nadie sin grupos en su línea", () => {
  const ops = opcionesDeLinea(
    [{ tipo: "CASA_DE_FE", liderId: "ruth" }],
    LINEAS,
    NOMBRES,
  );
  assert.deepEqual(ops.map((o) => o.id), ["ruth"]);
});

test("ordena de más grupos a menos, y a empate por nombre", () => {
  const ops = opcionesDeLinea(GRUPOS, LINEAS, NOMBRES);
  assert.deepEqual(ops.map((o) => o.id), ["felipe", "paola", "harold", "ruth"]);
});

// ⚠️ `repartirPorLinea` **no filtra por línea**: reparte lo que ya se filtró.
// Se le pasa lo mismo que la pantalla le pasa —lo de la línea elegida— porque
// darle la iglesia entera metería en «de su línea» a quien no cuelga de él
// (aquí Ruth, que no es de nadie).
const DE_LA_LINEA_DE_FELIPE = GRUPOS.filter(
  (g) => g.tipo === "CASA_DE_FE" && enLaLinea("felipe", g.liderId, LINEAS),
);

test("el reparto separa lo que lleva el mentor de lo que llevan los suyos", () => {
  const { directas, deSuLinea } = repartirPorLinea(
    DE_LA_LINEA_DE_FELIPE,
    (g) => g.liderId,
    "felipe",
  );
  assert.deepEqual(directas.map((g) => g.liderId), ["felipe"]);
  // Harold cuelga de Paola, que cuelga de Felipe: a cualquier profundidad es
  // «de su línea», no suya.
  assert.deepEqual(deSuLinea.map((g) => g.liderId), ["paola", "harold"]);
});

test("quien lleva toda su línea no deja nada en el otro lado", () => {
  const { directas, deSuLinea } = repartirPorLinea(
    [{ tipo: "CASA_DE_FE" as const, liderId: "ruth" }],
    (g) => g.liderId,
    "ruth",
  );
  assert.equal(directas.length, 1);
  assert.equal(deSuLinea.length, 0);
});

test("quien no lleva ninguna la deja toda en el otro lado", () => {
  const { directas, deSuLinea } = repartirPorLinea(
    GRUPOS.filter((g) => g.tipo === "CASA_DE_FE"),
    (g) => g.liderId,
    "administracion",
  );
  assert.equal(directas.length, 0);
  assert.equal(deSuLinea.length, 4);
});
