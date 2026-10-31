import assert from "node:assert/strict";
import test from "node:test";
import {
  asuntoDeInscripcion,
  type CasaDeLaInscripcion,
  CONFIRMACION_SIN_CASA,
  cuandoSeReune,
  dondeSeReune,
  fraseDeInscripcion,
  avisoDeDatosQueFaltan,
  loQueFaltaDeLaCasa,
  participioDeInscripcion,
  queLlevar,
  SIN_DIA_NI_HORA,
  SIN_DIRECCION,
  variableDeConfirmacion,
} from "./casa-de-fe-bienvenida-catalogo";

function casa(parcial: Partial<CasaDeLaInscripcion> = {}): CasaDeLaInscripcion {
  return {
    nombre: "CASA DE FE GRUPAL SUR",
    weekday: 4,
    meetingTime: "16:00",
    everyNWeeks: 1,
    address: "Carrera 9 #21-14",
    latitude: null,
    longitude: null,
    lider: "Paola Alejandra Viveros de Carvajal",
    liderDePila: "Paola Alejandra",
    ...parcial,
  };
}

test("el participio sale de la ficha, y sin dato no se inventa", () => {
  assert.equal(participioDeInscripcion("MUJER"), "inscrita");
  assert.equal(participioDeInscripcion("HOMBRE"), "inscrito");
  assert.equal(participioDeInscripcion(null), null);
  assert.equal(participioDeInscripcion(undefined), null);
});

test("la frase usa el género cuando se sabe", () => {
  assert.equal(
    fraseDeInscripcion({ nombreDePila: "Luisa", genero: "MUJER", casa: "Casa Norte" }),
    "Hola Luisa, quedaste inscrita en la Casa de Fe «Casa Norte».",
  );
  assert.equal(
    fraseDeInscripcion({ nombreDePila: "Jeison", genero: "HOMBRE", casa: "Casa Norte" }),
    "Hola Jeison, quedaste inscrito en la Casa de Fe «Casa Norte».",
  );
});

// ⚠️ 6 de los 58 miembros de Casa de Fe no tienen el género puesto (22-oct).
// El texto neutro tiene que decir lo mismo sin acertar ni fallar el género.
test("sin género, el texto es neutro y no dice «inscrito» ni «inscrita»", () => {
  const frase = fraseDeInscripcion({ nombreDePila: "Alex", genero: null, casa: "Casa Norte" });
  assert.equal(frase, "Hola Alex, ya estás en la Casa de Fe «Casa Norte».");
  assert.ok(!frase.includes("inscrit"));
});

test("el asunto lleva el día y la hora, que es lo único que se ve en el celular", () => {
  assert.equal(
    asuntoDeInscripcion({ nombreDePila: "Luisa Fernanda", genero: "MUJER", casa: casa() }),
    "Luisa Fernanda, quedaste inscrita en tu Casa de Fe · jueves 4:00 p. m.",
  );
});

test("el asunto sin género tampoco se rompe", () => {
  assert.equal(
    asuntoDeInscripcion({ nombreDePila: "Alex", genero: null, casa: casa() }),
    "Alex, ya tienes Casa de Fe · jueves 4:00 p. m.",
  );
});

test("«cuándo» se dice en plural, como se vive", () => {
  assert.equal(cuandoSeReune(casa())?.largo, "Todos los jueves a las 4:00 p. m.");
  assert.equal(cuandoSeReune(casa({ weekday: 6, meetingTime: "08:34" }))?.largo, "Todos los sábados a las 8:34 a. m.");
});

// La rama que hoy no usa nadie —las 59 casas abiertas son semanales— pero que
// tiene que estar bien el día que alguien ponga una quincenal.
test("una casa quincenal lo dice", () => {
  assert.ok(cuandoSeReune(casa({ everyNWeeks: 2 }))?.largo.includes("cada 15 días"));
});

