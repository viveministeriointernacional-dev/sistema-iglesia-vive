/// **La cadena de mentoría, sin base de datos.**
///
/// Vive aparte de `procesos.ts` por dos razones: se puede probar sin conexión
/// (y se prueba, en `procesos-arbol.test.ts`, contra la forma real del árbol de
/// la iglesia), y **la usa también el componente de cliente** que despliega las
/// ramas — y lo que toca el navegador no puede colgar de un módulo que importa
/// Prisma.

/// Lo mínimo que el árbol necesita de una persona. `procesos.ts` devuelve tipos
/// más gordos; aquí se piden solo estos tres campos para que la lógica no
/// dependa de cómo crezca el resto.
export type NodoDeLaRama = {
  learnerId: string;
  /// La cuenta del mentor que la acompaña.
  mentorId: string | null;
  /// Su propia cuenta, si tiene. Es lo que permite que la rama siga bajando.
  cuenta: string | null;
};

/// Agrupa a las personas por la cuenta del mentor que las acompaña.
export function agruparPorMentor<T extends NodoDeLaRama>(
  personas: readonly T[],
): Map<string, T[]> {
  const porMentor = new Map<string, T[]>();
  for (const persona of personas) {
    if (!persona.mentorId) continue;
    const lista = porMentor.get(persona.mentorId);
    if (lista) lista.push(persona);
    else porMentor.set(persona.mentorId, [persona]);
  }
  return porMentor;
}

/// Cuánta gente cuelga de una cuenta: sus discípulos directos más todos los que
/// acompañan sus discípulos, hacia abajo hasta el final de la cadena.
///
/// ⚠️ **`vistos` no es una optimización, es la salvaguarda.** Si por un error de
/// datos A acompañara a B y B a A, sin él esto se quedaría dando vueltas para
/// siempre; con él termina y cada persona cuenta una sola vez. Es la misma
/// razón por la que las consultas recursivas de `red.ts` usan `UNION` y no
/// `UNION ALL`.
export function ramaDe<T extends NodoDeLaRama>(
  cuenta: string,
  porMentor: Map<string, T[]>,
): { directos: number; total: number; indirectos: number } {
  const directos = porMentor.get(cuenta) ?? [];
  const vistos = new Set<string>();
  const pendientes = [...directos];

  while (pendientes.length > 0) {
    const persona = pendientes.pop();
    if (!persona || vistos.has(persona.learnerId)) continue;
    vistos.add(persona.learnerId);
    if (!persona.cuenta) continue;
    for (const hijo of porMentor.get(persona.cuenta) ?? []) {
      if (!vistos.has(hijo.learnerId)) pendientes.push(hijo);
    }
  }

  return {
    directos: directos.length,
    total: vistos.size,
    indirectos: vistos.size - directos.length,
  };
}
