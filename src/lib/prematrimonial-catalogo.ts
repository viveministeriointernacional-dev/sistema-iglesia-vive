/// Catálogo del prematrimonial: los 12 temas que una pareja responde **por
/// separado** y que su pastor compara.
///
/// **Todo lo de aquí es PURO y sin base de datos**, que es lo que permite
/// probarlo. Lo que toca Prisma o red vive en `prematrimonial.ts` (la regla del
/// 6-sep-2026: lo que use el navegador va en el catálogo).

/// Los 12 temas del curso. El recorrido no se termina con menos.
export const TOTAL_DE_TEMAS_PRE = 12;

/// Mínimo de una respuesta abierta para contar como respondida. El mismo que
/// en Casa de Fe: dos letras no son una respuesta.
export const LARGO_MINIMO_RESPUESTA_PRE = 10;

/// La nota del pastor al devolver un taller. **Obligatoria**: devolver sin
/// decir por qué deja a la persona sin saber qué corregir.
export const LARGO_MINIMO_NOTA_PRE = 10;

/// Los tipos de pregunta del libro.
///
/// ⚠️ **MULTIPLE y ORDEN no existen en Casa de Fe**, y son justo los que hacen
/// valiosa la comparación: son los únicos, junto con OPCION y SI_NO, donde el
/// sistema puede decir **sin juicio** si los dos respondieron lo mismo. El
/// taller 1 trae uno de cada (la 14 y la 21), y el libro mismo dice en la 21
/// «Comparen sus respuestas».
export type TipoDePreguntaPre =
  | "ABIERTA"
  | "SI_NO"
  | "OPCION"
  | "MULTIPLE"
  | "ORDEN";

export type PreguntaPre = {
  id: string;
  number: number;
  kind: string;
  prompt: string;
  /// Las opciones de SI_NO, OPCION, MULTIPLE y ORDEN. Vacío en las abiertas.
  options: string[];
};

export type RespuestaPre = {
  questionId: string;
  text: string | null;
  /// OPCION y SI_NO: el índice elegido.
  choice: number | null;
  /// MULTIPLE: los índices marcados.
  choices: number[];
  /// ORDEN: las opciones en el orden que puso la persona, por índice. El
  /// primero de la lista es su número 1.
  ordering: number[];
};

// ---------------------------------------------------------------------------
// ¿Está respondida?
// ---------------------------------------------------------------------------

/// ⚠️ **MARCAR VARIAS admite CERO marcas como respuesta válida**, y no es un
/// descuido. En la pregunta 14 («unidad en el matrimonio») es perfectamente
/// posible que alguien no considere correcta ninguna de las ocho — y esa es una
/// respuesta con contenido, no un campo vacío. Exigir al menos una marca
/// obligaría a mentir para poder enviar el taller.
///
/// Por eso MULTIPLE se da por respondida en cuanto la persona la **toca**, y
/// eso se guarda: una respuesta que existe en la base con la lista vacía no es
/// lo mismo que una pregunta que nadie abrió.
export function respondidaPre(
  pregunta: PreguntaPre,
  respuesta: RespuestaPre | undefined,
): boolean {
  if (!respuesta) return false;

  switch (pregunta.kind) {
    case "SI_NO":
    case "OPCION":
      return (
        respuesta.choice !== null &&
        respuesta.choice >= 0 &&
        respuesta.choice < pregunta.options.length
      );

    case "MULTIPLE":
      // Existe la fila = la tocó. Las marcas se validan aparte.
      return respuesta.choices.every(
        (i) => Number.isInteger(i) && i >= 0 && i < pregunta.options.length,
      );

    case "ORDEN":
      // Tiene que haber ordenado TODAS: un orden a medias no se puede comparar
      // posición por posición, que es para lo único que sirve.
      return esOrdenCompleto(respuesta.ordering, pregunta.options.length);

    default:
      return (respuesta.text ?? "").trim().length >= LARGO_MINIMO_RESPUESTA_PRE;
  }
}

/// Un orden válido usa cada opción **una sola vez** y no deja ninguna fuera.
export function esOrdenCompleto(orden: readonly number[], cuantas: number): boolean {
  if (orden.length !== cuantas) return false;
  const vistos = new Set<number>();
  for (const i of orden) {
    if (!Number.isInteger(i) || i < 0 || i >= cuantas) return false;
    if (vistos.has(i)) return false;
    vistos.add(i);
  }
  return true;
}

export type AvancePre = {
  respondidas: number;
  total: number;
  faltan: number;
  completo: boolean;
};

