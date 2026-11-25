import assert from "node:assert/strict";
import test from "node:test";
import {
  asuntoDeInscripcion,
  type CasaDeLaInscripcion,
  type GeneroDePersona,
  confirmacionSinCasa,
  cuandoSeReune,
  dondeSeReune,
  fraseDeInscripcion,
  FRASE_DEL_ENLACE,
  fraseDeQuedoInscrito,
  mensajeDeAccesoEnUnaLinea,
  nombreDeLaCasaEnLaFrase,
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

  // Los tres géneros, porque desde el 19-nov la frase de apertura cambia con
  // él: son tres textos distintos y los tres tienen que caber en la variable.
  const generos: GeneroDePersona[] = ["MUJER", "HOMBRE", null];

  for (const una of casos) {
    for (const genero of generos) {
      const texto = variableDeConfirmacion(una, genero);
      assert.ok(texto.length > 0, "Meta rechaza también la cadena vacía");
      assert.ok(!texto.includes("\n"), texto);
      assert.ok(!texto.includes("\t"), texto);
      assert.ok(!texto.includes("  "), `dos espacios seguidos: ${texto}`);
      assert.equal(texto, texto.trim());
    }
  }

  for (const genero of generos) {
    const sinCasa = confirmacionSinCasa(genero);
    assert.ok(sinCasa.length > 0);
    assert.ok(!sinCasa.includes("\n"));
    assert.ok(!sinCasa.includes("  "), sinCasa);
  }
});

// Probar al revés es lo que hace valer la prueba: se mete un salto de línea a
// propósito donde el equipo lo puede escribir —el nombre de la casa y la
// dirección se teclean a mano— y se comprueba que sale aplanado en vez de
// llegar a Meta y fallar sin explicación.
test("un salto de línea escrito a mano sale aplanado", () => {
  const texto = variableDeConfirmacion(
    casa({ nombre: "CASA\nDEL SUR", address: "Carrera 9\n#21-14" }),
    "MUJER",
  );
  assert.ok(!texto.includes("\n"));
  assert.ok(texto.includes("CASA DEL SUR"));
  assert.ok(texto.includes("Carrera 9 #21-14"));
});

// Lo que la persona tiene que poder leer sin abrir nada: dónde, cuándo, quién
// la lleva y qué llevar. Es el bloque «TU CASA DE FE» del correo.
test("la confirmación por WhatsApp dice casa, cuándo, dónde, quién y qué llevar", () => {
  const texto = variableDeConfirmacion(casa(), "HOMBRE");
  // ⚠️ «GRUPAL SUR» y no el nombre entero: la frase ya dice «Casa de Fe», así
  // que repetirlo sonaba a tartamudeo en 31 de las 56 casas abiertas.
  assert.ok(texto.includes("«GRUPAL SUR»"), texto);
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
  assert.ok(
    variableDeConfirmacion(casa({ address: null }), "MUJER").includes(SIN_DIRECCION),
  );
  assert.ok(
    variableDeConfirmacion(casa({ weekday: null }), "MUJER").includes(SIN_DIA_NI_HORA),
  );
  assert.ok(!variableDeConfirmacion(casa({ address: null }), "MUJER").includes("null"));
});

// ⚠️ **Lo que pidió el usuario el 19-nov, y lo que el canal no podía hacer
// antes.** La frase de qué pasó vivía en el texto FIJO de la plantilla de Meta
// («Ya quedaste en tu Casa de Fe»), que es el mismo para los 61 miembros, así
// que no podía llevar género. Ahora abre la variable, y con él.
test("el WhatsApp dice «inscrito» o «inscrita», y neutro cuando no se sabe", () => {
  const mujer = variableDeConfirmacion(casa(), "MUJER");
  const hombre = variableDeConfirmacion(casa(), "HOMBRE");
  const sinDato = variableDeConfirmacion(casa(), null);

  assert.ok(
    mujer.startsWith("Ya quedaste inscrita en la Casa de Fe «GRUPAL SUR»"),
    mujer,
  );
  assert.ok(
    hombre.startsWith("Ya quedaste inscrito en la Casa de Fe «GRUPAL SUR»"),
    hombre,
  );

  // ⚠️ Los 9 sin el dato (de 61, medidos el 19-nov) no reciben un «inscrito/a»
  // ni un hueco: reciben una frase que dice lo mismo sin el participio.
  assert.ok(!sinDato.includes("inscrit"), sinDato);
  assert.ok(sinDato.startsWith("Ya estás en la Casa de Fe «GRUPAL SUR»"), sinDato);

  // ⚠️ Y no se cuela un «Ya ya»: la forma neutra ya empieza por «Ya», así que
  // ponerle otro delante es el fallo que solo se ve imprimiendo las frases.
  for (const texto of [mujer, hombre, sinDato]) {
    assert.ok(!/\bYa ya\b/i.test(texto), texto);
    // La casa se nombra UNA vez: la frase nueva ya la nombra, así que el
    // «Tu Casa de Fe es «X»» de antes sobraba.
    assert.equal(texto.split("GRUPAL SUR").length - 1, 1, texto);
    // Y «Casa de Fe» aparece una sola vez, no dos seguidas.
    assert.ok(!/Casa de Fe «Casa de [Ff]e/.test(texto), texto);
  }
});

