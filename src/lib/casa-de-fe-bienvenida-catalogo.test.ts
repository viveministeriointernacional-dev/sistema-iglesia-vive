import assert from "node:assert/strict";
import test from "node:test";
import {
  asuntoDeInscripcion,
  type CasaDeLaInscripcion,
  cuandoSeReune,
  dondeSeReune,
  fraseDeInscripcion,
  participioDeInscripcion,
  SIN_DIA_NI_HORA,
  SIN_DIRECCION,
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
    lider: "Alejandro Facundo",
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
    asuntoDeInscripcion({ nombreDePila: "Luisa", genero: "MUJER", casa: casa() }),
    "Luisa, quedaste inscrita en tu Casa de Fe · jueves 4:00 p. m.",
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
  const asunto = asuntoDeInscripcion({ nombreDePila: "Luisa", genero: "MUJER", casa: casa({ weekday: null }) });
  assert.equal(asunto, "Luisa, quedaste inscrita en tu Casa de Fe");
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
