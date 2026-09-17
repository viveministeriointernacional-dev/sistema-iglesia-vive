/// **Cuándo y dónde se reúne un grupo**, y cómo eso llega a un mapa y a un
/// calendario.
///
/// Este módulo es **puro**: ni base de datos ni red, así que se puede probar
/// entero (`reunion-catalogo.test.ts`) y lo puede importar un componente de
/// cliente sin arrastrar `pg` al navegador (la regla del 6-sep-2026).
///
/// ⚠️ **Todo el cálculo de días se hace sobre fechas civiles «AAAA-MM-DD», no
/// sobre instantes.** Sumar una semana a «miércoles 23 de septiembre» es
/// aritmética de calendario: convertirlo a `Date` local para sumarle días es
/// justo por donde se cuela la trampa de las cinco horas. Aquí las fechas
/// entran y salen como texto, y `Date.UTC` solo se usa de calculadora.

export type DiaDeLaSemana = {
  /// Convención de JavaScript: 0 = domingo … 6 = sábado.
  valor: number;
  etiqueta: string;
  /// Como se dice en la frase: «se reúne los **miércoles**».
  plural: string;
  /// El código de dos letras que pide el RRULE de un archivo .ics.
  ics: string;
};

export const DIAS_DE_LA_SEMANA: readonly DiaDeLaSemana[] = [
  { valor: 1, etiqueta: "Lunes", plural: "lunes", ics: "MO" },
  { valor: 2, etiqueta: "Martes", plural: "martes", ics: "TU" },
  { valor: 3, etiqueta: "Miércoles", plural: "miércoles", ics: "WE" },
  { valor: 4, etiqueta: "Jueves", plural: "jueves", ics: "TH" },
  { valor: 5, etiqueta: "Viernes", plural: "viernes", ics: "FR" },
  { valor: 6, etiqueta: "Sábado", plural: "sábados", ics: "SA" },
  { valor: 0, etiqueta: "Domingo", plural: "domingos", ics: "SU" },
];

export function diaDeLaSemana(valor: number | null): DiaDeLaSemana | null {
  return DIAS_DE_LA_SEMANA.find((d) => d.valor === valor) ?? null;
}

export const FRECUENCIAS = [
  { valor: 1, etiqueta: "Semana", frase: "cada semana" },
  { valor: 2, etiqueta: "15 días", frase: "cada 15 días" },
] as const;

export const DURACIONES = [
  { valor: 60, etiqueta: "1 hora" },
  { valor: 90, etiqueta: "1 hora y media" },
  { valor: 120, etiqueta: "2 horas" },
] as const;

export function fraseDeFrecuencia(cada: number): string {
  return FRECUENCIAS.find((f) => f.valor === cada)?.frase ?? "cada semana";
}

export function etiquetaDeDuracion(minutos: number): string {
  return (
    DURACIONES.find((d) => d.valor === minutos)?.etiqueta ??
    `${minutos} minutos`
  );
}

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/// La hora que entrega un `<input type="time">`: «19:00». Se valida porque
/// llega del navegador y acaba en el archivo .ics de todo el mundo.
export function esHoraValida(valor: string): boolean {
  return HORA_VALIDA.test(valor);
}

/// «19:00» → «7:00 p. m.». Se escribe a mano y no con `Intl` porque no hay
/// fecha de la que tirar: es una hora suelta, sin día ni zona.
export function horaLegible(hhmm: string): string {
  if (!esHoraValida(hhmm)) return "";
  const [hh, mm] = hhmm.split(":");
  const hora = Number(hh);
  const doceHoras = hora % 12 === 0 ? 12 : hora % 12;
  return `${doceHoras}:${mm} ${hora >= 12 ? "p. m." : "a. m."}`;
}

/// «Los miércoles a las 7:00 p. m. · cada semana», o `null` si al grupo
/// todavía no le han puesto el día y la hora.
export function fraseDeLaReunion(grupo: {
  weekday: number | null;
  meetingTime: string | null;
  everyNWeeks: number;
}): string | null {
  const dia = diaDeLaSemana(grupo.weekday);
  if (!dia || !grupo.meetingTime || !esHoraValida(grupo.meetingTime)) {
    return null;
  }
  return `Los ${dia.plural} a las ${horaLegible(grupo.meetingTime)} · ${fraseDeFrecuencia(grupo.everyNWeeks)}`;
}

