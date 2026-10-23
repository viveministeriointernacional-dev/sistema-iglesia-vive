import assert from "node:assert/strict";
import test from "node:test";
import {
  armarAvisos,
  armarAvisosPorHora,
  armadorDelEnvio,
  asuntoDelCorreo,
  cuandoDelEnvio,
  faltaUnaHora,
  minutosDeHHmm,
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

// ------------------------------------------- el aviso de una hora antes (23-oct)

test("minutosDeHHmm lee la hora y rechaza lo que no es una hora", () => {
  assert.equal(minutosDeHHmm("00:00"), 0);
  assert.equal(minutosDeHHmm("07:00"), 420);
  assert.equal(minutosDeHHmm("08:34"), 514);
  assert.equal(minutosDeHHmm("23:59"), 1439);
  for (const malo of ["", "7:00", "24:00", "08:60", "ocho", "08:34:00"]) {
    assert.equal(minutosDeHHmm(malo), null, `«${malo}» no es una hora`);
  }
});

// La ventana es (45, 60]: el aviso sale en el primer disparo que cae dentro, y
// los dos siguientes se topan con el índice único.
test("la ventana son los 60 a 45 minutos antes, con el tope incluido", () => {
  // Una casa a las 08:00, con el cron de cada 5 minutos.
  assert.equal(faltaUnaHora("08:00", "06:55"), false, "65 min: todavía no");
  assert.equal(faltaUnaHora("08:00", "07:00"), true, "60 min justos: SÍ, el tope entra");
  assert.equal(faltaUnaHora("08:00", "07:05"), true, "55 min");
  assert.equal(faltaUnaHora("08:00", "07:14"), true, "46 min, el último que entra");
  assert.equal(faltaUnaHora("08:00", "07:15"), false, "45 min: ya salió en los disparos de antes");
  assert.equal(faltaUnaHora("08:00", "07:59"), false, "1 min antes: demasiado tarde");
  assert.equal(faltaUnaHora("08:00", "08:00"), false, "ya empezó");
  assert.equal(faltaUnaHora("08:00", "09:00"), false, "ya pasó");
});

// Las horas de verdad de la base, que no son redondas: 08:34 y 18:39.
test("una casa a una hora rara también cae en exactamente una ventana", () => {
  const dentro = ["07:35", "07:40", "07:45"].filter((t) => faltaUnaHora("08:34", t));
  assert.deepEqual(dentro, ["07:35", "07:40", "07:45"], "tres oportunidades, por si un disparo se salta");
  assert.equal(faltaUnaHora("08:34", "07:30"), false, "64 min: fuera");
  assert.equal(faltaUnaHora("08:34", "07:50"), false, "44 min: fuera");
  // Y la de las 18:39, la casa más tardía con minutos raros.
  assert.equal(faltaUnaHora("18:39", "17:40"), true);
  assert.equal(faltaUnaHora("18:39", "17:30"), false);
});

// ⚠️ LA LIMITACIÓN, ESCRITA A PROPÓSITO. Una casa entre medianoche y la 1:00
// tendría su marca el día anterior y aquí la resta sale negativa. Hoy la casa
// más temprana de las 58 empieza a las 06:00, así que el caso no existe — pero
// si alguien la crea, NO falla: simplemente no recibe este aviso, y sigue
// recibiendo el de la noche anterior.
test("no cruza la medianoche, y eso no revienta nada", () => {
  assert.equal(faltaUnaHora("00:30", "23:30"), false);
  assert.equal(faltaUnaHora("00:30", "00:00"), false, "30 min: fuera de la ventana igual");
  // La de las 06:00, que es la más temprana que existe, sí funciona.
  assert.equal(faltaUnaHora("06:00", "05:05"), true);
  // Y le sigue tocando el envío de la noche anterior.
  assert.equal(envioQueLeToca("00:30"), "NOCHE_ANTES");
});

test("una hora mal escrita no manda nada, en vez de mandar a destiempo", () => {
  assert.equal(faltaUnaHora("8:00", "07:00"), false);
  assert.equal(faltaUnaHora("08:00", ""), false);
});

// ⚠️ Lo que separa este envío de los otros dos: UNO POR CASA, no uno por día.
test("el aviso de una hora antes es uno por casa, con su grupoId", () => {
  const dos = armarAvisosPorHora([
    { usuarioId: "u1", nombre: "Paola Alejandra Viveros", correo: "p@x.co", contactoCrm: "c1",
      papel: "LIDER", casa: casa({ hora: "10:00", nombre: "Luisa Quintero", id: "g1" }) },
    { usuarioId: "u1", nombre: "Paola Alejandra Viveros", correo: "p@x.co", contactoCrm: "c1",
      papel: "LIDER", casa: casa({ hora: "14:30", nombre: "María Camila", id: "g2" }) },
  ]);
  assert.equal(dos.length, 2, "dos casas de la misma persona son dos avisos");
  assert.deepEqual(dos.map((a: Aviso) => a.grupoId), ["g1", "g2"]);
  assert.deepEqual(dos.map((a: Aviso) => a.propias.length), [1, 1]);
  assert.deepEqual(dos.map((a: Aviso) => a.deLinea.length), [0, 0]);
});

// La medida del 23-oct: con el mentor dentro, una persona recibiría 11 avisos en
// un día. La regla vive en la función, no solo en quien la llama.
test("el aviso de una hora antes NO va al mentor, lo pida quien lo pida", () => {
  const avisos = armarAvisosPorHora([
    { usuarioId: "mentor", nombre: "Jairo Esquivel", correo: "j@x.co", contactoCrm: "c9",
      papel: "MENTOR", casa: casa({ hora: "10:00", id: "g1" }) },
    { usuarioId: "lider", nombre: "Paola Alejandra", correo: "p@x.co", contactoCrm: "c1",
      papel: "LIDER", casa: casa({ hora: "10:00", id: "g1" }) },
    { usuarioId: "encargado", nombre: "Juan Felipe", correo: "f@x.co", contactoCrm: "c2",
      papel: "ENCARGADO", casa: casa({ hora: "10:00", id: "g1" }) },
  ]);
  assert.deepEqual(avisos.map((a: Aviso) => a.usuarioId), ["encargado", "lider"]);
});

test("el mismo par persona-casa no se duplica aunque llegue dos veces", () => {
  const avisos = armarAvisosPorHora([
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null,
      papel: "LIDER", casa: casa({ hora: "10:00", id: "g1" }) },
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null,
      papel: "ENCARGADO", casa: casa({ hora: "10:00", id: "g1" }) },
  ]);
  assert.equal(avisos.length, 1);
});

