import assert from "node:assert/strict";
import test from "node:test";
import { construirIcs, type ReunionParaCalendario } from "./calendario";

/// Una reunión real: la Casa de Fe de los miércoles a las 7 de la noche, con
/// una dirección que lleva coma y almohadilla — o sea, una dirección normal de
/// Neiva, que es justo lo que rompe un .ics mal escapado.
const CASA: ReunionParaCalendario = {
  id: "abc-123",
  nombre: "Alamor Norte Casa Hogar",
  weekday: 3,
  meetingTime: "19:00",
  everyNWeeks: 1,
  durationMinutes: 90,
  address: "Calle 19 # 5-42, Barrio Álamos Norte, Neiva",
  punto: null,
  inicio: "2026-09-23",
  clase: "Casa de Fe",
  papel: "lleva",
  lider: "Santiago Viveros",
};

function ics(
  reuniones: ReunionParaCalendario[] = [CASA],
  nombre = "Santiago Viveros",
) {
  return construirIcs({ nombre, reuniones, dominio: "iglesia.example" });
}

/// Deshace el plegado de líneas para poder buscar un campo completo. Es lo
/// mismo que hace un cliente de calendario al leer el archivo.
function desplegar(texto: string): string[] {
  return texto.replace(/\r\n[ \t]/g, "").split("\r\n").filter(Boolean);
}

/// Las líneas del PRIMER evento, sin la envoltura ni la definición de zona.
///
/// ⚠️ Hace falta porque la `VTIMEZONE` también tiene un `DTSTART` —el de la
/// regla de −05:00— y va ANTES del evento: buscar «DTSTART» en todo el archivo
/// devuelve el de la zona. Me lo tragué al escribir esta prueba y parecía un
/// fallo del código.
function delEvento(texto: string): string[] {
  const lineas = desplegar(texto);
  const desde = lineas.indexOf("BEGIN:VEVENT");
  if (desde === -1) return [];
  return lineas.slice(desde, lineas.indexOf("END:VEVENT", desde) + 1);
}

test("el archivo tiene la envoltura que pide el formato", () => {
  const lineas = desplegar(ics());
  assert.equal(lineas[0], "BEGIN:VCALENDAR");
  assert.equal(lineas.at(-1), "END:VCALENDAR");
  assert.ok(lineas.includes("VERSION:2.0"));
  // Las líneas se separan con CRLF, no con LF suelto.
  assert.ok(ics().includes("\r\n"));
  assert.ok(!/[^\r]\n/.test(ics()));
});

test("⚠️ lleva la zona de Bogotá definida, no solo nombrada", () => {
  // Un DTSTART con TZID obliga a incluir la VTIMEZONE. Sin ella, algunos
  // clientes se inventan la zona y la reunión de las 7 p. m. sale a otra hora.
  const lineas = desplegar(ics());
  assert.ok(lineas.includes("BEGIN:VTIMEZONE"));
  assert.ok(lineas.includes("TZID:America/Bogota"));
  assert.ok(lineas.includes("TZOFFSETTO:-0500"));
  assert.ok(lineas.includes("END:VTIMEZONE"));
});

test("la hora va como hora local con su zona, nunca en UTC", () => {
  const inicio = delEvento(ics()).find((l) => l.startsWith("DTSTART"));
  assert.equal(inicio, "DTSTART;TZID=America/Bogota:20260923T190000");
  // Lo que importa es que el VALOR no termine en «Z»: un `Z` al final
  // significaría hora de Greenwich, y el calendario pondría la reunión de las
  // 7 p. m. a las 2 de la tarde en Colombia.
  // (Ojo: `inicio.includes("Z")` no sirve como comprobación — la «Z» de
  // «TZID» hace que dé siempre positivo. Ahí caí al escribir esto.)
  assert.ok(!inicio!.split(":")[1].endsWith("Z"), inicio);
});

test("la repetición dice el día correcto y cada cuánto", () => {
  const lineas = desplegar(ics());
  assert.ok(lineas.includes("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=WE"));
  assert.ok(lineas.includes("DURATION:PT90M"));

  const cada15 = desplegar(ics([{ ...CASA, everyNWeeks: 2 }]));
  assert.ok(cada15.includes("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE"));
});

test("⚠️ el DTSTART cae en el día de la repetición, aunque el grupo empiece otro día", () => {
  // Se abre el grupo un lunes y se reúnen los miércoles: si el DTSTART se
  // quedara en el lunes, varios clientes añadirían una reunión ese lunes que
  // nadie pactó.
  const inicio = delEvento(ics([{ ...CASA, inicio: "2026-09-21" }])).find((l) =>
    l.startsWith("DTSTART"),
  )!;
  assert.ok(inicio.includes("20260923"), inicio);
});

