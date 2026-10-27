/// **Cómo se llama cada tipo de grupo, en un solo sitio.**
///
/// Nació el 27-oct-2026 con Restaurados y Mentorías. Antes la pantalla tenía
/// dos secciones escritas a mano, cada una con sus seis o siete frases
/// («Todas las Casas de Fe de la iglesia», «no lleva ningún Alpha», «Pulsa
/// Todas para ver las de su línea»…). Con cuatro tipos eso serían **veintiocho
/// frases copiadas**, y la copia número once es donde se cuela el «de el
/// Alpha» que el usuario ya cazó el 23-oct dibujando la ventana de borrar.
///
/// Aquí no se toca Prisma ni nada que arrastre `pg`: es la regla del
/// 6-sep-2026, lo que pinta el navegador vive en el catálogo (§12.4). El tipo
/// se escribe como unión de literales y no se importa el enum generado, para
/// que este archivo no dependa del cliente.

/// Los tres tipos que comparten la tabla `faith_house_group`.
export type TipoDeGrupo = "CASA_DE_FE" | "RESTAURADOS" | "MENTORIA";

/// Los cuatro que se ven en la pantalla. Alpha vive en su propia tabla
/// (`alpha_program`) y siempre ha sido así, pero para quien mira la pantalla
/// es un bloque más, y sus rótulos se escriben igual que los otros tres.
export type ClaveDeSeccion = TipoDeGrupo | "ALPHA";

export type RotulosDeGrupo = {
  clave: ClaveDeSeccion;
  /// El título en versalitas del bloque.
  seccion: string;
  /// Cómo se nombra uno: «Casa de Fe», «mentoría».
  singular: string;
  /// Cómo se nombran varios: «Casas de Fe», «mentorías».
  plural: string;
  /// «la» o «el», para «la Casa de Fe» / «el grupo de Restaurados».
  articulo: "la" | "el";
  /// «una» o «un».
  indefinido: "una" | "un";
  /// «las» o «los», para «las que lleva» / «los que lleva».
  articuloPlural: "las" | "los";
  /// El botón de abrir uno nuevo.
  botonNuevo: string;
  /// Lo que se dice a la derecha del título del bloque, después del alcance.
  /// Para Casa de Fe y Alpha es el contenido de referencia; para los dos
  /// nuevos es qué son, porque **todavía no tienen contenido** y decir «12
  /// temas» ahí sería mentira.
  referencia: string;
  /// Cómo se nombra en el renglón del desplegable de líneas, donde el sitio
  /// es poco: «52 casas», no «52 Casas de Fe».
  enElFiltro: string;
  enElFiltroPlural: string;
  /// La etiqueta gris de un grupo que ya se cerró.
  etiquetaCerrado: string;
  /// El título en versalitas de la tarjeta de administrar, que habla de UN
  /// grupo: «ESTA CASA DE FE», «ESTA MENTORÍA». Distinto de `seccion`, que
  /// encabeza la lista de todos.
  seccionSingular: string;
  /// El ejemplo gris dentro del campo del nombre. Sale de nombres reales de
  /// la iglesia: el equipo bautiza las casas por la familia y las mentorías
  /// por quien las recibe.
  ejemploDeNombre: string;
  /// El nombre corto del chip del calendario, que va en una línea junto a un
  /// cuadrito de color y un número.
  chip: string;
  /// Cómo viaja en la URL del calendario (`?tipo=`).
  enLaUrl: string;
  /// Dónde está su ficha. **Los tres tipos de `faith_house_group` comparten
  /// la misma ruta** (`/casa-de-fe/<id>`): es la misma tabla, el mismo
  /// permiso y la misma pantalla, y abrir tres rutas gemelas habría
  /// triplicado los guardias — que es justo donde se olvida uno (§12.6).
  ruta: string;
  /// El cuadrito de color en el calendario.
  ///
  /// ⚠️ Los cuatro se distinguen también por **lo claro y lo oscuro**, no solo
  /// por el tono: azul medio, verde oliva, ámbar y verde muy oscuro. Un par
  /// que solo cambie de tono deja fuera a quien no los separa bien, y además
  /// desaparece impreso en blanco y negro.
  punto: string;
  /// Si lleva el taller de los 12 temas — y con él el código de miembro y el
  /// correo que los reparte. **Solo Casa de Fe** (27-oct-2026): Restaurados y
  /// Mentorías no tienen cartilla, lo suyo se registra encuentro a encuentro.
  conTaller: boolean;
};

