/// Catálogo del **Cuestionario de Dominio para Líderes** (Escuela Ser Líder).
///
/// **Todo lo de aquí es PURO y sin base de datos**, que es lo que permite
/// probarlo. Lo que toca Prisma vive en `cuestionario.ts` (la regla del
/// 6-sep-2026: lo que use el navegador va en el catálogo).
///
/// ⚠️ **QUÉ ES ESTO, porque el nombre se parece al taller de Casa de Fe y no
/// son lo mismo.** El documento del usuario lo dice en su primera línea: «Este
/// cuestionario NO es el mismo que aparece dentro del libro para los nuevos
/// creyentes». Sobre los mismos 12 temas hay dos ejercicios opuestos:
///
/// - el **taller** (`taller-catalogo.ts`) lo llena el **discípulo** para
///   reflexionar y aplicar lo aprendido a su vida;
/// - el **cuestionario** lo llena el **líder que va a DICTAR** ese tema, para
///   verificar que lo domina lo suficiente como para enseñarlo, responder
///   preguntas y corregir errores comunes.
///
/// Una misma persona puede tener los dos, y por eso no comparten tablas.

import {
  estadoDelTaller,
  ultimaRevision,
  type EstadoDelTaller,
  type RevisionParaEstado,
} from "@/lib/taller-catalogo";

/// Los 12 temas del libro. El recorrido no se termina con menos.
export const TOTAL_DE_TEMAS_QUIZ = 12;

/// Cuántos caracteres mínimos pide una respuesta abierta.
///
/// ⚠️ **El doble que en el taller de Casa de Fe (10), y es a propósito.** Allí
/// responde un nuevo creyente y una frase corta puede ser una respuesta
/// honesta. Aquí responde quien va a PARARSE A ENSEÑAR el tema, y los
/// enunciados piden explicar, describir o acompañar pastoralmente: cualquier
/// respuesta real pasa de 20 caracteres con holgura. El mínimo no juzga la
/// calidad —eso lo hace el coordinador—, solo evita que se envíe un
/// cuestionario con doce puntos suspensivos.
export const LARGO_MINIMO_RESPUESTA_QUIZ = 20;

/// La nota del coordinador al devolver. **Obligatoria**, como en todos los
/// paneles: devolver sin decir por qué deja al líder sin saber qué repasar.
export const LARGO_MINIMO_NOTA_QUIZ = 10;

export type TipoDePreguntaQuiz = "ABIERTA" | "OPCION";

export type PreguntaQuiz = {
  id: string;
  number: number;
  kind: string;
  prompt: string;
  options: string[];
  /// Solo en las de OPCION. **Nunca viaja al navegador de quien responde**
  /// mientras el cuestionario está abierto (ver `verLaCalificacion`).
  correctChoice: number | null;
  explanation: string | null;
};

export type RespuestaQuiz = {
  questionId: string;
  text: string | null;
  choice: number | null;
};

// ---------------------------------------------------------------------------
// El estado: se DERIVA, no se guarda
// ---------------------------------------------------------------------------

/// ⚠️ **Se reutiliza `estadoDelTaller` a propósito, en vez de copiar la
/// lógica.** La regla difícil es la misma —comparar el envío contra la ÚLTIMA
/// revisión, para que un reenvío no se quede en «devuelto» para siempre— y dos
/// copias de esa comparación se desincronizarían en cuanto alguien arreglara
/// una sola.
export type EstadoQuiz = EstadoDelTaller;

export { ultimaRevision };
export type { RevisionParaEstado };

export function estadoDelQuiz(
  submittedAt: Date | null,
  revisiones: readonly RevisionParaEstado[],
): EstadoQuiz {
  return estadoDelTaller(submittedAt, revisiones);
}

export const ETIQUETA_QUIZ: Record<EstadoQuiz, string> = {
  BORRADOR: "Sin enviar",
  ENVIADO: "Esperando revisión del coordinador",
  APROBADO: "Aprobado · puedes dictar este tema",
  DEVUELTO: "Devuelto para repasar",
};

// ---------------------------------------------------------------------------
// Responder
// ---------------------------------------------------------------------------

