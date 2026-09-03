/// Comparación del secreto de los webhooks en tiempo constante: no se puede
/// adivinar carácter por carácter midiendo cuánto tarda en responder.
export function secretoValido(recibido: string | null, esperado: string) {
  if (!recibido || recibido.length !== esperado.length) return false;
  let diferencia = 0;
  for (let indice = 0; indice < esperado.length; indice += 1) {
    diferencia |= recibido.charCodeAt(indice) ^ esperado.charCodeAt(indice);
  }
  return diferencia === 0;
}
