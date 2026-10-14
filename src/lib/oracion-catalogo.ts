/// Catálogo del módulo de oración: lo que se puede calcular **sin tocar la base
/// de datos**, y por eso se puede probar.
///
/// ⚠️ Lo que viva aquí lo puede importar el navegador. Lo que consulte la base
/// o salga a la red va en `oracion.ts` (la regla del 6-sep-2026).

/// De dónde salió una petición. Decide cómo se pinta y, sobre todo, qué hay que
/// hacer con ella.
export type OrigenDeLaPeticion =
  | "REGISTRO"
  | "PERSONA"
  | "EQUIPO"
  | "HISTORICO";

export const ORIGENES: readonly OrigenDeLaPeticion[] = [
  "REGISTRO",
  "PERSONA",
  "EQUIPO",
  "HISTORICO",
] as const;

/// Lo que se lee en el distintivo de cada renglón.
export const ETIQUETA_ORIGEN: Record<OrigenDeLaPeticion, string> = {
  REGISTRO: "Se acaba de registrar",
  PERSONA: "La pidió ella misma",
  EQUIPO: "La registró el equipo",
  HISTORICO: "Venía de su ficha",
};

/// Una frase que explica el distintivo, para quien lo ve por primera vez.
export const EXPLICACION_ORIGEN: Record<OrigenDeLaPeticion, string> = {
  REGISTRO:
    "Llegó con el formulario de registro: es alguien que acaba de entrar a la iglesia.",
  PERSONA: "La escribió ella desde su celular.",
  EQUIPO: "La escribió alguien del equipo que habló con ella.",
  HISTORICO:
    "Estaba guardada en su ficha desde antes de que existiera este módulo, así que no se sabe quién la registró.",
};

export function esOrigen(valor: string): valor is OrigenDeLaPeticion {
  return (ORIGENES as readonly string[]).includes(valor);
}

/// Qué se muestra en los filtros de arriba.
export type FiltroDeOracion = "pendientes" | "atendidas" | "todas";

export const FILTROS: readonly { id: FiltroDeOracion; etiqueta: string }[] = [
  { id: "pendientes", etiqueta: "Pendientes" },
  { id: "atendidas", etiqueta: "Atendidas" },
  { id: "todas", etiqueta: "Todas" },
] as const;

export function filtroValido(valor: string | null | undefined): FiltroDeOracion {
  return valor === "atendidas" || valor === "todas" ? valor : "pendientes";
}

/// Lo mínimo que hace falta para pintar un renglón. Lo arma `oracion.ts`.
export type PeticionParaPintar = {
  id: string;
  texto: string;
  origen: OrigenDeLaPeticion;
  /// `null` cuando la persona pidió reservar su nombre.
  nombre: string | null;
  reservada: boolean;
  /// El expediente al que lleva el renglón. **Se conserva aunque sea
  /// reservada**: quien la acompaña tiene que poder acompañarla.
  learnerId: string | null;
  fase: string | null;
  pedidaEl: Date;
  registradaPor: string | null;
  oradaEl: Date | null;
  oradaPor: string | null;
  notaDeOracion: string | null;
};

/// ⚠️ **Lo que se enseña en lugar del nombre cuando la petición es reservada.**
/// No se inventa un apodo ni se deja en blanco: un renglón sin nada donde va el
/// nombre parece un error del sistema, y quien lo lee acaba abriendo la ficha
/// para ver quién es — que es justo lo que la persona pidió evitar.
export const NOMBRE_RESERVADO = "Reservada";

export function nombreVisible(peticion: {
  nombre: string | null;
  reservada: boolean;
}): string {
  if (peticion.reservada || !peticion.nombre) return NOMBRE_RESERVADO;
  return peticion.nombre;
}

/// ¿Sigue esperando que alguien ore por ella?
export function estaPendiente(peticion: { oradaEl: Date | null }): boolean {
  return peticion.oradaEl === null;
}

/// ⚠️ **Las de personas NUEVAS van en su propio bloque, arriba del todo.**
/// No es una preferencia de diseño: quien acaba de registrarse está en las 72
/// horas de la Operación 72, y su petición es la mejor excusa para esa primera
/// llamada. Mezclada entre las otras doscientas, se enfría.
export function esDePersonaNueva(peticion: {
  origen: OrigenDeLaPeticion;
  oradaEl: Date | null;
}): boolean {
  return peticion.origen === "REGISTRO" && estaPendiente(peticion);
}

export type ResumenDeOracion = {
  /// Las que esperan oración. Es el número que importa.
  pendientes: number;
  /// Las que entraron en los últimos 7 días, atendidas o no.
  estaSemana: number;
  /// Las que se marcaron como oradas en los últimos 30 días.
  atendidasEsteMes: number;
  /// De las pendientes, cuántas son de alguien que acaba de registrarse.
  dePersonasNuevas: number;
};

const DIA = 24 * 60 * 60 * 1000;

/// Las tres cifras de arriba, calculadas sobre lo que ya se cargó.
///
/// ⚠️ **«Esta semana» son los últimos 7 días, no la semana del calendario.**
/// El informe sí usa la semana de viernes a viernes (decisión del 7-sep,
/// porque mide el plazo de respuesta de la consolidación), pero aquí no hay
/// plazo que medir: la pregunta es «cuánto está entrando últimamente», y un
/// lunes por la mañana una semana de calendario diría «2» y parecería que la
/// iglesia dejó de pedir oración.
export function resumirPeticiones(
  peticiones: readonly {
    origen: OrigenDeLaPeticion;
    pedidaEl: Date;
    oradaEl: Date | null;
  }[],
  ahora: Date,
): ResumenDeOracion {
  let pendientes = 0;
  let estaSemana = 0;
  let atendidasEsteMes = 0;
  let dePersonasNuevas = 0;

  for (const p of peticiones) {
    const pendiente = p.oradaEl === null;
    if (pendiente) {
      pendientes += 1;
      if (p.origen === "REGISTRO") dePersonasNuevas += 1;
    }
    if (ahora.getTime() - p.pedidaEl.getTime() <= 7 * DIA) estaSemana += 1;
    if (p.oradaEl && ahora.getTime() - p.oradaEl.getTime() <= 30 * DIA) {
      atendidasEsteMes += 1;
    }
  }

  return { pendientes, estaSemana, atendidasEsteMes, dePersonasNuevas };
}

/// El largo mínimo de una petición escrita por la persona.
///
/// ⚠️ **Es 3, no 10 como en el taller de Casa de Fe, y es deliberado.** Allí el
/// mínimo evita enviar un taller con puntos suspensivos; aquí «fe» o «paz» es
/// una petición legítima, y un mínimo largo obligaría a rellenar con palabras a
/// quien escribe desde el dolor. Solo se evita el campo vacío o un punto.
export const LARGO_MINIMO_PETICION = 3;

/// El tope es generoso: nadie va a escribir una novela, pero cortar a mitad de
/// frase a quien está contando algo difícil es peor que guardar de más.
export const LARGO_MAXIMO_PETICION = 2000;

export function peticionValida(texto: string): { ok: true } | { ok: false; mensaje: string } {
  const limpio = texto.trim();
  if (limpio.length < LARGO_MINIMO_PETICION) {
    return { ok: false, mensaje: "Escribe por qué quieres que oremos." };
  }
  if (limpio.length > LARGO_MAXIMO_PETICION) {
    return {
      ok: false,
      mensaje: `Quedó muy larga: escríbela en ${LARGO_MAXIMO_PETICION} caracteres o menos.`,
    };
  }
  return { ok: true };
}