test("⚠️ una dirección con coma y almohadilla no rompe el archivo", () => {
  const lineas = desplegar(ics());
  const lugar = lineas.find((l) => l.startsWith("LOCATION:"))!;
  // La coma es separador en el formato: sin escapar, el cliente leería dos
  // valores y se quedaría con «Calle 19 # 5-42».
  assert.ok(lugar.includes("\\,"), lugar);
  assert.ok(lugar.includes("Álamos"));
  assert.ok(lugar.includes("#"));
  // Y una sola línea LOCATION, no varias.
  assert.equal(lineas.filter((l) => l.startsWith("LOCATION:")).length, 1);
});

test("sin dirección no se escribe el campo del lugar", () => {
  const lineas = desplegar(ics([{ ...CASA, address: null }]));
  assert.equal(lineas.filter((l) => l.startsWith("LOCATION:")).length, 0);
  // Y el evento sigue siendo válido.
  assert.ok(lineas.includes("BEGIN:VEVENT"));
  assert.ok(lineas.includes("END:VEVENT"));
});

test("⚠️ ninguna línea pasa de 75 octetos, contando las tildes como dos", () => {
  // Es el límite del formato. Se cuenta en bytes: una línea de 75 caracteres
  // con tildes ocupa más y algunos clientes la rechazan.
  const largo = ics([
    {
      ...CASA,
      nombre: "Casa de Fe de la Comuna Diez · Familia Rodríguez Peñaloza y Álvarez",
      address:
        "Carrera 15 # 22-08, Conjunto Residencial Los Guaduales Etapa Tres, Barrio Campoamor, Neiva, Huila, Colombia",
    },
  ]);
  for (const linea of largo.split("\r\n")) {
    const octetos = new TextEncoder().encode(linea).length;
    assert.ok(octetos <= 75, `línea de ${octetos} octetos: ${linea}`);
  }
  // Y al desplegarlo se recupera el texto entero, sin perder ni un carácter.
  const lugar = desplegar(largo).find((l) => l.startsWith("LOCATION:"))!;
  assert.ok(lugar.includes("Guaduales"));
  assert.ok(lugar.includes("Colombia"));
});

test("⚠️ el punto del mapa va como GEO, con punto y coma y SIN escapar", () => {
  // `GEO` separa latitud y longitud con «;», que aquí es sintaxis del campo y
  // no un carácter del texto: pasarlo por `escapar` lo dejaría en «\\;» y el
  // calendario descartaría el campo entero. Y el decimal es punto, no coma,
  // porque esto lo lee una máquina.
  const lineas = delEvento(ics([{ ...CASA, punto: { lat: 2.93861, lng: -75.28612 } }]));
  const linea = lineas.find((l) => l.startsWith("GEO:"));
  assert.equal(linea, "GEO:2.938610;-75.286120");

  // La dirección escrita NO se pierde: el punto es un extra.
  assert.ok(lineas.some((l) => l.startsWith("LOCATION:")));
});

test("sin punto marcado no se escribe GEO", () => {
  // Es el estado de los 19 grupos que ya existen. Un GEO vacío o en (0, 0)
  // pondría la reunión en el Atlántico.
  const lineas = delEvento(ics());
  assert.equal(lineas.filter((l) => l.startsWith("GEO")).length, 0);
});

test("el identificador del evento es estable entre refrescos", () => {
  // Si el UID o el DTSTAMP cambiaran en cada petición, los clientes tratarían
  // la misma reunión como nueva cada vez y repetirían los avisos.
  const a = desplegar(ics());
  const b = desplegar(ics());
  assert.deepEqual(a, b);
  assert.ok(a.includes("UID:abc-123@iglesia.example"));
});

test("cada grupo es un evento, y el nombre del calendario va escapado", () => {
  const dos = desplegar(
    ics(
      [CASA, { ...CASA, id: "def-456", nombre: "Alpha Norte", weekday: 6 }],
      "Ana, la líder",
    ),
  );
  assert.equal(dos.filter((l) => l === "BEGIN:VEVENT").length, 2);
  assert.ok(dos.some((l) => l.includes("BYDAY=SA")));
  const nombre = dos.find((l) => l.startsWith("X-WR-CALNAME:"))!;
  assert.ok(nombre.includes("\\,"), nombre);
});

test("sin reuniones el archivo sigue siendo válido y vacío", () => {
  const lineas = desplegar(ics([]));
  assert.equal(lineas[0], "BEGIN:VCALENDAR");
  assert.equal(lineas.at(-1), "END:VCALENDAR");
  assert.equal(lineas.filter((l) => l === "BEGIN:VEVENT").length, 0);
});

test("la descripción dice si lo lleva la persona o alguien más", () => {
  const propio = desplegar(ics()).find((l) => l.startsWith("DESCRIPTION:"))!;
  assert.ok(propio.includes("la llevas tú"));

  const ajeno = desplegar(ics([{ ...CASA, papel: "participa" }])).find((l) =>
    l.startsWith("DESCRIPTION:"),
  )!;
  assert.ok(ajeno.includes("la lleva Santiago Viveros"));
});
