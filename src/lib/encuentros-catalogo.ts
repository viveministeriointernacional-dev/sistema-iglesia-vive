/// **El registro de encuentros: los textos y las cuentas, sin tocar la base.**
///
/// Lo pidió el usuario el 27-oct-2026 para los cuatro procesos a la vez:
/// «una forma práctica de registrar en qué casa de fe se va, qué tema se llevó,
/// quién asistió», y «un checklist de manera visual … con un icono donde pueda
/// dejar una observación».
///
/// Vive en un catálogo y no en el lib porque esto lo pinta el navegador y un
/// archivo `"use server"` solo puede exportar funciones `async` (§12.4).
///
/// ## Las tres medidas que decidieron el diseño (27-oct-2026)
///
/// 1. **Los grupos son diminutos**: 62 abiertos y 58 personas inscritas en
///    total — media de 1,4 por grupo, el mayor tiene 6 y 17 están vacíos. La
///    rejilla es casi siempre **una sola fila**, así que el peso del diseño va
///    en que registrar cueste un toque, no en la tabla.
/// 2. **El panel de sesiones de Alpha lleva muerto desde que existe**: 2
///    sesiones creadas, 4 marcas de asistencia y **0 observaciones** con 14
///    personas inscritas. La causa no es que no se reúnan: es que para marcar
///    hay que **crear antes una sesión numerada**, dos pasos donde el líder
///    esperaba uno. De ahí que aquí el número se ponga solo y la fecha venga
///    puesta.
/// 3. **57 de los 62 grupos tienen día y hora**, así que el sistema sabe cuándo
///    tocaba reunirse y puede proponer esa fecha en vez de pedirla.

import {
  diaDeLaSemanaDe,
  leTocaEseDia,
  type SemanaCivil,
  semanaDe,
  correrSemana,
} from "@/lib/reunion-catalogo";
import type { RotulosDeGrupo } from "@/lib/tipo-de-grupo";

/// Cuántas semanas enseña la tirilla del historial. Ocho porque es el defecto
/// del histórico de Operación 72 y porque un trimestre no cabe de un vistazo.
export const SEMANAS_DE_LA_TIRILLA = 8;

/// Cuántas casillas se pintan en la ficha del grupo antes de recortar.
///
/// ⚠️ **Hace falta un tope y la medida lo dice**: la casa más vieja abierta
/// arrancó el 16-nov-2024, así que una fila sin recorte tendría hoy más de cien
/// casillas y no cabría en ninguna pantalla. Las viejas se ven en el historial.
export const CASILLAS_A_LA_VISTA = 10;

export type EncuentroDelGrupo = {
  id: string;
  numero: number;
  /// El día civil, «AAAA-MM-DD». Nunca un instante (§12.1).
  dia: string;
  /// Si se dio. En un grupo individual el «no se pudo» es un dato, no un hueco.
  seDio: boolean;
  /// Lo que se llevó, ya resuelto a texto.
  tema: string;
  /// Si el encuentro entero lleva observación.
  conNota: boolean;
};

export type MarcaDeAsistencia = {
  /// `true` vino, `false` faltó, `null` no se registró nada de esa persona en
  /// ese encuentro — que pasa cuando entró al grupo después.
  vino: boolean | null;
  conNota: boolean;
};

/// **¿Este grupo se registra como individual?**
///
/// Decisión del usuario (27-oct): «en el caso cuando es individual, pues que
/// solamente se le chulee como las sesiones … pero en el caso que sean
/// grupales … que él pueda chulear qué persona asistió».
///
/// ⚠️ **Lo decide cuánta gente hay, no el tipo de grupo.** Una mentoría con
/// dos personas es grupal y una Casa de Fe con una sola es individual: de las
/// 62 abiertas, la media es 1,4 personas. Atarlo al tipo habría preguntado
/// «quién vino» a un grupo de uno en la mayoría de los casos.
export function esIndividual(cuantasPersonas: number): boolean {
  return cuantasPersonas <= 1;
}