/// Cuántas sesiones trae el Alpha de referencia. Vive aquí y no en `alpha.ts`
/// porque este archivo lo lee el navegador y aquel importa Prisma.
export const SESIONES_DE_ALPHA_DE_REFERENCIA = 12;

export const ROTULOS: Record<ClaveDeSeccion, RotulosDeGrupo> = {
  ALPHA: {
    clave: "ALPHA",
    seccion: "ALPHA",
    singular: "Alpha",
    plural: "grupos de Alpha",
    articulo: "el",
    indefinido: "un",
    articuloPlural: "los",
    botonNuevo: "+ Nuevo grupo de Alpha",
    referencia: `${SESIONES_DE_ALPHA_DE_REFERENCIA} sesiones de referencia`,
    enElFiltro: "Alpha",
    enElFiltroPlural: "Alpha",
    etiquetaCerrado: "CERRADO",
    seccionSingular: "ALPHA",
    ejemploDeNombre: "Alpha · Sede central",
    chip: "Alpha",
    enLaUrl: "alpha",
    ruta: "/alpha",
    punto: "bg-verde-700",
    conTaller: false,
  },
  CASA_DE_FE: {
    clave: "CASA_DE_FE",
    seccion: "CASA DE FE",
    singular: "Casa de Fe",
    plural: "Casas de Fe",
    articulo: "la",
    indefinido: "una",
    articuloPlural: "las",
    botonNuevo: "+ Nueva Casa de Fe",
    referencia: "12 temas de referencia",
    enElFiltro: "casa",
    enElFiltroPlural: "casas",
    etiquetaCerrado: "CERRADA",
    seccionSingular: "CASA DE FE",
    ejemploDeNombre: "Casa de Fe · Familia Pérez",
    chip: "Casa de Fe",
    enLaUrl: "casa-de-fe",
    ruta: "/casa-de-fe",
    punto: "bg-azul-700",
    conTaller: true,
  },
  RESTAURADOS: {
    clave: "RESTAURADOS",
    seccion: "RESTAURADOS",
    singular: "grupo de Restaurados",
    plural: "grupos de Restaurados",
    articulo: "el",
    indefinido: "un",
    articuloPlural: "los",
    botonNuevo: "+ Nuevo grupo de Restaurados",
    referencia: "discipulado para parejas",
    enElFiltro: "grupo de Restaurados",
    enElFiltroPlural: "grupos de Restaurados",
    etiquetaCerrado: "CERRADO",
    seccionSingular: "GRUPO DE RESTAURADOS",
    ejemploDeNombre: "Restaurados · Sergio y Nora",
    chip: "Restaurados",
    enLaUrl: "restaurados",
    ruta: "/casa-de-fe",
    punto: "bg-ambar-barra",
    conTaller: false,
  },
  MENTORIA: {
    clave: "MENTORIA",
    seccion: "MENTORÍAS",
    singular: "mentoría",
    plural: "mentorías",
    articulo: "la",
    indefinido: "una",
    articuloPlural: "las",
    botonNuevo: "+ Nueva mentoría",
    referencia: "discipulado personalizado",
    enElFiltro: "mentoría",
    enElFiltroPlural: "mentorías",
    etiquetaCerrado: "CERRADA",
    seccionSingular: "MENTORÍA",
    ejemploDeNombre: "Mentoría · Jhonatan Trujillo",
    chip: "Mentorías",
    enLaUrl: "mentorias",
    ruta: "/casa-de-fe",
    punto: "bg-bosque-900",
    conTaller: false,
  },
};

/// **El orden en que salen los bloques de la pantalla.** Alpha y Casa de Fe
/// primero porque son los que tienen gente: 55 casas y 4 Alpha el 27-oct,
/// contra 3 mentorías y ningún grupo de Restaurados. Lo que más se usa, arriba.
export const SECCIONES: ClaveDeSeccion[] = [
  "ALPHA",
  "CASA_DE_FE",
  "RESTAURADOS",
  "MENTORIA",
];

