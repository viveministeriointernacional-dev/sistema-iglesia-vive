import {
  CallSchedule,
  ChurchAttendance,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";

/// Etiquetas de los seis puntos de entrada del paso 3 del registro, en el orden
/// del diseño (rejilla 3×2).
export const PUNTOS_DE_ENTRADA: { valor: EntryPoint; etiqueta: string }[] = [
  { valor: EntryPoint.SERVICIO_DOMINICAL, etiqueta: "Servicio dominical" },
  { valor: EntryPoint.SERVICIO_MIERCOLES, etiqueta: "Servicio miércoles" },
  { valor: EntryPoint.SERVICIO_JUVENIL, etiqueta: "Servicio Juvenil" },
  { valor: EntryPoint.REDES_SOCIALES, etiqueta: "Redes sociales" },
  { valor: EntryPoint.ALPHA_CASA_DE_FE, etiqueta: "Alpha / Casa de Fe" },
  { valor: EntryPoint.EVENTO_O_BRIGADA, etiqueta: "Evento o brigada" },
  { valor: EntryPoint.UNO_A_UNO, etiqueta: "Uno a uno" },
  { valor: EntryPoint.OTRO, etiqueta: "Otro" },
];

export const ETIQUETA_ENTRADA: Record<EntryPoint, string> = Object.fromEntries(
  PUNTOS_DE_ENTRADA.map((e) => [e.valor, e.etiqueta]),
) as Record<EntryPoint, string>;

export const TIPOS_DE_INVITACION: { valor: InvitationKind; etiqueta: string }[] = [
  { valor: InvitationKind.PERSONA, etiqueta: "Sí, una persona" },
  { valor: InvitationKind.REDES, etiqueta: "No, llegó por redes" },
  { valor: InvitationKind.DESCONOCIDO, etiqueta: "No sabe" },
];

export const ASISTENCIAS_IGLESIA: {
  valor: ChurchAttendance;
  etiqueta: string;
}[] = [
  {
    valor: ChurchAttendance.IGLESIA_VIVE,
    etiqueta: "Sí, asisto a la iglesia Vive",
  },
  {
    valor: ChurchAttendance.OTRA_IGLESIA,
    etiqueta: "Sí, asisto a otra iglesia",
  },
  { valor: ChurchAttendance.NUEVO, etiqueta: "No, soy nuevo" },
  {
    valor: ChurchAttendance.ASISTIA_ANTES,
    etiqueta: "No, pero asistía antes",
  },
];

export const ETIQUETA_ASISTENCIA_IGLESIA: Record<ChurchAttendance, string> =
  Object.fromEntries(
    ASISTENCIAS_IGLESIA.map((asistencia) => [
      asistencia.valor,
      asistencia.etiqueta,
    ]),
  ) as Record<ChurchAttendance, string>;

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

/// El apellido es opcional: a veces solo se sabe el nombre de pila.
export function nombreCompleto(persona: {
  firstName: string;
  lastName?: string | null;
}) {
  return `${persona.firstName} ${persona.lastName ?? ""}`.trim();
}

/// Cómo llegó, incluyendo el detalle cuando la respuesta fue «otro».
export function textoDeEntrada(
  entryPoint: EntryPoint | null,
  otro?: string | null,
) {
  if (!entryPoint) return "Sin registrar";
  if (entryPoint === EntryPoint.OTRO) return otro?.trim() || "Otro";
  return ETIQUETA_ENTRADA[entryPoint];
}

export function textoDeAsistenciaIglesia(
  asistencia: ChurchAttendance | null,
) {
  return asistencia
    ? ETIQUETA_ASISTENCIA_IGLESIA[asistencia]
    : "Sin registrar";
}

/// Las franjas y el horario escrito, en una sola frase legible.
export function textoDeHorario(
  franjas: CallSchedule[],
  nota?: string | null,
): string | null {
  const etiquetas = franjas.map(
    (franja) => HORARIOS.find((h) => h.valor === franja)?.etiqueta ?? franja,
  );
  if (nota?.trim()) etiquetas.push(nota.trim());
  if (!etiquetas.length) return null;
  return etiquetas.join(" · ");
}

/// Normaliza un teléfono para comparar duplicados: solo dígitos, sin
/// prefijos de marcación.
export function normalizarTelefono(valor: string | null | undefined) {
  if (!valor) return null;
  const digitos = valor.replace(/\D/g, "");
  return digitos.length ? digitos : null;
}

/// Normaliza un texto para buscar: minúsculas y SIN tildes. Debe coincidir con
/// lo que guarda `person.search_text` en la base de datos (que usa `unaccent`),
/// para que buscar «jose narvaez» encuentre «José Narváez» sin importar tildes,
/// mayúsculas ni exactitud.
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/// Los últimos dígitos, que es lo que de verdad identifica un número.
///
/// La misma persona aparece como «+57 311 555 4433», «3115554433» o
/// «57 311 5554433»: comparar la cadena completa los da por distintos y se
/// crean expedientes duplicados. Comparar la cola los reconoce como el mismo.
export const DIGITOS_COMPARABLES = 10;

export function colaDeTelefono(valor: string | null | undefined) {
  const digitos = normalizarTelefono(valor);
  if (!digitos) return null;
  return digitos.slice(-DIGITOS_COMPARABLES);
}
