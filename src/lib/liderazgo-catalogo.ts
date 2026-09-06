import { MilestoneKind, Phase } from "@iglesia/prisma-client";
import { ZONA_HORARIA } from "@/lib/dominio";

/// Catálogo del formulario público de liderazgo: las listas y los formatos que
/// necesitan **tanto el servidor como el navegador**.
///
/// Vive aparte de `liderazgo.ts` a propósito. Ese módulo habla con la base de
/// datos y con HighLevel, así que arrastra `pg` y módulos de Node (`fs`, `net`,
/// `tls`…). Si el formulario —que es un componente de cliente— importara de
/// ahí, esos módulos acabarían en el paquete del navegador y **el build se
/// cae**. Pasó de verdad el 6-sep-2026.
///
/// **Regla: lo que use el navegador va aquí; lo que toque base de datos o red,
/// en `liderazgo.ts`.**

/// Los hitos que la persona puede declarar de su propio recorrido. Quedan
/// FUERA a propósito: REGISTRO y OPERACION_72 (los pone el sistema),
/// VALIDACION_PASTORAL, EVALUACION_CIERRE y MULTIPLICACION (los decide un
/// pastor, no la persona).
export const HITOS_DECLARABLES: { kind: MilestoneKind; etiqueta: string }[] = [
  { kind: MilestoneKind.ENCUENTRO, etiqueta: "Encuentro" },
  { kind: MilestoneKind.BAUTISMO, etiqueta: "Bautismo en agua" },
  { kind: MilestoneKind.ALPHA, etiqueta: "Alpha · terminado" },
  { kind: MilestoneKind.CASA_DE_FE, etiqueta: "Casa de Fe · terminada" },
  { kind: MilestoneKind.FOCUS_DAY, etiqueta: "Focus Day" },
  { kind: MilestoneKind.ENTRADA_ESCUELA, etiqueta: "Entré a la Escuela" },
  { kind: MilestoneKind.GRADUACION, etiqueta: "Me gradué de la Escuela" },
  { kind: MilestoneKind.SERVICIO, etiqueta: "Empecé a servir" },
];

export const ETIQUETA_HITO: Record<string, string> = Object.fromEntries(
  HITOS_DECLARABLES.map((hito) => [hito.kind, hito.etiqueta]),
);

/// Las cuatro etapas, dichas como las diría la persona y no como las nombra el
/// modelo: quien llena el formulario no tiene por qué saber qué es «Fortalecer».
export const ETAPAS_DECLARABLES: {
  valor: Phase;
  etiqueta: string;
  descripcion: string;
}[] = [
  {
    valor: Phase.GANAR,
    etiqueta: "Ganar",
    descripcion: "Estoy empezando mi proceso.",
  },
  {
    valor: Phase.FORTALECER,
    etiqueta: "Fortalecer",
    descripcion: "Estoy en Alpha o Casa de Fe, con un mentor.",
  },
  {
    valor: Phase.ENTRENAR,
    etiqueta: "Entrenar",
    descripcion: "Estoy en la escuela, preparándome para liderar.",
  },
  {
    valor: Phase.MULTIPLICAR,
    etiqueta: "Multiplicar",
    descripcion: "Ya lidero y acompaño a otros.",
  },
];

export const ETIQUETA_ETAPA: Record<string, string> = Object.fromEntries(
  ETAPAS_DECLARABLES.map((etapa) => [etapa.valor, etapa.etiqueta]),
);

/// Lo que la persona puede decir que hace. Cada uno apunta al permiso que un
/// administrador activaría al confirmarlo; `null` = no hay permiso que dar (se
/// queda como información del expediente).
export const ROLES_DECLARABLES: {
  valor: string;
  etiqueta: string;
  permiso: "canMentor" | "canLeadAlpha" | "canLeadFaithHouse" | null;
}[] = [
  {
    valor: "CONSOLIDACION",
    etiqueta: "Consolidación (llamo y acompaño gente nueva)",
    permiso: null,
  },
  {
    valor: "LIDER_CASA_DE_FE",
    etiqueta: "Líder de Casa de Fe",
    permiso: "canLeadFaithHouse",
  },
  { valor: "LIDER_ALPHA", etiqueta: "Líder de Alpha", permiso: "canLeadAlpha" },
  {
    valor: "MENTOR",
    etiqueta: "Mentor (acompaño discípulos)",
    permiso: "canMentor",
  },
  {
    valor: "MINISTERIO",
    etiqueta: "Sirvo en un ministerio (alabanza, ujieres, medios…)",
    permiso: null,
  },
];

export const ETIQUETA_ROL: Record<string, string> = Object.fromEntries(
  ROLES_DECLARABLES.map((rol) => [rol.valor, rol.etiqueta]),
);

const MESES = [
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

/// Nadie recuerda el día exacto de su Encuentro de 2019, así que el formulario
/// pide mes y año. La fecha se ancla al **día 1 a mediodía en hora de
/// Colombia** — nunca a medianoche UTC, que se correría al mes anterior.
export function fechaDeMesYAno(mes: string, ano: string): Date | null {
  const m = Number(mes);
  const a = Number(ano);
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  if (!Number.isInteger(a) || a < 1950 || a > 2100) return null;
  const fecha = new Date(
    `${a}-${String(m).padStart(2, "0")}-01T12:00:00-05:00`,
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/// «Marzo 2019». Solo para lo que se le muestra a la persona.
export function mesYAnoLegible(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "long",
  }).formatToParts(fecha);
  const mes = partes.find((p) => p.type === "month")?.value ?? "";
  const ano = partes.find((p) => p.type === "year")?.value ?? "";
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${ano}`;
}

export const NOMBRES_DE_MES = MESES;

export type HitoDeclarado = {
  kind: MilestoneKind;
  hecho: boolean;
  /// Vacíos cuando marcó «No recuerdo»: el hito se guarda igual, sin fecha.
  mes: string;
  ano: string;
};

export type DatosLiderazgo = {
  callPhone: string;
  firstName: string;
  lastName: string;
  gender: "MUJER" | "HOMBRE" | "";
  birthDate: string;
  whatsappPhone: string;
  email: string;
  address: string;
  prayerRequest: string;
  phase: Phase | "";
  roles: string[];
  hitos: HitoDeclarado[];
};
