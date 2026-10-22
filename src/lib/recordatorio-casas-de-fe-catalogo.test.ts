import assert from "node:assert/strict";
import test from "node:test";
import {
  armarAvisos,
  asuntoDelCorreo,
  type Aviso,
  type CasaDelAviso,
  cuantasCasas,
  envioQueLeToca,
  HORA_TOPE_MANANA,
  nombreDePila,
  variableDeWhatsApp,
  TIPOS_DE_ENVIO,
  tipoValido,
} from "./recordatorio-casas-de-fe-catalogo";

function casa(parcial: Partial<CasaDelAviso> & { hora: string }): CasaDelAviso {
  return {
    id: `c-${parcial.hora}-${parcial.nombre ?? ""}`,
    nombre: "Casa de Fe Norte",
    miembros: 6,
    direccion: "Carrera 9 #21-14",
    comoLlegar: "https://maps.example/x",
    lider: "Esteban Lozano",
    ...parcial,
  };
}

// ----------------------------------------------- qué envío le toca a una hora

/// Las tres casas reales que obligaron a que exista el envío de la noche
/// anterior. Medidas el 20-oct en producción.
test("las casas de madrugada se avisan la noche anterior", () => {
  assert.equal(envioQueLeToca("06:00"), "NOCHE_ANTES");
  assert.equal(envioQueLeToca("07:00"), "NOCHE_ANTES");
  assert.equal(envioQueLeToca("08:34"), "NOCHE_ANTES");
});

test("las demás se avisan la mañana del mismo día", () => {
  for (const hora of ["09:00", "10:00", "14:30", "19:00", "20:30", "21:00"]) {
    assert.equal(envioQueLeToca(hora), "DIA", `${hora} debería ir en el envío del día`);
  }
});

/// El caso borde, que es el que decide: las 9:00 en punto van con el día.
test("el tope está EN las 9:00, no antes", () => {
  assert.equal(HORA_TOPE_MANANA, "09:00");
  assert.equal(envioQueLeToca("08:59"), "NOCHE_ANTES");
  assert.equal(envioQueLeToca("09:00"), "DIA");
});

/// **La prueba que impide el doble aviso.** Cada hora del reloj cae en UNO de
/// los dos envíos y nunca en los dos: si esta propiedad se rompiera, alguien
/// recibiría el mismo recordatorio dos veces y nada lo delataría.
test("ninguna hora del reloj cae en los dos envíos ni en ninguno", () => {
  for (let h = 0; h < 24; h += 1) {
    for (const m of ["00", "15", "30", "34", "45", "59"]) {
      const hora = `${String(h).padStart(2, "0")}:${m}`;
      const toca = envioQueLeToca(hora);
      assert.ok(TIPOS_DE_ENVIO.includes(toca), `${hora} no cayó en ningún envío`);
      const elOtro = toca === "DIA" ? "NOCHE_ANTES" : "DIA";
      assert.notEqual(toca, elOtro);
    }
  }
});

test("tipoValido no deja pasar cualquier cosa", () => {
  assert.equal(tipoValido("DIA"), "DIA");
  assert.equal(tipoValido("NOCHE_ANTES"), "NOCHE_ANTES");
  assert.equal(tipoValido("dia"), null);
  assert.equal(tipoValido("MAÑANA"), null);
  assert.equal(tipoValido(undefined), null);
  assert.equal(tipoValido(null), null);
});

// ------------------------------------------------- un aviso por persona y día

test("el líder con tres casas recibe UN aviso con las tres, por hora", () => {
  const avisos = armarAvisos([
    { usuarioId: "u1", nombre: "Esteban Lozano", correo: "e@x.co", contactoCrm: "C1", papel: "LIDER", casa: casa({ hora: "19:00", nombre: "Sur" }) },
    { usuarioId: "u1", nombre: "Esteban Lozano", correo: "e@x.co", contactoCrm: "C1", papel: "LIDER", casa: casa({ hora: "10:00", nombre: "Norte" }) },
    { usuarioId: "u1", nombre: "Esteban Lozano", correo: "e@x.co", contactoCrm: "C1", papel: "LIDER", casa: casa({ hora: "17:00", nombre: "Los Alpes" }) },
  ]);

  assert.equal(avisos.length, 1, "tres casas de la misma persona son UN aviso");
  assert.deepEqual(
    avisos[0].propias.map((c) => c.hora),
    ["10:00", "17:00", "19:00"],
  );
  assert.equal(avisos[0].deLinea.length, 0);
  assert.equal(cuantasCasas(avisos[0]), 3);
});