// La misma regla cuando no se pudo recuperar la casa: cambia lo que se sabe de
// la reunión, no cómo se le habla a la persona.
test("sin casa, la confirmación también lleva el género", () => {
  assert.ok(confirmacionSinCasa("MUJER").startsWith("Ya quedaste inscrita en una"));
  assert.ok(confirmacionSinCasa("HOMBRE").startsWith("Ya quedaste inscrito en una"));
  assert.ok(!confirmacionSinCasa(null).includes("inscrit"));
  for (const genero of ["MUJER", "HOMBRE", null] as GeneroDePersona[]) {
    assert.ok(confirmacionSinCasa(genero).includes("el día, la hora y la dirección"));
  }
});

// El correo y el WhatsApp dicen lo mismo con palabras distintas a propósito
// (allí hay saludo delante y aquí no), pero el participio sale del MISMO sitio:
// si alguien cambia `participioDeInscripcion`, los dos canales se mueven
// juntos. Esta prueba es lo que lo vigila.
test("los dos canales comparten el participio", () => {
  for (const genero of ["MUJER", "HOMBRE"] as GeneroDePersona[]) {
    const participio = participioDeInscripcion(genero)!;
    assert.ok(
      fraseDeInscripcion({ nombreDePila: "Luisa Fernanda", genero, casa: "X" }).includes(
        `quedaste ${participio} en la Casa de Fe «X»`,
      ),
    );
    assert.ok(
      fraseDeQuedoInscrito({ genero, casa: "X" }).includes(
        `quedaste ${participio} en la Casa de Fe «X»`,
      ),
    );
  }
});

// ⚠️ **Los 31 nombres de verdad, no inventados.** Son los que tenía la base el
// 19-nov entre las 56 casas abiertas, y están aquí porque cada uno rompía el
// recorte de una manera distinta: el guion doble, la barra vertical, los tres
// puntos, la «é» con tilde y el nombre que no lleva el prefijo.
test("el nombre de la casa no repite «Casa de Fe»", () => {
  const reales: [string, string][] = [
    ["Casa de fe Ana Lopez", "Ana Lopez"],
    ["casa de fe -  Jairo Andre Moya", "Jairo Andre Moya"],
    ["Casa de Fe -  Saira Leyton", "Saira Leyton"],
    ["Casa de fe | Santiago Lemus", "Santiago Lemus"],
    ["Casa de Fé Harver & Krystel", "Harver & Krystel"],
    ["Casa de Fe... Karolanne y Cristopher", "Karolanne y Cristopher"],
    ["CASA DE FE GRUPAL SUR", "GRUPAL SUR"],
    ["Casa de fe Nidia (abuela)", "Nidia (abuela)"],
    // Los 22 que no llevan esas palabras se quedan tal cual.
    ["JEISON Y LORENA", "JEISON Y LORENA"],
    ["Los Viveros", "Los Viveros"],
  ];

  for (const [nombre, esperado] of reales) {
    assert.equal(nombreDeLaCasaEnLaFrase(nombre), esperado, nombre);
  }

  // ⚠️ Si detrás del prefijo no queda nada, se devuelve el original: un hueco
  // entre comillas no identifica ninguna casa.
  assert.equal(nombreDeLaCasaEnLaFrase("Casa de Fe"), "Casa de Fe");
  assert.equal(nombreDeLaCasaEnLaFrase("  casa de fe -  "), "casa de fe -");
});

// ⚠️ **La variable que de verdad se manda desde el 25-nov.** La plantilla volvió
// a dos variables porque la acción de WhatsApp del flujo no deja añadir la
// tercera casilla sin volver a elegir la plantilla, así que el mensaje entero
// —confirmación Y enlace— viaja en el campo que el flujo ya tiene mapeado.
// Medido con un antes y un después sobre el mismo número: 2 variables con 2
// mapeadas salió `read`; 3 con 2 salió `failed`.
test("el mensaje de acceso lleva la confirmación y el enlace en UNA línea", () => {
  const enlace = "https://ejemplo.test/taller/mis/abc123";
  const texto = mensajeDeAccesoEnUnaLinea({
    confirmacion: variableDeConfirmacion(casa(), "MUJER"),
    enlace,
  });

  // Lo que Meta rechaza, otra vez: ni saltos, ni tabuladores, ni dobles
  // espacios, ni la cadena vacía.
  assert.ok(texto.length > 0);
  assert.ok(!texto.includes("\n"), texto);
  assert.ok(!texto.includes("\t"), texto);
  assert.ok(!texto.includes("  "), texto);
  assert.equal(texto, texto.trim());

  // Y lo que tiene que llevar: la frase con género, el enlace al final, y la
  // frase que lo presenta.
  assert.ok(texto.startsWith("Ya quedaste inscrita en la Casa de Fe «GRUPAL SUR»"), texto);
  assert.ok(texto.includes(FRASE_DEL_ENLACE), texto);
  assert.ok(texto.endsWith(enlace), texto);

  // ⚠️ El enlace va UNA vez: si alguien lo mete también en la confirmación,
  // el mensaje lo repite y nadie lo vería leyendo el código.
  assert.equal(texto.split(enlace).length - 1, 1, texto);
});

// El caso sin casa también tiene que llevar el enlace: es justo cuando la
// persona menos sabe, así que el único dato accionable no puede faltar.
test("sin casa, el mensaje de acceso sigue llevando el enlace", () => {
  const enlace = "https://ejemplo.test/taller/mis/xyz";
  for (const genero of ["MUJER", "HOMBRE", null] as GeneroDePersona[]) {
    const texto = mensajeDeAccesoEnUnaLinea({
      confirmacion: confirmacionSinCasa(genero),
      enlace,
    });
    assert.ok(texto.endsWith(enlace), texto);
    assert.ok(!texto.includes("\n"), texto);
    assert.ok(texto.includes("el día, la hora y la dirección"), texto);
  }
});
