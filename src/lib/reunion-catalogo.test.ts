import assert from "node:assert/strict";
import test from "node:test";
import {
  DIAS_DE_LA_SEMANA,
  diaDeLaSemanaDe,
  enlaceComoLlegar,
  enlaceDelMapa,
  enlaceGoogleCalendar,
  esHoraValida,
  fraseDeLaReunion,
  horaLegible,
  esPuntoValido,
  normalizarReunion,
  proximasReuniones,
  puntoDe,
  puntoLegible,
  puntoParaMaquina,
} from "./reunion-catalogo";

test("la hora se lee como la dice la gente", () => {
  assert.equal(horaLegible("19:00"), "7:00 p. m.");
  assert.equal(horaLegible("07:30"), "7:30 a. m.");
  // Las dos excepciones del reloj de 12 horas, que es donde siempre se falla.
  assert.equal(horaLegible("12:00"), "12:00 p. m.");
  assert.equal(horaLegible("00:00"), "12:00 a. m.");
  assert.equal(horaLegible("12:30"), "12:30 p. m.");
  assert.equal(horaLegible("23:59"), "11:59 p. m.");
});

test("una hora inventada no pasa", () => {
  for (const mala of ["24:00", "7:00", "19:60", "19", "", "7 pm", "19:0"]) {
    assert.equal(esHoraValida(mala), false, `debería rechazar «${mala}»`);
  }
  for (const buena of ["00:00", "09:05", "19:00", "23:59"]) {
    assert.equal(esHoraValida(buena), true, `debería aceptar «${buena}»`);
  }
  assert.equal(horaLegible("24:00"), "");
});

test("sin día y hora no hay frase: el grupo aún no tiene reunión", () => {
  assert.equal(
    fraseDeLaReunion({ weekday: null, meetingTime: "19:00", everyNWeeks: 1 }),
    null,
  );
  assert.equal(
    fraseDeLaReunion({ weekday: 3, meetingTime: null, everyNWeeks: 1 }),
    null,
  );
  assert.equal(
    fraseDeLaReunion({ weekday: 3, meetingTime: "19:00", everyNWeeks: 1 }),
    "Los miércoles a las 7:00 p. m. · cada semana",
  );
  assert.equal(
    fraseDeLaReunion({ weekday: 6, meetingTime: "16:30", everyNWeeks: 2 }),
    "Los sábados a las 4:30 p. m. · cada 15 días",
  );
});

test("los códigos de día del .ics coinciden con el día de JavaScript", () => {
  // Si estos dos se desalinearan, el calendario de todo el mundo repetiría la
  // reunión en el día equivocado, y nada más lo cazaría.
  const esperado: Record<number, string> = {
    0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA",
  };
  for (const dia of DIAS_DE_LA_SEMANA) {
    assert.equal(dia.ics, esperado[dia.valor], `no cuadra ${dia.etiqueta}`);
    // Y se comprueba contra una fecha real de ese día de la semana.
    const enero2026 = ["2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07",
                       "2026-01-08", "2026-01-09", "2026-01-10"];
    assert.equal(diaDeLaSemanaDe(enero2026[dia.valor]), dia.valor);
  }
});

test("las próximas reuniones caen siempre en el día elegido", () => {
  const lista = proximasReuniones(
    { weekday: 3, everyNWeeks: 1, inicio: "2026-09-23" },
    "2026-09-17",
  );
  assert.deepEqual(lista, [
    "2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21",
  ]);
  for (const dia of lista) assert.equal(diaDeLaSemanaDe(dia), 3);
});

test("nunca ofrece una reunión que ya pasó", () => {
  // El grupo arrancó en agosto; hoy es el 17 de septiembre.
  const lista = proximasReuniones(
    { weekday: 3, everyNWeeks: 1, inicio: "2026-08-05" },
    "2026-09-17",
  );
  assert.equal(lista[0], "2026-09-23");
  assert.ok(lista.every((d) => d >= "2026-09-17"));
});

test("si hoy ES día de reunión, hoy cuenta", () => {
  // 2026-09-23 es miércoles. Estando ese mismo día, la próxima es hoy y no la
  // semana que viene: la reunión de esta tarde todavía no ha pasado.
  const lista = proximasReuniones(
    { weekday: 3, everyNWeeks: 1, inicio: "2026-08-05" },
    "2026-09-23",
  );
  assert.equal(lista[0], "2026-09-23");
});

