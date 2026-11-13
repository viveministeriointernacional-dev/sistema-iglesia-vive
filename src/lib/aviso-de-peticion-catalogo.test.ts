import assert from "node:assert/strict";
import test from "node:test";
import {
  asuntoDelAviso,
  comoSeNombra,
  cuerpoDelAviso,
  debeAvisar,
  resumenDeLoQuePidio,
  urgeLlamar,
  variableDeWhatsAppDeLaPeticion,
} from "./aviso-de-peticion-catalogo";

test("solo avisa de las que pidió la persona por el link", () => {
  assert.equal(debeAvisar("PERSONA"), true);
  // Las 22 de 24 de noviembre: ya tienen consolidador y llamada.
  assert.equal(debeAvisar("REGISTRO"), false);
  // Las escribió alguien del equipo que está delante de la persona.
  assert.equal(debeAvisar("EQUIPO"), false);
  assert.equal(debeAvisar("HISTORICO"), false);
});

test("dice lo que pidió, y el proceso se suma en vez de sustituir", () => {
  assert.equal(resumenDeLoQuePidio(["ORACION"], false), "oración");
  assert.equal(resumenDeLoQuePidio(["CONSEJERIA"], false), "consejería");
  assert.equal(
    resumenDeLoQuePidio(["ORACION", "CONSEJERIA"], false),
    "oración y consejería",
  );
  assert.equal(
    resumenDeLoQuePidio(["ORACION"], true),
    "oración, y quiere iniciar un proceso",
  );
  assert.equal(
    resumenDeLoQuePidio(["ORACION", "CONSEJERIA"], true),
    "oración y consejería, y quiere iniciar un proceso",
  );
});

test("distingue lo que se ora de lo que hay que llamar", () => {
  assert.equal(urgeLlamar(["ORACION"], false), false);
  assert.equal(urgeLlamar(["CONSEJERIA"], false), true);
  assert.equal(urgeLlamar(["ORACION"], true), true);
});

test("una reservada no lleva el nombre a ninguna parte", () => {
  assert.equal(comoSeNombra("Luz Mary Ortiz", true), "Alguien de la iglesia");
  assert.equal(comoSeNombra("Luz Mary Ortiz", false), "Luz Mary Ortiz");
  // Una ficha sin nombre no deja el correo con un hueco.
  assert.equal(comoSeNombra("   ", false), "Alguien de la iglesia");

  const asunto = asuntoDelAviso({
    nombres: "Luz Mary",
    reservada: true,
    tipos: ["ORACION"],
    quiereProceso: false,
  });
  assert.ok(!asunto.includes("Luz"), asunto);
  // Sin los dos puntos: con ellos, «alguien de la iglesia» se leía como si
  // fuera el nombre de alguien.
  assert.equal(asunto, "Alguien pide oración");

  const cuerpo = cuerpoDelAviso({
    paraNombres: "Luis Alberto",
    nombreCompleto: "Luz Mary Ortiz",
    reservada: true,
    tipos: ["ORACION"],
    quiereProceso: false,
    texto: "Oren por mi hija.",
    celular: "3001234567",
  });
  assert.ok(!cuerpo.includes("Luz Mary"), "el nombre se colaba en el cuerpo");
  // Y tampoco el celular: sería decir quién es por otra puerta.
  assert.ok(!cuerpo.includes("3001234567"), "el celular se colaba");
});

test("el asunto pone lo urgente delante y usa el nombre de pila", () => {
  assert.equal(
    asuntoDelAviso({
      // Lo que guarda person.first_name: los NOMBRES, no el nombre completo.
      nombres: "Paola Alejandra",
      reservada: false,
      tipos: ["ORACION"],
      quiereProceso: true,
    }),
    // Dos nombres, no uno: cortar por el primer espacio se equivoca en 7 de 17.
    "Quiere iniciar un proceso: Paola Alejandra",
  );
  assert.equal(
    asuntoDelAviso({
      nombres: "Juan Felipe",
      reservada: false,
      tipos: ["ORACION", "CONSEJERIA"],
      quiereProceso: false,
    }),
    "Pide consejería: Juan Felipe",
  );
  assert.equal(
    asuntoDelAviso({
      nombres: "Sandra",
      reservada: false,
      tipos: ["ORACION"],
      quiereProceso: false,
    }),
    "Petición de oración: Sandra",
  );
});

test("la variable de WhatsApp va en UNA línea y sin el texto de la petición", () => {
  const linea = variableDeWhatsAppDeLaPeticion({
    nombreCompleto: "Sandra Barón",
    reservada: false,
    tipos: ["CONSEJERIA"],
    quiereProceso: true,
  });
  assert.ok(!/[\n\r\t]/.test(linea), "llevaba un salto de línea");
  assert.ok(!/ {4}/.test(linea), "llevaba cuatro espacios seguidos");
  assert.ok(linea.includes("Sandra Barón"));
  assert.ok(linea.includes("consejería"));
});

