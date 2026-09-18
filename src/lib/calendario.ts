import { getPrisma } from "@/lib/prisma";
import {
  diaDeLaSemana,
  diaISO,
  esHoraValida,
  etiquetaDeDuracion,
  fraseDeFrecuencia,
  puntoDe,
  puntoParaMaquina,
  type PuntoEnElMapa,
} from "@/lib/reunion-catalogo";

/// **El calendario de reuniones de una persona, como archivo .ics.**
///
/// Lo que se publica es un **feed de suscripción**: la persona lo añade una vez
/// a Google Calendar o al iPhone y desde entonces se actualiza solo. Por eso no
/// se manda una lista de fechas sino una **regla de repetición** (`RRULE`): el
/// calendario del teléfono genera las reuniones hasta el infinito sin que este
/// servidor tenga que decidir hasta cuándo.
///
/// ⚠️ **La URL es la única credencial.** Los calendarios no saben iniciar
/// sesión, así que quien tenga el enlace ve estas reuniones. De ahí que el
/// token sea largo, propio de cada cuenta, y se pueda rehacer.

/// Una reunión, ya lista para escribirse.
export type ReunionParaCalendario = {
  id: string;
  nombre: string;
  weekday: number;
  meetingTime: string;
  everyNWeeks: number;
  durationMinutes: number;
  address: string | null;
  /// El punto exacto, si alguien lo marcó con el pin. Va al evento como `GEO`,
  /// y es lo que le permite a quien recibe la reunión en su teléfono pulsar
  /// «Cómo llegar» y aterrizar en la casa.
  punto: PuntoEnElMapa | null;
  /// «AAAA-MM-DD»: desde cuándo se repite.
  inicio: string;
  /// Qué es y qué papel tiene la persona, para la descripción del evento.
  clase: "Alpha" | "Casa de Fe";
  papel: "lleva" | "participa";
  lider: string;
};