test("⚠️ cada 15 días conserva el ritmo del inicio, no el de hoy", () => {
  // Arranca el 2 de septiembre (miércoles). Cada 15 días toca el 2, 16, 30…
  // Estando el 17, la próxima es el 30 — NO el 23, que es el miércoles de en
  // medio. Si se contara desde hoy en vez de desde el inicio, la serie se
  // desplazaría y el grupo aparecería la semana equivocada.
  const lista = proximasReuniones(
    { weekday: 3, everyNWeeks: 2, inicio: "2026-09-02" },
    "2026-09-17",
    3,
  );
  assert.deepEqual(lista, ["2026-09-30", "2026-10-14", "2026-10-28"]);
});

test("el inicio puede caer en otro día de la semana que la reunión", () => {
  // Se abre el grupo un lunes y se reúnen los sábados: la primera es el
  // sábado siguiente, no el lunes.
  const lista = proximasReuniones(
    { weekday: 6, everyNWeeks: 1, inicio: "2026-09-21" },
    "2026-09-17",
    2,
  );
  assert.deepEqual(lista, ["2026-09-26", "2026-10-03"]);
  assert.equal(diaDeLaSemanaDe("2026-09-21"), 1);
});

test("un grupo sin día no tiene reuniones que ofrecer", () => {
  assert.deepEqual(
    proximasReuniones(
      { weekday: null, everyNWeeks: 1, inicio: "2026-09-23" },
      "2026-09-17",
    ),
    [],
  );
});

test("la serie cruza el fin de año sin romperse", () => {
  const lista = proximasReuniones(
    { weekday: 4, everyNWeeks: 1, inicio: "2026-12-24" },
    "2026-12-20",
    3,
  );
  assert.deepEqual(lista, ["2026-12-24", "2026-12-31", "2027-01-07"]);
  for (const dia of lista) assert.equal(diaDeLaSemanaDe(dia), 4);
});

const DIRECCION = "Calle 19 # 5-42, Barrio Álamos Norte, Neiva";
const PUNTO = { lat: 2.93861, lng: -75.28612 };

test("los enlaces del mapa llevan la dirección escapada", () => {
  const ver = enlaceDelMapa({ address: DIRECCION, punto: null })!;
  const ir = enlaceComoLlegar({ address: DIRECCION, punto: null })!;
  assert.ok(ver.startsWith("https://www.google.com/maps/search/?api=1&query="));
  assert.ok(ir.startsWith("https://www.google.com/maps/dir/?api=1&destination="));
  // El `#` sin escapar cortaría la URL y Maps recibiría media dirección.
  assert.ok(!ver.includes("#"));
  assert.ok(ver.includes("%23"));
  assert.ok(ver.includes("%C3%81") || ver.includes("%C3%81lamos"));
});

test("⚠️ con el pin puesto manda el punto, no la dirección escrita", () => {
  // Es la razón de ser de todo esto: buscar «Calle 19 # 5-42, Álamos Norte» en
  // Google deja a quien va en la mitad de la cuadra, porque esa dirección no
  // existe en el mapa tal como se dice. Las coordenadas señalan la casa.
  const ver = enlaceDelMapa({ address: DIRECCION, punto: PUNTO })!;
  assert.ok(ver.includes("2.938610"), ver);
  assert.ok(ver.includes("-75.286120"), ver);
  assert.ok(!ver.includes("Calle"), ver);

  const ir = enlaceComoLlegar({ address: DIRECCION, punto: PUNTO })!;
  assert.ok(ir.includes("destination=2.938610%2C-75.286120"), ir);
});

test("sin dirección y sin punto no hay enlace que abrir", () => {
  // Devuelve null para que la ficha no pinte un botón que lleva a ninguna
  // parte: es el estado de los 19 grupos que hoy no tienen ni lo uno ni lo otro.
  assert.equal(enlaceDelMapa({ address: null, punto: null }), null);
  assert.equal(enlaceComoLlegar({ address: null, punto: null }), null);
  assert.equal(enlaceDelMapa({ address: "   ", punto: null }), null);

  // Con punto y sin dirección sí hay enlace, y es el bueno.
  assert.ok(enlaceDelMapa({ address: null, punto: PUNTO })?.includes("2.938610"));
});