/// Los tres que viven en `faith_house_group`, en el orden de la pantalla.
export const TIPOS_DE_GRUPO: TipoDeGrupo[] = [
  "CASA_DE_FE",
  "RESTAURADOS",
  "MENTORIA",
];

/// Lee el `?tipo=` de la URL del calendario. Devuelve `null` para «todos» y
/// para cualquier cosa que no reconozca: un valor inventado no puede dejar el
/// calendario en blanco (la misma regla que el filtro de línea).
export function tipoDeLaUrl(valor: string | undefined): ClaveDeSeccion | null {
  if (!valor) return null;
  const encontrado = SECCIONES.find((c) => ROTULOS[c].enLaUrl === valor);
  return encontrado ?? null;
}

/// **El tipo tal como llega de un formulario.** Lo que manda el navegador es
/// texto, y de ahí sale un valor que se escribe en la base: si no está en la
/// lista, no se crea nada.
export function tipoDeGrupoDelFormulario(valor: unknown): TipoDeGrupo | null {
  return TIPOS_DE_GRUPO.find((t) => t === valor) ?? null;
}

/// «Solo las que lleva Alejandro Facundo» / «Solo los que lleva …».
export function fraseSoloLasQueLleva(r: RotulosDeGrupo, nombre: string) {
  return `Solo ${r.articuloPlural} que lleva ${nombre}`;
}

/// «Solo las de la línea de X, sin las suyas».
export function fraseSoloLaLinea(r: RotulosDeGrupo, nombre: string) {
  return `Solo ${r.articuloPlural} de la línea de ${nombre}, sin ${r.articuloPlural} suy${r.articuloPlural === "las" ? "a" : "o"}s`;
}

/// Lo que dice el bloque cuando no hay ninguno que enseñar.
///
/// ⚠️ **Con «directas» puesto, el hueco es frecuente y no es raro**: Alejandro
/// Facundo tiene 4 Alpha en su línea y no lleva ninguno (27-oct). Decir «en
/// esta línea no hay ningún Alpha» sería falso y mandaría a cambiar de línea,
/// que no es el problema. Por eso cada caso dice algo distinto.
export function fraseDelHueco(
  r: RotulosDeGrupo,
  caso:
    | { filtro: "sin-linea"; puedeCrear: boolean }
    | { filtro: "todas"; nombre: string }
    | { filtro: "directas"; nombre: string }
    | { filtro: "linea" },
): string {
  if (caso.filtro === "directas") {
    return `${caso.nombre} no lleva ning${r.indefinido === "una" ? "una" : "ún"} ${r.singular}. Pulsa «Todas» para ver ${r.articuloPlural} de su línea.`;
  }
  if (caso.filtro === "linea") {
    return `En su línea nadie más lleva ${r.indefinido} ${r.singular}. Pulsa «Todas» para verl${r.articuloPlural === "las" ? "a" : "o"}s tod${r.articuloPlural === "las" ? "a" : "o"}s.`;
  }
  if (caso.filtro === "todas") {
    return `En esta línea no hay ning${r.indefinido === "una" ? "una" : "ún"} ${r.singular}. Cambia de línea o elige «Toda la iglesia».`;
  }
  const vacio = `Todavía no hay ${r.plural}.`;
  return caso.puedeCrear
    ? `${vacio} Abre ${r.indefinido === "una" ? "la primera" : "el primero"} y elige quién ${r.articulo === "la" ? "la" : "lo"} lleva.`
    : // ⚠️ «uno», no «un»: aquí la palabra va **sola**, sin el nombre detrás,
      // y «cuando te asignen un, aparecerá aquí» es lo que salió la primera
      // vez que dibujé las frases con los cuatro tipos delante. Es la razón de
      // dibujarlas (§12.5): leyendo el código no se ve.
      `${vacio} Cuando te asignen ${r.indefinido === "una" ? "una" : "uno"}, aparecerá aquí.`;
}

/// El alcance que se dice a la derecha del título cuando no hay filtro puesto.
export function fraseDelAlcance(r: RotulosDeGrupo, vistaCompleta: boolean) {
  return vistaCompleta
    ? `Tod${r.articuloPlural === "las" ? "a" : "o"}s ${r.articuloPlural} ${r.plural} de la iglesia`
    : `${r.articuloPlural === "las" ? "Las" : "Los"} que llevas y ${r.articuloPlural} de tu red`;
}