export function avancePre(
  preguntas: readonly PreguntaPre[],
  respuestas: readonly RespuestaPre[],
): AvancePre {
  const porPregunta = new Map(respuestas.map((r) => [r.questionId, r]));
  let respondidas = 0;
  for (const p of preguntas) {
    if (respondidaPre(p, porPregunta.get(p.id))) respondidas += 1;
  }
  const total = preguntas.length;
  return {
    respondidas,
    total,
    faltan: total - respondidas,
    completo: total > 0 && respondidas === total,
  };
}

// ---------------------------------------------------------------------------
// El estado del taller de UNA persona
// ---------------------------------------------------------------------------

export type EstadoTallerPre = "BORRADOR" | "ENVIADO" | "APROBADO" | "DEVUELTO";

export type RevisionPre = {
  approved: boolean;
  reviewedAt: Date;
  /// A quién se le devolvió. Nulo cuando se aprobó (la aprobación es del tema,
  /// o sea de los dos).
  returnedToLearnerId: string | null;
};

/// ⚠️ **La misma trampa del reenvío que en Casa de Fe**: un taller devuelto y
/// vuelto a enviar tiene una revisión con `approved: false` y un `submittedAt`
/// POSTERIOR. Mirar solo «¿hay revisión?» lo dejaría en DEVUELTO para siempre.
export function estadoTallerPre(
  learnerId: string,
  submittedAt: Date | null,
  revisiones: readonly RevisionPre[],
): EstadoTallerPre {
  if (!submittedAt) return "BORRADOR";

  const ultima = ultimaRevisionPre(revisiones);
  if (!ultima) return "ENVIADO";
  if (submittedAt.getTime() > ultima.reviewedAt.getTime()) return "ENVIADO";

  if (ultima.approved) return "APROBADO";

  // ⚠️ **Una devolución es de UNA persona, no de las dos.** El pastor devuelve
  // el taller de quien respondió a medias; al otro no se le puede marcar como
  // devuelto algo que hizo bien, ni obligarlo a reenviar. Por eso la revisión
  // guarda a quién se le devolvió, y aquí se compara.
  if (ultima.returnedToLearnerId && ultima.returnedToLearnerId !== learnerId) {
    return "ENVIADO";
  }
  return "DEVUELTO";
}

export function ultimaRevisionPre<T extends { reviewedAt: Date }>(
  revisiones: readonly T[],
): T | null {
  let ultima: T | null = null;
  for (const r of revisiones) {
    if (!ultima || r.reviewedAt.getTime() > ultima.reviewedAt.getTime()) ultima = r;
  }
  return ultima;
}

// ---------------------------------------------------------------------------
// El estado del tema para LA PAREJA
// ---------------------------------------------------------------------------

export type EstadoTemaPareja =
  | "SIN_EMPEZAR"
  | "UNO_ENVIO"
  | "ESPERANDO"
  | "DEVUELTO"
  | "APROBADO";

export const ETIQUETA_TEMA_PAREJA: Record<EstadoTemaPareja, string> = {
  SIN_EMPEZAR: "Sin empezar",
  UNO_ENVIO: "Falta uno de los dos",
  ESPERANDO: "Los dos enviaron · por revisar",
  DEVUELTO: "Devuelto para corregir",
  APROBADO: "Aprobado",
};

export function estadoTemaPareja(datos: {
  envioA: Date | null;
  envioB: Date | null;
  revisiones: readonly RevisionPre[];
}): EstadoTemaPareja {
  const ultima = ultimaRevisionPre(datos.revisiones);

  if (ultima) {
    const masNuevo = Math.max(
      datos.envioA?.getTime() ?? 0,
      datos.envioB?.getTime() ?? 0,
    );
    // Alguno reenvió después de la revisión: vuelve a la cola.
    if (masNuevo <= ultima.reviewedAt.getTime()) {
      return ultima.approved ? "APROBADO" : "DEVUELTO";
    }
  }

  if (datos.envioA && datos.envioB) return "ESPERANDO";
  if (datos.envioA || datos.envioB) return "UNO_ENVIO";
  return "SIN_EMPEZAR";
}

/// ⚠️ **No se puede comparar un tema hasta que los DOS enviaron.** Es la regla
/// que sostiene el ejercicio: media comparación no dice nada, y enseñarla
/// obligaría al pastor a juzgar con un solo lado.
export function sePuedeComparar(envioA: Date | null, envioB: Date | null): boolean {
  return Boolean(envioA && envioB);
}

/// ¿Este tema está esperando que el pastor lo destape?
///
/// Se calcula aparte del estado porque son dos cosas distintas: el estado dice
/// en qué va el taller, y esto dice si a la pareja ya se le puede mostrar.
export function listoParaDestapar(datos: {
  envioA: Date | null;
  envioB: Date | null;
  destapadoEl: Date | null;
}): boolean {
  return sePuedeComparar(datos.envioA, datos.envioB) && !datos.destapadoEl;
}

