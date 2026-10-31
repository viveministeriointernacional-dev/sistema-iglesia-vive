/// **El texto de la confirmación de inscripción a una Casa de Fe.**
///
/// Aparte de `correo.ts` porque eso manda correos y aquí no hay nada que no
/// sea texto: así se puede probar sin levantar nada (§12.4).
///
/// ## Qué cambió y por qué (22-oct-2026)
///
/// El correo de antes **entregaba unos talleres**: despachaba la inscripción en
/// media línea —«ya entraste a CASA DE FE GRUPAL SUR»— y dedicaba el resto a
/// los 12 temas. La persona quedaba inscrita **sin saber cuándo ni dónde
/// presentarse**, y tenía que preguntárselo a alguien.
///
/// Ahora lo primero es la reunión: **qué día, a qué hora, dónde y quién la
/// lleva**. Los talleres van después, porque pueden esperar a que abra el
/// enlace; saber a qué hora llegar, no.

import {
  diaDeLaSemana,
  enlaceComoLlegar,
  fraseDeFrecuencia,
  horaLegible,
  puntoDe,
} from "@/lib/reunion-catalogo";
import { enUnaLinea } from "@/lib/whatsapp-variable";

/// Lo que guarda la ficha. `null` cuando nadie lo llenó.
export type GeneroDePersona = "HOMBRE" | "MUJER" | null | undefined;

/// La casa, tal como hace falta para escribir la confirmación.
export type CasaDeLaInscripcion = {
  nombre: string;
  /// 0 = domingo … 6 = sábado. `null` si todavía no se puso.
  weekday: number | null;
  /// «HH:mm», hora de Colombia. `null` si todavía no se puso.
  meetingTime: string | null;
  everyNWeeks: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /// Quien la lleva, con su nombre completo. Ojo: suele ser quien
  /// **discipula**, no el dueño de la casa — los nombres del título del grupo
  /// son los discípulos (22-oct).
  lider: string;
  /// Cómo se le llama: los NOMBRES de su ficha, no la primera palabra.
  ///
  /// ⚠️ Cortar por el primer espacio se equivoca en **7 de los 17 líderes**
  /// (22-oct): «Paola Alejandra» sale «Paola», «Juan Felipe» sale «Juan»,
  /// «Harold Mauricio» sale «Harold». En Colombia los dos nombres son el
  /// nombre, y llamar a alguien por la mitad se nota.
  liderDePila: string;
};

/// **«inscrita» o «inscrito», y nada cuando no se sabe.**
///
/// El dato está en la ficha y llega del registro de HighLevel. Medido el
/// 22-oct sobre los 58 miembros de Casa de Fe: **31 mujeres, 21 hombres y 6
/// sin el dato**. Para esos 6 esta función devuelve `null` y el texto usa la
/// forma neutra, que dice lo mismo sin tener que acertar el género.
export function participioDeInscripcion(genero: GeneroDePersona): string | null {
  if (genero === "MUJER") return "inscrita";
  if (genero === "HOMBRE") return "inscrito";
  return null;
}

/// **El asunto.** Lleva el día y la hora porque es lo único que se ve en la
/// lista del celular antes de abrir, y es justo el dato que faltaba.
export function asuntoDeInscripcion(datos: {
  /// Los NOMBRES de la ficha, no el nombre completo.
  ///
  /// Decisión del usuario (22-oct), y la medida la respalda: con el nombre
  /// completo delante el asunto llegaba a **77 y 82 caracteres**, y el celular
  /// corta por los **45** — el día y la hora, que es lo que queríamos que se
  /// viera sin abrir, se quedaban fuera de la vista previa.
  ///
  /// ⚠️ Sale del campo de nombres, **no de cortar por el primer espacio**: es
  /// el mismo error que se arregló en el nombre del líder. «Luisa Fernanda», no
  /// «Luisa».
  nombreDePila: string;
  genero: GeneroDePersona;
  casa: CasaDeLaInscripcion;
}): string {
  const participio = participioDeInscripcion(datos.genero);
  const encabezado = participio
    ? `${datos.nombreDePila}, quedaste ${participio} en tu Casa de Fe`
    : `${datos.nombreDePila}, ya tienes Casa de Fe`;

  const cuando = cuandoSeReune(datos.casa);
  return cuando ? `${encabezado} · ${cuando.corto}` : encabezado;
}

