import { diaDeLaSemanaDe } from "@/lib/reunion-catalogo";

/// **GI · Generación Imparable**: el catálogo, puro y sin base de datos.
///
/// Vive aparte de `gi.ts` por la regla del 6-sep-2026: lo que usa el navegador
/// va en el catálogo; lo que toca Prisma, en el módulo de datos. Aquí no se
/// importa nada que arrastre `pg`.
///
/// ⚠️ **Todo el tiempo se cuenta en FECHAS CIVILES «AAAA-MM-DD», nunca con
/// `Date`.** «El devocional del martes 22» es un día, no un instante: si se
/// guardara con hora habría que inventarse una y convertirla en cada lectura,
/// que es exactamente la trampa de las cinco horas del 11-sep-2026. Es la misma
/// decisión que tomó `reunion-catalogo.ts` con la hora de las reuniones.

const UN_DIA = 86_400_000;

function comoNumero(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`);
}

function comoDia(valor: number): string {
  return new Date(valor).toISOString().slice(0, 10);
}

/// El día siguiente / anterior, en fecha civil. Suma y resta sobre UTC a
/// propósito: hacerlo con la hora local del servidor —que en Cloudflare es
/// UTC, pero podría no serlo— correría el día en el borde de la medianoche.
export function diaSiguiente(dia: string, cuantos = 1): string {
  return comoDia(comoNumero(dia) + cuantos * UN_DIA);
}

export function diaAnterior(dia: string, cuantos = 1): string {
  return diaSiguiente(dia, -cuantos);
}

/// El largo mínimo de una observación, como en los demás paneles: una nota de
/// tres letras no le explica nada a quien la lea dentro de seis meses.
export const LARGO_MINIMO_OBSERVACION = 10;

/// Días sin una sola marca tras los que el joven sale en ámbar.
///
/// **No significa que no esté haciendo el devocional**: significa que nadie lo
/// está registrando, que es justo lo que la pantalla sirve para ver.
export const DIAS_SIN_MARCAR_AVISA = 5;

// ------------------------------------------------------------ los días

/// ⚠️ **Un día que todavía no ha llegado NO se puede marcar.**
///
/// Sin esta regla, el domingo por la mañana se podría dejar marcada la semana
/// entera, y el conteo diría que el movimiento va al 100 % cuando lo que hubo
/// fue un clic. Lo que se registra es lo que ya pasó.
export function esDiaFuturo(dia: string, hoy: string): boolean {
  return dia > hoy;
}

/// Cuántos días de esa lista ya ocurrieron (hoy incluido). Es el denominador
/// honesto de «11 de 15»: contar los siete días de la semana el martes daría
/// un porcentaje que solo puede empeorar.
export function diasQueYaPasaron(dias: readonly string[], hoy: string): string[] {
  return dias.filter((dia) => !esDiaFuturo(dia, hoy));
}

export type ResumenDeDevocionales = {
  /// Días que ya ocurrieron dentro del tramo.
  posibles: number;
  /// De esos, cuántos quedaron marcados.
  hechos: number;
};

export function resumenDeDevocionales(
  dias: readonly string[],
  marcados: ReadonlySet<string>,
  hoy: string,
): ResumenDeDevocionales {
  const pasados = diasQueYaPasaron(dias, hoy);
  return {
    posibles: pasados.length,
    hechos: pasados.filter((dia) => marcados.has(dia)).length,
  };
}

/// **Los días corridos que lleva marcados.**
///
/// ⚠️ Si hoy no está marcado, la racha se cuenta desde AYER y no se corta.
/// Marcar es algo que hace el líder, no el joven, y casi siempre lo hace por la
/// tarde: cortar la racha a las 7 de la mañana diría que alguien falló cuando
/// lo único que pasó es que el día no ha terminado.
export function rachaAlDia(marcados: ReadonlySet<string>, hoy: string): number {
  let dia = marcados.has(hoy) ? hoy : diaAnterior(hoy);
  let cuantos = 0;
  while (marcados.has(dia)) {
    cuantos += 1;
    dia = diaAnterior(dia);
  }
  return cuantos;
}

/// Días transcurridos desde la última marca. `null` cuando no hay ninguna —que
/// **no es lo mismo que cero**: es que no consta que nadie lo haya registrado
/// nunca, y la pantalla lo dice con otras palabras.
export function diasSinMarcar(
  marcados: readonly string[],
  hoy: string,
): number | null {
  if (!marcados.length) return null;
  const ultima = marcados.reduce((a, b) => (a > b ? a : b));
  return Math.round((comoNumero(hoy) - comoNumero(ultima)) / UN_DIA);
}

// ------------------------------------------------------------ el mes

/// El mes de una fecha civil, como «AAAA-MM».
export function mesDe(dia: string): string {
  return dia.slice(0, 7);
}

/// Corre un mes «AAAA-MM» hacia adelante o hacia atrás. Se hace con aritmética
/// de meses y no de días porque los meses no miden lo mismo — es la misma
/// lección del informe del 7-sep-2026.
export function correrMes(mes: string, cuantos: number): string {
  const [anio, numero] = mes.split("-").map(Number);
  const total = anio * 12 + (numero - 1) + cuantos;
  const z = (n: number) => String(n).padStart(2, "0");
  return `${Math.floor(total / 12)}-${z((total % 12) + 1)}`;
}

/// Los días de un mes, en fechas civiles.
export function diasDelMes(mes: string): string[] {
  const primero = `${mes}-01`;
  const dias: string[] = [];
  let dia = primero;
  while (mesDe(dia) === mes) {
    dias.push(dia);
    dia = diaSiguiente(dia);
  }
  return dias;
}

/// **La rejilla del mes, de lunes a domingo**, con los huecos del principio.
///
/// Los huecos son `null` y no un día de otro mes: pintar el 31 de agosto en la
/// casilla del lunes invitaría a marcarlo desde el calendario de septiembre, y
/// esa marca caería en un mes que no se está mirando.
export function rejillaDelMes(mes: string): (string | null)[] {
  const dias = diasDelMes(mes);
  // 0 = domingo en la convención de JavaScript, y aquí la semana empieza en
  // lunes, así que el domingo va a la séptima casilla y no a la primera.
  const huecos = (diaDeLaSemanaDe(dias[0]) + 6) % 7;
  return [...Array.from({ length: huecos }, () => null), ...dias];
}

const NOMBRE_DEL_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/// «Septiembre de 2026». Se arma a mano y no con `Intl` porque la entrada es
/// una fecha civil, no un `Date`: pasarla por un formateador con zona horaria
/// la correría un día —y con él, a veces, el mes entero.
export function mesLegible(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const nombre = NOMBRE_DEL_MES[numero - 1] ?? mes;
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} de ${anio}`;
}

/// «22 sep», desde una fecha civil y sin pasar por `Date`.
export function diaCivilCorto(dia: string): string {
  const [, mes, numero] = dia.split("-");
  const nombre = NOMBRE_DEL_MES[Number(mes) - 1] ?? mes;
  return `${Number(numero)} ${nombre.slice(0, 3)}`;
}

/// «Martes 22 de septiembre», para encabezar una observación.
export function diaCivilLargo(dia: string): string {
  const semana = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  const [, mes, numero] = dia.split("-");
  const nombre = semana[diaDeLaSemanaDe(dia)];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${Number(numero)} de ${
    NOMBRE_DEL_MES[Number(mes) - 1] ?? mes
  }`;
}
