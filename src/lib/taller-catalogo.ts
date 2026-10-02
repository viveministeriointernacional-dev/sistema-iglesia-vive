/// Catálogo del taller virtual de Casa de Fe.
///
/// **Todo lo de aquí es PURO y sin base de datos**, que es lo que permite
/// probarlo. Lo que toca Prisma o red vive en `taller.ts` (la regla del
/// 6-sep-2026: lo que use el navegador va en el catálogo).

/// Cuántos caracteres mínimos pide una respuesta abierta para contar como
/// respondida. Dos letras no son una respuesta, y sin un mínimo el botón de
/// enviar se encendería con doce puntos suspensivos.
export const LARGO_MINIMO_RESPUESTA = 10;

/// La nota del líder al devolver un taller. **Obligatoria**, como en todos los
/// paneles: devolver sin decir por qué deja a la persona sin saber qué
/// corregir.
export const LARGO_MINIMO_NOTA = 10;

/// Los 12 temas del libro. El recorrido no se termina con menos.
export const TOTAL_DE_TEMAS = 12;

export type TipoDePregunta = "ABIERTA" | "OPCION" | "DIBUJO";

export type PreguntaDelTaller = {
  id: string;
  number: number;
  kind: string;
  prompt: string;
  options: string[];
};

export type RespuestaDelTaller = {
  questionId: string;
  text: string | null;
  choice: number | null;
};

/// El estado del taller **se deriva**, no se guarda (ver el comentario del
/// modelo `FaithHouseWorkshop`).
export type EstadoDelTaller =
  | "BORRADOR"
  | "ENVIADO"
  | "APROBADO"
  | "DEVUELTO";

export type RevisionParaEstado = {
  approved: boolean;
  reviewedAt: Date;
};

/// ⚠️ **El orden importa y no es obvio: se compara el envío contra la ÚLTIMA
/// revisión.** Un taller devuelto y vuelto a enviar tiene una revisión (con
/// `approved: false`) y un `submittedAt` POSTERIOR a ella; si solo se mirara
/// «¿tiene revisión?», ese reenvío se leería como «devuelto» para siempre y
/// nunca volvería a la cola del líder.
export function estadoDelTaller(
  submittedAt: Date | null,
  revisiones: readonly RevisionParaEstado[],
): EstadoDelTaller {
  if (!submittedAt) return "BORRADOR";

  const ultima = ultimaRevision(revisiones);
  if (!ultima) return "ENVIADO";

  // Se volvió a enviar después de que lo revisaran: está esperando otra vez.
  if (submittedAt.getTime() > ultima.reviewedAt.getTime()) return "ENVIADO";

  return ultima.approved ? "APROBADO" : "DEVUELTO";
}

export function ultimaRevision<T extends RevisionParaEstado>(
  revisiones: readonly T[],
): T | null {
  let ultima: T | null = null;
  for (const r of revisiones) {
    if (!ultima || r.reviewedAt.getTime() > ultima.reviewedAt.getTime()) {
      ultima = r;
    }
  }
  return ultima;
}

export const ETIQUETA_ESTADO: Record<EstadoDelTaller, string> = {
  BORRADOR: "Sin enviar",
  ENVIADO: "Esperando revisión",
  APROBADO: "Aprobado",
  DEVUELTO: "Devuelto para corregir",
};

/// ¿Esta pregunta quedó respondida?
///
/// ⚠️ **Las de DIBUJO cuentan como respondidas con texto**, y esa es la
/// decisión que hace que el taller del tema 2 se pueda terminar. El punto 7 de
/// ese tema pide dibujar dentro de un recuadro y **hoy no hay subida de
/// archivos**; la pantalla le pide describirlo en palabras. Tratarlo como una
/// abierta cualquiera sería mentir sobre lo que se pidió; dejarlo fuera del
/// conteo dejaría ese taller imposible de enviar.
export function preguntaRespondida(
  pregunta: PreguntaDelTaller,
  respuesta: RespuestaDelTaller | undefined,
): boolean {
  if (!respuesta) return false;

  if (pregunta.kind === "OPCION") {
    return (
      respuesta.choice !== null &&
      respuesta.choice >= 0 &&
      respuesta.choice < pregunta.options.length
    );
  }

  return (respuesta.text ?? "").trim().length >= LARGO_MINIMO_RESPUESTA;
}

