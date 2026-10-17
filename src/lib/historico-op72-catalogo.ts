import type { Extremo } from "@/lib/informe-detalle-catalogo";

/// **El histórico de Operación 72: qué se dibuja y por qué.**
///
/// Lo que de esto necesita el navegador. Aparte de `historico-op72.ts` por la
/// regla del 6-sep: ese módulo consulta la base, así que si un componente de
/// cliente importara de ahí, `pg` acabaría en el paquete del navegador (§12.4).
///
/// ## Dos decisiones que salieron de medir, no de diseñar
///
/// **1. Las salidas van en su propia gráfica, no en la línea de arriba.**
/// Medido el 16-oct sobre las 7 semanas de sep-oct: de 211 bajas, **198 se
/// hicieron en ocho días**, y 67 de ellas en uno solo, por una sola persona.
/// Son limpiezas de lista, no trabajo semanal de consolidación. Sumadas a la
/// línea del recorrido, la semana del 28-sep pasaría de 25 a 99 movimientos y
/// la gráfica dejaría de medir lo que dice medir.
///
/// **2. Un panel por salto, cada uno con su escala.** En esas mismas semanas
/// los saltos van de 0 a 18 por semana salvo uno, que tuvo un pico de 55. En
/// una escala compartida, cinco de los seis quedan pegados al suelo. Y la
/// rampa de azules del tablero **falla el validador de color** como 6 series
/// juntas (ΔE 12,4 entre pasos vecinos, por debajo del mínimo de 15: no se
/// distinguen ni con visión normal). Con paneles, el color deja de cargar
/// información y la carga el título.

/// Los seis pasos del recorrido que tienen panel propio. Son los de
/// `TRANSICIONES` en `op72.ts` —el camino que el equipo sigue de verdad— más
/// la entrada. Lo que no cabe aquí se cuenta aparte, no se esconde.
export const PASOS_RECORRIDO = [
  {
    clave: "entraron",
    desde: "NUEVA",
    hacia: "INICIADA",
    titulo: "Entraron al tablero",
    pie: "Se registró a la persona",
  },
  {
    clave: "no-contesto",
    desde: "INICIADA",
    hacia: "SEGUIMIENTO",
    titulo: "Iniciada → Seguimiento",
    pie: "Llamaron y no contestó",
  },
  {
    clave: "contesto-primera",
    desde: "INICIADA",
    hacia: "CONTACTADA",
    titulo: "Iniciada → Contactada",
    pie: "Contestó a la primera llamada",
  },
  {
    clave: "contesto-despues",
    desde: "SEGUIMIENTO",
    hacia: "CONTACTADA",
    titulo: "Seguimiento → Contactada",
    pie: "Contestó al volver a llamar",
  },
  {
    clave: "visita-acordada",
    desde: "CONTACTADA",
    hacia: "VISITA_PENDIENTE",
    titulo: "Contactada → Visita pendiente",
    pie: "Se acordó la visita",
  },
  {
    clave: "visita-cumplida",
    desde: "VISITA_PENDIENTE",
    hacia: "LISTA_PARA_ENTREGA",
    titulo: "Visita pendiente → Lista",
    pie: "Se cumplió la visita",
  },
  // ⚠️ Este panel NO estaba en el diseño y lo pidió el dato. Al sumar los seis
  // primeros salían 286 movimientos contra los 480 de la línea de arriba: el
  // 40 % no aparecía en ningún panel. De ese resto, **56 eran este salto** —el
  // más frecuente de todos los que faltaban—, y no es un caso raro: significa
  // que se llenó el formulario de VISITA sin haber llenado antes el de
  // LLAMADA, así que la tarjeta se saltó «contactada». Merece verse, porque
  // dice que el formulario de llamadas no se está usando.
  {
    clave: "visita-sin-llamada",
    desde: "INICIADA",
    hacia: "VISITA_PENDIENTE",
    titulo: "Iniciada → Visita pendiente",
    pie: "Se agendó la visita sin registrar la llamada",
  },
] as const satisfies readonly {
  clave: string;
  desde: Extremo;
  hacia: Extremo;
  titulo: string;
  pie: string;
}[];

export type PasoRecorrido = (typeof PASOS_RECORRIDO)[number];

/// **Las tres puertas de salida, en su propia gráfica.** El mismo reparto que
/// el ⊖ del tablero: entregada a su mentor es el final bueno, asistente es que
/// no quiso proceso, baja es que se perdió.
///
/// ⚠️ **Los colores NO son los tres de la marca, y la razón está medida.** El
/// primer intento fue `verde-700 · ambar-barra · rojo` y **falla el validador**:
/// el ámbar y el rojo de la marca quedan a ΔE 13,4 con visión normal, por
/// debajo del mínimo de 15 — puestos como dos líneas en la misma gráfica, no se
/// distinguen ni mirándolos de frente. Se volvieron a escoger los pasos hasta
/// dar con tres que pasan: **ΔE 12,3 con protanopía y 20,2 con visión normal**,
/// conservando el rojo exacto de la marca.
///
/// Queda un aviso de contraste en el ámbar (2,25:1 sobre el papel), y ese no se
/// puede descartar: obliga a etiquetas visibles o a una vista en tabla. La
/// pantalla trae **las dos** — la leyenda nombra cada serie con su total y
/// debajo está la tabla entera. El color nunca viaja solo.
export const PUERTAS_SALIDA = [
  { clave: "entregadas", hacia: "ENTREGADA", titulo: "Entregadas a mentor", color: "#5c8a46" },
  { clave: "asistentes", hacia: "CERRADA", titulo: "Pasaron a asistentes", color: "#dba029" },
  { clave: "bajas", hacia: "BAJA", titulo: "Dadas de baja", color: "#b4462f" },
] as const satisfies readonly {
  clave: string;
  hacia: Extremo;
  titulo: string;
  color: string;
}[];

