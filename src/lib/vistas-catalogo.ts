import { Role } from "@iglesia/prisma-client";

/// **El catálogo de vistas de la plataforma**: qué pantallas se pueden encender
/// y apagar por perfil desde `/administracion/vistas`.
///
/// Vive aparte de `vistas.ts` por la regla del 6-sep-2026: lo que pinta el
/// navegador va en el catálogo, lo que toca la base va en el módulo de datos.
/// Aquí no se importa Prisma ni nada que arrastre `pg`.
///
/// ⚠️ **La lista es CERRADA y va en el código a propósito.** Cada renglón
/// corresponde a una ruta real; una vista que se pudiera inventar desde la
/// pantalla no tendría página a la que abrir.

/// Las dos pantallas que **NO** entran en el configurador, y por qué.
///
/// - **Administración** (`/administracion`) es desde donde se crean accesos, se
///   cambian roles y se configuran estas mismas vistas. Si se pudiera encender
///   desde aquí, cualquiera con ella encendida podría encenderse todo lo demás.
/// - **Llave maestra** abre el perfil de cualquier persona de la iglesia, notas
///   pastorales incluidas. Sigue siendo solo del administrador principal.
///
/// Las dos conservan su guardia de siempre (`ROLES_ADMIN` y `esAdminPrincipal`).
export const VISTAS_FUERA_DEL_CONFIGURADOR = [
  "/administracion",
  "/administracion/llave-maestra",
] as const;

/// Qué se ve al entrar a una vista. **No lo decide el interruptor**: lo deciden
/// las reglas de alcance de cada pantalla, que no cambian.
///
/// Se enseña junto a cada renglón porque es lo que más fácil se confunde:
/// encender «Procesos» a un mentor le muestra **toda la iglesia**, mientras que
/// encenderle «Mi red» le muestra **solo su rama**.
export type AlcanceDeVista = "propio" | "rama" | "todo";

export const ETIQUETA_ALCANCE: Record<AlcanceDeVista, string> = {
  propio: "Solo lo suyo",
  rama: "Lo suyo y lo de su rama",
  todo: "Toda la iglesia",
};

export type VistaId =
  | "mi-red"
  | "gi"
  | "operacion-72"
  | "registro-interno"
  | "grupos"
  | "escuela"
  | "eventos"
  | "mi-proceso"
  | "procesos"
  | "informe"
  | "actividad"
  | "llamadas"
  | "asistentes"
  | "bajas";

export type DefinicionDeVista = {
  id: VistaId;
  nombre: string;
  ruta: string;
  alcance: AlcanceDeVista;
  /// Qué se ve al entrar, en una frase. Para la pantalla de configuración.
  alcanceDetalle: string;
  /// Dónde aparece: en la barra superior o dentro de Administración. Solo
  /// agrupa la tabla; no cambia el comportamiento.
  grupo: "menu" | "administracion";
};

export const VISTAS: readonly DefinicionDeVista[] = [
  {
    id: "mi-red",
    nombre: "Mi red",
    ruta: "/mi-red",
    alcance: "rama",
    alcanceDetalle: "Sus discípulos y los de ellos, hacia abajo",
    grupo: "menu",
  },
  {
    id: "gi",
    nombre: "GI",
    ruta: "/gi",
    alcance: "rama",
    alcanceDetalle:
      "Los jóvenes que acompaña en GI · los de su línea si es mentor · todo el movimiento si lo coordina",
    grupo: "menu",
  },
  {
    id: "operacion-72",
    nombre: "Operación 72",
    ruta: "/operacion-72",
    alcance: "rama",
    alcanceDetalle: "Sus personas · toda la iglesia si coordina la consolidación",
    grupo: "menu",
  },
  {
    id: "registro-interno",
    nombre: "Registrar persona",
    ruta: "/registro-interno",
    alcance: "propio",
    alcanceDetalle: "No es una lista: es el formulario de alta",
    grupo: "menu",
  },
  {
    id: "grupos",
    nombre: "Alpha y Casa de Fe",
    ruta: "/alpha",
    alcance: "rama",
    alcanceDetalle: "Los que lleva y los de su rama",
    grupo: "menu",
  },
  {
    id: "escuela",
    nombre: "Escuela",
    ruta: "/escuela",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "menu",
  },
  {
    id: "eventos",
    nombre: "Eventos",
    ruta: "/eventos",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "menu",
  },
  {
    id: "mi-proceso",
    nombre: "Mi proceso",
    ruta: "/mi-proceso",
    alcance: "propio",
    alcanceDetalle: "Su propio recorrido, nada más",
    grupo: "menu",
  },
  {
    id: "procesos",
    nombre: "Procesos",
    ruta: "/administracion/procesos",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "administracion",
  },
  {
    id: "informe",
    nombre: "Informe",
    ruta: "/administracion/informe",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "administracion",
  },
  {
    id: "actividad",
    nombre: "Actividad del día",
    ruta: "/administracion/actividad",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "administracion",
  },
  {
    id: "llamadas",
    nombre: "Tablero de llamadas",
    ruta: "/administracion/llamadas",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "administracion",
  },
  {
    id: "asistentes",
    nombre: "Asistentes",
    ruta: "/administracion/asistentes",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "administracion",
  },
  {
    id: "bajas",
    nombre: "Bajas",
    ruta: "/administracion/bajas",
    alcance: "todo",
    alcanceDetalle: "Toda la iglesia",
    grupo: "administracion",
  },
];

