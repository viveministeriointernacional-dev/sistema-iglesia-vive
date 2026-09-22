/// **Los encargados de un grupo**: quienes lo llevan JUNTO al líder.
///
/// Este archivo es el catálogo —puro, sin base de datos ni red—, así que lo
/// pueden importar los componentes de cliente. Es la regla del 6-sep-2026: lo
/// que use el navegador va en el catálogo; lo que toque base de datos, en
/// `alpha.ts` / `casa-de-fe.ts`.
///
/// **Por qué existe esto.** Hasta el 21-sep-2026 un Alpha o una Casa de Fe
/// tenía UN solo dueño, y el equipo venía resolviendo la falta metiendo al
/// segundo dentro del NOMBRE del grupo: «Casa de Fe Joiner & Maria Isabel»,
/// «Oscar & Dana», «Jaime & Geraldine», «Jeison y Lorena». Seis grupos
/// nombrados en pareja. El líder sigue siendo uno —es quien responde por el
/// grupo— y los encargados lo administran igual que él.

/// **Lo que hace falta saber de un grupo para decidir si alguien lo administra.**
///
/// ⚠️ `coLeaderIds` es OBLIGATORIO a propósito, y es la salvaguarda de todo
/// este cambio. Si fuera opcional, cualquier consulta que olvidara traer los
/// encargados dejaría a un encargado sin poder tocar su propio grupo — un
/// agujero **mudo**, que es peor que uno ruidoso, porque nadie sabría por qué
/// «no le sale el botón». Siendo obligatorio, `tsc` señala uno por uno los
/// sitios que hay que corregir.
///
/// Es la contracara de la lección del 12-sep-2026: allí el compilador no podía
/// ver una promesa negada; aquí se le da algo que sí puede ver.
export type GrupoParaPermiso = {
  leaderId: string;
  createdById?: string | null;
  /// Las CUENTAS encargadas del grupo (`AlphaCoLeader.userId`).
  coLeaderIds: string[];
};

/// **Quiénes llevan el grupo**: el líder y sus encargados, en ese orden.
///
/// Se usa para el permiso y para la ficha, y por eso vive en un solo sitio: si
/// la ficha enseñara a alguien que el permiso no reconoce, esa persona vería su
/// nombre en el grupo y no podría tocarlo.
export function quienesLoLlevan(grupo: GrupoParaPermiso): string[] {
  return [grupo.leaderId, ...grupo.coLeaderIds];
}

/// **Quién queda de encargado cuando el líder cambia.**
///
/// Decisión del usuario (21-sep-2026): **el líder saliente pasa a encargado**,
/// no se va. Casi siempre un cambio de líder es pasar la batuta dentro de la
/// misma pareja que ya lleva la casa, y sacar al saliente de un tirón le
/// quitaría el grupo de su lista y de su calendario sin que nadie lo pidiera.
/// Si de verdad hay que sacarlo, se le quita después con un clic.
///
/// Las dos reglas que sostienen el resultado, y que las pruebas vigilan:
/// **el líder nuevo NUNCA queda también de encargado** (estaría dos veces en
/// la ficha, y el índice único de la base rechazaría el renglón), y **nadie se
/// repite**.
export function encargadosTrasCambiarLider(
  grupo: GrupoParaPermiso,
  nuevoLiderId: string,
): string[] {
  const conElSaliente = [...grupo.coLeaderIds, grupo.leaderId];
  return [...new Set(conElSaliente)].filter((id) => id !== nuevoLiderId);
}

/// **Quién puede entrar a la lista de candidatos a encargado**: las cuentas
/// activas con el permiso de llevar ese tipo de grupo, **menos las que ya lo
/// llevan**.
///
/// Sin el descarte, el buscador ofrecería «Añadir» sobre alguien que ya está,
/// y el índice único de la base lo rechazaría con un error que no dice nada.
export function candidatosDisponibles<T extends { id: string }>(
  candidatos: T[],
  grupo: GrupoParaPermiso,
): T[] {
  const ocupados = new Set(quienesLoLlevan(grupo));
  return candidatos.filter((candidato) => !ocupados.has(candidato.id));
}

/// El largo mínimo de la nota que explica un cambio de líder. Mismo criterio
/// que los demás paneles de la plataforma: el motivo sirve para contar, la nota
/// es lo que le explica el caso a quien abra el grupo dentro de un año.
export const LARGO_MINIMO_NOTA = 10;

/// **Traduce una fila de la base a lo que pide el permiso.**
///
/// Existe para que el sitio que consulta el grupo y el que decide el permiso no
/// puedan desincronizarse: quien trae `coLeaders` del `select` pasa por aquí y
/// ya. Sin esto, cada punto de llamada escribiría su propio `.map()` y bastaría
/// uno mal escrito para dejar a un encargado fuera de su grupo.
export function paraPermiso(grupo: {
  leaderId: string;
  createdById?: string | null;
  coLeaders: { userId: string }[];
}): GrupoParaPermiso {
  return {
    leaderId: grupo.leaderId,
    createdById: grupo.createdById,
    coLeaderIds: grupo.coLeaders.map((encargado) => encargado.userId),
  };
}
