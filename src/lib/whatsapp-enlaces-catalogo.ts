/// **Los enlaces de «escríbenos al WhatsApp», con su mensaje ya escrito.**
///
/// Un `wa.me` no es una integración: es una función de WhatsApp que abre el
/// chat con la iglesia y, si se le pasa `text`, **con el mensaje ya redactado**.
/// La persona solo le da enviar, que es lo que hace que escriba en vez de
/// cerrar.
///
/// ## ⚠️ Por qué esto importa más de lo que parece
///
/// Todo lo que nos ha costado el WhatsApp —la plantilla rechazada del taller,
/// el valor de variable sin saltos de línea, esperar la aprobación de Meta—
/// pasa **solo cuando escribimos nosotros primero**. Cuando es la persona la
/// que escribe, se abre una ventana de 24 horas en la que el equipo responde
/// **texto libre**, como en un WhatsApp normal. Estos enlaces son la puerta de
/// esa ventana.
///
/// ## Y por qué hay VARIOS al mismo número
///
/// El mensaje que llega dice de dónde salió la persona: el del volante del
/// congreso no se parece al de la cartelera. Sin eso, todo cae en la misma
/// bandeja sin forma de saber qué funcionó.

/// El WhatsApp de la iglesia, el que está conectado a la API en HighLevel.
///
/// ⚠️ **No es el teléfono de la ubicación en HighLevel.** Ese
/// (+57 313 209 6584) es el contacto de la cuenta, y mandar ahí a la gente la
/// dejaría escribiéndole a un número que nadie atiende — error cometido el
/// 11-nov-2026 y corregido por el usuario.
export const WHATSAPP_IGLESIA = "573228042438";

export type EnlaceDeWhatsApp = {
  id: string;
  /// Para qué sirve, en la pantalla de quien reparte el enlace.
  donde: string;
  /// El mensaje que le queda escrito a la persona.
  mensaje: string;
};

export const ENLACES: readonly EnlaceDeWhatsApp[] = [
  {
    id: "informacion",
    donde: "Pauta de Facebook e Instagram",
    mensaje: "Hola, quiero más información",
  },
  {
    id: "oracion",
    donde: "Cartelera y pantallas del servicio",
    mensaje: "Hola, quiero pedir oración",
  },
  {
    id: "proceso",
    donde: "Para quien se acerca después del servicio",
    mensaje: "Hola, quiero empezar un proceso en la iglesia",
  },
  {
    id: "congreso",
    donde: "Volante y pauta del congreso",
    mensaje: "Hola, quiero información del congreso HASI",
  },
  {
    id: "libre",
    donde: "Sin mensaje: abre el chat en blanco",
    mensaje: "",
  },
] as const;

/// **La dirección del enlace.**
///
/// ⚠️ **El mensaje va codificado con `encodeURIComponent`, y no es opcional.**
/// Pegado tal cual, un espacio rompe la dirección y hay teléfonos que entregan
/// media frase; las tildes y los signos de apertura (`¿`, `¡`) se pierden o
/// llegan como basura. Esta función es el único sitio donde se arma, para que
/// nadie construya uno a mano.
export function enlaceDeWhatsApp(mensaje: string, numero = WHATSAPP_IGLESIA): string {
  const base = `https://wa.me/${numero}`;
  const limpio = mensaje.trim();
  return limpio ? `${base}?text=${encodeURIComponent(limpio)}` : base;
}

/// **Pasa un celular de la base al formato que `wa.me` entiende.**
///
/// En la base conviven «+573116665492», «3102214808» y «+57 322 7065179»: unos
/// con indicativo, otros sin él, y con espacios. `wa.me` solo acepta dígitos y
/// **exige el indicativo del país**, así que sin esto la mitad de los enlaces
/// abriría un chat con un número inventado.
///
/// ⚠️ **Devuelve `null` en vez de adivinar.** Un enlace que abre el chat
/// equivocado es peor que no pintarlo: el pastor creería que le escribió a la
/// persona (§12.6).
export function celularParaWhatsApp(crudo: string | null): string | null {
  if (!crudo) return null;
  const digitos = crudo.replace(/\D/g, "");
  if (digitos.length === 0) return null;

  // ⚠️ **Un «+» delante significa que ya está en formato internacional, y se
  // respeta tal cual.** Sin esta regla se perdían los de fuera de Colombia: hay
  // una petición desde España (+34) y otra desde Estados Unidos (+1), y
  // ponerles «57» delante abriría un chat con un número inventado mientras que
  // descartarlos deja a dos personas sin forma de contestarles.
  if (crudo.trim().startsWith("+")) {
    return digitos.length >= 8 ? digitos : null;
  }

  // Sin indicativo: un celular colombiano son 10 dígitos y empieza por 3.
  if (/^3\d{9}$/.test(digitos)) return `57${digitos}`;
  // Escrito con el 57 pero sin el «+».
  if (/^573\d{9}$/.test(digitos)) return digitos;
  // Un fijo, o algo a medio escribir: no se adivina.
  return null;
}

/// El enlace para escribirle a UNA persona desde la pantalla de Oración, sin
/// mensaje escrito: lo que se le diga a quien acaba de pedir consejería no lo
/// puede redactar el sistema.
export function enlaceAUnaPersona(celular: string | null): string | null {
  const numero = celularParaWhatsApp(celular);
  return numero ? `https://wa.me/${numero}` : null;
}