/// Genera un token nuevo. 32 caracteres hexadecimales de `crypto`: es una
/// credencial, así que no puede salir de `Math.random`.
export function generarTokenDeCalendario(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/// Las reuniones que le tocan a una cuenta: los grupos que lleva **y los
/// grupos en los que está inscrita como participante**.
///
/// Esa segunda mitad es la que hace útil el calendario para la iglesia entera y
/// no solo para los 20 líderes.
export async function reunionesDeLaCuenta(
  token: string,
): Promise<{ nombre: string; reuniones: ReunionParaCalendario[] } | null> {
  const prisma = await getPrisma();

  const cuenta = await prisma.appUser.findUnique({
    where: { calendarToken: token },
    select: { id: true, active: true, fullName: true, personId: true },
  });
  if (!cuenta || !cuenta.active) return null;

  // El expediente de la propia persona: es por ahí por donde se sabe en qué
  // grupos participa (las inscripciones apuntan al expediente, no a la cuenta).
  const expediente = cuenta.personId
    ? await prisma.learnerProfile.findFirst({
        where: { personId: cuenta.personId },
        select: { id: true },
      })
    : null;

  const donde = { closedAt: null } as const;
  const seleccion = {
    id: true,
    name: true,
    startDate: true,
    weekday: true,
    meetingTime: true,
    everyNWeeks: true,
    durationMinutes: true,
    address: true,
    latitude: true,
    longitude: true,
    leader: { select: { fullName: true } },
  } as const;

  const [alphasQueLleva, casasQueLleva, alphasDondeParticipa, casasDondeParticipa] =
    await prisma.$transaction([
      prisma.alphaProgram.findMany({
        where: { ...donde, leaderId: cuenta.id },
        select: seleccion,
      }),
      prisma.faithHouseGroup.findMany({
        where: { ...donde, leaderId: cuenta.id },
        select: seleccion,
      }),
      prisma.alphaProgram.findMany({
        where: expediente
          ? { ...donde, enrollments: { some: { learnerId: expediente.id } } }
          : { id: "sin-expediente" },
        select: seleccion,
      }),
      prisma.faithHouseGroup.findMany({
        where: expediente
          ? { ...donde, members: { some: { learnerId: expediente.id } } }
          : { id: "sin-expediente" },
        select: seleccion,
      }),
    ]);

  type Fila = (typeof alphasQueLleva)[number];

  const armar = (
    fila: Fila,
    clase: ReunionParaCalendario["clase"],
    papel: ReunionParaCalendario["papel"],
  ): ReunionParaCalendario | null => {
    // Un grupo sin día u hora no se puede poner en un calendario. No es un
    // error: es el estado de los grupos a los que nadie se lo ha puesto aún.
    if (fila.weekday === null || !fila.meetingTime) return null;
    if (!diaDeLaSemana(fila.weekday) || !esHoraValida(fila.meetingTime)) return null;
    return {
      id: fila.id,
      nombre: fila.name,
      weekday: fila.weekday,
      meetingTime: fila.meetingTime,
      everyNWeeks: fila.everyNWeeks,
      durationMinutes: fila.durationMinutes,
      address: fila.address,
      punto: puntoDe(fila.latitude, fila.longitude),
      inicio: diaISO(fila.startDate),
      clase,
      papel,
      lider: fila.leader.fullName,
    };
  };

  const todas = [
    ...alphasQueLleva.map((f) => armar(f, "Alpha", "lleva")),
    ...casasQueLleva.map((f) => armar(f, "Casa de Fe", "lleva")),
    ...alphasDondeParticipa.map((f) => armar(f, "Alpha", "participa")),
    ...casasDondeParticipa.map((f) => armar(f, "Casa de Fe", "participa")),
  ].filter((r): r is ReunionParaCalendario => r !== null);

  // Quien lleva un grupo y además está inscrita en él saldría dos veces.
  const porId = new Map<string, ReunionParaCalendario>();
  for (const r of todas) if (!porId.has(r.id)) porId.set(r.id, r);

  return { nombre: cuenta.fullName, reuniones: [...porId.values()] };
}

/// Escapa un texto para un campo de .ics: comas, punto y coma y barras
/// invertidas son separadores en el formato, y un salto de línea corta el
/// campo. Sin esto, una dirección con coma —o sea, cualquier dirección real—
/// rompería el archivo.
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/// Las líneas de un .ics no pueden pasar de 75 octetos: se parten y las
/// continuaciones empiezan por un espacio. Se cuenta en **bytes y no en
/// caracteres** porque una tilde ocupa dos, y partir por la mitad de una letra
/// produciría un archivo corrupto.
function plegar(linea: string): string {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;

  const trozos: string[] = [];
  let actual = "";
  let cuenta = 0;
  for (const caracter of linea) {
    const ancho = new TextEncoder().encode(caracter).length;
    // 74 para el primer trozo y 73 para los siguientes: el espacio inicial de
    // la continuación también cuenta.
    const tope = trozos.length === 0 ? 74 : 73;
    if (cuenta + ancho > tope) {
      trozos.push(actual);
      actual = "";
      cuenta = 0;
    }
    actual += caracter;
    cuenta += ancho;
  }
  if (actual) trozos.push(actual);
  return trozos.map((t, i) => (i === 0 ? t : ` ${t}`)).join("\r\n");
}

/// El archivo completo.
///
/// Lleva su propia **`VTIMEZONE` de Bogotá** porque un `DTSTART` con `TZID`
/// obliga a ello: sin la definición, algunos clientes se inventan la zona y la
/// reunión de las 7 de la noche aparece a otra hora. Colombia no tiene horario
/// de verano, así que la definición es una sola regla fija de −05:00 — que es
/// justo lo que hace que esto sea sencillo aquí y un lío en otros países.
export function construirIcs(datos: {
  nombre: string;
  reuniones: ReunionParaCalendario[];
  /// De dónde salió el archivo, para el identificador de cada evento.
  dominio: string;
}): string {
  const lineas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Iglesia Vive//Reuniones//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(`Mis reuniones · ${datos.nombre}`)}`,
    "X-WR-TIMEZONE:America/Bogota",
    // Cada cuánto conviene que el cliente vuelva a mirar. Google lo ignora y
    // usa su propio ritmo (de horas), pero el iPhone y Outlook sí lo respetan.
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H",
    "X-PUBLISHED-TTL:PT2H",
    "BEGIN:VTIMEZONE",
    "TZID:America/Bogota",
    "BEGIN:STANDARD",
    "DTSTART:19930404T000000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0500",
    "TZNAME:-05",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const r of datos.reuniones) {
    const dia = diaDeLaSemana(r.weekday);
    if (!dia) continue;

    const [hh, mm] = r.meetingTime.split(":");
    const primera = primeraFecha(r.inicio, r.weekday);
    const compacta = primera.replace(/-/g, "");
    const inicio = `${compacta}T${hh}${mm}00`;

    const descripcion = [
      `${r.clase} · ${r.papel === "lleva" ? "la llevas tú" : `la lleva ${r.lider}`}`,
      `Se reúne los ${dia.plural} a las ${r.meetingTime} · ${fraseDeFrecuencia(r.everyNWeeks)}`,
      `Dura ${etiquetaDeDuracion(r.durationMinutes)}`,
    ].join("\\n");

    lineas.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@${datos.dominio}`,
      // Fijo y no `now()`: si cambiara en cada petición, algunos clientes
      // tratarían el evento como nuevo en cada refresco y duplicarían avisos.
      `DTSTAMP:${compacta}T000000Z`,
      `DTSTART;TZID=America/Bogota:${inicio}`,
      `DURATION:PT${r.durationMinutes}M`,
      `RRULE:FREQ=WEEKLY;INTERVAL=${r.everyNWeeks};BYDAY=${dia.ics}`,
      `SUMMARY:${escapar(r.nombre)}`,
      `DESCRIPTION:${descripcion}`,
      ...(r.address ? [`LOCATION:${escapar(r.address)}`] : []),
      // ⚠️ `GEO` lleva las coordenadas separadas por **punto y coma**, con
      // punto decimal, y **NO se escapa**: aquí el «;» es la sintaxis del
      // campo, no un carácter del texto. Pasarlo por `escapar` lo convertiría
      // en «\;» y el cliente descartaría el campo entero.
      ...(r.punto ? [`GEO:${puntoParaMaquina(r.punto, ";")}`] : []),
      "END:VEVENT",
    );
  }

  lineas.push("END:VCALENDAR");

  // CRLF entre líneas, que es lo que pide el formato.
  return lineas.map(plegar).join("\r\n") + "\r\n";
}

/// El primer día de la serie: el primer `weekday` a partir del inicio del
/// grupo. El `DTSTART` de un evento con `RRULE` **tiene que caer en el día de
/// la repetición**; si no, algunos clientes añaden una reunión extra ese día.
function primeraFecha(inicio: string, weekday: number): string {
  const [a, m, d] = inicio.split("-").map(Number);
  let fecha = Date.UTC(a, m - 1, d);
  while (new Date(fecha).getUTCDay() !== weekday) fecha += 86_400_000;
  const f = new Date(fecha);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${f.getUTCFullYear()}-${z(f.getUTCMonth() + 1)}-${z(f.getUTCDate())}`;
}