/// ⚠️ **El caso que justifica agrupar por persona y no por papel.** Rosa lleva
/// una casa y además acompaña a otros dos líderes: agrupando por papel recibiría
/// DOS correos el mismo día.
test("quien lidera Y acompaña recibe un solo aviso, con las dos listas", () => {
  const avisos = armarAvisos([
    { usuarioId: "rosa", nombre: "Rosa Delgado", correo: "r@x.co", contactoCrm: "C9", papel: "LIDER", casa: casa({ hora: "16:00", nombre: "La Toma" }) },
    { usuarioId: "rosa", nombre: "Rosa Delgado", correo: "r@x.co", contactoCrm: "C9", papel: "MENTOR", casa: casa({ hora: "10:00", nombre: "Norte" }) },
    { usuarioId: "rosa", nombre: "Rosa Delgado", correo: "r@x.co", contactoCrm: "C9", papel: "MENTOR", casa: casa({ hora: "19:00", nombre: "Sur" }) },
  ]);

  assert.equal(avisos.length, 1);
  assert.deepEqual(avisos[0].propias.map((c) => c.nombre), ["La Toma"]);
  assert.deepEqual(avisos[0].deLinea.map((c) => c.nombre), ["Norte", "Sur"]);
  assert.equal(cuantasCasas(avisos[0]), 3);
});

/// Quien es líder y además figura como encargado del mismo grupo la vería dos
/// veces en su propio correo.
test("la misma casa no se repite dentro de un aviso", () => {
  const laMisma = casa({ hora: "18:00", nombre: "El Jardín" });
  const avisos = armarAvisos([
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null, papel: "LIDER", casa: laMisma },
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null, papel: "ENCARGADO", casa: laMisma },
  ]);
  assert.equal(cuantasCasas(avisos[0]), 1);
});

test("el encargado cuenta la casa como suya, no como de su línea", () => {
  const avisos = armarAvisos([
    { usuarioId: "u2", nombre: "Nubia", correo: null, contactoCrm: null, papel: "ENCARGADO", casa: casa({ hora: "18:00" }) },
  ]);
  assert.equal(avisos[0].propias.length, 1);
  assert.equal(avisos[0].deLinea.length, 0);
});

test("sin casas no hay avisos", () => {
  assert.deepEqual(armarAvisos([]), []);
});

// ------------------------------------------------------------------ los textos

test("el asunto dice cuántas son, y la hora cuando es una sola", () => {
  const unaCasa = armarAvisos([
    { usuarioId: "u1", nombre: "Mariela Ossa", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "19:00" }) },
  ])[0];
  assert.equal(asuntoDelCorreo(unaCasa, "DIA"), "Hoy tienes Casa de Fe · 7:00 p. m.");
  assert.equal(asuntoDelCorreo(unaCasa, "NOCHE_ANTES"), "Mañana tienes Casa de Fe · 7:00 p. m.");

  const tres = armarAvisos([
    { usuarioId: "u1", nombre: "Esteban", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "10:00", nombre: "A" }) },
    { usuarioId: "u1", nombre: "Esteban", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "17:00", nombre: "B" }) },
    { usuarioId: "u1", nombre: "Esteban", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "19:00", nombre: "C" }) },
  ])[0];
  assert.equal(asuntoDelCorreo(tres, "DIA"), "Hoy tienes 3 Casas de Fe");
});

test("el asunto del mentor no dice «tienes», porque no tiene que ir", () => {
  const soloLinea = armarAvisos([
    { usuarioId: "m", nombre: "Rosa", correo: null, contactoCrm: null, papel: "MENTOR", casa: casa({ hora: "10:00", nombre: "A" }) },
    { usuarioId: "m", nombre: "Rosa", correo: null, contactoCrm: null, papel: "MENTOR", casa: casa({ hora: "19:00", nombre: "B" }) },
  ])[0];
  assert.equal(asuntoDelCorreo(soloLinea, "DIA"), "Tu línea tiene 2 Casas de Fe hoy");
  assert.ok(!asuntoDelCorreo(soloLinea, "DIA").includes("tienes"));
});

test("el WhatsApp va en UNA sola línea y NO lleva direcciones", () => {
  const aviso = armarAvisos([
    { usuarioId: "u1", nombre: "Esteban", correo: null, contactoCrm: "C1", papel: "LIDER", casa: casa({ hora: "10:00", nombre: "Norte", miembros: 6, direccion: "Carrera 9 #21-14" }) },
    { usuarioId: "u1", nombre: "Esteban", correo: null, contactoCrm: "C1", papel: "LIDER", casa: casa({ hora: "19:00", nombre: "Sur", miembros: 9, direccion: "Calle 48 Sur #7-02" }) },
  ])[0];

  const texto = variableDeWhatsApp(aviso, "DIA");
  assert.ok(texto.startsWith("Hoy tienes 2 Casas de Fe:"));
  assert.ok(texto.includes("10:00 a. m. - Norte (6 miembros)"));
  assert.ok(texto.includes("7:00 p. m. - Sur (9 miembros)"));
  // La dirección va solo al correo: no cabe en el resumen del celular.
  assert.ok(!texto.includes("Carrera 9"), "la dirección no debe ir en el WhatsApp");
  assert.ok(!texto.includes("Calle 48"), "la dirección no debe ir en el WhatsApp");
});

