/// **Borrar un grupo creado por error: qué se va, qué se queda, y cómo se
/// confirma.**
///
/// Catálogo aparte porque esto lo pinta el navegador y las acciones viven en
/// archivos `"use server"`, que solo pueden exportar funciones `async` (§12.4).
///
/// ## Por qué borrar y no solo cerrar (22-oct-2026)
///
/// «Cerrar» ya existía y no sirve para un error: la casa sigue en la lista, en
/// el calendario y en el buscador. Pedido del usuario: «si por error se crea
/// una casa de fe o un alfa, no se puede ni modificar ni editar».
///
/// ## ⚠️ Lo que midió el 22-oct y da la vuelta al diseño obvio
///
/// La regla fácil habría sido **«borrar solo si está vacío»**. No sirve, por
/// las dos puntas:
///
/// 1. **Vacío NO significa error.** 15 de las 59 casas no tienen a nadie
///    inscrito, y 14 son casas reales con su día, su hora, su dirección y su
///    líder — simplemente nadie ha metido todavía a su gente en el sistema.
/// 2. **Y la única casa que es claramente una prueba TIENE un miembro**: «Casa
///    de Fe Prueba», con una persona dentro desde el 12-oct. O sea que el
///    guarda habría rechazado justo la que hay que borrar.
///
/// Así que se puede borrar con gente dentro, y lo que protege no es un guarda:
/// es **decir exactamente qué desaparece** y pedir que se escriba el nombre.
///
/// ## Lo que de verdad se pierde, comprobado en las claves ajenas
///
/// En cascada se van **solo el renglón de cada miembro y los encargados** (y en
/// Alpha, las sesiones y la asistencia). **El expediente de cada persona no se
/// toca**: sus 12 temas del taller viven en `faith_house_progress`, su código
/// en `member_code`, su enlace en `faith_house_taller_token`, y todos cuelgan
/// del aprendiz, no del grupo. En Alpha, el Focus Day y la validación se
/// escriben **además** como hito (`marcarFocusDay` y `validarAlpha` hacen el
/// `upsert` en `milestone`), así que tampoco se pierden.
///
/// Eso es lo que hace que ofrecer «borrar» sea honesto, y es justo lo que hay
/// que escribir en la pantalla: un líder que no sabe qué se lleva por delante
/// no pulsa el botón, o lo pulsa con miedo.

export type ClaseDeGrupo = "alpha" | "casa-de-fe";

/// Cómo se llama cada cosa, para no escribir «grupo» donde el equipo dice
/// «casa».
/// ⚠️ **`rotulos` llegó el 27-oct-2026 con Restaurados y Mentorías.** La
/// `clase` sigue diciendo qué tabla se toca —y eso no cambió: los tres tipos
/// nuevos viven en `faith_house_group`—, pero ya no alcanza para NOMBRAR el
/// grupo: «esta Casa de Fe» sería falso en la ventana de borrar una mentoría,
/// y esa ventana es justo donde el usuario cazó el 23-oct cuatro faltas por
/// dibujarla con datos de verdad. Sin `rotulos` se comporta como antes.
export function comoSeLlama(
  clase: ClaseDeGrupo,
  rotulos?: { singular: string; articulo: "la" | "el" },
): {
  /// «esta Casa de Fe» / «este Alpha».
  este: string;
  /// «la Casa de Fe» / «el Alpha».
  el: string;
  /// Cómo se llama a quien está dentro.
  miembros: { uno: string; varios: string };
} {
  if (rotulos) {
    return {
      este: `${rotulos.articulo === "la" ? "esta" : "este"} ${rotulos.singular}`,
      el: `${rotulos.articulo} ${rotulos.singular}`,
      miembros:
        clase === "alpha"
          ? { uno: "persona inscrita", varios: "personas inscritas" }
          : { uno: "persona", varios: "personas" },
    };
  }

  return clase === "alpha"
    ? {
        este: "este Alpha",
        el: "el Alpha",
        miembros: { uno: "persona inscrita", varios: "personas inscritas" },
      }
    : {
        este: "esta Casa de Fe",
        el: "la Casa de Fe",
        miembros: { uno: "persona", varios: "personas" },
      };
}

/// Lo que el servidor cuenta antes de ofrecer el botón.
export type LoQueTieneElGrupo = {
  /// Los nombres de quienes están dentro. Van por su nombre y no como un
  /// número: «2 personas» no le dice al líder si son las que él cree.
  personas: string[];
  encargados: number;
  /// Solo Alpha.
  sesiones: number;
  asistencias: number;
  /// Solo Alpha: cuántas notas escribió el líder al validar. Es lo ÚNICO del
  /// recorrido de Alpha que no está también en el hito del expediente, así que
  /// es lo único que de verdad se pierde.
  notasDeValidacion: number;
};

export const GRUPO_VACIO: LoQueTieneElGrupo = {
  personas: [],
  encargados: 0,
  sesiones: 0,
  asistencias: 0,
  notasDeValidacion: 0,
};