export const VISTA_POR_ID = new Map(VISTAS.map((v) => [v.id, v]));

export function esVistaConocida(valor: string): valor is VistaId {
  return VISTA_POR_ID.has(valor as VistaId);
}

/// **El valor que trae de fábrica cada casilla de la matriz**: lo que ese rol
/// ve HOY, antes de que nadie toque nada.
///
/// ⚠️ **No es una propuesta: sale de los predicados que ya existían en
/// `auth.ts`, `alpha.ts`, `casa-de-fe.ts`, `entrenar.ts` y `eventos.ts`.** Si
/// se despliega esto y no se mueve un solo interruptor, la plataforma se
/// comporta exactamente igual que antes — que es lo que se le prometió al
/// usuario al aprobar el mockup (16-sep-2026).
///
/// Se guarda aquí, y no se calcula llamando a esas funciones, porque el
/// catálogo no puede importar `auth.ts` (arrastraría Prisma al navegador). La
/// prueba `vistas.test.ts` comprueba que las dos versiones coinciden, así que
/// si alguien cambia un predicado y se olvida de esta tabla, salta.
export const POR_DEFECTO_SEGUN_ROL: Record<VistaId, readonly Role[]> = {
  "mi-red": [Role.MENTOR, Role.PASTOR, Role.ADMIN],
  // ⚠️ GI es la ÚNICA vista de esta tabla que no reconstruye nada: el
  // movimiento juvenil no existía en la plataforma antes del 23-sep-2026, así
  // que aquí no hay un «antes» que respetar y este renglón es una decisión, no
  // una foto. Se le da a quien acompaña una línea —el usuario pidió que el
  // informe lo vieran «los pastores de GI y el mentor o pastor asignado de esa
  // línea»— y, por `PERMISOS_QUE_ABREN`, a quien lleve o coordine GI, sea cual
  // sea su rol: el líder de GI del caso real es una joven de 14 años con
  // cuenta de LÍDER DE ALPHA.
  gi: [Role.MENTOR, Role.PASTOR, Role.ADMIN],
  "operacion-72": [Role.ADMIN, Role.CONSOLIDADOR],
  "registro-interno": [Role.CONSOLIDADOR, Role.PASTOR, Role.ADMIN],
  grupos: [Role.MENTOR, Role.PASTOR, Role.ADMIN],
  escuela: [Role.MENTOR, Role.PASTOR, Role.ADMIN],
  eventos: [
    Role.CONSOLIDADOR,
    Role.LIDER_ALPHA,
    Role.MENTOR,
    Role.PASTOR,
    Role.ADMIN,
  ],
  "mi-proceso": [Role.APRENDIZ],
  procesos: [Role.PASTOR, Role.ADMIN],
  informe: [Role.ADMIN],
  actividad: [Role.ADMIN],
  llamadas: [Role.ADMIN],
  asistentes: [Role.ADMIN],
  bajas: [Role.ADMIN],
};

/// Los permisos acumulables que, **además del rol**, abrían una vista antes de
/// que existiera el configurador.
///
/// ⚠️ Esto es lo que evita una regresión silenciosa el día del despliegue: hoy
/// **10 de los 11 consolidadores** ven «Alpha y Casa de Fe» por la casilla
/// «Líder de Alpha», no por su rol. Si el defecto mirara solo el rol, esas diez
/// personas perderían la pantalla en cuanto esto entrara en producción.
///
/// Las casillas **siguen existiendo** y siguen haciendo su otro oficio —ser
/// elegible para que te asignen un grupo, acompañar discípulos—; lo que dejan
/// de gobernar en cuanto hay una fila configurada es el menú.
export const PERMISOS_QUE_ABREN: Partial<
  Record<VistaId, readonly ("canLeadAlpha" | "canLeadFaithHouse" | "canMentor" | "coordinaConsolidacion" | "veTodosLosGrupos" | "llevaGi" | "coordinaGi")[]>
> = {
  "mi-red": ["canMentor"],
  gi: ["llevaGi", "coordinaGi"],
  "operacion-72": ["coordinaConsolidacion"],
  grupos: ["canLeadAlpha", "canLeadFaithHouse", "veTodosLosGrupos"],
};

/// Las tres respuestas posibles de una excepción por cuenta.
export const OPCIONES_DE_EXCEPCION = [
  { valor: "rol", etiqueta: "Como su rol" },
  { valor: "si", etiqueta: "Encendida" },
  { valor: "no", etiqueta: "Apagada" },
] as const;

export type OpcionDeExcepcion = (typeof OPCIONES_DE_EXCEPCION)[number]["valor"];