// ⚠️ Lo que de verdad protege al correo: que un dato que falta NO deje un hueco
// ni un «null», sino una frase que le dice a la persona qué va a pasar.
test("sin día o sin hora, ni hueco ni «null»", () => {
  assert.equal(cuandoSeReune(casa({ weekday: null })), null);
  assert.equal(cuandoSeReune(casa({ meetingTime: null })), null);
  assert.equal(cuandoSeReune(casa({ meetingTime: "no es una hora" })), null);
  // Y el asunto se queda sin el sufijo en vez de escribir « · null».
  const asunto = asuntoDeInscripcion({ nombreDePila: "Luisa Fernanda", genero: "MUJER", casa: casa({ weekday: null }) });
  assert.equal(asunto, "Luisa Fernanda, quedaste inscrita en tu Casa de Fe");
  assert.ok(!asunto.includes("null"));
  assert.ok(!asunto.includes("·"));
});

test("sin dirección se dice qué va a pasar, y no se ofrece «cómo llegar»", () => {
  for (const vacia of [null, "", "   "]) {
    const donde = dondeSeReune(casa({ address: vacia }));
    assert.equal(donde.texto, SIN_DIRECCION);
    assert.equal(donde.comoLlegar, null, "sin dirección no puede haber enlace de ruta");
  }
  assert.ok(SIN_DIRECCION.length > 0 && SIN_DIA_NI_HORA.length > 0);
});

test("con dirección va la dirección, y con pin además el «cómo llegar»", () => {
  const soloTexto = dondeSeReune(casa());
  assert.equal(soloTexto.texto, "Carrera 9 #21-14");
  assert.ok(soloTexto.comoLlegar, "la dirección sola ya sirve para buscar la ruta");

  const conPin = dondeSeReune(casa({ latitude: 2.9273, longitude: -75.2819 }));
  assert.ok(conPin.comoLlegar?.includes("2.9273"), "con pin, la ruta va al punto exacto");
});

// Lo que el usuario pidió el 22-oct, con sus palabras: un corazón dispuesto,
// agenda y lapicero, y que nombre al líder POR SU PAPEL además de su nombre.
test("qué llevar nombra el papel y el nombre del líder", () => {
  const frase = queLlevar("Paola Alejandra");
  assert.ok(frase.includes("un corazón dispuesto"));
  assert.ok(frase.includes("una agenda y un lapicero"));
  assert.ok(frase.includes("tu líder de Casa de Fe, Paola Alejandra"));
  assert.ok(!frase.includes("No tienes que llevar nada"));
});

// ⚠️ El guardia que impide inscribir a alguien en una casa a la que le faltan
// datos. El aviso tiene que decir QUÉ falta: un «completa los datos» genérico
// obliga al líder a adivinar, y falta la dirección en 24 de 59 casas.
test("dice exactamente qué le falta a la casa", () => {
  assert.deepEqual(loQueFaltaDeLaCasa(casa()), []);
  assert.deepEqual(loQueFaltaDeLaCasa(casa({ address: null })), ["la dirección"]);
  assert.deepEqual(loQueFaltaDeLaCasa(casa({ address: "  " })), ["la dirección"]);
  assert.deepEqual(loQueFaltaDeLaCasa(casa({ weekday: null })), ["el día y la hora"]);
  assert.deepEqual(loQueFaltaDeLaCasa(casa({ meetingTime: null })), ["el día y la hora"]);
  assert.deepEqual(loQueFaltaDeLaCasa(casa({ weekday: null, address: null })), [
    "el día y la hora",
    "la dirección",
  ]);
});

test("sin nada que falte no hay aviso, y con algo lo nombra", () => {
  assert.equal(avisoDeDatosQueFaltan([]), null);

  const uno = avisoDeDatosQueFaltan(["la dirección"]);
  assert.ok(uno?.includes("completa la dirección de esta casa"));
  assert.ok(uno?.includes("«La reunión»"), "hay que decirle DÓNDE completarlo");

  const dos = avisoDeDatosQueFaltan(["el día y la hora", "la dirección"]);
  assert.ok(dos?.includes("el día y la hora y la dirección"));
});

// ---------------------------------------------------------------------------
// La misma confirmación, por WhatsApp
// ---------------------------------------------------------------------------