export function respondidaQuiz(
  pregunta: PreguntaQuiz,
  respuesta: RespuestaQuiz | undefined,
): boolean {
  if (!respuesta) return false;

  if (pregunta.kind === "OPCION") {
    return (
      respuesta.choice !== null &&
      respuesta.choice >= 0 &&
      respuesta.choice < pregunta.options.length
    );
  }

  return (respuesta.text ?? "").trim().length >= LARGO_MINIMO_RESPUESTA_QUIZ;
}

export type AvanceQuiz = {
  respondidas: number;
  total: number;
  faltan: number;
  completo: boolean;
};

export function avanceQuiz(
  preguntas: readonly PreguntaQuiz[],
  respuestas: readonly RespuestaQuiz[],
): AvanceQuiz {
  const porPregunta = new Map(respuestas.map((r) => [r.questionId, r]));
  let respondidas = 0;
  for (const p of preguntas) {
    if (respondidaQuiz(p, porPregunta.get(p.id))) respondidas += 1;
  }
  const total = preguntas.length;
  return {
    respondidas,
    total,
    faltan: total - respondidas,
    completo: total > 0 && respondidas === total,
  };
}

/// Un cuestionario solo se envía completo, y se comprueba **también en el
/// servidor**: un botón apagado es una sugerencia del navegador.
export function puedeEnviarseQuiz(
  preguntas: readonly PreguntaQuiz[],
  respuestas: readonly RespuestaQuiz[],
  estado: EstadoQuiz,
): boolean {
  if (estado === "ENVIADO" || estado === "APROBADO") return false;
  return avanceQuiz(preguntas, respuestas).completo;
}

// ---------------------------------------------------------------------------
// Calificar: lo único que el sistema se atreve a juzgar
// ---------------------------------------------------------------------------

/// `NO_SE_CALIFICA` es el caso normal, no la excepción: **38 de las 63
/// preguntas son abiertas**.
export type Calificacion = "ACERTO" | "FALLO" | "SIN_RESPONDER" | "NO_SE_CALIFICA";

/// ⚠️ **EL SISTEMA NO JUZGA LAS ABIERTAS, Y ES UNA DECISIÓN, NO UNA
/// LIMITACIÓN QUE SE DISIMULE.** El documento es explícito: en las abiertas
/// «no hay una única correcta, pero sí deben reflejar comprensión real y
/// capacidad de explicarlo a otros». Decir «bien» o «mal» sobre un párrafo
/// haría que el coordinador dejara de leerlos, que es justo lo contrario de
/// para lo que existe la revisión.
export function calificar(
  pregunta: PreguntaQuiz,
  respuesta: RespuestaQuiz | undefined,
): Calificacion {
  if (pregunta.kind !== "OPCION" || pregunta.correctChoice === null) {
    return "NO_SE_CALIFICA";
  }
  if (!respuesta || respuesta.choice === null) return "SIN_RESPONDER";
  return respuesta.choice === pregunta.correctChoice ? "ACERTO" : "FALLO";
}

export type ResultadoDeOpcion = {
  aciertos: number;
  fallos: number;
  /// Cuántas de este tema se pueden calificar. Es el denominador que se
  /// enseña: «3 de 3», nunca «3 de 6» metiendo las abiertas.
  calificables: number;
};

export function resultadoDeOpcion(
  preguntas: readonly PreguntaQuiz[],
  respuestas: readonly RespuestaQuiz[],
): ResultadoDeOpcion {
  const porPregunta = new Map(respuestas.map((r) => [r.questionId, r]));
  let aciertos = 0;
  let fallos = 0;
  let calificables = 0;
  for (const p of preguntas) {
    const c = calificar(p, porPregunta.get(p.id));
    if (c === "NO_SE_CALIFICA") continue;
    calificables += 1;
    if (c === "ACERTO") aciertos += 1;
    else if (c === "FALLO") fallos += 1;
  }
  return { aciertos, fallos, calificables };
}

export function cuantasSeCalifican(preguntas: readonly PreguntaQuiz[]): number {
  return preguntas.filter((p) => p.kind === "OPCION" && p.correctChoice !== null)
    .length;
}