// ⚠️ La prueba que de verdad protege el envío. Meta rechaza un valor de variable
// con saltos de línea, tabuladores o cuatro espacios seguidos, y el rechazo no
// dice por qué: el mensaje simplemente no sale. Se comprueba sobre los cuatro
// casos (solo propias, solo de línea, las dos, y una sola) porque cada rama arma
// el texto por su lado.
test("ningún caso produce saltos de línea ni espacios dobles", () => {
  const propia = { usuarioId: "u", nombre: "Ana", correo: null, contactoCrm: "C", papel: "LIDER" as const };
  const deLinea = { usuarioId: "u", nombre: "Ana", correo: null, contactoCrm: "C", papel: "MENTOR" as const };

  const casos: Aviso[] = [
    armarAvisos([{ ...propia, casa: casa({ hora: "18:00", nombre: "Una" }) }])[0],
    armarAvisos([
      { ...propia, casa: casa({ hora: "06:00", nombre: "A" }) },
      { ...propia, casa: casa({ hora: "20:00", nombre: "B" }) },
    ])[0],
    armarAvisos([{ ...deLinea, casa: casa({ hora: "07:00", nombre: "C", lider: "Rosa Díaz" }) }])[0],
    armarAvisos([
      { ...propia, casa: casa({ hora: "09:00", nombre: "D" }) },
      { ...deLinea, casa: casa({ hora: "19:30", nombre: "E", lider: "Rosa Díaz" }) },
    ])[0],
  ];

  for (const aviso of casos) {
    for (const tipo of TIPOS_DE_ENVIO) {
      const texto = variableDeWhatsApp(aviso, tipo);
      assert.ok(texto.length > 0, "una variable vacía también la rechaza Meta");
      assert.ok(!/[\n\r\t]/.test(texto), `salto de línea en: ${texto}`);
      assert.ok(!/ {2}/.test(texto), `espacios seguidos en: ${texto}`);
    }
  }
});

test("si un trozo trae un salto de línea, se aplana en vez de llegar a Meta", () => {
  const aviso = armarAvisos([
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: "C", papel: "LIDER", casa: casa({ hora: "18:00", nombre: "Casa\ncon salto" }) },
  ])[0];
  const texto = variableDeWhatsApp(aviso, "DIA");
  assert.ok(!texto.includes("\n"));
  assert.ok(texto.includes("Casa con salto"));
});

test("«un miembro» en singular", () => {
  const aviso = armarAvisos([
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "18:00", miembros: 1 }) },
  ])[0];
  assert.ok(variableDeWhatsApp(aviso, "DIA").includes("(1 miembro)"));
  assert.ok(!variableDeWhatsApp(aviso, "DIA").includes("1 miembros"));
});

test("el WhatsApp del mentor nombra a quien lleva la casa, no a sus miembros", () => {
  const aviso = armarAvisos([
    { usuarioId: "m", nombre: "Rosa", correo: null, contactoCrm: "C9", papel: "MENTOR", casa: casa({ hora: "10:00", nombre: "Norte", lider: "Esteban Lozano" }) },
  ])[0];
  const texto = variableDeWhatsApp(aviso, "DIA");
  assert.ok(texto.includes("lidera Esteban Lozano"), "el mentor necesita saber a quién preguntarle");
  assert.ok(texto.includes("se reúne una casa de tu línea"));
  assert.ok(!texto.includes("tienes"), "el mentor no tiene que ir");
});

test("la noche anterior lo dice con palabras", () => {
  const aviso = armarAvisos([
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "06:00" }) },
  ])[0];
  assert.ok(variableDeWhatsApp(aviso, "NOCHE_ANTES").startsWith("Mañana tienes Casa de Fe:"));
});

test("el saludo usa el primer nombre", () => {
  assert.equal(nombreDePila("María José Rojas Puentes"), "María");
  assert.equal(nombreDePila("  Esteban   Lozano "), "Esteban");
  assert.equal(nombreDePila("Ana"), "Ana");
});

/// Probado al revés (§12.8): si el aviso del mentor y el del líder se
/// agruparan por papel en vez de por persona, esta propiedad se rompería.
test("nadie aparece dos veces en la lista de avisos", () => {
  const avisos = armarAvisos([
    { usuarioId: "rosa", nombre: "Rosa", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "16:00", nombre: "A" }) },
    { usuarioId: "rosa", nombre: "Rosa", correo: null, contactoCrm: null, papel: "MENTOR", casa: casa({ hora: "10:00", nombre: "B" }) },
    { usuarioId: "ana", nombre: "Ana", correo: null, contactoCrm: null, papel: "LIDER", casa: casa({ hora: "18:00", nombre: "C" }) },
  ]);
  const ids = avisos.map((a: Aviso) => a.usuarioId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(avisos.length, 2);
});