// Los dos envíos diarios siguen escribiendo `""`, que es lo que mantiene su
// idempotencia de siempre (uno por persona y día).
test("los avisos diarios llevan grupoId vacío", () => {
  const avisos = armarAvisos([
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null,
      papel: "LIDER", casa: casa({ hora: "10:00", id: "g1" }) },
    { usuarioId: "u1", nombre: "Ana", correo: null, contactoCrm: null,
      papel: "LIDER", casa: casa({ hora: "14:00", id: "g2" }) },
  ]);
  assert.equal(avisos.length, 1, "las dos casas caben en un solo aviso del día");
  assert.equal(avisos[0].grupoId, "");
});

// ----------------------------------------------------- cómo se nombra el momento

test("cada envío nombra su momento, y encaja en las tres frases", () => {
  assert.equal(cuandoDelEnvio("DIA"), "Hoy");
  assert.equal(cuandoDelEnvio("NOCHE_ANTES"), "Mañana");
  assert.equal(cuandoDelEnvio("UNA_HORA_ANTES"), "En una hora");
});

test("el asunto y el WhatsApp del aviso de una hora antes se leen bien", () => {
  const aviso: Aviso = {
    usuarioId: "u1",
    nombre: "Alejandro Facundo",
    correo: "a@x.co",
    contactoCrm: "c1",
    propias: [casa({ hora: "07:00", nombre: "JEISON Y LORENA", miembros: 5, id: "g1" })],
    deLinea: [],
    grupoId: "g1",
  };
  assert.equal(
    asuntoDelCorreo(aviso, "UNA_HORA_ANTES"),
    "En una hora tienes Casa de Fe · 7:00 a. m.",
  );
  const texto = variableDeWhatsApp(aviso, "UNA_HORA_ANTES");
  assert.equal(texto, "En una hora tienes Casa de Fe: 7:00 a. m. - JEISON Y LORENA (5 miembros)");
  // La regla que gobierna todo el WhatsApp: una sola línea (§6).
  assert.ok(!/[\n\t]/.test(texto));
  assert.ok(!/ {4}/.test(texto));
});

test("el tercer tipo se acepta por la query y los otros dos siguen valiendo", () => {
  assert.equal(tipoValido("UNA_HORA_ANTES"), "UNA_HORA_ANTES");
  assert.equal(tipoValido("DIA"), "DIA");
  assert.equal(tipoValido("NOCHE_ANTES"), "NOCHE_ANTES");
  assert.equal(tipoValido("una_hora_antes"), null);
  assert.equal(tipoValido("UNA_HORA"), null);
  assert.equal(TIPOS_DE_ENVIO.length, 3);
});

