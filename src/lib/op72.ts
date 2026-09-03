import { CallOutcome, ContactType, Operation72Status } from "@iglesia/prisma-client";

export const DURACION_OPERACION_72_HORAS = 72;
const MS_POR_HORA = 3_600_000;

export type Urgencia = "vencida" | "urgente" | "normal";

/// Las horas restantes siempre se calculan en servidor.
export function horasRestantes(deadlineAt: Date, ahora: Date = new Date()) {
  return Math.ceil((deadlineAt.getTime() - ahora.getTime()) / MS_POR_HORA);
}

export function urgenciaDe(deadlineAt: Date, ahora: Date = new Date()): Urgencia {
  const ms = deadlineAt.getTime() - ahora.getTime();
  if (ms <= 0) return "vencida";
  return ms <= 12 * MS_POR_HORA ? "urgente" : "normal";
}

/// Texto del chip de plazo. Dice qué mide: «71 H» a secas no distingue si son
/// las horas que quedan o las que pasaron, y «VENCIDA» no dice desde cuándo —
/// una deuda de ayer y una de hace tres meses no se atienden igual.
export function textoChip(deadlineAt: Date, ahora: Date = new Date()) {
  const restantes = horasRestantes(deadlineAt, ahora);
  if (restantes > 0) return `QUEDAN ${restantes} H`;

  const vencidas = -restantes;
  if (vencidas < 24) return `VENCIÓ HACE ${Math.max(vencidas, 1)} H`;
  const dias = Math.floor(vencidas / 24);
  return `VENCIÓ HACE ${dias} ${dias === 1 ? "DÍA" : "DÍAS"}`;
}

/// Relleno de la barra de avance: (72 − horas restantes) / 72, mínimo 6 %.
export function porcentajeAvance(deadlineAt: Date, ahora: Date = new Date()) {
  const restantes = Math.max(horasRestantes(deadlineAt, ahora), 0);
  const bruto = ((DURACION_OPERACION_72_HORAS - restantes) /
    DURACION_OPERACION_72_HORAS) *
    100;
  return Math.max(6, Math.min(100, Math.round(bruto)));
}

export const COLUMNAS_OP72 = [
  { estado: Operation72Status.INICIADA, titulo: "INICIADA" },
  { estado: Operation72Status.SEGUIMIENTO, titulo: "SEGUIMIENTO" },
  { estado: Operation72Status.CONTACTADA, titulo: "CONTACTADA" },
  { estado: Operation72Status.VISITA_PENDIENTE, titulo: "VISITA PENDIENTE" },
  { estado: Operation72Status.LISTA_PARA_ENTREGA, titulo: "LISTA PARA ENTREGA" },
] as const;

/// Estados visibles en el tablero: al entregar, la tarjeta sale.
export const ESTADOS_EN_TABLERO = COLUMNAS_OP72.map((c) => c.estado);

type Transicion = {
  siguiente: Operation72Status;
  etiqueta: string;
  detallePorDefecto?: string;
};

export const TRANSICIONES: Partial<Record<Operation72Status, Transicion>> = {
  [Operation72Status.INICIADA]: {
    siguiente: Operation72Status.CONTACTADA,
    etiqueta: "Registrar llamada",
    detallePorDefecto: "Llamada registrada hoy · acordar visita",
  },
  // En seguimiento se vuelve a llamar: si contesta pasa a CONTACTADA; si no,
  // se queda aquí con un intento más en el historial.
  [Operation72Status.SEGUIMIENTO]: {
    siguiente: Operation72Status.CONTACTADA,
    etiqueta: "Volver a llamar",
    detallePorDefecto: "Llamada registrada hoy · acordar visita",
  },
  [Operation72Status.CONTACTADA]: {
    siguiente: Operation72Status.VISITA_PENDIENTE,
    etiqueta: "Agendar visita",
    detallePorDefecto: "Visita agendada · pendiente de confirmar",
  },
  [Operation72Status.VISITA_PENDIENTE]: {
    siguiente: Operation72Status.LISTA_PARA_ENTREGA,
    etiqueta: "Cerrar visita y preparar entrega",
  },
  [Operation72Status.LISTA_PARA_ENTREGA]: {
    siguiente: Operation72Status.ENTREGADA,
    etiqueta: "Entregar a mentor",
  },
};

