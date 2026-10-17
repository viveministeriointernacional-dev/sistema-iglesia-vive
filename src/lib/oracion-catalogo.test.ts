import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIAS_DE_LA_SEMANA,
  DIAS_DEL_MES,
  ETIQUETA_ORIGEN,
  EXPLICACION_ORIGEN,
  FILTRO_DEL_RECUADRO,
  FILTROS,
  desdeHace,
  LARGO_MAXIMO_PETICION,
  NOMBRE_RESERVADO,
  ORIGENES,
  esDePersonaNueva,
  esOrigen,
  estaPendiente,
  filtroValido,
  nombreVisible,
  peticionValida,
  resumirPeticiones,
} from "./oracion-catalogo";

const AHORA = new Date("2026-10-13T12:00:00-05:00");
const haceDias = (n: number) => new Date(AHORA.getTime() - n * 24 * 60 * 60 * 1000);

test("los cuatro orígenes tienen etiqueta y explicación", () => {
  for (const origen of ORIGENES) {
    assert.ok(ETIQUETA_ORIGEN[origen], `falta la etiqueta de ${origen}`);
    assert.ok(EXPLICACION_ORIGEN[origen], `falta la explicación de ${origen}`);
  }
  assert.equal(ORIGENES.length, 4);
});

test("un origen inventado no pasa", () => {
  assert.equal(esOrigen("REGISTRO"), true);
  assert.equal(esOrigen("LO_QUE_SEA"), false);
});

test("el filtro cae en «pendientes» cuando llega cualquier cosa", () => {
  assert.equal(filtroValido("atendidas"), "atendidas");
  assert.equal(filtroValido("todas"), "todas");
  assert.equal(filtroValido("pendientes"), "pendientes");
  assert.equal(filtroValido(null), "pendientes");
  assert.equal(filtroValido("inventado"), "pendientes");
});

test("una reservada enseña «Reservada» y nunca el nombre", () => {
  assert.equal(
    nombreVisible({ nombre: "María Gómez", reservada: true }),
    NOMBRE_RESERVADO,
  );
  assert.equal(
    nombreVisible({ nombre: "María Gómez", reservada: false }),
    "María Gómez",
  );
});

test("sin nombre tampoco se deja el renglón en blanco", () => {
  // Un hueco donde va el nombre parece un error del sistema.
  assert.equal(nombreVisible({ nombre: null, reservada: false }), NOMBRE_RESERVADO);
});

test("pendiente es no tener fecha de oración", () => {
  assert.equal(estaPendiente({ oradaEl: null }), true);
  assert.equal(estaPendiente({ oradaEl: haceDias(1) }), false);
});

test("solo es «de persona nueva» si viene del registro Y sigue pendiente", () => {
  assert.equal(esDePersonaNueva({ origen: "REGISTRO", oradaEl: null }), true);
  // Ya se oró: deja de ser urgente aunque venga del registro.
  assert.equal(esDePersonaNueva({ origen: "REGISTRO", oradaEl: haceDias(1) }), false);
  // Pendiente pero no es alguien que acaba de llegar.
  assert.equal(esDePersonaNueva({ origen: "PERSONA", oradaEl: null }), false);
  assert.equal(esDePersonaNueva({ origen: "HISTORICO", oradaEl: null }), false);
});

test("el resumen cuenta las cuatro cifras", () => {
  const resumen = resumirPeticiones(
    [
      { origen: "REGISTRO", pedidaEl: haceDias(1), oradaEl: null },
      { origen: "PERSONA", pedidaEl: haceDias(2), oradaEl: null },
      { origen: "EQUIPO", pedidaEl: haceDias(3), oradaEl: haceDias(1) },
      { origen: "HISTORICO", pedidaEl: haceDias(60), oradaEl: haceDias(10) },
      { origen: "HISTORICO", pedidaEl: haceDias(90), oradaEl: haceDias(80) },
    ],
    AHORA,
  );
  assert.equal(resumen.pendientes, 2);
  assert.equal(resumen.estaSemana, 3); // las de 1, 2 y 3 días
  assert.equal(resumen.atendidasEsteMes, 2); // las oradas hace 1 y 10 días
  assert.equal(resumen.dePersonasNuevas, 1);
});

test("«esta semana» son 7 días, y el borde cuenta", () => {
  const dentro = resumirPeticiones(
    [{ origen: "PERSONA", pedidaEl: haceDias(7), oradaEl: null }],
    AHORA,
  );
  assert.equal(dentro.estaSemana, 1);
  const fuera = resumirPeticiones(
    [{ origen: "PERSONA", pedidaEl: haceDias(8), oradaEl: null }],
    AHORA,
  );
  assert.equal(fuera.estaSemana, 0);
});

