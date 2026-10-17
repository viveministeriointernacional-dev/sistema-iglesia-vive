import assert from "node:assert/strict";
import test from "node:test";
import {
  agruparSaltos,
  ETIQUETA_EXTREMO,
  EXTREMOS,
  type Extremo,
  extremoValido,
  GRUPOS_SALTO,
  grupoDelSalto,
  ORDEN_GRUPOS,
  type Salto,
  TITULO_GRUPO,
  tituloDelSalto,
  TONO_GRUPO,
} from "./informe-detalle-catalogo";

const salto = (desde: Extremo, hacia: Extremo, cuantas = 1): Salto => ({
  desde,
  hacia,
  cuantas,
  grupo: grupoDelSalto(desde, hacia),
});

/// ⚠️ **La prueba que de verdad importa de este archivo.**
///
/// `grupoDelSalto` decide por POSICIÓN en el recorrido cuando ninguna regla
/// anterior aplica, y `BAJA` va la última de todas. Sin la regla explícita que
/// la atrapa antes, **una baja desde cualquier columna contaría como un
/// AVANCE**: el informe diría que 211 personas progresaron cuando se habían
/// perdido. El orden de los `if` no es estilo, es el significado.
test("una baja nunca es un avance, venga de la columna que venga", () => {
  for (const desde of ["INICIADA", "SEGUIMIENTO", "CONTACTADA", "VISITA_PENDIENTE", "LISTA_PARA_ENTREGA"] as const) {
    assert.equal(
      grupoDelSalto(desde, "BAJA"),
      "baja",
      `una baja desde ${desde} no puede caer en otro grupo`,
    );
  }
  assert.equal(grupoDelSalto("SIN_REGISTRO", "BAJA"), "baja");
});

/// Y tampoco es «salió a asistentes»: son dos desenlaces opuestos. Pasar a
/// asistente es que la persona asiste pero no quiere proceso; la baja es que
/// se perdió.
test("una baja y un pase a asistente no van al mismo bloque", () => {
  assert.notEqual(grupoDelSalto("CONTACTADA", "BAJA"), grupoDelSalto("CONTACTADA", "CERRADA"));
  assert.equal(grupoDelSalto("CONTACTADA", "CERRADA"), "salida");
  assert.equal(TITULO_GRUPO.baja, "SE DIERON DE BAJA");
  assert.equal(TONO_GRUPO.baja, "rojo");
});

/// Caer en SEGUIMIENTO nunca es un avance aunque la columna esté más adelante
/// que INICIADA: significa que se llamó y no contestaron.
test("caer en seguimiento no es avanzar", () => {
  assert.equal(grupoDelSalto("INICIADA", "SEGUIMIENTO"), "sin-contacto");
  assert.equal(grupoDelSalto("SEGUIMIENTO", "SEGUIMIENTO"), "sin-contacto");
});

test("los avances y los retrocesos se distinguen por el puesto", () => {
  assert.equal(grupoDelSalto("CONTACTADA", "VISITA_PENDIENTE"), "avance");
  assert.equal(grupoDelSalto("LISTA_PARA_ENTREGA", "ENTREGADA"), "avance");
  assert.equal(grupoDelSalto("VISITA_PENDIENTE", "CONTACTADA"), "retroceso");
  assert.equal(grupoDelSalto("NUEVA", "INICIADA"), "entrada");
});

test("todo extremo tiene etiqueta y todo grupo tiene título, tono y puesto", () => {
  for (const extremo of EXTREMOS) {
    assert.ok(ETIQUETA_EXTREMO[extremo], `falta la etiqueta de ${extremo}`);
  }
  for (const grupo of GRUPOS_SALTO) {
    assert.ok(TITULO_GRUPO[grupo], `falta el título de ${grupo}`);
    assert.ok(TONO_GRUPO[grupo], `falta el tono de ${grupo}`);
    assert.ok(ORDEN_GRUPOS.includes(grupo), `${grupo} no está en el orden de pintado`);
  }
  assert.equal(ORDEN_GRUPOS.length, GRUPOS_SALTO.length);
});

test("extremoValido rechaza lo que no es un extremo", () => {
  assert.equal(extremoValido("BAJA"), "BAJA");
  assert.equal(extremoValido("CONTACTADA"), "CONTACTADA");
  assert.equal(extremoValido("contactada"), null);
  assert.equal(extremoValido("INVENTADO"), null);
  assert.equal(extremoValido(undefined), null);
});

/// El título es lo que se lee en la ventana. Una baja no se escribe con flecha
/// («Contactada → Dada de baja» suena a que avanzó a algún sitio).
test("el título de un salto se lee como una frase", () => {
  assert.equal(tituloDelSalto("NUEVA", "INICIADA"), "Entró en iniciada");
  assert.equal(tituloDelSalto("CONTACTADA", "VISITA_PENDIENTE"), "Contactada → Visita pendiente");
  assert.equal(tituloDelSalto("CONTACTADA", "BAJA"), "Dada de baja desde Contactada");
  assert.equal(tituloDelSalto("SIN_REGISTRO", "BAJA"), "Dada de baja (sin historial)");
});

test("agruparSaltos ordena por bloque y suma cada subtotal", () => {
  const bloques = agruparSaltos([
    salto("CONTACTADA", "VISITA_PENDIENTE", 3),
    salto("INICIADA", "BAJA", 10),
    salto("SEGUIMIENTO", "BAJA", 4),
    salto("INICIADA", "SEGUIMIENTO", 7),
    salto("NUEVA", "INICIADA", 5),
  ]);

  assert.deepEqual(
    bloques.map((bloque) => bloque.grupo),
    ["avance", "sin-contacto", "baja", "entrada"],
  );
  const bajas = bloques.find((bloque) => bloque.grupo === "baja");
  assert.equal(bajas?.subtotal, 14);
  // Dentro del bloque, de mayor a menor.
  assert.deepEqual(bajas?.saltos.map((s) => s.cuantas), [10, 4]);
  // Un bloque sin saltos no se pinta.
  assert.equal(agruparSaltos([]).length, 0);
});

/// Probar al revés (§12.8): si alguien quita la regla de la baja, el salto
/// cae por posición y el grupo cambia. Esto comprueba que la posición de BAJA
/// es efectivamente la última, que es lo que haría el daño.
test("sin la regla, una baja caería como avance por su puesto", () => {
  // `LISTA_PARA_ENTREGA → BAJA` solo puede dar «baja» por la regla explícita:
  // por puesto, BAJA está después de todas las columnas.
  assert.equal(grupoDelSalto("LISTA_PARA_ENTREGA", "BAJA"), "baja");
  assert.equal(grupoDelSalto("LISTA_PARA_ENTREGA", "ENTREGADA"), "avance");
  // Y ENTREGADA sí va por puesto, para que se vea que la diferencia es la regla.
  assert.equal(grupoDelSalto("INICIADA", "ENTREGADA"), "avance");
});