/// Cómo salió la llamada, en el orden en que se pregunta.
export const RESULTADOS_DE_LLAMADA: {
  valor: CallOutcome;
  etiqueta: string;
  /// Solo un contacto real pasa la tarjeta a CONTACTADA. «No contestó» queda
  /// registrado como intento y la persona pasa a SEGUIMIENTO (hay que volver a
  /// llamar): el tablero no puede decir «contactada» si nadie respondió.
  contacta: boolean;
}[] = [
  { valor: CallOutcome.CONTESTO_BIEN, etiqueta: "Contestó bien", contacta: true },
  {
    valor: CallOutcome.CONTESTO_REPROGRAMO,
    etiqueta: "Contestó y reprogramó",
    contacta: true,
  },
  { valor: CallOutcome.CONTESTO_REGULAR, etiqueta: "Contestó regular", contacta: true },
  { valor: CallOutcome.CONTESTO_MAL, etiqueta: "Contestó mal", contacta: true },
  { valor: CallOutcome.NO_CONTESTO, etiqueta: "No contestó", contacta: false },
];

export const ETIQUETA_LLAMADA: Record<CallOutcome, string> = Object.fromEntries(
  RESULTADOS_DE_LLAMADA.map((r) => [r.valor, r.etiqueta]),
) as Record<CallOutcome, string>;

export function contactaDeVerdad(resultado: CallOutcome) {
  return RESULTADOS_DE_LLAMADA.find((r) => r.valor === resultado)?.contacta ?? false;
}

/// Motivos para dar de baja desde el tablero. Son una lista cerrada a
/// propósito: con motivos comparables se puede saber, meses después, cuántas
/// personas se perdieron por no contestar y cuántas por no querer seguir.
export const MOTIVOS_DE_BAJA = [
  "No desea continuar el proceso",
  "No fue posible contactarla",
  "Vive fuera de la ciudad",
  "Los datos no corresponden a una persona real",
  "Ya asiste a otra iglesia",
  "Otro motivo",
] as const;

export function tituloLinea(lineKnown: boolean) {
  return lineKnown
    ? "LÍNEA CONOCIDA · SE CONSERVA"
    : "SIN LÍNEA · ASIGNAR POR PERFIL";
}

export function edadDesde(birthDate: Date | null | undefined, ahora = new Date()) {
  if (!birthDate) return null;
  let edad = ahora.getFullYear() - birthDate.getFullYear();
  const mes = ahora.getMonth() - birthDate.getMonth();
  if (mes < 0 || (mes === 0 && ahora.getDate() < birthDate.getDate())) edad -= 1;
  return edad >= 0 && edad < 130 ? edad : null;
}

/// Cómo se nombra un movimiento en la tarjeta. El tablero mostraba el resumen
/// libre de la Operación 72 («No contestó · Se llamó en 3 ocasiones…»), que
/// mezcla el hecho con la observación y no dice quién ni cuándo. Aquí sale solo
/// el hecho; el resto lo pone la tarjeta en sus propias líneas.
export function tituloDelMovimiento(intento: {
  type: ContactType;
  outcome: CallOutcome | null;
  result: string | null;
  intentosPrevios?: number;
}): string {
  if (intento.type === ContactType.VISITA) return "Visita agendada";
  if (intento.type === ContactType.INTENTO_VISITA) return "Visita intentada";
  if (intento.type === ContactType.MENSAJE) return "Mensaje enviado";
  if (intento.type === ContactType.CONVERSACION) return "Conversación";

  if (
    intento.type === ContactType.LLAMADA ||
    intento.type === ContactType.INTENTO_LLAMADA
  ) {
    const cual = ordinalDeIntento(intento.intentosPrevios ?? 0);
    const salida = intento.outcome ? ETIQUETA_LLAMADA[intento.outcome].toLowerCase() : null;
    return salida ? `${cual} · ${salida}` : cual;
  }

  return intento.result?.trim() || "Movimiento registrado";
}

/// «1.ª llamada», «2.º intento»… Con una sola llamada no hace falta numerar.
function ordinalDeIntento(previos: number): string {
  const numero = previos + 1;
  if (numero <= 1) return "Llamada";
  const sufijo = numero === 2 ? "2.º" : numero === 3 ? "3.er" : `${numero}.º`;
  return `${sufijo} intento`;
}
