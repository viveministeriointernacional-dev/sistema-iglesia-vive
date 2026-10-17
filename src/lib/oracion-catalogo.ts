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
///
/// **Los tres recuadros de la cabecera son tres de estos filtros**, y por eso
/// están aquí y no sueltos: al pulsar un recuadro la lista pasa a enseñar
/// exactamente lo que ese número cuenta. Si el recuadro y su filtro contaran
/// cosas distintas, la pantalla se contradiría sola — de ahí que la ventana de
/// tiempo de cada uno salga de `DESDE_HACE`, una sola vez (§12.6).
export type FiltroDeOracion =
  | "pendientes"
  | "semana"
  | "oradas-mes"
  | "atendidas"
  | "todas";

export const FILTROS: readonly { id: FiltroDeOracion; etiqueta: string }[] = [
  { id: "pendientes", etiqueta: "Pendientes" },
  { id: "semana", etiqueta: "Entraron esta semana" },
  { id: "oradas-mes", etiqueta: "Oradas este mes" },
  { id: "atendidas", etiqueta: "Atendidas" },
  { id: "todas", etiqueta: "Todas" },
] as const;

const IDS_DE_FILTRO: readonly string[] = FILTROS.map((f) => f.id);

/// Lo que llegue por la URL se valida contra la lista cerrada; cualquier otra
/// cosa cae en «pendientes», que es la vista con la que abre la pantalla.
export function filtroValido(valor: string | null | undefined): FiltroDeOracion {
  return IDS_DE_FILTRO.includes(valor ?? "")
    ? (valor as FiltroDeOracion)
    : "pendientes";
}

/// **Qué recuadro lleva a qué filtro.** La cabecera lee esto en vez de repetir
/// los identificadores: añadir un recuadro nuevo es añadir un renglón aquí.
export const FILTRO_DEL_RECUADRO = {
  pendientes: "pendientes",
  estaSemana: "semana",
  atendidasEsteMes: "oradas-mes",
} as const satisfies Record<string, FiltroDeOracion>;

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

/// **Cuántos días mira cada recuadro con ventana de tiempo.** Lo usan las dos
/// puntas: el conteo del recuadro (aquí mismo, en memoria) y el `WHERE` de la
/// consulta que arma su lista. Escrito dos veces, bastaría con que alguien
/// cambiara uno para que el recuadro dijera 5 y la lista enseñara 7.
export const DIAS_DE_LA_SEMANA = 7;
export const DIAS_DEL_MES = 30;

/// El instante a partir del cual cuenta una ventana. Devuelve una fecha, que es
/// lo que necesita la consulta, y se compara igual que el conteo.
export function desdeHace(dias: number, ahora: Date): Date {
  return new Date(ahora.getTime() - dias * DIA);
}

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
    if (p.pedidaEl >= desdeHace(DIAS_DE_LA_SEMANA, ahora)) estaSemana += 1;
    if (p.oradaEl && p.oradaEl >= desdeHace(DIAS_DEL_MES, ahora)) {
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
