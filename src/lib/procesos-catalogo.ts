import { Operation72Status, Phase } from "@iglesia/prisma-client";
import type { PersonaDeProcesos } from "@/lib/procesos";

/// Los nombres y los cortes de la pantalla de Procesos.
///
/// Vive aparte de `procesos.ts` por la regla de siempre (6-sep-2026): lo que se
/// pinta va en el catálogo, lo que toca la base va en el módulo de datos. Aquí
/// no se importa Prisma ni nada que arrastre `pg`.

export const ETIQUETA_FASE: Record<Phase, string> = {
  [Phase.GANAR]: "Ganar",
  [Phase.FORTALECER]: "Fortalecer",
  [Phase.ENTRENAR]: "Entrenar",
  [Phase.MULTIPLICAR]: "Multiplicar",
};

export const ETIQUETA_OP72: Record<Operation72Status, string> = {
  [Operation72Status.INICIADA]: "Iniciada",
  [Operation72Status.SEGUIMIENTO]: "Seguimiento",
  [Operation72Status.CONTACTADA]: "Contactada",
  [Operation72Status.VISITA_PENDIENTE]: "Visita pendiente",
  [Operation72Status.LISTA_PARA_ENTREGA]: "Lista para entrega",
  [Operation72Status.ENTREGADA]: "Entregada",
  [Operation72Status.CERRADA]: "Cerrada",
};

/// **Qué significa cada columna del tablero, en palabras.**
///
/// El usuario lo pidió explícitamente («posiblemente con una descripción»), y
/// hace falta: el nombre solo no lo dice. «Seguimiento» no quiere decir que se
/// le esté haciendo seguimiento a alguien — quiere decir que se le llamó y no
/// contestó.
export const COLUMNAS_DE_OP72: {
  estado: Operation72Status;
  titulo: string;
  descripcion: string;
  queSigue: string;
}[] = [
  {
    estado: Operation72Status.INICIADA,
    titulo: "INICIADA",
    descripcion:
      "Se registró a la persona y todavía nadie la ha llamado. Es el punto de entrada: cada tarjeta nace aquí con un plazo de 72 horas.",
    queSigue: "llamarla y registrar la llamada en el formulario.",
  },
  {
    estado: Operation72Status.SEGUIMIENTO,
    titulo: "SEGUIMIENTO",
    descripcion:
      "Se le llamó y no contestó. No es que nadie la haya atendido: es que no se ha logrado hablar con ella. Son las que más fácil se pierden, porque nada empuja la tarjeta hacia adelante salvo volver a marcar.",
    queSigue: "volver a llamar. Si contesta, pasa sola a Contactada.",
  },
  {
    estado: Operation72Status.CONTACTADA,
    titulo: "CONTACTADA",
    descripcion:
      "Ya se habló con la persona y espera que se le acuerde una visita. Que esta sea la bolsa más grande es buena señal: significa que el teléfono está funcionando.",
    queSigue: "acordar día, hora y lugar de la visita.",
  },
  {
    estado: Operation72Status.VISITA_PENDIENTE,
    titulo: "VISITA PENDIENTE",
    descripcion:
      "Hay una visita acordada, con fecha y lugar. Esta columna se ordena por la fecha de la visita, no por cuándo se registró a la persona.",
    queSigue: "hacer la visita y cerrarla en el tablero.",
  },
  {
    estado: Operation72Status.LISTA_PARA_ENTREGA,
    titulo: "LISTA PARA ENTREGA",
    descripcion:
      "Terminó el proceso y espera mentor; el sistema ya propuso un candidato. También llegan aquí las personas que ya llevaban proceso en la iglesia y solo les faltaba mentor, sin pasar por llamada ni visita.",
    queSigue:
      "confirmar la entrega. Al mentor le llega un correo con toda la historia.",
  },
];

export const FILTROS_DE_PROCESOS = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "fase-FORTALECER", etiqueta: "Fortalecer" },
  { valor: "fase-ENTRENAR", etiqueta: "Entrenar" },
  { valor: "fase-MULTIPLICAR", etiqueta: "Multiplicar" },
  { valor: "op-INICIADA", etiqueta: "Iniciada" },
  { valor: "op-SEGUIMIENTO", etiqueta: "Seguimiento" },
  { valor: "op-CONTACTADA", etiqueta: "Contactada" },
  { valor: "op-VISITA_PENDIENTE", etiqueta: "Visita pendiente" },
  { valor: "op-LISTA_PARA_ENTREGA", etiqueta: "Esperan mentor" },
  { valor: "con-mentor", etiqueta: "Con mentor" },
  { valor: "sin-mentor", etiqueta: "Sin mentor" },
  { valor: "casa-de-fe", etiqueta: "En Casa de Fe" },
  { valor: "asistentes", etiqueta: "Asistentes" },
] as const;

export type FiltroDeProcesos = (typeof FILTROS_DE_PROCESOS)[number]["valor"];

export function cumpleFiltro(
  persona: Pick<PersonaDeProcesos, "fase" | "op72" | "mentor" | "casaDeFe" | "estado">,
  filtro: FiltroDeProcesos,
): boolean {
  if (filtro === "todas") return true;
  if (filtro === "con-mentor") return persona.mentor !== "";
  if (filtro === "sin-mentor") return persona.mentor === "";
  if (filtro === "casa-de-fe") return persona.casaDeFe !== "";
  if (filtro === "asistentes") return persona.estado === "ASISTENTE";
  if (filtro.startsWith("fase-")) return persona.fase === filtro.slice(5);
  if (filtro.startsWith("op-")) return persona.op72 === filtro.slice(3);
  return true;
}