/// **Qué desaparece.** Una línea por cosa, en orden de importancia: primero las
/// personas, que es lo que preocupa.
export function loQueSeBorra(
  clase: ClaseDeGrupo,
  tiene: LoQueTieneElGrupo,
  rotulos?: { singular: string; articulo: "la" | "el" },
): string[] {
  const nombres = comoSeLlama(clase, rotulos);
  const lineas: string[] = [];

  if (tiene.personas.length > 0) {
    const cuantas = tiene.personas.length;
    const palabra = cuantas === 1 ? nombres.miembros.uno : nombres.miembros.varios;
    // ⚠️ «queda» y «quedan»: dibujar la ventana con los datos de verdad sacó
    // «1 persona quedan fuera» (§12.5). El plural de la frase tiene que seguir
    // al número, no al sustantivo del grupo.
    lineas.push(
      `${cuantas} ${palabra} ${cuantas === 1 ? "queda" : "quedan"} fuera de ${nombres.este}: ${tiene.personas.join(", ")}.`,
    );
  }

  // ⚠️ Esto no es cosmético y no se ve en el esquema: `puedeRevisarElTaller`
  // (`taller.ts`) le da permiso al líder de la casa **por la pertenencia al
  // grupo**. Borrada la casa, ese camino se cierra. Quien además sea su mentor
  // lo conserva por `accesoAExpediente`, que se comprueba antes.
  if (tiene.personas.length > 0 && clase === "casa-de-fe") {
    lineas.push(
      "Quien lleva la casa deja de poder revisarles el taller desde aquí, salvo que además sea su mentor.",
    );
  }

  if (tiene.encargados > 0) {
    lineas.push(
      tiene.encargados === 1
        ? "El encargado deja de tenerlo a su cargo."
        : `Los ${tiene.encargados} encargados dejan de tenerlo a su cargo.`,
    );
  }

  if (tiene.sesiones > 0) {
    lineas.push(
      `Las ${tiene.sesiones} sesiones y la asistencia que se tomó en ellas (${tiene.asistencias} ${tiene.asistencias === 1 ? "marca" : "marcas"}).`,
    );
  } else if (tiene.asistencias > 0) {
    lineas.push(`La asistencia tomada (${tiene.asistencias} marcas).`);
  }

  if (tiene.notasDeValidacion > 0) {
    lineas.push(
      `La nota que el líder escribió al validar (${tiene.notasDeValidacion}). El hito de Alpha se queda en el expediente, pero la nota no.`,
    );
  }

  // ⚠️ `del` y no `de el`, y el verbo explícito: la primera versión decía «la
  // dirección de el Alpha, y el Alpha de la lista y del calendario», que además
  // se leía como si hubiera «una Casa de Fe de la lista».
  lineas.push(
    `El día, la hora y la dirección, y ${nombres.el} desaparece de la lista y del calendario de todos.`,
  );

  return lineas;
}

/// **Qué NO desaparece**, que es la mitad que quita el miedo. Lo primero es
/// siempre el expediente, porque es lo que un líder teme perder.
export function loQueSeQueda(
  clase: ClaseDeGrupo,
  tiene: LoQueTieneElGrupo,
  rotulos?: { singular: string; articulo: "la" | "el" },
): string[] {
  const lineas: string[] = [];

  if (tiene.personas.length > 0) {
    // ⚠️ El taller de los 12 temas es de CASA DE FE, no de Alpha: nombrarlo en
    // la ventana de un Alpha confunde, aunque la persona tenga uno por otra
    // casa.
    // ⚠️ **El taller es de CASA DE FE, no de todos los grupos de su tabla.**
    // Nombrarlo al borrar una mentoría prometería algo que esa gente no tiene,
    // igual que nombrarlo en un Alpha. Es la misma falta que el usuario cazó
    // el 23-oct cuando la ventana de un Alpha hablaba del taller.
    const conTaller = clase !== "alpha" && (!rotulos || rotulos.singular === "Casa de Fe");
    lineas.push(
      conTaller
        ? "El expediente de cada persona queda igual: nadie pierde lo que ya respondió del taller, ni su código, ni su enlace."
        : "El expediente de cada persona queda igual: no pierde ningún hito ni nada de su proceso.",
    );
    if (clase === "alpha") {
      lineas.push(
        "El Focus Day y el Alpha validado siguen marcados como hito en el expediente de quien los tenga.",
      );
    }
    lineas.push(
      `Se pueden volver a inscribir en ${
        clase === "alpha"
          ? "otro Alpha"
          : rotulos
            ? `${rotulos.articulo === "la" ? "otra" : "otro"} ${rotulos.singular}`
            : "otra Casa de Fe"
      } cuando quieras.`,
    );
  }

  lineas.push("Queda escrito en la auditoría quién lo borró, cuándo y a quién tenía dentro.");

  return lineas;
}

/// **El nombre que hay que escribir para confirmar.**
///
/// Se compara sin tildes de más ni espacios de más: los nombres los escribió el
/// equipo a mano y hay «Casa de Fe -  Saira Leyton» con dos espacios seguidos y
/// «casa de fe Jesica Paula Lopez» en minúscula. Exigir el byte exacto sería
/// pedirle al líder que adivine un espacio que no se ve.
///
/// Lo que sí se exige es escribirlo: pulsar dos veces «Sí, borrar» se hace sin
/// leer, y copiar el nombre obliga a mirar CUÁL se está borrando — que es el
/// error de verdad, borrar la casa de al lado.
export function nombreCoincide(escrito: string, real: string): boolean {
  return aplanar(escrito) === aplanar(real) && aplanar(real).length > 0;
}

function aplanar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

/// El mensaje cuando el nombre escrito no es el del grupo.
export const NOMBRE_QUE_NO_COINCIDE =
  "El nombre que escribiste no es el de este grupo. Cópialo tal como aparece arriba.";