/// La primera frase del correo: qué pasó y en qué casa.
export function fraseDeInscripcion(datos: {
  nombreDePila: string;
  genero: GeneroDePersona;
  casa: string;
}): string {
  const participio = participioDeInscripcion(datos.genero);
  return participio
    ? `Hola ${datos.nombreDePila}, quedaste ${participio} en la Casa de Fe «${datos.casa}».`
    : `Hola ${datos.nombreDePila}, ya estás en la Casa de Fe «${datos.casa}».`;
}

/// **Cuándo se reúne**, en dos formatos: el largo para el cuerpo del correo y
/// el corto para el asunto.
///
/// Devuelve `null` si falta el día o la hora. Pasa en **1 de las 59 casas
/// abiertas** (22-oct), pero ese 1 no puede recibir un correo con un hueco.
export function cuandoSeReune(
  casa: Pick<CasaDeLaInscripcion, "weekday" | "meetingTime" | "everyNWeeks">,
): { largo: string; corto: string } | null {
  const dia = diaDeLaSemana(casa.weekday);
  if (!dia || !casa.meetingTime) return null;
  const hora = horaLegible(casa.meetingTime);
  if (!hora) return null;

  // «cada semana» no se dice: es lo normal y alargaría la frase sin añadir
  // nada. Las 59 casas abiertas son semanales (22-oct), así que esta rama
  // existe para el día que alguien ponga una quincenal.
  const cada = casa.everyNWeeks > 1 ? ` (${fraseDeFrecuencia(casa.everyNWeeks)})` : "";

  return {
    largo: `Todos los ${dia.plural} a las ${hora}${cada}`,
    corto: `${dia.plural} ${hora}`,
  };
}

/// **Qué llevar el primer día.** No es un detalle de redacción: alguien que
/// llega a una casa ajena sin saber qué se espera de él llega incómodo.
export function queLlevar(liderDePila: string): string {
  return `Lleva un corazón dispuesto, y una agenda y un lapicero para anotar. Si algún día no puedes, avísale a tu líder de Casa de Fe, ${liderDePila}.`;
}

/// **Lo que se dice cuando el dato no está.** Nunca un renglón en blanco ni un
/// «null»: una frase que le dice a la persona qué va a pasar.
export const SIN_DIA_NI_HORA = "Tu líder te confirmará el día y la hora.";
export const SIN_DIRECCION = "Tu líder te dirá la dirección antes del primer encuentro.";

/// **Dónde se reúne**, con su enlace de «Cómo llegar» cuando se puede.
///
/// ⚠️ Falta la dirección en **24 de las 59 casas abiertas** (22-oct, el 41 %),
/// así que esta rama no es un caso raro: es dos de cada cinco correos. Por eso
/// el texto de reserva tiene que sonar a algo que va a pasar, no a un error.
export function dondeSeReune(casa: CasaDeLaInscripcion): {
  texto: string;
  comoLlegar: string | null;
} {
  const direccion = (casa.address ?? "").trim();
  if (!direccion) return { texto: SIN_DIRECCION, comoLlegar: null };

  return {
    texto: direccion,
    comoLlegar: enlaceComoLlegar({
      address: casa.address,
      punto: puntoDe(casa.latitude, casa.longitude),
    }),
  };
}

/// **Qué le falta a la casa para que su confirmación salga entera.**
///
/// El correo de inscripción lleva el día, la hora y la dirección. Si no están,
/// la persona queda inscrita sin saber cuándo ni dónde presentarse — que es
/// justo el fallo que se arregló el 22-oct. Así que en vez de mandar el correo
/// cojo, **se piden antes de inscribir**.
///
/// ⚠️ No es un caso raro: el 22-oct faltaba la dirección en **24 de las 59
/// casas abiertas** y el día u hora en 1. Por eso el aviso tiene que decir
/// exactamente qué falta, no un «completa los datos» genérico.
export function loQueFaltaDeLaCasa(
  casa: Pick<CasaDeLaInscripcion, "weekday" | "meetingTime" | "everyNWeeks" | "address">,
): string[] {
  const falta: string[] = [];
  if (!cuandoSeReune(casa)) falta.push("el día y la hora");
  if (!(casa.address ?? "").trim()) falta.push("la dirección");
  return falta;
}

/// El aviso, con lo que falta nombrado. `null` cuando no falta nada.
export function avisoDeDatosQueFaltan(falta: string[]): string | null {
  if (falta.length === 0) return null;
  const lista = falta.length === 1 ? falta[0] : falta.join(" y ");
  return `Antes de inscribir a alguien, completa ${lista} de esta casa, arriba en «La reunión». El correo de confirmación los lleva, y sin ellos la persona queda inscrita sin saber cuándo ni dónde presentarse.`;
}