test("sin enlace no se pinta el botón, porque no todos pueden abrir Oración", () => {
  const base = {
    paraNombres: "Jairo",
    nombreCompleto: "Sandra Barón",
    reservada: false,
    tipos: ["ORACION"] as const,
    quiereProceso: false,
    texto: "Oren por mi trabajo.",
  };
  const sin = cuerpoDelAviso({ ...base, enlace: null });
  assert.ok(!sin.includes("Verla en la plataforma"));
  const con = cuerpoDelAviso({ ...base, enlace: "https://x.test/oracion" });
  assert.ok(con.includes("Verla en la plataforma"));
  assert.ok(con.includes("https://x.test/oracion"));
});

test("el texto de la persona se escapa, no se interpreta", () => {
  const cuerpo = cuerpoDelAviso({
    paraNombres: "Nora",
    nombreCompleto: "<b>Ana</b>",
    reservada: false,
    tipos: ["ORACION"],
    quiereProceso: false,
    texto: "Oren por mi hijo <script>alert(1)</script>",
  });
  assert.ok(!cuerpo.includes("<script>"), "entró una etiqueta sin escapar");
  assert.ok(cuerpo.includes("&lt;script&gt;"));
});

test("el asunto respeta los DOS nombres, que es el fallo de 7 de 17", () => {
  // La prueba al revés: si alguien alimentara esto con el nombre completo, el
  // saludo y el asunto perderían el segundo nombre. Por eso el parámetro se
  // llama `nombres` y sale de `person.first_name`.
  assert.equal(
    asuntoDelAviso({
      nombres: "Yuli Katherine",
      reservada: false,
      tipos: ["ORACION"],
      quiereProceso: false,
    }),
    "Petición de oración: Yuli Katherine",
  );
  assert.ok(
    cuerpoDelAviso({
      paraNombres: "Paola Alejandra",
      nombreCompleto: "Sandra Barón",
      reservada: false,
      tipos: ["ORACION"],
      quiereProceso: false,
      texto: "Oren por mí.",
    }).includes("Hola, Paola Alejandra:"),
  );
});

test("el aviso no supone el género de nadie", () => {
  // Salió al dibujarlo con datos reales: la frase decía «que alguien LA llame,
  // no solo que oremos por ELLA», y el primer caso de verdad fue Juan Felipe.
  // En una reservada, además, el género no se puede saber sin destapar quién es.
  for (const reservada of [false, true]) {
    const cuerpo = cuerpoDelAviso({
      paraNombres: "Nora",
      nombreCompleto: "Juan Felipe Carvajal",
      reservada,
      tipos: ["CONSEJERIA"],
      quiereProceso: true,
      texto: "Quiero hablar con alguien.",
    });
    assert.ok(!/\bla llame\b/.test(cuerpo), "supuso el género en «la llame»");
    assert.ok(!/\bpor ella\b/.test(cuerpo), "supuso el género en «por ella»");
    assert.ok(!/\bbuscarla\b/.test(cuerpo), "supuso el género en «buscarla»");
  }
});

test("el pie no manda a una pantalla que la mitad no puede abrir", () => {
  // Jairo, Ruth, Yuli y Nora reciben el aviso y NO abren Administración.
  const cuerpo = cuerpoDelAviso({
    paraNombres: "Jairo",
    nombreCompleto: "Sandra Barón",
    reservada: false,
    tipos: ["ORACION"],
    quiereProceso: false,
    texto: "Oren por mí.",
  });
  assert.ok(cuerpo.includes("pídele al"), cuerpo.slice(-320));
});

test("urgeLlamar es la MISMA regla para el asunto y para el WhatsApp", () => {
  // Si estas dos cosas se separaran en dos reglas parecidas, un día el asunto
  // diría «Pide consejería» y el WhatsApp no saldría, sin que nada avisara.
  const casos: { tipos: string[]; proceso: boolean; wa: boolean }[] = [
    { tipos: ["ORACION"], proceso: false, wa: false },
    { tipos: ["CONSEJERIA"], proceso: false, wa: true },
    { tipos: ["ORACION", "CONSEJERIA"], proceso: false, wa: true },
    { tipos: ["ORACION"], proceso: true, wa: true },
  ];
  for (const caso of casos) {
    assert.equal(urgeLlamar(caso.tipos, caso.proceso), caso.wa);
    // Y el asunto cambia exactamente en los mismos casos.
    const asunto = asuntoDelAviso({
      nombres: "Sandra",
      reservada: false,
      tipos: caso.tipos,
      quiereProceso: caso.proceso,
    });
    assert.equal(
      asunto !== "Petición de oración: Sandra",
      caso.wa,
      `${asunto} no concuerda con urgeLlamar`,
    );
  }
});