// ⚠️ ESTA PRUEBA EXISTE PORQUE AL ROMPER EL MOTOR A PROPÓSITO NO FALLABA NADA.
// El 23-oct cambié el armador del camino de `UNA_HORA_ANTES` por el de los
// resúmenes: `tsc` pasó y las 32 pruebas pasaron. El fallo habría sido
// silencioso y grave — quien lleva dos casas recibiría UN aviso al día en vez
// de uno por casa, porque el `grupoId` vacío choca con el índice único.
test("cada envío usa su armador, y se nota en el grupoId", () => {
  const filas = [
    { usuarioId: "u1", nombre: "Paola", correo: null, contactoCrm: null,
      papel: "LIDER" as const, casa: casa({ hora: "10:00", id: "g1" }) },
    { usuarioId: "u1", nombre: "Paola", correo: null, contactoCrm: null,
      papel: "LIDER" as const, casa: casa({ hora: "14:30", id: "g2" }) },
  ];

  const unaHora = armadorDelEnvio("UNA_HORA_ANTES")(filas);
  assert.equal(unaHora.length, 2, "una hora antes: un aviso POR CASA");
  assert.deepEqual(unaHora.map((a: Aviso) => a.grupoId), ["g1", "g2"]);

  for (const tipo of ["DIA", "NOCHE_ANTES"] as const) {
    const diario = armadorDelEnvio(tipo)(filas);
    assert.equal(diario.length, 1, `${tipo}: un aviso por PERSONA`);
    assert.equal(diario[0].grupoId, "", `${tipo}: grupoId vacío`);
    assert.equal(diario[0].propias.length, 2);
  }
});

// ⚠️ EL CASO REAL QUE OBLIGÓ A AGRUPAR POR HORA Y NO POR CASA. Alejandro
// Facundo lleva los lunes DOS casas a las 7:00 p. m.: agrupando por casa
// recibiría dos WhatsApps en el mismo minuto, que no se lee como un
// recordatorio sino como un sistema roto. Lo encontró dibujarlo con los datos
// de producción, no leyendo el código (§12.5).
test("dos casas a la misma hora son UN aviso que nombra las dos", () => {
  const avisos = armarAvisosPorHora([
    { usuarioId: "alejo", nombre: "Alejandro Facundo", correo: "a@x.co", contactoCrm: "c1",
      papel: "LIDER", casa: casa({ hora: "19:00", nombre: "Casa de Fe (Sur Casa Cristian)", miembros: 7, id: "7cee5c85" }) },
    { usuarioId: "alejo", nombre: "Alejandro Facundo", correo: "a@x.co", contactoCrm: "c1",
      papel: "LIDER", casa: casa({ hora: "19:00", nombre: "CASA DE FE GRUPAL SUR", miembros: 6, id: "3f30b27c" }) },
  ]);
  assert.equal(avisos.length, 1, "un solo aviso, no dos");
  assert.equal(avisos[0].propias.length, 2);
  const texto = variableDeWhatsApp(avisos[0], "UNA_HORA_ANTES");
  assert.ok(texto.includes("2 Casas de Fe"), texto);
  assert.ok(texto.includes("CASA DE FE GRUPAL SUR"), texto);
  assert.ok(texto.includes("Sur Casa Cristian"), texto);
  assert.equal(asuntoDelCorreo(avisos[0], "UNA_HORA_ANTES"), "En una hora tienes 2 Casas de Fe");
});

// Pero dos casas a horas DISTINTAS siguen siendo dos avisos, cada uno a su hora.
test("dos casas a horas distintas siguen siendo dos avisos", () => {
  const avisos = armarAvisosPorHora([
    { usuarioId: "paola", nombre: "Paola Alejandra", correo: "p@x.co", contactoCrm: "c1",
      papel: "LIDER", casa: casa({ hora: "10:00", id: "g1" }) },
    { usuarioId: "paola", nombre: "Paola Alejandra", correo: "p@x.co", contactoCrm: "c1",
      papel: "LIDER", casa: casa({ hora: "14:30", id: "g2" }) },
  ]);
  assert.equal(avisos.length, 2);
  assert.deepEqual(avisos.map((a: Aviso) => a.grupoId), ["g1", "g2"]);
});

// ⚠️ La clave tiene que ser la MISMA en los tres disparos de la ventana. Si
// dependiera del orden en que llegan las filas, un orden distinto daría una
// clave distinta, el índice único no reconocería el aviso ya mandado y saldría
// dos veces. Por eso es el id más bajo, no «el primero que llegó».
test("la clave de idempotencia no depende del orden de las filas", () => {
  const unaCasa = { hora: "19:00", nombre: "Sur", id: "7cee5c85" };
  const otra = { hora: "19:00", nombre: "Grupal", id: "3f30b27c" };
  const base = { usuarioId: "alejo", nombre: "Alejandro", correo: null, contactoCrm: null, papel: "LIDER" as const };

  const unOrden = armarAvisosPorHora([
    { ...base, casa: casa(unaCasa) },
    { ...base, casa: casa(otra) },
  ]);
  const otroOrden = armarAvisosPorHora([
    { ...base, casa: casa(otra) },
    { ...base, casa: casa(unaCasa) },
  ]);
  assert.equal(unOrden[0].grupoId, otroOrden[0].grupoId, "la misma clave en los dos órdenes");
  assert.equal(unOrden[0].grupoId, "3f30b27c", "el id más bajo");
});