// ---------------------------------------------------------------------------
// La misma confirmación, por WhatsApp
// ---------------------------------------------------------------------------

/// **El centro del WhatsApp de confirmación: UNA SOLA LÍNEA.**
///
/// ⚠️ **No es el mensaje: es el valor de `{{2}}` de la plantilla
/// `confirmacion_casa_de_fe`.** El WhatsApp de este CRM solo manda plantillas
/// aprobadas por Meta, y **el valor de una variable no admite ni un salto de
/// línea** (§6). El saludo y el cierre viven en la plantilla, fijos; de aquí
/// solo viaja el centro. Termina en `enUnaLinea`, así que si alguien mete un
/// `\n` en cualquiera de los trozos **se aplana aquí** en vez de llegar a Meta
/// y hacer que el envío falle sin explicación.
///
/// ## Qué lleva y qué NO, y por qué
///
/// Lleva lo mismo que el bloque «TU CASA DE FE» del correo: la casa, cuándo,
/// dónde, quién la lleva y qué llevar. **El enlace va aparte, en `{{3}}`**, para
/// que la plantilla lo pueda presentar como lo que es.
///
/// **NO lleva el código de 6 dígitos**, y es la decisión del 22-oct: ese dato es
/// justo lo que Meta trata como código de verificación y lo que obliga a la
/// categoría *Authentication* — es la sospecha principal del rechazo de
/// `codigo_ingreso_escuela`. El enlace **ya identifica a la persona**, así que
/// el código es redundante en este canal; sigue en el correo, en su campo del
/// CRM y visible para el líder en la ficha de la casa.
///
/// **NO lleva la lista de los 12 temas.** Doce títulos en una sola línea son
/// unos 300 caracteres de ruido delante del único dato que hay que pulsar, y
/// están todos detrás del enlace.
export function variableDeConfirmacion(casa: CasaDeLaInscripcion): string {
  const cuando = cuandoSeReune(casa);
  const direccion = (casa.address ?? "").trim();

  const partes = [
    `Tu Casa de Fe es «${casa.nombre}»`,
    cuando ? `Se reúnen ${cuando.largo.toLowerCase()}` : SIN_DIA_NI_HORA,
    direccion ? `La dirección es ${direccion}` : SIN_DIRECCION,
    // ⚠️ **El líder se nombra UNA sola vez, y con su papel delante.** La
    // primera versión decía «La lleva Santiago Viveros Artunduaga» y acababa
    // con el `queLlevar` del correo, que lo vuelve a nombrar: el mismo nombre
    // dos veces en un mensaje de tres líneas, y 331 caracteres. Se vio al
    // dibujarlo con las casas de verdad, no leyendo el código (§12.5).
    //
    // Va el nombre **completo**, no el de pila: aquí es la presentación de
    // alguien a quien la persona quizá no conoce todavía.
    `La lleva tu líder de Casa de Fe, ${casa.lider}; avísale si algún día no puedes ir`,
    QUE_LLEVAR_CORTO,
  ];

  return enUnaLinea(partes.map(frase).join(" "));
}

/// **Qué llevar, sin el aviso al líder**, que en el WhatsApp ya va arriba.
const QUE_LLEVAR_CORTO =
  "Lleva un corazón dispuesto, y una agenda y un lapicero para anotar";

/// Cierra una frase con un punto **y solo uno**.
///
/// ⚠️ Existe por «a las 5:00 p. m..»: la hora legible ya termina en punto, así
/// que añadirle otro deja un doble punto en medio del mensaje. Salió al
/// dibujarlo con datos reales, y afecta a **todas** las casas de la tarde.
function frase(texto: string): string {
  const limpio = texto.trim();
  return limpio.endsWith(".") ? limpio : `${limpio}.`;
}

/// **Lo que se escribe cuando se perdió el grupo.** `casa` es `null` en la
/// confirmación del correo cuando la inscripción no pudo recuperar la casa, y
/// el campo del CRM no se puede quedar vacío: Meta rechaza también la cadena
/// vacía, y el WhatsApp saldría con un hueco en medio.
export const CONFIRMACION_SIN_CASA = enUnaLinea(
  "Ya estás en una Casa de Fe. Tu líder te confirmará el día, la hora y la dirección.",
);
