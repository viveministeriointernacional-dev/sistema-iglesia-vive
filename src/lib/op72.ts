import { Operation72Status } from "@/generated/prisma";

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

export function textoChip(deadlineAt: Date, ahora: Date = new Date()) {
  if (urgenciaDe(deadlineAt, ahora) === "vencida") return "VENCIDA";
  return `${Math.max(horasRestantes(deadlineAt, ahora), 0)} H`;
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
