/// Lo del desglose del informe que también necesita el navegador.
///
/// Aparte de `informe-detalle.ts` por la regla del 6-sep: ese módulo consulta la
/// base de datos, así que si un componente de cliente importara de ahí, `pg`
/// acabaría en el paquete del navegador y el build se cae.
///
/// ⚠️ **Aquí no se formatea ninguna fecha.** Todas las filas llegan del servidor
/// con el día y la hora ya escritos en hora de Colombia: formatear en el
/// navegador es la trampa de las cinco horas (§12.1 de CLAUDE.md), y encima el
/// reloj del visitante no tiene por qué estar en Colombia.

/// Los seis indicadores del informe que se pueden abrir. Son exactamente los
/// seis recuadros de arriba: si se añade uno, va aquí y en `TITULO_INDICADOR`.
export const INDICADORES = [
  "personas-nuevas",
  "llamadas",
  "visitas",
  "entregadas",
  "hitos",
  "bajas",
] as const;

export type Indicador = (typeof INDICADORES)[number];

export function indicadorValido(valor: string | undefined): Indicador | null {
  return INDICADORES.includes(valor as Indicador) ? (valor as Indicador) : null;
}

/// El rótulo del recuadro, tal como ya se pintaba.
export const ROTULO_INDICADOR: Record<Indicador, string> = {
  "personas-nuevas": "PERSONAS NUEVAS",
  llamadas: "LLAMADAS",
  visitas: "VISITAS",
  entregadas: "ENTREGADAS",
  hitos: "HITOS",
  bajas: "BAJAS",
};

/// **Las pestañas, que solo tienen dos indicadores**: los dos cuyo total
/// esconde dos hechos distintos.
///
/// - **Llamadas**: las marcaciones del discador frente a las que quedaron
///   registradas en el formulario, que es lo único que mueve la tarjeta (§6).
/// - **Visitas**: las que **se cumplieron** frente a las que solo se
///   **acordaron**. Aparecer en visitas significa que la visita se concretó
///   (decisión del usuario, 16-oct-2026).
export const PESTANAS_LLAMADAS = ["todas", "registradas", "sin-registrar"] as const;
export const PESTANAS_VISITAS = ["cumplidas", "acordadas"] as const;

export type Pestana =
  | (typeof PESTANAS_LLAMADAS)[number]
  | (typeof PESTANAS_VISITAS)[number];

/// Con qué pestaña abre cada indicador. Visitas abre en **cumplidas** porque es
/// la cifra del recuadro: la ventana tiene que explicar el número que se clicó.
export function pestanaPorDefecto(indicador: Indicador): Pestana {
  return indicador === "visitas" ? "cumplidas" : "todas";
}

export function pestanaValida(indicador: Indicador, valor: string | undefined): Pestana {
  const permitidas: readonly string[] =
    indicador === "visitas" ? PESTANAS_VISITAS : PESTANAS_LLAMADAS;
  return permitidas.includes(valor ?? "")
    ? (valor as Pestana)
    : pestanaPorDefecto(indicador);
}

/// Los cinco tonos de etiqueta del sistema. Se decide en servidor y el cliente
/// solo traduce a clases, para que ningún color se escriba a mano dos veces.
export type Tono = "neutro" | "azul" | "verde" | "ambar" | "rojo";

export const CLASES_TONO: Record<Tono, string> = {
  neutro: "bg-[rgba(19,28,36,.07)] text-[rgba(19,28,36,.68)]",
  azul: "bg-azul-100 text-azul-700",
  verde: "bg-verde-100 text-verde-700",
  ambar: "bg-ambar-chip text-ambar-texto",
  rojo: "bg-rojo-fondo text-rojo",
};

export const CLASES_TONO_TEXTO: Record<Tono, string> = {
  neutro: "text-[rgba(19,28,36,.55)]",
  azul: "text-azul-700",
  verde: "text-verde-700",
  ambar: "text-ambar-texto",
  rojo: "text-rojo",
};

export type Etiqueta = { texto: string; tono: Tono };

/// Una fila del desglose, con todo ya resuelto en servidor.
export type FilaDetalle = {
  id: string;
  /// «jue 15 oct». Vacío cuando la fila no tiene fecha propia.
  dia: string;
  /// «5:02 p. m.».
  hora: string;
  nombre: string;
  /// Para el enlace al expediente. Nulo cuando no se pudo resolver la persona
  /// (una marcación a un número que no está en la base, por ejemplo): entonces
  /// **no se pinta como enlace**, porque un enlace que no abre es peor que
  /// ninguno (§12.6).
  learnerId: string | null;
  /// La línea gris de debajo: quién lo hizo, el consolidador, la duración…
  contexto: string | null;
  /// Lo que escribió el equipo, entre comillas.
  observacion: string | null;
  /// La etiqueta de la derecha (el estado, el tipo de hito…).
  chip: Etiqueta | null;
  /// Una segunda marca pequeña bajo el chip («✓ registrada», «siguió
  /// avanzando»).
  marca: Etiqueta | null;
};

/// Lo que el servidor devuelve para pintar la ventana. Los textos vienen
/// hechos: así la ventana no tiene que saber nada del dominio.
export type Desglose = {
  rotulo: string;
  titulo: string;
  subtitulo: string;
  /// El recuadro ámbar de arriba, solo cuando hay algo que hacer. Un aviso que
  /// sale siempre se deja de leer (§12.6).
  aviso: string | null;
  /// La clave va como texto, no como `Pestana`: la misma ventana la usan el
  /// informe y el tablero de Operación 72, y cada uno tiene sus pestañas. Quien
  /// la reciba la vuelve a validar contra SU lista cerrada antes de usarla —
  /// viene del navegador.
  pestanas: { clave: string; etiqueta: string; activa: boolean }[] | null;
  filas: FilaDetalle[];
  total: number;
  pie: string;
  enlace: { texto: string; href: string } | null;
};