/// ⚠️ **CUÁNDO VE EL LÍDER SU CALIFICACIÓN: SOLO CUANDO EL COORDINADOR
/// APRUEBA** (decisión del usuario: «cuando el coordinador lo aprueba»). Y no
/// es un detalle de presentación — es lo que sostiene que esto mida algo:
///
/// - Si se enseñara **al enviar**, el líder vería «fallaste la 5, la correcta
///   es la b» y, como los intentos **se apilan**, le bastaría reenviar con la
///   respuesta copiada. El cuestionario dejaría de decir quién domina el tema
///   y pasaría a decir quién lo intentó dos veces.
/// - Si se enseñara **al devolverlo**, lo mismo: corregir sería copiar. Por
///   eso un devuelto trae **la nota del coordinador y nada más** — que es
///   justamente lo que le dice qué repasar.
///
/// Aprobado ya no se puede volver a llenar, así que ahí la calificación no
/// enseña a nadie a hacer trampa: enseña doctrina, que es para lo que el
/// documento trae una explicación en cada respuesta.
export function verLaCalificacion(estado: EstadoQuiz): boolean {
  return estado === "APROBADO";
}

// ---------------------------------------------------------------------------
// Los 12 temas de una persona
// ---------------------------------------------------------------------------

export type EstadoTemaQuiz =
  | "APROBADO"
  | "ESPERANDO"
  | "DEVUELTO"
  | "EMPEZADO"
  | "SIN_EMPEZAR";

export const ETIQUETA_TEMA_QUIZ: Record<EstadoTemaQuiz, string> = {
  APROBADO: "Aprobado",
  ESPERANDO: "Esperando revisión",
  DEVUELTO: "Devuelto para repasar",
  EMPEZADO: "Empezado, sin enviar",
  SIN_EMPEZAR: "Sin empezar",
};

export function estadoDelTemaQuiz(datos: {
  /// Nulo si todavía no ha abierto el cuestionario de ese tema.
  quiz: {
    submittedAt: Date | null;
    revisiones: readonly RevisionParaEstado[];
    respondidas: number;
  } | null;
}): EstadoTemaQuiz {
  if (!datos.quiz) return "SIN_EMPEZAR";

  const estado = estadoDelQuiz(datos.quiz.submittedAt, datos.quiz.revisiones);
  if (estado === "APROBADO") return "APROBADO";
  if (estado === "ENVIADO") return "ESPERANDO";
  if (estado === "DEVUELTO") return "DEVUELTO";

  // ⚠️ Abrir un tema para mirarlo —que es lo que hace cualquiera al recibir el
  // enlace— NO es haberlo empezado. Si contara, el tablero del coordinador
  // nacería con renglones «empezados» que nadie empezó (la lección medida del
  // 2-oct-2026: de 4 talleres abiertos, 3 no tenían ni una respuesta).
  return datos.quiz.respondidas > 0 ? "EMPEZADO" : "SIN_EMPEZAR";
}

/// Cuántos de los 12 lleva aprobados. Cuenta **lo aprobado**, no lo enviado:
/// decir «3 de 12» con dos esperando revisión le prometería al líder una
/// habilitación que el coordinador todavía no le ha firmado.
export function temasAprobadosQuiz(estados: readonly EstadoTemaQuiz[]): number {
  return estados.filter((e) => e === "APROBADO").length;
}

/// ¿Este renglón va arriba, separado de los demás?
///
/// **Solo lo devuelto.** Es lo único que le pide algo ahora mismo; dejarlo en
/// su sitio del libro lo esconde entre once y el líder no vuelve a saber que
/// tenía algo que repasar. Lo demás conserva el orden del libro, incluido lo
/// aprobado, porque los temas se dictan en ese orden.
export function pideAtencionQuiz(estado: EstadoTemaQuiz): boolean {
  return estado === "DEVUELTO";
}

/// ¿Ya domina los 12? Es lo que habilita a un líder para dictar todo el libro.
export function dominaLosDoce(temasAprobados: number): boolean {
  return temasAprobados >= TOTAL_DE_TEMAS_QUIZ;
}