test("un punto se valida y se redondea a seis decimales", () => {
  // Seis decimales son ~11 cm. Los quince que manda el navegador solo
  // ensuciarían la auditoría cada vez que alguien roza el mapa.
  assert.deepEqual(puntoDe(2.9386098765432, -75.2861212345), {
    lat: 2.93861,
    lng: -75.286121,
  });
  assert.ok(esPuntoValido(2.93861, -75.28612));

  // Fuera de rango, no numérico, o media coordenada: no es un punto.
  assert.equal(puntoDe(120, -75.28), null);
  assert.equal(puntoDe(2.93, -200), null);
  assert.equal(puntoDe(Number.NaN, -75.28), null);
  assert.equal(puntoDe(2.93861, null), null);
  assert.equal(puntoDe(null, null), null);
  assert.equal(esPuntoValido(Number.POSITIVE_INFINITY, 0), false);
});

test("⚠️ para una persona el punto va con coma; para una máquina, con punto", () => {
  // Mezclar los dos formatos es lo que rompe una URL o un archivo .ics: si la
  // coordenada saliera como «2,93861», Google leería dos parámetros.
  assert.equal(puntoLegible(PUNTO), "2,938610 · \u221275,286120");
  assert.equal(puntoParaMaquina(PUNTO), "2.938610,-75.286120");
  // En un .ics el separador es punto y coma.
  assert.equal(puntoParaMaquina(PUNTO, ";"), "2.938610;-75.286120");
});

test("normalizarReunion acepta el punto, lo redondea y rechaza medias tintas", () => {
  const base = {
    weekday: 1,
    meetingTime: "17:00",
    everyNWeeks: 1,
    durationMinutes: 60,
    address: "Calle 19 # 5-42",
  };

  const con = normalizarReunion({ ...base, latitude: "2.9386098", longitude: "-75.2861212" });
  assert.ok(con.ok);
  assert.equal(con.datos.latitude, 2.93861);
  assert.equal(con.datos.longitude, -75.286121);

  // Sin punto es lo normal y tiene que seguir pasando.
  const sin = normalizarReunion(base);
  assert.ok(sin.ok);
  assert.equal(sin.datos.latitude, null);
  assert.equal(sin.datos.longitude, null);

  // Media coordenada se rechaza: la base lo repite con un CHECK, pero el
  // mensaje bueno lo da aquí.
  const media = normalizarReunion({ ...base, latitude: "2.93861", longitude: null });
  assert.equal(media.ok, false);

  const fuera = normalizarReunion({ ...base, latitude: "95", longitude: "-75.28" });
  assert.equal(fuera.ok, false);
});

test("el enlace de Google Calendar lleva la hora de Colombia y el fin bien calculado", () => {
  const url = enlaceGoogleCalendar({
    nombre: "Alamor Norte Casa Hogar",
    dia: "2026-09-23",
    hora: "19:00",
    duracionMinutos: 90,
    direccion: "Calle 19 # 5-42, Neiva",
  });
  assert.ok(url);
  assert.ok(url.includes("dates=20260923T190000%2F20260923T203000"));
  assert.ok(url.includes("ctz=America%2FBogota"));
  // Sin `Z`: son horas locales, y `ctz` es lo que las ancla.
  assert.ok(!url.includes("T190000Z"));
});

test("una reunión que cruza la medianoche corre el día del final", () => {
  const url = enlaceGoogleCalendar({
    nombre: "Vigilia",
    dia: "2026-09-25",
    hora: "23:00",
    duracionMinutos: 120,
    direccion: null,
  });
  assert.ok(url);
  assert.ok(url.includes("dates=20260925T230000%2F20260926T010000"));
  assert.ok(!url.includes("location="));
});

test("con una hora inválida no se genera enlace", () => {
  assert.equal(
    enlaceGoogleCalendar({
      nombre: "X",
      dia: "2026-09-23",
      hora: "25:00",
      duracionMinutos: 60,
      direccion: null,
    }),
    null,
  );
});
