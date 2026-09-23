import { test } from "node:test";
import assert from "node:assert/strict";
import {
  correrMes,
  diaAnterior,
  diaCivilCorto,
  diaCivilLargo,
  diaSiguiente,
  diasDelMes,
  diasQueYaPasaron,
  diasSinMarcar,
  esDiaFuturo,
  mesDe,
  mesLegible,
  rachaAlDia,
  rejillaDelMes,
  resumenDeDevocionales,
} from "./gi-catalogo";

/// La semana real del mockup: lunes 21 a domingo 27 de septiembre de 2026.
const SEMANA = [
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-09-24",
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
];

test("el día siguiente y el anterior no se salen del calendario", () => {
  assert.equal(diaSiguiente("2026-09-30"), "2026-10-01");
  assert.equal(diaAnterior("2026-03-01"), "2026-02-28");
  // 2028 es bisiesto: el 29 de febrero existe y hay que pisarlo.
  assert.equal(diaSiguiente("2028-02-28"), "2028-02-29");
});

test("⚠️ un día que aún no llegó no se puede marcar", () => {
  // Sin esta regla, el lunes se podría dejar marcada la semana entera y el
  // conteo diría que el movimiento va al 100 % por un clic.
  assert.equal(esDiaFuturo("2026-09-24", "2026-09-23"), true);
  assert.equal(esDiaFuturo("2026-09-23", "2026-09-23"), false, "hoy sí se marca");
  assert.equal(esDiaFuturo("2026-09-22", "2026-09-23"), false);
});

test("⚠️ el denominador son los días que YA pasaron, no los siete", () => {
  // Contar la semana entera el miércoles daría un porcentaje que solo puede
  // empeorar, y el líder parecería estar fallando por mirar temprano.
  assert.deepEqual(diasQueYaPasaron(SEMANA, "2026-09-23"), [
    "2026-09-21",
    "2026-09-22",
    "2026-09-23",
  ]);
  assert.deepEqual(diasQueYaPasaron(SEMANA, "2026-09-30").length, 7);
});

test("el resumen cuenta hechos sobre posibles", () => {
  const marcados = new Set(["2026-09-21", "2026-09-23", "2026-09-26"]);
  // El 26 está marcado pero todavía no ha llegado: no cuenta en ninguno de los
  // dos lados, o el resumen diría 2 de 3 con un día que nadie ha vivido.
  assert.deepEqual(resumenDeDevocionales(SEMANA, marcados, "2026-09-23"), {
    posibles: 3,
    hechos: 2,
  });
});

test("la racha son los días corridos hasta hoy", () => {
  const marcados = new Set(["2026-09-21", "2026-09-22", "2026-09-23"]);
  assert.equal(rachaAlDia(marcados, "2026-09-23"), 3);
});

test("⚠️ si hoy no está marcado todavía, la racha NO se corta", () => {
  // Marcar lo hace el líder, no el joven, y casi siempre por la tarde. Cortar
  // la racha a las 7 de la mañana diría que alguien falló cuando lo único que
  // pasó es que el día no ha terminado.
  const marcados = new Set(["2026-09-21", "2026-09-22"]);
  assert.equal(rachaAlDia(marcados, "2026-09-23"), 2);
});

test("un hueco corta la racha", () => {
  const marcados = new Set(["2026-09-20", "2026-09-22", "2026-09-23"]);
  assert.equal(rachaAlDia(marcados, "2026-09-23"), 2);
});

test("sin ninguna marca la racha es cero", () => {
  assert.equal(rachaAlDia(new Set(), "2026-09-23"), 0);
});

test("⚠️ nunca marcado NO es lo mismo que marcado hace cero días", () => {
  // Devolver 0 diría «marcó hoy». La pantalla tiene que poder distinguir
  // «lleva 8 días sin marcar» de «no consta que lo haya hecho nunca».
  assert.equal(diasSinMarcar([], "2026-09-23"), null);
  assert.equal(diasSinMarcar(["2026-09-15"], "2026-09-23"), 8);
  assert.equal(diasSinMarcar(["2026-09-15", "2026-09-23"], "2026-09-23"), 0);
});

test("el mes se corre por meses, no por días", () => {
  assert.equal(mesDe("2026-09-22"), "2026-09");
  assert.equal(correrMes("2026-09", -1), "2026-08");
  assert.equal(correrMes("2026-12", 1), "2027-01");
  assert.equal(correrMes("2026-01", -1), "2025-12");
  assert.equal(correrMes("2026-09", -12), "2025-09");
});

test("los días de un mes son todos los suyos, ni uno más", () => {
  assert.equal(diasDelMes("2026-09").length, 30);
  assert.equal(diasDelMes("2026-02").length, 28);
  assert.equal(diasDelMes("2028-02").length, 29, "2028 es bisiesto");
  assert.equal(diasDelMes("2026-09").at(-1), "2026-09-30");
});

test("⚠️ la rejilla empieza en LUNES y los huecos van vacíos", () => {
  // El 1 de septiembre de 2026 es martes, así que hay un solo hueco delante.
  // Si ahí se pintara el 31 de agosto, alguien lo marcaría desde el calendario
  // de septiembre y esa marca caería en un mes que no se está mirando.
  const rejilla = rejillaDelMes("2026-09");
  assert.equal(rejilla[0], null);
  assert.equal(rejilla[1], "2026-09-01");
  assert.equal(rejilla.length, 31);
});

test("un mes que empieza en domingo lleva seis huecos", () => {
  // 1 de noviembre de 2026 es domingo: con la semana en lunes, es la última
  // casilla de la primera fila.
  const rejilla = rejillaDelMes("2026-11");
  assert.equal(rejilla.filter((d) => d === null).length, 6);
  assert.equal(rejilla[6], "2026-11-01");
});

test("⚠️ los nombres se arman sin Date, para que no se corra el día", () => {
  // Pasar una fecha civil por un formateador con zona horaria la correría un
  // día hacia atrás —y con él, a veces, el mes entero— que es la segunda mitad
  // de la trampa del 8-sep-2026.
  assert.equal(mesLegible("2026-09"), "Septiembre de 2026");
  assert.equal(diaCivilCorto("2026-09-01"), "1 sep");
  assert.equal(diaCivilLargo("2026-09-22"), "Martes 22 de septiembre");
});
