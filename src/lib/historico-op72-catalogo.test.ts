import assert from "node:assert/strict";
import test from "node:test";
import { EXTREMOS, type Extremo } from "./informe-detalle-catalogo";
import {
  ALTO_PANEL,
  ANCHO_VISTA,
  FUERA_DEL_TABLERO,
  PASOS_RECORRIDO,
  PUERTAS_SALIDA,
  type Punto,
  puntosEnCoordenadas,
  rutasDeLinea,
  topeDe,
} from "./historico-op72-catalogo";

const punto = (valor: number, i = 0): Punto => ({
  dia: `2026-10-${String(1 + i).padStart(2, "0")}`,
  fin: `2026-10-${String(1 + i).padStart(2, "0")}`,
  etiqueta: `${1 + i} oct`,
  valor,
  parcial: false,
});

const serie = (valores: number[]) => valores.map((valor, i) => punto(valor, i));

test("los seis pasos usan extremos de verdad y no se repiten", () => {
  const vistos = new Set<string>();
  for (const paso of PASOS_RECORRIDO) {
    assert.ok(EXTREMOS.includes(paso.desde as Extremo), `${paso.desde} no es un extremo`);
    assert.ok(EXTREMOS.includes(paso.hacia as Extremo), `${paso.hacia} no es un extremo`);
    const par = `${paso.desde}→${paso.hacia}`;
    assert.ok(!vistos.has(par), `el paso ${par} está dos veces`);
    vistos.add(par);
    assert.ok(paso.titulo && paso.pie, `al paso ${paso.clave} le falta texto`);
  }
});

/// Las tres puertas del histórico tienen que ser **las mismas tres** que
/// sacan a alguien del tablero. Si apareciera un cuarto desenlace y solo se
/// añadiera en un sitio, la gráfica de salidas dejaría de sumar lo mismo que
/// el ⊖ del tablero sin que nada fallara.
test("las puertas de salida son exactamente las que sacan del tablero", () => {
  assert.deepEqual(
    PUERTAS_SALIDA.map((puerta) => puerta.hacia as string).sort(),
    [...FUERA_DEL_TABLERO].sort(),
  );
});

/// Ningún paso del recorrido puede apuntar a una salida: para eso está la
/// gráfica de abajo, y contarlo en los dos sitios lo duplicaría.
test("ningún panel del recorrido apunta a una salida", () => {
  for (const paso of PASOS_RECORRIDO) {
    assert.ok(
      !FUERA_DEL_TABLERO.includes(paso.hacia as Extremo),
      `${paso.clave} apunta a ${paso.hacia}, que es una salida`,
    );
  }
});

/// ⚠️ Con el tope en 0 la división da `NaN`, el atributo `d` sale con «NaN» y
/// **la gráfica desaparece sin un solo error en consola**. Un periodo entero
/// sin movimientos es un caso normal, no un fallo.
test("una serie toda en cero dibuja una línea, no NaN", () => {
  const puntos = serie([0, 0, 0]);
  const { firme: ruta } = rutasDeLinea(puntos, topeDe([0, 0, 0]), ALTO_PANEL);
  assert.ok(!ruta.includes("NaN"), `la ruta trae NaN: ${ruta}`);
  assert.ok(ruta.startsWith("M"));
  assert.equal(topeDe([0, 0, 0]), 1);
  assert.equal(topeDe([]), 1);
});

/// Un rango de un solo día es un tramo solo, y una línea de un punto no se ve.
test("un punto solo dibuja un trazo corto, no un punto invisible", () => {
  const { firme: ruta } = rutasDeLinea(serie([5]), 5, ALTO_PANEL);
  assert.ok(ruta.includes("L"), `con un punto hay que dibujar algo: ${ruta}`);
  assert.ok(!ruta.includes("NaN"));
  assert.deepEqual(rutasDeLinea([], 1, ALTO_PANEL), { firme: "", enCurso: "" });
});

test("la línea usa todo el ancho y el valor más alto queda arriba", () => {
  const puntos = puntosEnCoordenadas(serie([0, 5, 10]), 10, ALTO_PANEL);
  assert.equal(puntos[0].x, 0);
  assert.equal(puntos[2].x, ANCHO_VISTA);
  // Más valor = más arriba = menos `y`.
  assert.ok(puntos[2].y < puntos[1].y);
  assert.ok(puntos[1].y < puntos[0].y);
  // Y nada se sale del área de dibujo.
  for (const p of puntos) {
    assert.ok(p.y >= 0 && p.y <= ALTO_PANEL, `y fuera del panel: ${p.y}`);
  }
});

test("con un solo punto la coordenada va al centro, no al borde", () => {
  const [solo] = puntosEnCoordenadas(serie([3]), 3, ALTO_PANEL);
  assert.equal(solo.x, ANCHO_VISTA / 2);
});

/// Probar al revés (§12.8): si el tope fuera menor que el valor más alto, el
/// punto se saldría del panel por arriba. Es lo que pasaría al reusar el tope
/// de otra serie por error.
test("un tope menor que el dato se saldría del panel", () => {
  const [p] = puntosEnCoordenadas(serie([100]), 10, ALTO_PANEL);
  assert.ok(p.y < 0, "con un tope demasiado bajo el punto tiene que salirse: por eso cada panel calcula el suyo");
});

/// El tramo en curso sale como un trazo aparte para poder dibujarlo
/// discontinuo. Sin esto, la línea de TODAS las gráficas cae a plomo al final
/// —la semana en curso lleva dos días— y parecería un derrumbe cada semana.
test("el tramo en curso se devuelve como un trazo aparte", () => {
  const puntos = serie([10, 8, 2]);
  puntos[2].parcial = true;

  const { firme, enCurso } = rutasDeLinea(puntos, 10, ALTO_PANEL);
  assert.ok(firme.includes("M") && firme.includes("L"), "el trazo firme lleva los dos primeros");
  assert.ok(enCurso.startsWith("M"), "el tramo en curso tiene que venir aparte");
  // El trazo firme NO puede llegar hasta el último punto.
  assert.equal(firme.split("L").length - 1, 1, "el firme solo une los dos puntos cerrados");

  // Y si nada está en curso, no hay segundo trazo.
  const cerrados = rutasDeLinea(serie([10, 8, 2]), 10, ALTO_PANEL);
  assert.equal(cerrados.enCurso, "");
  assert.equal(cerrados.firme.split("L").length - 1, 2);
});
