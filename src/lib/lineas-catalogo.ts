/// **Filtrar los grupos por la línea de mentoría de quien los lleva.**
///
/// La pregunta que contesta: «de las 37 Casas de Fe, ¿cuáles cuelgan de mi
/// línea?». Es distinta de «cuáles llevo yo»: un pastor casi nunca lleva una
/// casa, pero su gente sí — y lo que quiere ver es el conjunto.
///
/// Todo lo de aquí es **puro**: recibe los grupos ya cargados y el mapa de
/// líneas, y no toca la base. Por eso se puede probar.

/// Un grupo, reducido a lo que el filtro necesita.
export type GrupoConLider = {
  tipo: "alpha" | "casa-de-fe";
  liderId: string;
};

/// Para cada cuenta que lleva un grupo, las cuentas que tiene **por encima**
/// en la mentoría, de la más cercana a la más lejana.
export type LineasDeLosLideres = Record<string, string[]>;

/// Un renglón del desplegable.
export type OpcionDeLinea = {
  id: string;
  nombre: string;
  casas: number;
  alpha: number;
};

/// ¿El grupo que lleva `liderId` cae dentro de la línea de `mentorId`?
///
/// ⚠️ **El propio mentor cuenta, y sin eso el filtro mentiría.** `lineas` solo
/// trae a quien está POR ENCIMA de cada líder, así que filtrar por Ruth Bonilla
/// —que lleva 5 casas ella misma y no tiene a nadie debajo— habría devuelto
/// cero. «Su línea» es ella y lo que cuelga de ella.
export function enLaLinea(
  mentorId: string,
  liderId: string,
  lineas: LineasDeLosLideres,
): boolean {
  if (mentorId === liderId) return true;
  return (lineas[liderId] ?? []).includes(mentorId);
}

/// Las cuentas que se pueden elegir en el filtro, con cuántos grupos tiene
/// cada una en su línea.
///
/// ⚠️ **Ninguna opción puede devolver una pantalla vacía, y no por un guardia
/// sino por cómo se construye la lista:** las candidatas son los líderes de los
/// grupos que hay y quienes están por encima de ellos, así que todas tienen al
/// menos un grupo. Se intentó dejar además un `if (suyos.length === 0)
/// continue` y **ninguna prueba conseguía hacerlo saltar** — un guardia que no
/// se puede ver fallar miente sobre la invariante, así que se quitó.
/// Partir de «todas las cuentas del equipo» sí habría dado un desplegable
/// donde la mayoría de las opciones no devuelven nada, que es la peor forma de
/// un filtro: la que deja dudando si no hay grupos o si está roto.
///
/// ⚠️ **Y los números SE SOLAPAN a propósito**: las 14 de Juan Felipe
/// **contienen** las 6 de Paola, porque Paola está en su línea. Es lo que se
/// pidió —«el mentor y sus líneas»— y por eso el rótulo dice «y su línea» en
/// vez de dar a entender un reparto exclusivo.
export function opcionesDeLinea(
  grupos: GrupoConLider[],
  lineas: LineasDeLosLideres,
  nombres: Record<string, string>,
): OpcionDeLinea[] {
  const candidatas = new Set<string>();
  for (const grupo of grupos) {
    candidatas.add(grupo.liderId);
    for (const mentor of lineas[grupo.liderId] ?? []) candidatas.add(mentor);
  }

  const opciones: OpcionDeLinea[] = [];
  for (const id of candidatas) {
    const suyos = grupos.filter((g) => enLaLinea(id, g.liderId, lineas));
    opciones.push({
      id,
      nombre: nombres[id] ?? "—",
      casas: suyos.filter((g) => g.tipo === "casa-de-fe").length,
      alpha: suyos.filter((g) => g.tipo === "alpha").length,
    });
  }

  // De más a menos: arriba quedan las líneas grandes, que es por donde se
  // empieza a mirar. A igual tamaño, por nombre, para que el orden no baile
  // entre dos cargas de la misma pantalla.
  return opciones.sort(
    (a, b) =>
      b.casas + b.alpha - (a.casas + a.alpha) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
}