/// **El último día en que a este grupo le tocaba reunirse, contando hoy.**
///
/// Es lo que hace que registrar cueste un toque: el botón ya dice la fecha.
/// `null` cuando el grupo no tiene día de la semana puesto (5 de 62) o cuando
/// todavía no ha llegado su primera reunión — ahí se pide la fecha a mano.
///
/// Mira hacia atrás un número acotado de días en vez de calcular la serie al
/// revés: la serie ya la sabe `leTocaEseDia`, que es la que tiene en cuenta el
/// «cada 15 días» contado **desde el inicio del grupo** (regla del 17-sep).
export function ultimaVezQueTocaba(
  grupo: { weekday: number | null; everyNWeeks: number; inicio: string },
  hoy: string,
  diasHaciaAtras = 120,
): string | null {
  if (grupo.weekday === null) return null;
  // Se salta directamente al último día de la semana correcto, y de ahí hacia
  // atrás de semana en semana: así no se recorren 120 días uno a uno.
  const atraso = (diaDeLaSemanaDe(hoy) - grupo.weekday + 7) % 7;
  let dia = sumarDias(hoy, -atraso);
  for (let i = 0; i * 7 <= diasHaciaAtras; i += 1) {
    if (leTocaEseDia(grupo, dia)) return dia;
    dia = sumarDias(dia, -7);
  }
  return null;
}

const UN_DIA = 24 * 60 * 60 * 1000;

