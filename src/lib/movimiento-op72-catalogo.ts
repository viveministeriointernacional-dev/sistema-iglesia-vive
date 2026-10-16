/// **El ⊕ de cada lista y el ⊖ de las salidas, en el tablero de Operación 72.**
///
/// Lo que de esto necesita el navegador. Aparte de `movimiento-op72.ts` por la
/// regla del 6-sep: ese módulo consulta la base, así que si un componente de
/// cliente importara de ahí, `pg` acabaría en el paquete del navegador y el
/// build se cae (§12.4).
///
/// Las cinco listas se escriben aquí como texto y **no** se importa
/// `Operation72Status` del cliente de Prisma: un enum del esquema es un objeto
/// en ejecución, y lo que toca el navegador va en el catálogo.

export const LISTAS = [
  "INICIADA",
  "SEGUIMIENTO",
  "CONTACTADA",
  "VISITA_PENDIENTE",
  "LISTA_PARA_ENTREGA",
] as const;

export type Lista = (typeof LISTAS)[number];

export function listaValida(valor: string | undefined): Lista | null {
  return LISTAS.includes(valor as Lista) ? (valor as Lista) : null;
}

export const ETIQUETA_LISTA: Record<Lista, string> = {
  INICIADA: "Iniciada",
  SEGUIMIENTO: "Seguimiento",
  CONTACTADA: "Contactada",
  VISITA_PENDIENTE: "Visita pendiente",
  LISTA_PARA_ENTREGA: "Lista para entrega",
};

/// **Las tres puertas por las que se sale de Operación 72, y son distintas.**
///
/// Juntarlas en un solo número rojo sería el error del indicador de visitas
/// otra vez (§12.6): salir entregada a un mentor es el final bueno del
/// recorrido, pasar a asistente es que la persona no quiso proceso, y una baja
/// es que se perdió. El ⊖ enseña el total —que es lo que cabe en un botón— y
/// la ventana las separa siempre en tres.
export const PUERTAS = ["entregadas", "asistentes", "bajas"] as const;

export type Puerta = (typeof PUERTAS)[number];

/// La pestaña de la ventana del ⊖: las tres puertas más «todas».
export const PESTANAS_SALIDA = ["todas", ...PUERTAS] as const;

export type PestanaSalida = (typeof PESTANAS_SALIDA)[number];

export function pestanaSalidaValida(valor: string | undefined): PestanaSalida {
  return PESTANAS_SALIDA.includes(valor as PestanaSalida)
    ? (valor as PestanaSalida)
    : "todas";
}

export const ETIQUETA_PUERTA: Record<Puerta, string> = {
  entregadas: "Entregadas a mentor",
  asistentes: "Pasaron a asistentes",
  bajas: "Dadas de baja",
};

/// Cómo se nombra cada puerta en una frase corta, dentro de la fila.
export const FRASE_PUERTA: Record<Puerta, string> = {
  entregadas: "entregada a su mentor",
  asistentes: "pasó a asistente de la iglesia",
  bajas: "dada de baja",
};

export type MovimientoDelTablero = {
  /// Cuántas **entraron** a cada lista dentro del periodo. No cuenta a quien ya
  /// estaba y se quedó: volver a llamar a alguien de Seguimiento y que no
  /// conteste deja la tarjeta donde estaba, y sumarlo aquí inflaría el ⊕ y
  /// rompería la cuenta (medido el 16-oct: 4 de las 8 «entradas» a Seguimiento
  /// de esa semana eran justo eso).
  entraron: Record<Lista, number>;
  /// Las que ya estaban en la lista y siguieron ahí tras un intento nuevo. No
  /// se suman al ⊕, pero se dicen dentro de la ventana: son trabajo hecho.
  siguieronAhi: Record<Lista, number>;
  salieron: { total: number; porPuerta: Record<Puerta, number> };
  /// true cuando el periodo pedido empieza antes de que hubiera auditoría
  /// (15-ago-2026), así que el movimiento está incompleto por fuerza.
  antesDeLaAuditoria: boolean;
};

export const SIN_MOVIMIENTO: MovimientoDelTablero = {
  entraron: {
    INICIADA: 0,
    SEGUIMIENTO: 0,
    CONTACTADA: 0,
    VISITA_PENDIENTE: 0,
    LISTA_PARA_ENTREGA: 0,
  },
  siguieronAhi: {
    INICIADA: 0,
    SEGUIMIENTO: 0,
    CONTACTADA: 0,
    VISITA_PENDIENTE: 0,
    LISTA_PARA_ENTREGA: 0,
  },
  salieron: { total: 0, porPuerta: { entregadas: 0, asistentes: 0, bajas: 0 } },
  antesDeLaAuditoria: false,
};
