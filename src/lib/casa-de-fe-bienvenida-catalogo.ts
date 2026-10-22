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
