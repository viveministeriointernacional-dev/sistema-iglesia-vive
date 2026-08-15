import { CallSchedule, EntryPoint, Gender, InvitationKind } from "@/generated/prisma";

/// Etiquetas de los seis puntos de entrada del paso 3 del registro, en el orden
/// del diseño (rejilla 3×2).
export const PUNTOS_DE_ENTRADA: { valor: EntryPoint; etiqueta: string }[] = [
  { valor: EntryPoint.SERVICIO_DOMINICAL, etiqueta: "Servicio dominical" },
  { valor: EntryPoint.SERVICIO_MIERCOLES, etiqueta: "Servicio miércoles" },
  { valor: EntryPoint.REDES_SOCIALES, etiqueta: "Redes sociales" },
  { valor: EntryPoint.ALPHA_CASA_DE_FE, etiqueta: "Alpha / Casa de Fe" },
  { valor: EntryPoint.EVENTO_O_BRIGADA, etiqueta: "Evento o brigada" },
  { valor: EntryPoint.UNO_A_UNO, etiqueta: "Uno a uno" },
];

export const ETIQUETA_ENTRADA: Record<EntryPoint, string> = Object.fromEntries(
  PUNTOS_DE_ENTRADA.map((e) => [e.valor, e.etiqueta]),
) as Record<EntryPoint, string>;

export const TIPOS_DE_INVITACION: { valor: InvitationKind; etiqueta: string }[] = [
  { valor: InvitationKind.PERSONA, etiqueta: "Sí, una persona" },
  { valor: InvitationKind.REDES, etiqueta: "No, llegó por redes" },
  { valor: InvitationKind.DESCONOCIDO, etiqueta: "No sabe" },
];

export const GENEROS: { valor: Gender; etiqueta: string }[] = [
  { valor: Gender.MUJER, etiqueta: "Mujer" },
  { valor: Gender.HOMBRE, etiqueta: "Hombre" },
];

export const HORARIOS: { valor: CallSchedule; etiqueta: string }[] = [
  { valor: CallSchedule.MANANA, etiqueta: "Mañana" },
  { valor: CallSchedule.TARDE, etiqueta: "Tarde" },
  { valor: CallSchedule.NOCHE, etiqueta: "Noche" },
];

/// Los 12 temas obligatorios de Casa de Fe. El orden es flexible: lo decide el
/// mentor (ESPECIFICACION_PRODUCTO.md §6.2).
export const TEMAS_CASA_DE_FE = [
  "Identidad",
  "Oración",
  "Palabra",
  "Familia",
  "Carácter",
  "Libertad",
  "Comunidad",
  "Mayordomía",
  "Perdón",
  "Servicio",
  "Visión",
  "Multiplicar",
];

export function nombreCompleto(persona: { firstName: string; lastName: string }) {
  return `${persona.firstName} ${persona.lastName}`.trim();
}

/// Normaliza un teléfono para comparar duplicados: solo dígitos, sin
/// prefijos de marcación.
export function normalizarTelefono(valor: string | null | undefined) {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length ? digitos : null;
}