test("una petición vieja ya atendida no ensucia ninguna cifra", () => {
  const resumen = resumirPeticiones(
    [{ origen: "HISTORICO", pedidaEl: haceDias(200), oradaEl: haceDias(150) }],
    AHORA,
  );
  assert.deepEqual(resumen, {
    pendientes: 0,
    estaSemana: 0,
    atendidasEsteMes: 0,
    dePersonasNuevas: 0,
  });
});

test("una petición de una sola palabra es válida", () => {
  // «fe» no, pero «paz» sí: quien escribe desde el dolor no tiene que rellenar.
  assert.equal(peticionValida("paz").ok, true);
  assert.equal(peticionValida("Por la salud de mi mamá").ok, true);
});

test("el campo vacío o un punto no pasan", () => {
  assert.equal(peticionValida("").ok, false);
  assert.equal(peticionValida("   ").ok, false);
  assert.equal(peticionValida(".").ok, false);
});

test("una petición larguísima se rechaza con su mensaje", () => {
  const resultado = peticionValida("a".repeat(LARGO_MAXIMO_PETICION + 1));
  assert.equal(resultado.ok, false);
  if (!resultado.ok) assert.match(resultado.mensaje, /muy larga/);
});

test("los espacios de los bordes no cuentan para el mínimo", () => {
  assert.equal(peticionValida("  paz  ").ok, true);
  assert.equal(peticionValida("  a  ").ok, false);
});

// --------------------------------------------- Los recuadros, que ahora filtran

/// ⚠️ **El número de un recuadro y la lista que abre tienen que contar lo
/// mismo.** Cada recuadro de la cabecera lleva a un filtro, y si alguien
/// renombrara un filtro sin tocar el mapa, el recuadro llevaría a «pendientes»
/// sin avisar: `filtroValido` traga cualquier cosa desconocida.
test("cada recuadro apunta a un filtro que existe de verdad", () => {
  for (const [recuadro, id] of Object.entries(FILTRO_DEL_RECUADRO)) {
    assert.ok(
      FILTROS.some((f) => f.id === id),
      `el recuadro ${recuadro} apunta a «${id}», que no está en FILTROS`,
    );
    // Y sobrevive al validador: si no, la URL caería en «pendientes».
    assert.equal(filtroValido(id), id, `«${id}» no sobrevive a filtroValido`);
  }
});

test("filtroValido acepta los cinco y rechaza lo demás", () => {
  for (const opcion of FILTROS) {
    assert.equal(filtroValido(opcion.id), opcion.id);
  }
  assert.equal(filtroValido("semana"), "semana");
  assert.equal(filtroValido("oradas-mes"), "oradas-mes");
  assert.equal(filtroValido("inventado"), "pendientes");
  assert.equal(filtroValido(undefined), "pendientes");
  assert.equal(filtroValido(null), "pendientes");
  assert.equal(filtroValido("__proto__"), "pendientes");
});

/// Las dos ventanas de tiempo las usan el conteo del recuadro y el `WHERE` de
/// su lista. Esta prueba es lo que impide que se separen.
test("desdeHace devuelve el límite exacto de la ventana", () => {
  const ahora = new Date("2026-10-17T15:00:00Z");
  assert.equal(
    desdeHace(DIAS_DE_LA_SEMANA, ahora).toISOString(),
    "2026-10-10T15:00:00.000Z",
  );
  assert.equal(
    desdeHace(DIAS_DEL_MES, ahora).toISOString(),
    "2026-09-17T15:00:00.000Z",
  );
  assert.equal(DIAS_DE_LA_SEMANA, 7);
  assert.equal(DIAS_DEL_MES, 30);
});

/// El recuadro cuenta con `>=` sobre el mismo instante que el filtro, así que
/// una petición justo en el borde tiene que caer del mismo lado en los dos.
test("una petición justo en el borde cuenta igual en el recuadro que en el filtro", () => {
  const ahora = new Date("2026-10-17T15:00:00Z");
  const borde = desdeHace(DIAS_DE_LA_SEMANA, ahora);
  const unMsAntes = new Date(borde.getTime() - 1);

  const dentro = resumirPeticiones(
    [{ origen: "PERSONA", pedidaEl: borde, oradaEl: null }],
    ahora,
  );
  const fuera = resumirPeticiones(
    [{ origen: "PERSONA", pedidaEl: unMsAntes, oradaEl: null }],
    ahora,
  );

  assert.equal(dentro.estaSemana, 1, "justo en el borde SÍ entra, como el gte de la consulta");
  assert.equal(fuera.estaSemana, 0, "un milisegundo antes queda fuera");
});
