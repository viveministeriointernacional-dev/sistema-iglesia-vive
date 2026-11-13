import type { OrigenDeLaPeticion, TipoDePeticion } from "@/lib/oracion-catalogo";

// ---------------------------------------------------------------------------
// El aviso de una petición nueva, para los pastores y la mesa ministerial
// (12-nov-2026)
//
// Aquí vive SOLO el texto y las decisiones. Quien manda está en
// `aviso-de-peticion.ts`, y quien recibe es la columna
// `app_user.receives_prayer_alerts`, que se enciende cuenta por cuenta desde
// Administración. Partido así porque el texto se puede dibujar y probar sin
// base de datos ni correo, que es lo único que destapó las cuatro faltas de
// redacción del borrado de grupos (§12.5).
// ---------------------------------------------------------------------------

/// **Qué peticiones avisan: SOLO las que la persona pidió ella misma.**
///
/// ⚠️ **Y esto no es un detalle de implementación, es lo que decide si el aviso
/// se lee o se silencia.** Está medido el 12-nov-2026: de las 24 peticiones de
/// noviembre, **22 vinieron del formulario de REGISTRO** —el renglón «petición
/// de oración» que la gente llena al registrarse— y solo 2 las pidió la persona
/// desde el link. En octubre fueron 33 de 60. Avisar de todas serían ~60 al mes
/// por 16 personas, **unos 960 correos mensuales**, y a la tercera semana nadie
/// los abre: la regla de que un aviso que sale siempre se deja de leer (§12.6).
///
/// Las del registro además **ya tienen a quién le toca**: se reparte
/// consolidador y se llama. Las de EQUIPO también — las escribió un
/// consolidador o un mentor que está delante de la persona. La que no tiene
/// dueño, y por eso es la que hay que avisar, es la que llega sola por el link.
export function debeAvisar(origen: OrigenDeLaPeticion): boolean {
  return origen === "PERSONA";
}

/// Lo que pidió, en palabras, para el asunto y para la primera línea.
///
/// `quiereProceso` NO es un tipo: es una marca aparte que puede venir con
/// cualquiera de los dos (o con los dos), así que se dice al final y no
/// sustituye a nada.
export function resumenDeLoQuePidio(
  tipos: readonly string[],
  quiereProceso: boolean,
): string {
  const tiene = (t: TipoDePeticion) => tipos.includes(t);
  const base = tiene("CONSEJERIA")
    ? tiene("ORACION")
      ? "oración y consejería"
      : "consejería"
    : "oración";
  return quiereProceso ? `${base}, y quiere iniciar un proceso` : base;
}

/// **Lo urgente primero.** Una consejería o un «quiero empezar» piden que
/// alguien llame; una petición de oración, que alguien ore. El asunto lo dice
/// para que se sepa desde la lista del celular, sin abrir.
///
/// ⚠️ **Y esto mismo decide si sale WhatsApp o solo correo.** Un WhatsApp es
/// una interrupción: suena en el bolsillo y en la pantalla de bloqueo, a
/// cualquier hora. Quince teléfonos sonando por «oren por mi trabajo» es como
/// se silencia el canal — y entonces no suena tampoco el día que alguien
/// escriba algo grave. Las dos cosas salen de esta función y no de dos reglas
/// parecidas en dos sitios, que es lo que se desincroniza sin que nada avise.
export function urgeLlamar(tipos: readonly string[], quiereProceso: boolean): boolean {
  return quiereProceso || tipos.includes("CONSEJERIA");
}

/// **Cómo se nombra a quien pidió.**
///
/// ⚠️ **Reservada NO es anónima, pero en el correo el nombre NO va.** En la
/// pantalla de Oración la ficha sigue enlazada, porque quien la acompaña tiene
/// que poder acompañarla; un correo, en cambio, se reenvía, se lee en voz alta
/// en una reunión y se queda en 16 bandejas. Lo que la persona pidió fue que no
/// se supiera que era ella, y el correo es justo el sitio donde eso se escapa.
/// Quien tenga que atenderla la encuentra en la plataforma.
export function comoSeNombra(nombreCompleto: string, reservada: boolean): string {
  if (reservada) return "Alguien de la iglesia";
  const limpio = nombreCompleto.trim();
  return limpio.length > 0 ? limpio : "Alguien de la iglesia";
}

/// El asunto. Corto a propósito: el celular enseña unos 40 caracteres, así que
/// lo que importa va al principio y el nombre va después (la lección del correo
/// de Casa de Fe, 22-oct).
export function asuntoDelAviso(datos: {
  /// ⚠️ **`person.first_name` ENTERO, y NO el nombre completo ni su primera
  /// palabra.** En Colombia los dos nombres son el nombre: partir por el
  /// primer espacio se equivoca en 7 de los 17 líderes —«Paola Alejandra» sale
  /// «Paola», «Yuli Katherine» sale «Yuli»— y llamar a alguien por la mitad se
  /// nota (§12.6). El campo `first_name` ya guarda exactamente los NOMBRES, así
  /// que aquí no se corta nada: es el patrón de `taller-bienvenida.ts`.
  nombres: string;
  reservada: boolean;
  tipos: readonly string[];
  quiereProceso: boolean;
}): string {
  // Una reservada no lleva nombre, así que tampoco lleva los dos puntos: el
  // asunto «Pide consejería: alguien de la iglesia» se leía como si «alguien de
  // la iglesia» fuera el nombre de alguien.
  if (datos.reservada) {
    if (datos.quiereProceso) return "Alguien quiere iniciar un proceso";
    if (datos.tipos.includes("CONSEJERIA")) return "Alguien pide consejería";
    return "Alguien pide oración";
  }
  const quien = datos.nombres.trim();
  if (!quien) {
    if (datos.quiereProceso) return "Alguien quiere iniciar un proceso";
    return datos.tipos.includes("CONSEJERIA")
      ? "Alguien pide consejería"
      : "Alguien pide oración";
  }
  if (datos.quiereProceso) return `Quiere iniciar un proceso: ${quien}`;
  if (datos.tipos.includes("CONSEJERIA")) return `Pide consejería: ${quien}`;
  return `Petición de oración: ${quien}`;
}