// ------------------------------------------------- El histórico de Operación 72

/// Los extremos de un salto. Además de los siete estados, dos casos que no son
/// estados: la tarjeta acaba de entrar, o entró antes de que existiera la
/// auditoría (15-ago-2026) y no se sabe de dónde venía.
export const EXTREMOS = [
  "NUEVA",
  "SIN_REGISTRO",
  "INICIADA",
  "SEGUIMIENTO",
  "CONTACTADA",
  "VISITA_PENDIENTE",
  "LISTA_PARA_ENTREGA",
  "ENTREGADA",
  "CERRADA",
] as const;

export type Extremo = (typeof EXTREMOS)[number];

export function extremoValido(valor: string | undefined): Extremo | null {
  return EXTREMOS.includes(valor as Extremo) ? (valor as Extremo) : null;
}

export const ETIQUETA_EXTREMO: Record<Extremo, string> = {
  NUEVA: "Recién registrada",
  SIN_REGISTRO: "Sin registro previo",
  INICIADA: "Iniciada",
  SEGUIMIENTO: "Seguimiento",
  CONTACTADA: "Contactada",
  VISITA_PENDIENTE: "Visita pendiente",
  LISTA_PARA_ENTREGA: "Lista para entrega",
  ENTREGADA: "Entregada",
  CERRADA: "Asistente de la iglesia",
};

/// El orden del recorrido. `Operation72Status` no lo garantiza.
const PUESTO: Record<Extremo, number> = {
  NUEVA: -1,
  SIN_REGISTRO: -1,
  INICIADA: 0,
  SEGUIMIENTO: 1,
  CONTACTADA: 2,
  VISITA_PENDIENTE: 3,
  LISTA_PARA_ENTREGA: 4,
  ENTREGADA: 5,
  CERRADA: 6,
};

/// En qué bloque se cuenta cada salto. **El orden de las reglas importa**, y la
/// primera es la que cambia la lectura: caer en SEGUIMIENTO nunca es un avance
/// aunque la columna esté más adelante que INICIADA — significa que se llamó y
/// no contestaron.
export const GRUPOS_SALTO = [
  "entrada",
  "avance",
  "sin-contacto",
  "salida",
  "retroceso",
] as const;

export type GrupoSalto = (typeof GRUPOS_SALTO)[number];

export function grupoDelSalto(desde: Extremo, hacia: Extremo): GrupoSalto {
  if (desde === "NUEVA") return "entrada";
  if (hacia === "CERRADA") return "salida";
  if (hacia === "SEGUIMIENTO") return "sin-contacto";
  if (PUESTO[hacia] > PUESTO[desde]) return "avance";
  if (PUESTO[hacia] < PUESTO[desde]) return "retroceso";
  return "sin-contacto";
}

export const TITULO_GRUPO: Record<GrupoSalto, string> = {
  entrada: "ENTRARON AL TABLERO",
  avance: "AVANZARON",
  "sin-contacto": "SE LLAMÓ Y NO CONTESTÓ",
  salida: "SALIERON A ASISTENTES",
  retroceso: "VOLVIERON ATRÁS",
};

export const TONO_GRUPO: Record<GrupoSalto, Tono> = {
  entrada: "azul",
  avance: "verde",
  "sin-contacto": "ambar",
  salida: "neutro",
  retroceso: "rojo",
};

/// El orden en que se pintan los bloques: primero lo que avanzó, porque es lo
/// que se quiere leer; lo que entró, al final, que ya se ve en el recuadro de
/// personas nuevas.
export const ORDEN_GRUPOS: GrupoSalto[] = [
  "avance",
  "sin-contacto",
  "salida",
  "retroceso",
  "entrada",
];

export type Salto = {
  desde: Extremo;
  hacia: Extremo;
  cuantas: number;
  grupo: GrupoSalto;
};

export type MovimientosOp72 = {
  saltos: Salto[];
  total: number;
  /// Cuántos movimientos quedaron sin columna de origen conocida. Son las
  /// tarjetas que ya existían cuando empezó la auditoría: se dicen, no se
  /// esconden.
  sinOrigen: number;
  /// true cuando el periodo pedido empieza antes de que hubiera auditoría, así
  /// que el histórico está incompleto por fuerza y hay que avisarlo.
  antesDeLaAuditoria: boolean;
};

/// Un salto por bloque, ya ordenado y con el subtotal de cada uno.
export function agruparSaltos(saltos: Salto[]) {
  return ORDEN_GRUPOS.map((grupo) => {
    const suyos = saltos
      .filter((salto) => salto.grupo === grupo)
      .sort((a, b) => b.cuantas - a.cuantas);
    return {
      grupo,
      saltos: suyos,
      subtotal: suyos.reduce((suma, salto) => suma + salto.cuantas, 0),
    };
  }).filter((bloque) => bloque.saltos.length > 0);
}

/// El texto del renglón: «Iniciada → Contactada». Para los dos extremos que no
/// son estados se dice lo que son, sin flecha de origen.
export function tituloDelSalto(desde: Extremo, hacia: Extremo): string {
  if (desde === "NUEVA") return `Entró en ${ETIQUETA_EXTREMO[hacia].toLowerCase()}`;
  return `${ETIQUETA_EXTREMO[desde]} → ${ETIQUETA_EXTREMO[hacia]}`;
}