function sumarDias(dia: string, cuantos: number): string {
  const fecha = new Date(`${dia}T00:00:00Z`);
  const movida = new Date(fecha.getTime() + cuantos * UN_DIA);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${movida.getUTCFullYear()}-${z(movida.getUTCMonth() + 1)}-${z(movida.getUTCDate())}`;
}

/// El número de la casilla siguiente. Se pone solo: es lo que ahorra el paso
/// que mató el panel de Alpha.
export function proximoNumero(encuentros: { numero: number }[]): number {
  return encuentros.reduce((mayor, e) => Math.max(mayor, e.numero), 0) + 1;
}

/// **Qué dice el botón grande.** Si el sistema sabe cuándo tocaba, lo dice; si
/// no, pide la fecha. Nunca promete una fecha que no sabe.
export function textoDelBotonDeRegistrar(
  diaQueTocaba: string | null,
  yaRegistrado: boolean,
  diaLargo: (dia: string) => string,
): { titulo: string; pie: string | null } {
  if (!diaQueTocaba) {
    return { titulo: "Registrar un encuentro", pie: null };
  }
  if (yaRegistrado) {
    return {
      titulo: "Registrar otro encuentro",
      // ⚠️ Decirlo importa: sin esta línea, quien ya registró el del lunes y ve
      // el botón otra vez no sabe si se guardó.
      pie: `El de ${diaLargo(diaQueTocaba)} ya está registrado`,
    };
  }
  return {
    titulo: `Registrar el encuentro de ${diaLargo(diaQueTocaba)}`,
    pie: "Tocó reunirse y todavía no está registrado",
  };
}

/// Cómo se nombra la columna de casillas según el grupo sea de uno o de varios.
export function rotuloDeLaRejilla(individual: boolean): string {
  return individual ? "SE DIO" : "QUIÉN VINO";
}

/// Cómo se titula el campo del tema. Casa de Fe lleva cartilla; los otros tres
/// no, y prometerles «tema» de una lista que no existe sería mentir (§12.6).
export function rotuloDelTema(rotulos: RotulosDeGrupo): string {
  return rotulos.conTaller ? "QUÉ TEMA SE LLEVÓ" : "DE QUÉ SE HABLÓ";
}

/// **Cómo se lee un encuentro en la lista de debajo de la rejilla.**
export function pieDelEncuentro(
  encuentro: { seDio: boolean; vinieron: number; deCuantos: number },
  individual: boolean,
): string {
  if (!encuentro.seDio) return "no se pudo";
  if (individual) return "se dio";
  return `${encuentro.vinieron === 1 ? "vino 1" : `vinieron ${encuentro.vinieron}`} de ${encuentro.deCuantos}`;
}

/// **Las ocho semanas de la tirilla del historial**, de la más vieja a esta.
///
/// Cada una dice si hubo algún encuentro registrado. Se calcula sobre semanas
/// civiles de lunes a domingo, las mismas del calendario.
export function tirillaDeSemanas(
  dias: string[],
  hoy: string,
  cuantas = SEMANAS_DE_LA_TIRILLA,
): { semana: SemanaCivil; hubo: boolean }[] {
  const estaSemana = semanaDe(hoy);
  const tirilla: { semana: SemanaCivil; hubo: boolean }[] = [];
  for (let i = cuantas - 1; i >= 0; i -= 1) {
    const semana = semanaDe(correrSemana(estaSemana.inicio, -i));
    tirilla.push({
      semana,
      hubo: dias.some((dia) => dia >= semana.inicio && dia <= semana.fin),
    });
  }
  return tirilla;
}

/// **Cuánto hace que no se reúnen**, dicho en semanas porque es el ritmo real
/// de estos grupos: nadie lleva la cuenta en días.
///
/// ⚠️ **«Nunca» no es lo mismo que «hace mucho», y por eso tiene su frase.** El
/// día que esto salga, los 62 grupos van a decir «Nunca» — no porque no se
/// reúnan, sino porque no había dónde apuntarlo. Decir «hace 100 semanas»
/// sería acusar al equipo de algo que no hizo.
export function cuantoHaceQueNoSeReune(
  ultimoDia: string | null,
  hoy: string,
): { frase: string; atrasado: boolean; nunca: boolean } {
  if (!ultimoDia) {
    return { frase: "Sin ningún encuentro", atrasado: false, nunca: true };
  }
  const inicioDeEstaSemana = semanaDe(hoy).inicio;
  const inicioDeLaSuya = semanaDe(ultimoDia).inicio;
  const semanas = Math.round(
    (new Date(`${inicioDeEstaSemana}T00:00:00Z`).getTime() -
      new Date(`${inicioDeLaSuya}T00:00:00Z`).getTime()) /
      (7 * UN_DIA),
  );
  if (semanas <= 0) return { frase: "Esta semana", atrasado: false, nunca: false };
  if (semanas === 1) return { frase: "La semana pasada", atrasado: false, nunca: false };
  return {
    frase: `Hace ${semanas} semanas`,
    // Tres semanas es el umbral: con un grupo semanal son tres faltas
    // seguidas, y con uno de cada quince días, una sola. Por debajo de eso un
    // aviso saldría casi siempre, y un aviso que sale siempre se deja de leer.
    atrasado: semanas >= 3,
    nunca: false,
  };
}

/// **El orden del historial: arriba lo que lleva más tiempo sin moverse.**
///
/// Es la única forma de decir sin un cartel que ahí hay algo que mirar (§12.6).
/// Los que nunca han registrado nada van **al principio de todo**, porque son
/// los que ni siquiera han empezado.
export function ordenarPorAbandono<T extends { ultimoDia: string | null }>(
  grupos: T[],
): T[] {
  return [...grupos].sort((a, b) => {
    if (a.ultimoDia === null && b.ultimoDia === null) return 0;
    if (a.ultimoDia === null) return -1;
    if (b.ultimoDia === null) return 1;
    return a.ultimoDia.localeCompare(b.ultimoDia);
  });
}

/// El aviso de arriba del historial. `null` cuando no hay nada que avisar —
/// porque un aviso que sale siempre se deja de leer.
export function avisoDeAbandono(cuantos: number): string | null {
  if (cuantos === 0) return null;
  const grupos = cuantos === 1 ? "Un grupo lleva" : `${cuantos} grupos llevan`;
  return `${grupos} más de tres semanas sin un encuentro registrado. Puede que se estén reuniendo y nadie lo apunte, o puede que no se estén reuniendo.`;
}

/// **Cómo se nombra el tema de un encuentro.**
///
/// Se guarda el NÚMERO del tema de la cartilla, no su nombre, para que
/// renombrar un tema no deje encuentros hablando del nombre viejo — que es
/// justo lo que se arregló el 27-sep con los talleres. Aquí se vuelve a
/// resolver a texto con el catálogo del día.
export function nombreDelTema(
  encuentro: { topicNumber: number | null; topic: string | null },
  temas: { numero: number; nombre: string }[],
): string {
  if (encuentro.topicNumber !== null) {
    const tema = temas.find((t) => t.numero === encuentro.topicNumber);
    if (tema) return `${tema.numero} · ${tema.nombre}`;
    // El tema existió y ya no está en la lista. Decir el número es más honesto
    // que callarlo: el líder sabe de cuál habla.
    return `Tema ${encuentro.topicNumber}`;
  }
  const escrito = (encuentro.topic ?? "").trim();
  return escrito || "Sin tema apuntado";
}

/// **Cuál es el siguiente tema de la cartilla que le toca a este grupo.**
///
/// Viene marcado en el desplegable para que lo normal sea no tocarlo. No es un
/// guarda: se puede elegir cualquiera, porque un grupo repite temas y se salta
/// otros, y bloquearlo sería el guarda que rechaza el caso que existe (§12.6).
export function temaQueSigue(
  encuentros: { topicNumber: number | null }[],
  cuantosTemas: number,
): number | null {
  if (cuantosTemas < 1) return null;
  const dados = encuentros
    .map((e) => e.topicNumber)
    .filter((n): n is number => n !== null);
  if (dados.length === 0) return 1;
  const mayor = Math.max(...dados);
  return mayor >= cuantosTemas ? null : mayor + 1;
}