/// Una línea, sin saltos: lo que viaja a la variable de la plantilla de
/// WhatsApp cuando ese canal esté aprobado. Se escribe aquí y ahora para que el
/// día que exista la plantilla no haya que inventar el texto en otro sitio.
///
/// ⚠️ **El TEXTO de la petición no entra.** Un WhatsApp llega a la pantalla de
/// bloqueo y lo lee quien tenga el teléfono en la mano. Dice qué pidió y quién,
/// y que el detalle está en la plataforma.
export function variableDeWhatsAppDeLaPeticion(datos: {
  /// El nombre completo: aquí no se saluda, se identifica.
  nombreCompleto: string;
  reservada: boolean;
  tipos: readonly string[];
  quiereProceso: boolean;
}): string {
  const quien = comoSeNombra(datos.nombreCompleto, datos.reservada);
  const que = resumenDeLoQuePidio(datos.tipos, datos.quiereProceso);
  return `${quien} acaba de pedir ${que}. El detalle está en la plataforma, en Oración.`
    .replace(/\s+/g, " ")
    .trim();
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/// El cuerpo del correo. Lleva el texto de la petición porque es lo que permite
/// orar por ella sin entrar a ninguna pantalla, que es lo que de verdad va a
/// pasar a las 10 de la noche.
export function cuerpoDelAviso(datos: {
  /// Los NOMBRES de quien RECIBE el correo (`person.first_name`), para
  /// saludarlo. Nunca su `app_user.full_name`: ver `asuntoDelAviso`.
  paraNombres: string;
  /// El nombre completo de quien pidió, para que se sepa quién es.
  nombreCompleto: string;
  reservada: boolean;
  tipos: readonly string[];
  quiereProceso: boolean;
  texto: string;
  /// Dirección de la pantalla de Oración. Se omite para quien no la puede
  /// abrir: un enlace que va a fallar es peor que no ponerlo (§12.6).
  enlace?: string | null;
  celular?: string | null;
}): string {
  const quien = comoSeNombra(datos.nombreCompleto, datos.reservada);
  const que = resumenDeLoQuePidio(datos.tipos, datos.quiereProceso);
  const llamar = urgeLlamar(datos.tipos, datos.quiereProceso);

  const aviso = datos.reservada
    ? `<p style="margin:14px 0 0;font-size:13px;color:#8a5a00;background:#fff6e0;border-radius:9px;padding:10px 12px">
         Pidió que no se dijera su nombre. En la plataforma, en Oración, sí
         aparece de quién se trata, para que el equipo pueda buscar a la persona.
       </p>`
    : "";

  const contacto =
    !datos.reservada && datos.celular
      ? `<p style="margin:10px 0 0;font-size:13.5px">Su celular: <strong>${escapar(
          datos.celular,
        )}</strong></p>`
      : "";

  const boton = datos.enlace
    ? `<p style="margin:18px 0 0">
         <a href="${escapar(datos.enlace)}"
            style="background:#0e2a4e;color:#fff;text-decoration:none;padding:11px 15px;border-radius:9px;font-weight:bold;font-size:13px;display:inline-block">
           Verla en la plataforma
         </a>
       </p>`
    : "";

  // ⚠️ **Sin género, y no es un detalle de estilo.** La primera versión decía
  // «que alguien LA llame, no solo que oremos por ELLA», y el primer caso real
  // dibujado fue Juan Felipe. Aquí no se sabe el género —y en una reservada no
  // se puede saber sin destapar quién es—, así que la frase se escribe de
  // manera que no haga falta: es la misma trampa del artículo de §12.6, que
  // tampoco la vio nadie leyendo el código.
  const quehacer = llamar
    ? `<p style="margin:14px 0 0;font-size:14px"><strong>Esto pide que alguien llame</strong>, no solo que oremos.</p>`
    : "";

  return `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b2128;max-width:560px">
      <p style="margin:0;font-size:15px">Hola, ${escapar(datos.paraNombres.trim())}:</p>
      <p style="margin:10px 0 0;font-size:15px">
        <strong>${escapar(quien)}</strong> acaba de pedir <strong>${escapar(que)}</strong>.
      </p>
      ${quehacer}
      <div style="margin:14px 0 0;border-left:3px solid #c9ccd1;padding:2px 0 2px 14px">
        <p style="margin:0;font-size:15px;white-space:pre-wrap">${escapar(datos.texto.trim())}</p>
      </div>
      ${contacto}
      ${aviso}
      ${boton}
      <p style="margin:20px 0 0;font-size:12px;color:#8a929a">
        Te llega porque tu cuenta tiene encendido «Recibe los avisos de oración
        y consejería». Si no quieres seguir recibiéndolos, pídele al
        administrador del sistema que lo apague en tu cuenta.
      </p>
    </div>`;
}