// ⚠️ **LA PRUEBA QUE DE VERDAD IMPORTA.** Meta rechaza un valor de variable que
// lleve un salto de línea, un tabulador, cuatro espacios seguidos o la cadena
// vacía, y el rechazo no explica nada: el mensaje simplemente no sale, que es
// exactamente lo que pasó 56 veces durante tres semanas sin que nadie lo
// supiera. Se recorren también los casos a los que les falta un dato, porque
// son los que arman el texto por ramas distintas.
test("la variable del WhatsApp cabe siempre en una sola línea", () => {
  const casos = [
    casa(),
    casa({ address: null }),
    casa({ weekday: null }),
    casa({ meetingTime: null }),
    casa({ weekday: null, address: "   " }),
    casa({ everyNWeeks: 2 }),
  ];

  for (const una of casos) {
    const texto = variableDeConfirmacion(una);
    assert.ok(texto.length > 0, "Meta rechaza también la cadena vacía");
    assert.ok(!texto.includes("\n"), texto);
    assert.ok(!texto.includes("\t"), texto);
    assert.ok(!texto.includes("  "), `dos espacios seguidos: ${texto}`);
    assert.equal(texto, texto.trim());
  }

  assert.ok(CONFIRMACION_SIN_CASA.length > 0);
  assert.ok(!CONFIRMACION_SIN_CASA.includes("\n"));
});

// Probar al revés es lo que hace valer la prueba: se mete un salto de línea a
// propósito donde el equipo lo puede escribir —el nombre de la casa y la
// dirección se teclean a mano— y se comprueba que sale aplanado en vez de
// llegar a Meta y fallar sin explicación.
test("un salto de línea escrito a mano sale aplanado", () => {
  const texto = variableDeConfirmacion(
    casa({ nombre: "CASA\nDEL SUR", address: "Carrera 9\n#21-14" }),
  );
  assert.ok(!texto.includes("\n"));
  assert.ok(texto.includes("CASA DEL SUR"));
  assert.ok(texto.includes("Carrera 9 #21-14"));
});

// Lo que la persona tiene que poder leer sin abrir nada: dónde, cuándo, quién
// la lleva y qué llevar. Es el bloque «TU CASA DE FE» del correo.
test("la confirmación por WhatsApp dice casa, cuándo, dónde, quién y qué llevar", () => {
  const texto = variableDeConfirmacion(casa());
  assert.ok(texto.includes("«CASA DE FE GRUPAL SUR»"));
  assert.ok(texto.includes("los jueves a las 4:00 p. m."), texto);
  assert.ok(texto.includes("Carrera 9 #21-14"));
  assert.ok(
    texto.includes("tu líder de Casa de Fe, Paola Alejandra Viveros de Carvajal"),
    texto,
  );
  assert.ok(texto.includes("una agenda y un lapicero"));

  // ⚠️ El líder se nombra UNA vez. Con el `queLlevar` del correo salía dos
  // veces en tres líneas, y eso solo se vio al dibujarlo con datos reales.
  assert.equal(texto.split("Paola Alejandra").length - 1, 1, texto);

  // ⚠️ «a las 4:00 p. m..»: la hora ya termina en punto. Afecta a todas las
  // casas de la tarde, que son la mayoría.
  assert.ok(!texto.includes(".."), texto);
  // ⚠️ El código de 6 dígitos NO viaja por WhatsApp: es la sospecha principal
  // del rechazo de la plantilla anterior (22-oct). Si alguien lo vuelve a
  // meter, esta prueba lo dice.
  assert.ok(!/\d{6}/.test(texto), texto);
});

// Cuando falta un dato no queda un hueco ni un «null»: queda una frase que
// dice qué va a pasar. Falta la dirección en 24 de las 59 casas abiertas.
test("si falta el día o la dirección, lo dice con palabras", () => {
  assert.ok(variableDeConfirmacion(casa({ address: null })).includes(SIN_DIRECCION));
  assert.ok(variableDeConfirmacion(casa({ weekday: null })).includes(SIN_DIA_NI_HORA));
  assert.ok(!variableDeConfirmacion(casa({ address: null })).includes("null"));
});