export type PuertaSalida = (typeof PUERTAS_SALIDA)[number];

/// Los tres destinos que sacan a alguien del tablero.
export const FUERA_DEL_TABLERO: Extremo[] = ["ENTREGADA", "CERRADA", "BAJA"];

/// Un punto de cualquier serie. La etiqueta viene escrita del servidor, en
/// hora de Colombia (§12.1).
export type Punto = {
  /// El primer día del cubo, «AAAA-MM-DD». Es la clave y también lo que se
  /// manda al abrir el detalle de ese tramo.
  dia: string;
  /// «5 oct» o «octubre», según el grano.
  etiqueta: string;
  /// El último día del cubo, para pedir el detalle de ese tramo exacto.
  fin: string;
  valor: number;
  /// **El tramo todavía no ha terminado.** Es casi siempre el último: la
  /// semana en curso lleva dos días y el mes en curso, diez. Sin decirlo, la
  /// línea se desploma al final SIEMPRE y parecería que el equipo dejó de
  /// trabajar — un aviso falso cada semana. Se dibuja con trazo discontinuo y
  /// se nombra «en curso».
  parcial: boolean;
};

export type Serie = {
  clave: string;
  titulo: string;
  pie: string;
  desde: Extremo;
  hacia: Extremo;
  puntos: Punto[];
  total: number;
  /// El tope de ESTE panel. Va escrito en pantalla porque es lo único que
  /// impide comparar alturas entre paneles que no comparten escala.
  tope: number;
};

export type Historico = {
  /// El pulso: cuántos movimientos del recorrido hubo en cada tramo. Una sola
  /// serie, así que el título la nombra y no hace falta leyenda.
  pulso: Punto[];
  pulsoTotal: number;
  pulsoTope: number;
  /// Un panel por salto, con su propia escala.
  pasos: Serie[];
  /// Las tres puertas de salida, en una gráfica con leyenda.
  salidas: Serie[];
  salidasTotal: number;
  salidasTope: number;
  /// Movimientos que no siguieron ninguno de los seis pasos ni salieron: saltos
  /// de carril, correcciones a mano, regresos. Se dicen, no se esconden.
  fueraDeCarril: number;
  /// Los que se volvieron a intentar y la tarjeta no se movió.
  giros: number;
  /// true cuando el periodo empieza antes de que hubiera auditoría.
  antesDeLaAuditoria: boolean;
  /// Cuántos movimientos no tienen columna de origen conocida.
  sinOrigen: number;
};

/// El alto en píxeles del área de dibujo de cada forma. Están aquí y no en el
/// componente porque las rutas SVG se calculan **en el servidor**: así el
/// navegador recibe la gráfica ya dibujada y no hay un salto de maquetación al
/// hidratar.
export const ALTO_PULSO = 170;
export const ALTO_PANEL = 54;
export const ALTO_SALIDAS = 150;
export const ANCHO_VISTA = 1000;

/// Las dos rutas de una línea, en coordenadas de `viewBox`.
///
/// **El último tramo se devuelve aparte cuando está en curso**, para dibujarlo
/// con trazo discontinuo. Sin eso, la línea cae a plomo al final de todas las
/// gráficas —la semana en curso lleva dos días— y parecería un derrumbe cada
/// vez que alguien abre la pantalla.
///
/// Con un solo punto se dibuja un trazo corto horizontal: una línea de un punto
/// no se ve, y un periodo de una semana es un caso normal, no un error.
export function rutasDeLinea(
  puntos: Punto[],
  tope: number,
  alto: number,
): { firme: string; enCurso: string } {
  if (puntos.length === 0) return { firme: "", enCurso: "" };
  const coordenadas = puntosEnCoordenadas(puntos, tope, alto);

  if (coordenadas.length === 1) {
    const [{ x, y }] = coordenadas;
    const trazo = `M${Math.max(x - 12, 0)},${y} L${x + 12},${y}`;
    return puntos[0].parcial ? { firme: "", enCurso: trazo } : { firme: trazo, enCurso: "" };
  }

  const ultimoEnCurso = puntos[puntos.length - 1].parcial;
  const firmes = ultimoEnCurso ? coordenadas.slice(0, -1) : coordenadas;
  const firme = firmes.map(({ x, y }, i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");

  if (!ultimoEnCurso) return { firme, enCurso: "" };

  const penultimo = coordenadas[coordenadas.length - 2];
  const ultimo = coordenadas[coordenadas.length - 1];
  return { firme, enCurso: `M${penultimo.x},${penultimo.y} L${ultimo.x},${ultimo.y}` };
}

export function puntosEnCoordenadas(puntos: Punto[], tope: number, alto: number) {
  const divisor = Math.max(tope, 1);
  const paso = puntos.length > 1 ? ANCHO_VISTA / (puntos.length - 1) : 0;
  return puntos.map((punto, i) => ({
    ...punto,
    x: puntos.length > 1 ? i * paso : ANCHO_VISTA / 2,
    // 4 px de margen arriba para que el punto más alto no se corte.
    y: alto - 4 - (punto.valor / divisor) * (alto - 8),
  }));
}

/// El tope de una serie, redondeado hacia arriba para que la línea no toque el
/// techo. Nunca menos de 1: dividir entre 0 pinta `NaN` en el atributo `d` y
/// la gráfica desaparece sin error en consola.
export function topeDe(valores: number[]): number {
  return Math.max(...valores, 1);
}