export type AvanceDelTaller = {
  respondidas: number;
  total: number;
  faltan: number;
  completo: boolean;
};

export function avanceDelTaller(
  preguntas: readonly PreguntaDelTaller[],
  respuestas: readonly RespuestaDelTaller[],
): AvanceDelTaller {
  const porPregunta = new Map(respuestas.map((r) => [r.questionId, r]));
  let respondidas = 0;
  for (const p of preguntas) {
    if (preguntaRespondida(p, porPregunta.get(p.id))) respondidas += 1;
  }
  const total = preguntas.length;
  return {
    respondidas,
    total,
    faltan: total - respondidas,
    completo: total > 0 && respondidas === total,
  };
}

/// ⚠️ **Un taller solo se puede enviar completo**, y el botón nace apagado
/// hasta entonces. Si se pudiera enviar a medias, el líder recibiría talleres
/// en blanco y tendría que devolverlos uno por uno — trabajo para él por un
/// descuido de otro. La misma regla se comprueba **en el servidor**: un botón
/// apagado es una sugerencia del navegador, no una garantía.
export function puedeEnviarse(
  preguntas: readonly PreguntaDelTaller[],
  respuestas: readonly RespuestaDelTaller[],
  estado: EstadoDelTaller,
): boolean {
  if (estado === "ENVIADO" || estado === "APROBADO") return false;
  return avanceDelTaller(preguntas, respuestas).completo;
}

/// El código del QR de un tema, y el token con el que la persona vuelve.
///
/// ⚠️ **`crypto.getRandomValues`, NUNCA `Math.random`**: los dos son
/// credenciales (la regla del 17-sep-2026 con el token del calendario).
export function generarCodigo(bytes = 16): string {
  const crudo = new Uint8Array(bytes);
  crypto.getRandomValues(crudo);
  return Array.from(crudo, (b) => b.toString(16).padStart(2, "0")).join("");
}

/// ¿Ya terminó los 12? Es lo que dispara el hito CASA DE FE.
export function terminoLosDoce(temasCompletados: number): boolean {
  return temasCompletados >= TOTAL_DE_TEMAS;
}

/// El celular, en los 10 dígitos con que se busca la ficha. Devuelve `null` si
/// lo escrito no alcanza — se reutiliza la misma llave del formulario de
/// liderazgo, que es la que el equipo ya conoce.
export function colaDelCelular(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return digitos.slice(-10);
}

// ---------------------------------------------------------------------------
// El código de miembro: el «carné» con el que se entra sin celular
// ---------------------------------------------------------------------------

/// Seis dígitos. Alcanza para 900 000 personas —la iglesia tiene 463— y se
/// dicta por teléfono sin equivocarse. Con cuatro se repetiría pronto y sería
/// adivinable; con ocho ya es incómodo de leer en voz alta.
export const LARGO_DEL_CODIGO = 6;

/// ¿Esto que escribieron parece un código?
///
/// ⚠️ **Se limpian los espacios y los guiones antes de mirar**, porque la
/// gente escribe «418 203» o «418-203» tal como se lo dictaron. Rechazar eso
/// sería castigar a quien copió bien.
export function normalizarCodigo(valor: string): string | null {
  const limpio = valor.replace(/[\s.\-]/g, "");
  if (!/^[1-9][0-9]{5}$/.test(limpio)) return null;
  return limpio;
}

/// Un código nuevo: seis dígitos aleatorios que nunca empiezan por 0.
///
/// ⚠️ **`crypto.getRandomValues`, no `Math.random`.** No es un secreto, pero
/// `Math.random` en un bucle produce rachas predecibles, y dos personas con el
/// mismo código verían el taller la una de la otra.
///
/// ⚠️ **Nunca correlativo.** Con 1, 2, 3… cualquiera abriría el taller del
/// vecino escribiendo el número siguiente.
export function generarCodigoDeMiembro(): string {
  const crudo = new Uint32Array(1);
  crypto.getRandomValues(crudo);
  // 100000–999999: el primer dígito nunca es 0.
  return String(100000 + (crudo[0] % 900000));
}

/// Como se enseña en pantalla y se dicta: «418 203».
export function codigoLegible(codigo: string): string {
  return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
}
