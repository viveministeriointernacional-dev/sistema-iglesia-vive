import assert from "node:assert/strict";
import test from "node:test";
import {
  armarCsv,
  campoCsv,
  coincideConLaBusqueda,
  filtroValido,
  pasaElFiltro,
  resumirTestimonios,
  validarTestimonio,
  FILTROS,
  VACIO,
} from "./testimonios-catalogo";

const bueno = {
  nombre: "  Marta   Lucía Cerquera ",
  celular: "310 555 0182",
  edad: 54,
  milagro: "  El médico no encontró nada en el último examen. ",
};

test("un testimonio completo pasa, y se guarda limpio", () => {
  const r = validarTestimonio(bueno);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.limpio.nombre, "Marta Lucía Cerquera");
  assert.equal(r.limpio.milagro, "El médico no encontró nada en el último examen.");
  assert.equal(r.limpio.edad, 54);
});

test("cada campo dice su propio error, de arriba abajo", () => {
  const msj = (d: Partial<typeof bueno>) => {
    const r = validarTestimonio({ ...bueno, ...d });
    return r.ok ? null : r.mensaje;
  };
  assert.equal(msj({ nombre: " M " }), "Escribe tu nombre.");
  assert.equal(msj({ celular: "300 12" }), "Escribe un número de celular válido.");
  assert.equal(msj({ edad: 0 }), "Escribe tu edad.");
  assert.equal(msj({ edad: 121 }), "Escribe tu edad.");
  assert.equal(msj({ edad: Number.NaN }), "Escribe tu edad.");
  assert.equal(msj({ edad: 30.5 }), "Escribe tu edad.");
  assert.equal(msj({ milagro: " paz " }), "Cuéntanos tu milagro.");
  assert.match(msj({ milagro: "a".repeat(4001) }) ?? "", /4000/);
  // Con todo mal, sale el primero: el nombre.
  assert.equal(msj({ nombre: "", celular: "", milagro: "" }), "Escribe tu nombre.");
});

test("el recuadro y su lista se cuentan con la misma regla", () => {
  const ahora = new Date("2026-11-15T15:00:00Z");
  const dias = (n: number) => new Date(ahora.getTime() - n * 86_400_000);
  const lista = [
    { recibidoEl: dias(1), contactadoEl: null },
    { recibidoEl: dias(7), contactadoEl: null }, // justo en el borde: cuenta
    { recibidoEl: dias(8), contactadoEl: dias(2) },
    { recibidoEl: dias(30), contactadoEl: null },
  ];
  const resumen = resumirTestimonios(lista, ahora);
  assert.deepEqual(resumen, { pendientes: 3, estaSemana: 2, recibidos: 4 });
  assert.equal(lista.filter((t) => pasaElFiltro(t, "pendientes", ahora)).length, resumen.pendientes);
  assert.equal(lista.filter((t) => pasaElFiltro(t, "semana", ahora)).length, resumen.estaSemana);
  assert.equal(lista.filter((t) => pasaElFiltro(t, "todos", ahora)).length, resumen.recibidos);
  assert.equal(lista.filter((t) => pasaElFiltro(t, "contactados", ahora)).length, 1);
});

test("un filtro desconocido cae en «sin contactar», y todos tienen su texto de vacío", () => {
  assert.equal(filtroValido(undefined), "pendientes");
  assert.equal(filtroValido("cualquiera"), "pendientes");
  assert.equal(filtroValido("todos"), "todos");
  for (const f of FILTROS) assert.ok(VACIO[f.id].length > 0);
});

test("la búsqueda no mira tildes ni mayúsculas, y en el celular solo los dígitos", () => {
  const t = { nombre: "Gloria Esperanza Tovar", celular: "+57 315 555 0923" };
  assert.ok(coincideConLaBusqueda(t, "esperanza"));
  assert.ok(coincideConLaBusqueda(t, "GLÓRIA"));
  assert.ok(coincideConLaBusqueda(t, "315 555"));
  assert.ok(coincideConLaBusqueda(t, ""));
  assert.ok(!coincideConLaBusqueda(t, "marta"));
  // Dos dígitos sueltos no bastan: casarían con casi cualquiera.
  assert.ok(!coincideConLaBusqueda({ nombre: "Ana", celular: "3105550182" }, "55"));
});

test("el CSV no deja pasar fórmulas de Excel y dobla las comillas", () => {
  assert.equal(campoCsv("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(campoCsv("@SUM(A1)"), `"'@SUM(A1)"`);
  assert.equal(campoCsv("-1+1"), `"'-1+1"`);
  assert.equal(campoCsv("Dios es bueno"), `"Dios es bueno"`);
  assert.equal(campoCsv(54), `"54"`);
  assert.equal(campoCsv(null), `""`);
});

test("el CSV lleva el BOM para que Excel lea las tildes, y una fila por testimonio", () => {
  const csv = armarCsv([
    {
      fecha: "14 nov 2026, 8:12 p. m.",
      nombre: "Marta Lucía",
      celular: "3105550182",
      edad: 54,
      milagro: "Línea uno\nlínea dos",
      contactado: "Sí",
      contactadoPor: "Paola Viveros",
    },
  ]);
  assert.ok(csv.startsWith("﻿\"Fecha\""));
  // El salto de línea dentro del testimonio va entre comillas, así que la fila
  // sigue siendo una sola para Excel.
  assert.ok(csv.includes(`"Línea uno\nlínea dos"`));
  assert.equal(csv.split("\r\n").length, 3); // cabecera, fila, y el final vacío
});
