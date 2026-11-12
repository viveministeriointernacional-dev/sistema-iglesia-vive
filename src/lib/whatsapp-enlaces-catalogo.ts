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