// ------------------------------------------------------- fechas civiles

const UN_DIA = 86_400_000;

function aNumeros(dia: string): [number, number, number] {
  const [a, m, d] = dia.split("-").map(Number);
  return [a, m, d];
}

/// La calculadora: una fecha civil como milisegundos UTC. **No es un
/// instante**: es el día a medianoche UTC, que se usa solo para sumar días sin
/// que ningún cambio de hora local mueva el resultado.
function comoNumero(dia: string): number {
  const [a, m, d] = aNumeros(dia);
  return Date.UTC(a, m - 1, d);
}

function comoDia(numero: number): string {
  const f = new Date(numero);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${f.getUTCFullYear()}-${z(f.getUTCMonth() + 1)}-${z(f.getUTCDate())}`;
}

export function diaDeLaSemanaDe(dia: string): number {
  return new Date(comoNumero(dia)).getUTCDay();
}

/// **Las próximas reuniones**, como fechas civiles «AAAA-MM-DD».
///
/// Empieza a contar en la fecha de inicio del grupo, o en `hoy` si el grupo ya
/// arrancó — nunca ofrece una reunión que ya pasó. La periodicidad se cuenta
/// **desde el inicio**, no desde hoy: si se reúnen cada 15 días, cuál de los
/// dos miércoles toca depende de cuándo empezaron.
export function proximasReuniones(
  grupo: {
    weekday: number | null;
    everyNWeeks: number;
    /// El día en que arrancó el grupo, «AAAA-MM-DD».
    inicio: string;
  },
  hoy: string,
  cuantas = 5,
): string[] {
  if (grupo.weekday === null || !diaDeLaSemana(grupo.weekday)) return [];

  const cada = grupo.everyNWeeks >= 1 ? Math.trunc(grupo.everyNWeeks) : 1;

  // La primera reunión de la serie: el primer día correcto desde el inicio.
  let primera = comoNumero(grupo.inicio);
  while (new Date(primera).getUTCDay() !== grupo.weekday) {
    primera += UN_DIA;
  }

  // Se salta hacia adelante en bloques de `cada` semanas hasta llegar a hoy,
  // de un tirón y no día por día: así la serie conserva su ritmo aunque el
  // grupo haya empezado hace un año.
  const desde = comoNumero(hoy);
  const paso = cada * 7 * UN_DIA;
  let actual = primera;
  if (actual < desde) {
    const saltos = Math.ceil((desde - actual) / paso);
    actual += saltos * paso;
  }

  const lista: string[] = [];
  for (let i = 0; i < cuantas; i += 1) {
    lista.push(comoDia(actual));
    actual += paso;
  }
  return lista;
}

// ------------------------------------------------------------- enlaces

/// Abre el punto en Google Maps. **Es un enlace y no un mapa incrustado a
/// propósito**: dibujar el mapa dentro de la página exige una clave de API con
/// facturación activa, y el enlace además abre la app del celular, que es lo
/// que de verdad usa quien va de camino.
export function enlaceDelMapa(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

export function enlaceComoLlegar(direccion: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(direccion)}`;
}

