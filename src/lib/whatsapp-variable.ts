/// **El aplanador de las variables de plantilla de WhatsApp.**
///
/// ⚠️ **Meta rechaza un valor de variable que lleve un salto de línea, un
/// tabulador o cuatro espacios seguidos.** La plantilla sí puede tener los
/// párrafos que quiera: la restricción es sobre lo que se mete en el hueco
/// `{{n}}`. Lo descubrimos tarde (22-oct-2026), con el recordatorio ya
/// construido, y la misma trampa llevaba tres semanas tumbando el WhatsApp del
/// acceso al taller sin que nadie lo supiera.
///
/// Vive en su propio módulo porque **ya son dos sitios los que arman una
/// variable** —el recordatorio de las casas y la confirmación de inscripción— y
/// dos copias de la misma garantía es justo lo que se desincroniza sin que nada
/// avise (§12.6). El día que alguien añada un tercero, la garantía ya existe.
///
/// No hay nada aquí que consulte nada: es texto, y se prueba solo (§12.4).

/// Aplana cualquier espacio en blanco a un solo espacio. Es la garantía de que
/// lo que sale de aquí cabe en una variable de plantilla, escriba lo que
/// escriba quien toque las funciones que lo llaman.
export function enUnaLinea(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}
