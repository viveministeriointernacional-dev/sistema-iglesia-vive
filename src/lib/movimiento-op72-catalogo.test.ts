import assert from "node:assert/strict";
import test from "node:test";
import { COLUMNAS_OP72 } from "./op72";
import {
  ETIQUETA_LISTA,
  ETIQUETA_PUERTA,
  type Lista,
  LISTAS,
  listaValida,
  PESTANAS_SALIDA,
  pestanaSalidaValida,
  PUERTAS,
  SIN_MOVIMIENTO,
} from "./movimiento-op72-catalogo";

/// **Las cinco listas del catálogo tienen que ser las cinco columnas del
/// tablero, en el mismo orden.**
///
/// Están escritas dos veces a propósito: `COLUMNAS_OP72` usa el enum de Prisma
/// (servidor) y `LISTAS` es texto plano, porque lo que toca el navegador va en
/// el catálogo (§12.4). Esta prueba es lo único que impide que se separen —si
/// alguien añade una columna al tablero y se olvida del catálogo, el ⊕ de esa
/// columna no existiría y nada más lo avisaría.
test("las listas del catálogo son las columnas del tablero, en orden", () => {
  assert.deepEqual(
    [...LISTAS],
    COLUMNAS_OP72.map((columna) => columna.estado as string),
  );
});

test("cada lista tiene su etiqueta escrita", () => {
  for (const lista of LISTAS) {
    assert.ok(ETIQUETA_LISTA[lista], `falta la etiqueta de ${lista}`);
  }
});

test("listaValida solo deja pasar las cinco listas", () => {
  assert.equal(listaValida("CONTACTADA"), "CONTACTADA");
  assert.equal(listaValida("LISTA_PARA_ENTREGA"), "LISTA_PARA_ENTREGA");
  // Son estados de Operación 72, pero NO columnas del tablero: a esas no se
  // «entra», se sale por ellas, y las enseña el ⊖.
  assert.equal(listaValida("ENTREGADA"), null);
  assert.equal(listaValida("CERRADA"), null);
  assert.equal(listaValida("contactada"), null);
  assert.equal(listaValida(undefined), null);
  assert.equal(listaValida(""), null);
});

/// La pestaña llega del navegador: lo que no esté en la lista cerrada cae en
/// «todas», que es la que explica el número que se pulsó.
test("pestanaSalidaValida cae en «todas» ante cualquier cosa rara", () => {
  for (const pestana of PESTANAS_SALIDA) {
    assert.equal(pestanaSalidaValida(pestana), pestana);
  }
  assert.equal(pestanaSalidaValida("bajas"), "bajas");
  assert.equal(pestanaSalidaValida("inventada"), "todas");
  assert.equal(pestanaSalidaValida(undefined), "todas");
  assert.equal(pestanaSalidaValida("__proto__"), "todas");
});

/// Las tres puertas son tres hechos distintos y tienen que seguir siéndolo:
/// entregada a su mentor es el final bueno, asistente es que no quiso proceso
/// y baja es que se perdió. Juntarlas sería el error del indicador de visitas
/// otra vez (§12.6).
test("las tres puertas de salida están y son distintas", () => {
  assert.deepEqual([...PUERTAS], ["entregadas", "asistentes", "bajas"]);
  const etiquetas = PUERTAS.map((puerta) => ETIQUETA_PUERTA[puerta]);
  assert.equal(new Set(etiquetas).size, PUERTAS.length);
  // «todas» más las tres puertas, sin repetir.
  assert.equal(PESTANAS_SALIDA.length, PUERTAS.length + 1);
});

/// El tablero pinta estos números antes de que llegue nada de la base (y si la
/// consulta no devuelve fila). Un hueco aquí saldría como «+undefined».
test("el movimiento vacío trae las cinco listas y las tres puertas en cero", () => {
  for (const lista of LISTAS) {
    assert.equal(SIN_MOVIMIENTO.entraron[lista], 0);
    assert.equal(SIN_MOVIMIENTO.siguieronAhi[lista], 0);
  }
  for (const puerta of PUERTAS) {
    assert.equal(SIN_MOVIMIENTO.salieron.porPuerta[puerta], 0);
  }
  assert.equal(SIN_MOVIMIENTO.salieron.total, 0);
  assert.equal(SIN_MOVIMIENTO.antesDeLaAuditoria, false);
});

/// Probar al revés es lo que hace valer una prueba (§12.8): si alguien quita
/// una lista del catálogo, la primera prueba tiene que caerse.
test("quitar una lista rompe la correspondencia con el tablero", () => {
  const recortadas = LISTAS.filter((lista) => lista !== "SEGUIMIENTO") as Lista[];
  assert.notDeepEqual(
    recortadas,
    COLUMNAS_OP72.map((columna) => columna.estado as string),
  );
});