// ---------------------------------------------------------------------------
// La comparación, que es el punto de todo
// ---------------------------------------------------------------------------

export type Veredicto = "COINCIDEN" | "DISTINTO" | "NO_COMPARABLE";

export type Comparacion = {
  veredicto: Veredicto;
  /// En MULTIPLE: lo que marcó uno y el otro no (por índice de opción), en los
  /// dos sentidos. Vacío en los demás tipos.
  soloA: number[];
  soloB: number[];
  /// En ORDEN: los índices de opción en los que los dos pusieron un número
  /// distinto. Vacío en los demás tipos.
  posicionesDistintas: number[];
};

const SIN_DETALLE = { soloA: [], soloB: [], posicionesDistintas: [] };

/// ⚠️ **EL SISTEMA NO JUZGA LAS ABIERTAS, Y ESO ES UNA DECISIÓN, NO UNA
/// LIMITACIÓN QUE HAYA QUE DISIMULAR.** Medir si dos párrafos dicen lo mismo es
/// exactamente el juicio pastoral para el que existe esta pantalla. Decir
/// «coinciden» donde hay un desacuerdo de fondo sería peor que no decir nada:
/// el pastor dejaría de leerlas.
///
/// Por eso una abierta devuelve siempre `NO_COMPARABLE` — las dos respuestas se
/// ponen lado a lado y quien decide es la persona.
export function compararRespuestas(
  pregunta: PreguntaPre,
  a: RespuestaPre | undefined,
  b: RespuestaPre | undefined,
): Comparacion {
  // Si falta alguna de las dos no hay nada que comparar todavía.
  if (!respondidaPre(pregunta, a) || !respondidaPre(pregunta, b)) {
    return { veredicto: "NO_COMPARABLE", ...SIN_DETALLE };
  }

  switch (pregunta.kind) {
    case "SI_NO":
    case "OPCION":
      return {
        veredicto: a!.choice === b!.choice ? "COINCIDEN" : "DISTINTO",
        ...SIN_DETALLE,
      };

    case "MULTIPLE": {
      const setA = new Set(a!.choices);
      const setB = new Set(b!.choices);
      const soloA = [...setA].filter((i) => !setB.has(i)).sort((x, y) => x - y);
      const soloB = [...setB].filter((i) => !setA.has(i)).sort((x, y) => x - y);
      return {
        veredicto: soloA.length === 0 && soloB.length === 0 ? "COINCIDEN" : "DISTINTO",
        soloA,
        soloB,
        posicionesDistintas: [],
      };
    }

    case "ORDEN": {
      // Se compara **qué número le puso cada uno a cada opción**, no la lista
      // en crudo: lo que importa es si para él «Dios» va primero y para ella
      // tercero, y eso es la posición de la opción, no el índice de la lista.
      const puestoA = puestoPorOpcion(a!.ordering);
      const puestoB = puestoPorOpcion(b!.ordering);
      const distintas: number[] = [];
      for (const [opcion, puesto] of puestoA) {
        if (puestoB.get(opcion) !== puesto) distintas.push(opcion);
      }
      distintas.sort((x, y) => x - y);
      return {
        veredicto: distintas.length === 0 ? "COINCIDEN" : "DISTINTO",
        soloA: [],
        soloB: [],
        posicionesDistintas: distintas,
      };
    }

    default:
      return { veredicto: "NO_COMPARABLE", ...SIN_DETALLE };
  }
}

/// De «la opción 2 va primera» a «la opción 2 tiene el puesto 1».
export function puestoPorOpcion(orden: readonly number[]): Map<number, number> {
  const mapa = new Map<number, number>();
  orden.forEach((opcion, i) => mapa.set(opcion, i + 1));
  return mapa;
}

/// Cuántas preguntas de este tema puede comparar el sistema por sí solo. Es lo
/// que la pantalla dice arriba («21 preguntas · 3 comparables»), para que nadie
/// espere un veredicto en las otras dieciocho.
export function cuantasComparables(preguntas: readonly PreguntaPre[]): number {
  return preguntas.filter((p) => p.kind !== "ABIERTA").length;
}

/// ¿Ya terminó los 12? Es lo que dispara el hito.
export function terminoElPrematrimonial(temasAprobados: number): boolean {
  return temasAprobados >= TOTAL_DE_TEMAS_PRE;
}

/// El código de miembro como se dicta: «418 203». Es el mismo formato de Casa
/// de Fe — la persona tiene UN solo código para todo.
export function codigoLegiblePre(codigo: string): string {
  return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
}