/// El enlace que abre Google Calendar con UNA reunión ya cargada.
///
/// Es un atajo cómodo, pero **es una copia**: si después se cambia la hora en
/// la plataforma, en ese calendario se queda la vieja. Lo que se mantiene al
/// día es el enlace de suscripción (`/calendario/<token>.ics`).
export function enlaceGoogleCalendar(datos: {
  nombre: string;
  /// «AAAA-MM-DD».
  dia: string;
  /// «HH:mm», hora de Colombia.
  hora: string;
  duracionMinutos: number;
  direccion: string | null;
}): string | null {
  if (!esHoraValida(datos.hora)) return null;

  const [a, m, d] = aNumeros(datos.dia);
  const [hh, mm] = datos.hora.split(":").map(Number);
  const z = (n: number) => String(n).padStart(2, "0");

  // Sin `Z`: son horas locales, y `ctz` le dice a Google en qué zona leerlas.
  const inicio = `${a}${z(m)}${z(d)}T${z(hh)}${z(mm)}00`;

  const fin = new Date(Date.UTC(a, m - 1, d, hh, mm) + datos.duracionMinutos * 60_000);
  const finTexto =
    `${fin.getUTCFullYear()}${z(fin.getUTCMonth() + 1)}${z(fin.getUTCDate())}` +
    `T${z(fin.getUTCHours())}${z(fin.getUTCMinutes())}00`;

  const parametros = new URLSearchParams({
    action: "TEMPLATE",
    text: datos.nombre,
    dates: `${inicio}/${finTexto}`,
    ctz: "America/Bogota",
  });
  if (datos.direccion) parametros.set("location", datos.direccion);

  return `https://calendar.google.com/calendar/render?${parametros.toString()}`;
}

// ------------------------------------------------- lo que se guarda

export type DatosDeReunion = {
  weekday: number | null;
  meetingTime: string | null;
  everyNWeeks: number;
  durationMinutes: number;
  address: string | null;
};

export const REUNION_VACIA: DatosDeReunion = {
  weekday: null,
  meetingTime: null,
  everyNWeeks: 1,
  durationMinutes: 90,
  address: null,
};

/// Valida y limpia lo que llega del formulario.
///
/// ⚠️ **El día y la hora van juntos o no van.** Un grupo con día pero sin hora
/// no se puede poner en ningún calendario, y uno con hora pero sin día tampoco:
/// dejar pasar la mitad guardaría un dato que no sirve para nada y que además
/// haría que la ficha dijera cosas raras. Los dos en blanco sí vale — es el
/// estado de los 18 grupos que ya existen.
export function normalizarReunion(crudo: {
  weekday: string | number | null;
  meetingTime: string | null;
  everyNWeeks: string | number;
  durationMinutes: string | number;
  address: string | null;
}): { ok: true; datos: DatosDeReunion } | { ok: false; mensaje: string } {
  const diaTexto =
    crudo.weekday === null || crudo.weekday === "" ? null : String(crudo.weekday);
  const dia = diaTexto === null ? null : Number(diaTexto);
  const hora = crudo.meetingTime?.trim() ? crudo.meetingTime.trim() : null;

  if (dia !== null && !diaDeLaSemana(dia)) {
    return { ok: false, mensaje: "Ese día de la semana no existe." };
  }
  if (hora !== null && !esHoraValida(hora)) {
    return { ok: false, mensaje: "La hora no es válida. Usa el formato 7:00 p. m." };
  }
  if ((dia === null) !== (hora === null)) {
    return {
      ok: false,
      mensaje:
        "Para que el grupo salga en el calendario hacen falta el día y la hora, no solo uno.",
    };
  }

  const cada = Number(crudo.everyNWeeks);
  if (!FRECUENCIAS.some((f) => f.valor === cada)) {
    return { ok: false, mensaje: "Elige cada cuánto se reúnen." };
  }

  const duracion = Number(crudo.durationMinutes);
  if (!DURACIONES.some((d) => d.valor === duracion)) {
    return { ok: false, mensaje: "Elige cuánto dura la reunión." };
  }

  const direccion = crudo.address?.trim() ? crudo.address.trim() : null;
  if (direccion && direccion.length > 300) {
    return { ok: false, mensaje: "La dirección es demasiado larga." };
  }

  return {
    ok: true,
    datos: {
      weekday: dia,
      meetingTime: hora,
      everyNWeeks: cada,
      durationMinutes: duracion,
      address: direccion,
    },
  };
}

/// Un `DateTime @db.Date` de Prisma → «AAAA-MM-DD».
///
/// ⚠️ Lee los componentes **UTC** a propósito. Prisma trae una columna `@db.Date`
/// a medianoche UTC, así que usar `getDate()` (hora local) la correría un día
/// hacia atrás en Colombia — es la segunda mitad de la trampa del 8-sep-2026.
export function diaISO(fecha: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${z(fecha.getUTCMonth() + 1)}-${z(fecha.getUTCDate())}`;
}
