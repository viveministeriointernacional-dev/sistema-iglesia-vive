import type { Etiqueta } from "@/lib/informe-detalle-catalogo";
import { ZONA_HORARIA } from "@/lib/dominio";

/// **Cómo se escribe una fila de cualquier ventana de detalle.**
///
/// Vivían dentro de `informe-detalle.ts`, que es donde nacieron. Salieron aquí
/// el 16-oct-2026, cuando el tablero de Operación 72 estrenó sus propias
/// ventanas (el ⊕ de cada lista y el ⊖ de las salidas): dos módulos distintos
/// pintan las mismas filas, y **el día y la hora no pueden escribirse dos
/// veces**. Duplicar ese formato es exactamente cómo se cuela la trampa de las
/// cinco horas (§12.1): basta que una copia se quede sin `timeZone` para que
/// todo lo posterior a las 7 p. m. salga con la fecha del día siguiente.
///
/// Las fechas se formatean **aquí, en el servidor**, en hora de Colombia, y
/// viajan ya hechas: el reloj del visitante no tiene por qué estar en Neiva.

const DIA_FILA = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: ZONA_HORARIA,
});

const HORA_FILA = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

export function dia(fecha: Date) {
  return DIA_FILA.format(fecha).replace(".", "").replace(",", "");
}

export function hora(fecha: Date) {
  return HORA_FILA.format(fecha);
}

export function nombreDe(first: string, last: string | null) {
  return [first, last].filter(Boolean).join(" ");
}

/// Junta las piezas de la línea gris saltándose las que están en blanco: un
/// dato que falta no deja un « · » colgando.
export function contexto(...piezas: (string | null | undefined)[]) {
  const limpias = piezas.filter((pieza): pieza is string => Boolean(pieza));
  return limpias.length > 0 ? limpias.join(" · ") : null;
}

/// Las observaciones del equipo vienen de un campo libre y algunas son varios
/// párrafos (medido: 260 caracteres en una sola llamada del 16-oct). En la
/// ventana se recortan para que una fila no empuje a las demás fuera de la
/// pantalla; el expediente las tiene completas.
const TOPE_OBSERVACION = 200;

export function comillas(texto: string | null | undefined) {
  const limpio = texto?.trim().replace(/\s+/g, " ");
  if (!limpio) return null;
  if (limpio.length <= TOPE_OBSERVACION) return `«${limpio}»`;
  return `«${limpio.slice(0, TOPE_OBSERVACION).trimEnd()}…»`;
}

export const ETIQUETA_ESTADO: Record<string, Etiqueta> = {
  INICIADA: { texto: "Iniciada", tono: "neutro" },
  SEGUIMIENTO: { texto: "Seguimiento", tono: "ambar" },
  CONTACTADA: { texto: "Contactada", tono: "azul" },
  VISITA_PENDIENTE: { texto: "Visita pendiente", tono: "verde" },
  LISTA_PARA_ENTREGA: { texto: "Lista para entrega", tono: "verde" },
  ENTREGADA: { texto: "Entregada", tono: "verde" },
  CERRADA: { texto: "Asistente", tono: "neutro" },
};

/// Dónde está hoy la persona, para el chip de la derecha.
///
/// ⚠️ **El estado del expediente manda sobre el de la tarjeta.** Dar de baja
/// deja la Operación 72 en `CERRADA`, que es el mismo estado que «pasó a
/// asistente de la iglesia»: mirando solo la tarjeta, la ventana de bajas
/// diría «Hoy: asistente» de cada persona que se perdió. Son dos desenlaces
/// opuestos y solo los distingue `learner_profile.status`.
export function estadoHoy(
  status: string | null,
  estadoDelExpediente?: string | null,
): Etiqueta | null {
  if (estadoDelExpediente === "RETIRADO") {
    return { texto: "Hoy: dada de baja", tono: "rojo" };
  }
  if (!status) return null;
  const base = ETIQUETA_ESTADO[status];
  if (!base) return null;
  return { texto: `Hoy: ${base.texto.toLowerCase()}`, tono: base.tono };
}

/// Cómo salió la llamada, en palabras. `CallOutcome` del esquema.
export const ETIQUETA_RESULTADO: Record<string, string> = {
  CONTESTO_BIEN: "contestó bien",
  CONTESTO_REPROGRAMO: "contestó, reprogramó",
  CONTESTO_REGULAR: "contestó, regular",
  CONTESTO_MAL: "contestó mal",
  NO_CONTESTO: "no contestó",
};

export function pieDe(mostradas: number, total: number, singular: string, plural: string) {
  if (total === 0) return `No hubo ${plural} en este periodo.`;
  if (mostradas >= total) {
    return total === 1 ? `Una ${singular}.` : `Las ${total} ${plural}, de la más reciente a la más antigua.`;
  }
  return `Mostrando las ${mostradas} más recientes de ${total}.`;
}

/// Cuántas filas trae una ventana. Medido el 15-oct-2026: en una semana el
/// indicador más grande son 89 marcaciones, pero en un mes son 735 — por eso
/// hay tope y por eso el pie dice siempre cuántas se están viendo.
export const TOPE = 60;

/// **Quién movió la tarjeta, cuando no hay cuenta detrás.**
///
/// Sin actor significa que el movimiento entró por el formulario público de
/// HighLevel, que es como trabaja el equipo de consolidación: no tienen cuenta
/// en la plataforma (§6). Decir «lo movió el sistema» sería falso — lo movió
/// una persona, llenando el formulario. Medido el 16-oct: **6 de cada 7
/// movimientos no tienen actor**, así que esta frase es la que más se lee.
export function quienLoHizo(nombre: string | null) {
  return nombre ? `lo registró ${nombre}` : "entró por el formulario";
}
