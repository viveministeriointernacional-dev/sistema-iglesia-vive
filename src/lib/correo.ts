import {
  asuntoDeInscripcion,
  type CasaDeLaInscripcion,
  cuandoSeReune,
  dondeSeReune,
  fraseDeInscripcion,
  type GeneroDePersona,
  SIN_DIA_NI_HORA,
} from "@/lib/casa-de-fe-bienvenida-catalogo";
import { variableDeEntorno } from "@/lib/entorno";
import type { ClientePrisma } from "@/lib/prisma";
import {
  asuntoDelCorreo,
  type Aviso,
  nombreDePila,
  type TipoDeEnvio,
} from "@/lib/recordatorio-casas-de-fe-catalogo";
import { horaLegible } from "@/lib/reunion-catalogo";

/// Dónde guardar la copia del correo, para poder previsualizarlo después desde
/// la actividad del día. Es opcional y best-effort: si la tabla no existe o el
/// guardado falla, el correo igual se envía y no se rompe nada.
export type RegistroDeCorreo = {
  prisma: ClientePrisma;
  tipo: string;
  personId?: string | null;
  learnerId?: string | null;
  actorId?: string | null;
};

/// Qué pasó con un envío. Cuando falla se dice **por qué**: un correo que no
/// sale sin dejar rastro es imposible de diagnosticar desde fuera, y la pantalla
/// que lo pidió necesita poder avisarle a la persona en vez de dar por hecho
/// que llegó.
export type ResultadoCorreo =
  | { enviado: true }
  | { enviado: false; motivo: string };

/// Envío de correo por Resend (una API sencilla que funciona en el Worker).
/// Nunca lanza: la acción que lo disparó (crear un acceso, cambiar una
/// contraseña) ya hizo su trabajo y no debe deshacerse porque el correo falle.
/// Devuelve el resultado para que quien llama decida qué decirle al usuario.
/// Cambiar de proveedor es cambiar solo esta función.
async function enviarCorreo(datos: {
  to: string;
  subject: string;
  html: string;
  registro?: RegistroDeCorreo;
}): Promise<ResultadoCorreo> {
  const resultado = await enviarPorResend(datos);
  if (datos.registro) await guardarCopia(datos, resultado);
  return resultado;
}

async function guardarCopia(
  datos: { to: string; subject: string; html: string; registro?: RegistroDeCorreo },
  resultado: ResultadoCorreo,
) {
  const registro = datos.registro;
  if (!registro) return;
  try {
    await registro.prisma.emailSent.create({
      data: {
        kind: registro.tipo,
        to: datos.to,
        subject: datos.subject,
        html: datos.html,
        sent: resultado.enviado,
        failure: resultado.enviado ? null : resultado.motivo,
        personId: registro.personId ?? null,
        learnerId: registro.learnerId ?? null,
        actorId: registro.actorId ?? null,
      },
    });
  } catch (error) {
    // Sin tabla (migración pendiente) o sin permiso: el correo ya salió, y la
    // copia es solo para previsualizar. No se rompe la acción por esto.
    console.error("No se pudo guardar la copia del correo", error);
  }
}

async function enviarPorResend(datos: {
  to: string;
  subject: string;
  html: string;
}): Promise<ResultadoCorreo> {
  const apiKey = await variableDeEntorno("RESEND_API_KEY");
  const from = await variableDeEntorno("EMAIL_FROM");
  if (!apiKey || !from) {
    const faltan = [
      apiKey ? null : "RESEND_API_KEY",
      from ? null : "EMAIL_FROM",
    ]
      .filter(Boolean)
      .join(" y ");
    return {
      enviado: false,
      motivo: `el sistema de correo no está configurado (falta ${faltan} en el Worker).`,
    };
  }
  if (!datos.to) {
    return { enviado: false, motivo: "no hay una dirección de correo a la cual enviarlo." };
  }

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: datos.to,
        subject: datos.subject,
        html: datos.html,
      }),
    });
    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      console.error("Resend rechazó el correo", respuesta.status, detalle.slice(0, 300));
      return {
        enviado: false,
        motivo: `Resend rechazó el envío (error ${respuesta.status}): ${motivoDeResend(detalle)}`,
      };
    }
    return { enviado: true };
  } catch (error) {
    console.error("No se pudo enviar el correo", error);
    return { enviado: false, motivo: "no se pudo conectar con el servicio de correo." };
  }
}

/// Saca el mensaje de la respuesta de error de Resend (viene como JSON con
/// `message`). Si no se puede leer, se devuelve el texto crudo recortado.
function motivoDeResend(cuerpo: string): string {
  try {
    const json = JSON.parse(cuerpo) as { message?: unknown };
    if (typeof json.message === "string" && json.message) return json.message;
  } catch {
    // No era JSON; sirve el texto tal cual.
  }
  return cuerpo.slice(0, 200) || "sin detalle";
}

/// Dirección pública del sistema. Vive aquí porque los correos son el único
/// sitio donde hace falta una URL absoluta.
export const URL_SISTEMA =
  "https://sistema-iglesia-vive.viveministeriointernacional.workers.dev";

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const MARCO = (contenido: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#131c24">
    <h2 style="color:#1f3b57;font-weight:normal">Iglesia Vive</h2>
    ${contenido}
    <p style="margin-top:24px;font-size:12px;color:#8a929a">
      Sistema de Transformación y Propósito · Vive Ministerio Internacional
    </p>
  </div>`;

/// Correo con los datos de ingreso para una cuenta recién creada.
export async function correoCredenciales(datos: {
  to: string;
  nombre: string;
  email: string;
  password: string;
}): Promise<ResultadoCorreo> {
  return enviarCorreo({
    to: datos.to,
    subject: "Tu acceso al sistema de Iglesia Vive",
    html: MARCO(`
      <p>Hola ${escapar(datos.nombre)}, se creó tu acceso al sistema.</p>
      <p><strong>Ingresa aquí:</strong><br/>
        <a href="${URL_SISTEMA}/ingresar">
          Abrir el sistema
        </a>
      </p>
      <table style="margin:16px 0;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#8a929a">Usuario</td><td><strong>${escapar(datos.email)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a929a">Contraseña</td><td><strong>${escapar(datos.password)}</strong></td></tr>
      </table>
      <p style="font-size:13px;color:#8a929a">Por seguridad, cambia tu contraseña después de entrar.</p>
    `),
  });
}

/// Correo con el que el mentor recibe a una persona. Cinco bloques: quién es,
/// qué le pedimos, cómo le fue en Operación 72, petición de oración y botones.
/// El contenido lo arma `enviarCorreoDeEntrega` (src/lib/correo-entrega.ts).
export async function correoEntregaAMentor(datos: {
  to: string;
  mentorNombre: string;
  personaNombre: string;
  genero: "MUJER" | "HOMBRE" | null;
  entregadaPor: string | null;
  quienEs: { rotulo: string; valor: string }[];
  historial: {
    titulo: string;
    quien: string | null;
    cuando: string;
    observacion: string | null;
  }[];
  peticionDeOracion: string | null;
  learnerId: string;
  registro?: RegistroDeCorreo;
}): Promise<ResultadoCorreo> {
  const pronombre = datos.genero === "HOMBRE" ? "LO" : datos.genero === "MUJER" ? "LA" : "LE";
  const asunto = `TE ENTREGAMOS A ${datos.personaNombre.toUpperCase()} PARA QUE ${pronombre} MENTOREES`;
  const ella = datos.genero === "HOMBRE" ? "lo" : "la";
  const nombreDePila = datos.personaNombre.split(" ")[0] ?? datos.personaNombre;

  const filas = datos.quienEs
    .map(
      (fila) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#8a929a;white-space:nowrap;vertical-align:top">${escapar(fila.rotulo)}</td><td style="padding:4px 0"><strong>${escapar(fila.valor)}</strong></td></tr>`,
    )
    .join("");

  const eventos = datos.historial
    .map(
      (evento) => `
        <tr>
          <td style="padding:0 10px 14px 0;vertical-align:top"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1b4a7a;margin-top:6px"></span></td>
          <td style="padding:0 0 14px 0">
            <div style="font-size:13px;font-weight:bold;color:#131c24">${escapar(evento.titulo)}</div>
            <div style="font-size:11.5px;color:#8a929a;margin-top:2px">${escapar([evento.quien, evento.cuando].filter(Boolean).join(" · "))}</div>
            ${evento.observacion ? `<div style="font-size:12.5px;color:#4a5560;margin-top:5px">«${escapar(evento.observacion)}»</div>` : ""}
          </td>
        </tr>`,
    )
    .join("");

  const boton = (texto: string, href: string, principal = false) =>
    `<a href="${href}" style="display:block;text-align:center;text-decoration:none;border-radius:10px;padding:13px 18px;font-size:13px;font-weight:bold;margin-top:8px;${
      principal
        ? "background:#0e2a4e;color:#ffffff"
        : "border:1px solid #c9ccd1;color:#131c24;background:#ffffff"
    }">${escapar(texto)}</a>`;

  return enviarCorreo({
    to: datos.to,
    subject: asunto,
    registro: datos.registro,
    html: MARCO(`
      <p style="font-size:15px;font-weight:bold;letter-spacing:.02em;color:#131c24">${escapar(asunto)}</p>
      <p>Hola ${escapar(datos.mentorNombre)}, <strong>${escapar(datos.personaNombre)}</strong> terminó su proceso de Operación 72 y desde hoy queda asignad${datos.genero === "HOMBRE" ? "o" : "a"} a tu mentoría.</p>

      <table style="margin:16px 0;font-size:14px;background:#eaf0f7;border-radius:12px;padding:12px 16px;width:100%">${filas}</table>

      <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin-top:22px">QUÉ TE PEDIMOS</p>
      <p>${escapar(nombreDePila)} pasa a la fase <strong>Fortalecer</strong>. Tu tarea:</p>
      <ol style="padding-left:20px;line-height:1.6">
        <li><strong>Llámal${ella === "lo" ? "o" : "a"} y preséntate como su mentor</strong>, o preséntale a su líder de <strong>Casa de Fe</strong> o de <strong>Alpha</strong>.</li>
        <li><strong>Vincúlal${ella === "lo" ? "o" : "a"} a un grupo</strong>: inscríbel${ella === "lo" ? "o" : "a"} en un <strong>Alpha</strong> o en una <strong>Casa de Fe</strong>.<br/><span style="font-size:13px;color:#4a5560">Solo si no está ya en un proceso: si alguien ${ella} viene acompañando, continúa con ese proceso.</span></li>
        <li>Si va a estar con un líder de tu equipo, <strong>asígnale el líder</strong> desde su expediente para que el sistema sepa quién ${ella} acompaña.</li>
      </ol>

      <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin-top:22px">CÓMO LE FUE EN OPERACIÓN 72</p>
      <table style="border-collapse:collapse;margin-top:8px">${eventos}</table>

      ${
        datos.peticionDeOracion
          ? `<div style="margin-top:18px;border:1px solid #b9d3a5;background:#f5f8f1;border-radius:12px;padding:12px 16px">
              <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#4f7038;margin:0">PETICIÓN DE ORACIÓN</p>
              <p style="margin:6px 0 0">«${escapar(datos.peticionDeOracion)}»</p>
            </div>`
          : ""
      }

      <div style="margin-top:22px">
        ${boton("Abrir su expediente", `${URL_SISTEMA}/expediente/${datos.learnerId}`, true)}
        ${boton(`Inscribirl${ella === "lo" ? "o" : "a"} en un Alpha`, `${URL_SISTEMA}/alpha`)}
        ${boton(`Inscribirl${ella === "lo" ? "o" : "a"} en Casa de Fe`, `${URL_SISTEMA}/casa-de-fe`)}
      </div>

      <p style="font-size:12px;color:#8a929a;margin-top:22px">Las notas pastorales no viajan por correo: las ves en su expediente, donde cada apertura queda registrada.</p>
    `),
  });
}

/// Correo con la contraseña nueva cuando un administrador la restablece.
export async function correoContrasenaRestablecida(datos: {
  to: string;
  nombre: string;
  email: string;
  password: string;
}): Promise<ResultadoCorreo> {
  return enviarCorreo({
    to: datos.to,
    subject: "Tu contraseña de Iglesia Vive fue restablecida",
    html: MARCO(`
      <p>Hola ${escapar(datos.nombre)}, un administrador restableció tu contraseña.</p>
      <table style="margin:16px 0;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#8a929a">Usuario</td><td><strong>${escapar(datos.email)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a929a">Contraseña nueva</td><td><strong>${escapar(datos.password)}</strong></td></tr>
      </table>
      <p><a href="${URL_SISTEMA}/ingresar">Entrar al sistema</a></p>
      <p style="font-size:13px;color:#8a929a">La contraseña anterior ya no funciona. Si no pediste este cambio, avísale al administrador.</p>
    `),
  });
}

/// Enlace para que la persona cree ella misma una contraseña nueva.
export async function correoRecuperarContrasena(datos: {
  to: string;
  nombre: string;
  enlace: string;
}): Promise<ResultadoCorreo> {
  return enviarCorreo({
    to: datos.to,
    subject: "Recupera tu contraseña de Iglesia Vive",
    html: MARCO(`
      <p>Hola ${escapar(datos.nombre)}, recibimos una solicitud para cambiar tu contraseña.</p>
      <p style="margin:20px 0">
        <a href="${datos.enlace}"
           style="background:#0e2a4e;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:bold;display:inline-block">
          Crear una contraseña nueva
        </a>
      </p>
      <p style="font-size:13px;color:#8a929a">El enlace vence en una hora y solo sirve una vez.</p>
      <p style="font-size:13px;color:#8a929a">Si no lo pediste, ignora este correo: tu contraseña sigue igual.</p>
    `),
  });
}

/// Correo con el que una persona recibe su código y sus 12 talleres al entrar
/// a una Casa de Fe.
///
/// ⚠️ **No lleva los QR dibujados, y es una limitación del correo, no una
/// decisión de producto.** Gmail descarta los `<svg>` incrustados y bloquea las
/// imágenes en `data:`, así que doce QR dentro del mensaje llegarían como doce
/// recuadros vacíos. Un QR no es más que la forma de llevar un enlace al papel:
/// en un teléfono el enlace **es** el QR, así que aquí van los doce enlaces,
/// que es lo que de verdad se puede pulsar. La hoja impresa con los doce QR
/// sigue existiendo para la casa, y se saca desde «Los 12 temas».
/// Lo que hace falta para escribir la confirmación de inscripción.
export type DatosDeLaInscripcion = {
  nombre: string;
  /// De la ficha. Decide «inscrita» / «inscrito»; si falta, el texto neutro.
  genero: GeneroDePersona;
  codigo: string;
  /// La casa entera, no solo su nombre: sin el día, la hora y la dirección no
  /// hay confirmación que valga. `null` solo si se perdió el grupo.
  casa: CasaDeLaInscripcion | null;
  /// El enlace a «Mis talleres», con su token.
  enlace: string;
  temas: { number: number; name: string; enlace: string | null }[];
};

/// **El asunto y el cuerpo, sin mandar nada.**
///
/// Está separado del envío a propósito: así el correo se puede **dibujar con
/// datos de verdad** antes de darlo por bueno (§12.5). Un correo que solo se ha
/// leído en el código es un correo sin revisar.
export function correoDeInscripcionACasaDeFe(datos: DatosDeLaInscripcion): {
  subject: string;
  html: string;
} {
  const nombreDePila = datos.nombre.split(" ")[0] ?? datos.nombre;

  const subject = datos.casa
    ? asuntoDeInscripcion({ nombreDePila, genero: datos.genero, casa: datos.casa })
    : `${nombreDePila}, aquí están tus 12 talleres de Casa de Fe`;

  const renglones = datos.temas
    .map((tema) => {
      const titulo = `${tema.number}. ${escapar(tema.name)}`;
      const celda = tema.enlace
        ? `<a href="${tema.enlace}" style="color:#0e2a4e;text-decoration:none;font-weight:bold">${titulo}</a>`
        : `<span style="color:#8a929a">${titulo}</span>`;
      return `<tr><td style="padding:7px 0;border-bottom:1px solid #e7e3d8;font-size:13.5px">${celda}</td></tr>`;
    })
    .join("");

  const fila = (rotulo: string, valor: string) => `
    <tr>
      <td style="padding:6px 14px 6px 0;font-size:12px;font-weight:bold;letter-spacing:.06em;color:#8a929a;vertical-align:top;white-space:nowrap">${rotulo}</td>
      <td style="padding:6px 0;font-size:14px;color:#1d2a36">${valor}</td>
    </tr>`;

  let bloqueDeLaCasa = "";
  if (datos.casa) {
    const cuando = cuandoSeReune(datos.casa);
    const donde = dondeSeReune(datos.casa);
    const liderDePila = datos.casa.lider.split(" ")[0] ?? datos.casa.lider;
    const comoLlegar = donde.comoLlegar
      ? ` · <a href="${donde.comoLlegar}" style="color:#0e2a4e;font-weight:bold">Cómo llegar</a>`
      : "";

    bloqueDeLaCasa = `
      <div style="margin:18px 0;border:1px solid #c9ccd1;border-radius:12px;padding:14px 16px;background:#f7f5ee">
        <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin:0 0 6px">TU CASA DE FE</p>
        <table style="width:100%;border-collapse:collapse">
          ${fila("CUÁNDO", escapar(cuando ? cuando.largo : SIN_DIA_NI_HORA))}
          ${fila("DÓNDE", `${escapar(donde.texto)}${comoLlegar}`)}
          ${fila("QUIÉN LA LLEVA", escapar(datos.casa.lider))}
        </table>
      </div>
      <p style="font-size:13px;color:#4a5560">
        No tienes que llevar nada. Llega, y si algún día no puedes, avísale a
        ${escapar(liderDePila)}.
      </p>`;
  }

  const html = MARCO(`
      <p>${escapar(
        datos.casa
          ? fraseDeInscripcion({ nombreDePila, genero: datos.genero, casa: datos.casa.nombre })
          : `Hola ${nombreDePila}, ya estás en una Casa de Fe.`,
      )}</p>
      ${datos.casa ? "<p>Esto es lo que necesitas para el primer día.</p>" : ""}

      ${bloqueDeLaCasa}

      <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin-top:26px">TUS 12 TALLERES</p>
      <p>En la Casa de Fe van a ir viendo los 12 temas del libro. Cada uno tiene
      un taller que llenas desde tu celular. Este enlace es tuyo:
      <strong>guárdalo</strong>.</p>

      <p style="margin:20px 0">
        <a href="${datos.enlace}"
           style="background:#0e2a4e;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold;display:inline-block">
          Abrir mis talleres
        </a>
      </p>

      <div style="margin:18px 0;border:1px solid #c9ccd1;border-radius:12px;padding:14px 16px;background:#f7f5ee">
        <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin:0">TU CÓDIGO</p>
        <p style="font-size:30px;letter-spacing:.14em;margin:6px 0 0;font-weight:bold">${escapar(
          `${datos.codigo.slice(0, 3)} ${datos.codigo.slice(3)}`,
        )}</p>
        <p style="font-size:12.5px;color:#4a5560;margin:8px 0 0">
          Es solo tuyo. Te sirve para entrar a tu taller desde cualquier
          teléfono, o si escaneas uno de los QR que están en tu Casa de Fe.
          <strong>No lo compartas</strong>: con él se escribe en tu expediente.
        </p>
      </div>

      <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin-top:22px">LOS 12 TEMAS</p>
      <table style="width:100%;border-collapse:collapse;margin-top:6px">${renglones}</table>

      <p style="font-size:12.5px;color:#4a5560;margin-top:20px">
        Cada taller se guarda mientras lo llenas, así que puedes hacerlo en
        varios días. Cuando lo envíes, tu líder lo revisa y te dice si quedó
        listo o si hay que corregir algo.
      </p>
      <p style="font-size:12.5px;color:#8a929a">
        No necesitas contraseña ni crear una cuenta.
      </p>
    `);

  return { subject, html };
}

/// **La confirmación de inscripción a una Casa de Fe**, con su acceso a los
/// talleres.
///
/// ⚠️ **El orden es la decisión que importa, y cambió el 22-oct.** Antes esto
/// entregaba unos talleres y despachaba la inscripción en media línea; la
/// persona quedaba inscrita sin saber **cuándo ni dónde presentarse**, y tenía
/// que preguntárselo a alguien. Ahora la reunión va primero —día, hora,
/// dirección y quién la lleva— y los talleres después: el enlace puede esperar
/// a que lo abra, llegar a la hora no.
export async function correoTalleresDeCasaDeFe(
  datos: DatosDeLaInscripcion & { to: string; registro?: RegistroDeCorreo },
): Promise<ResultadoCorreo> {
  const { subject, html } = correoDeInscripcionACasaDeFe(datos);
  return enviarCorreo({ to: datos.to, subject, html, registro: datos.registro });
}


/// **El recordatorio de las Casas de Fe del día.**
///
/// Uno por persona, no uno por casa: quien lleva siete casas recibiría siete
/// correos a la semana y dejaría de abrirlos (§12.6). Las direcciones y el
/// «Cómo llegar» van **aquí** y no en el WhatsApp, que se queda con el resumen
/// corto: tres direcciones completas no se leen en el celular.
///
/// Si la persona además acompaña como mentor, las casas de su línea van en un
/// bloque aparte y **se dice que no tiene que ir** — si no, un correo que lista
/// cuatro reuniones se lee como cuatro obligaciones.
export async function correoRecordatorioCasaDeFe(datos: {
  to: string;
  /// El aviso entero, tal como lo armó el catálogo.
  ///
  /// ⚠️ **Recibe el `Aviso` y no sus trozos a propósito.** La primera versión
  /// de esta función tomaba `propias` y `deLinea` por separado y volvía a
  /// construir un `Aviso` de mentira solo para pedirle el asunto: dos sitios
  /// armando la misma cosa, que es exactamente lo que se desincroniza sin que
  /// nada avise (§12.6). El asunto y el cuerpo salen del mismo objeto.
  aviso: Aviso;
  tipo: TipoDeEnvio;
  registro?: RegistroDeCorreo;
}): Promise<ResultadoCorreo> {
  const cuando = datos.tipo === "DIA" ? "Hoy" : "Mañana";
  const nombre = nombreDePila(datos.aviso.nombre);
  const asunto = asuntoDelCorreo(datos.aviso, datos.tipo);

  const propias = datos.aviso.propias
    .map((casa) => {
      const boton = casa.comoLlegar
        ? `<p style="margin:10px 0 0">
             <a href="${casa.comoLlegar}"
                style="background:#0e2a4e;color:#fff;text-decoration:none;padding:11px 15px;border-radius:9px;font-weight:bold;font-size:13px;display:inline-block">
               Cómo llegar
             </a>
           </p>`
        : `<p style="margin:10px 0 0;font-size:12.5px;color:#8a929a">
             A esta casa todavía no le han puesto la dirección en la plataforma.
           </p>`;
      return `
        <div style="margin:10px 0;border:1px solid #c9ccd1;border-radius:12px;padding:14px 16px">
          <p style="margin:0;font-size:24px;font-weight:bold;color:#0e2a4e">${escapar(
            horaLegible(casa.hora),
          )}</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:bold">${escapar(casa.nombre)}</p>
          ${
            casa.direccion
              ? `<p style="margin:6px 0 0;font-size:13.5px">${escapar(casa.direccion)}</p>`
              : ""
          }
          <p style="margin:4px 0 0;font-size:13px;color:#4a5560">${casa.miembros} ${
            casa.miembros === 1 ? "miembro inscrito" : "miembros inscritos"
          }</p>
          ${boton}
        </div>`;
    })
    .join("");

  const linea = datos.aviso.deLinea
    .map(
      (casa) => `
        <tr>
          <td style="padding:8px 12px 8px 0;border-bottom:1px solid #e7e3d8;font-size:13.5px;font-weight:bold;color:#0e2a4e;white-space:nowrap">${escapar(
            horaLegible(casa.hora),
          )}</td>
          <td style="padding:8px 12px 8px 0;border-bottom:1px solid #e7e3d8;font-size:13.5px;font-weight:bold">${escapar(
            casa.nombre,
          )}</td>
          <td style="padding:8px 12px 8px 0;border-bottom:1px solid #e7e3d8;font-size:13px;color:#4a5560">${escapar(
            casa.lider,
          )}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e7e3d8;font-size:13px;color:#4a5560;text-align:right">${
            casa.miembros
          }</td>
        </tr>`,
    )
    .join("");

  const bloqueDeLinea =
    datos.aviso.deLinea.length === 0
      ? ""
      : `
        <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin-top:24px">
          ${datos.aviso.propias.length > 0 ? "ADEMÁS, DE TU LÍNEA" : `DE TU LÍNEA, ${cuando.toUpperCase()}`}
        </p>
        <p style="font-size:12.5px;color:#4a5560;margin:6px 0 0">
          No tienes que ir. Es para que sepas qué está abierto y a quién
          preguntarle después.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px">${linea}</table>`;

  const cierre =
    datos.aviso.propias.length === 0
      ? ""
      : `
        <div style="margin:18px 0 0;border:1px solid #c9ccd1;border-radius:12px;padding:14px 16px;background:#f7f5ee">
          <p style="font-size:11px;font-weight:bold;letter-spacing:.1em;color:#8a929a;margin:0">
            ${datos.tipo === "DIA" ? "SI HOY NO SE PUEDE" : "POR QUÉ TE LLEGA ESTA NOCHE"}
          </p>
          <p style="font-size:12.5px;color:#4a5560;margin:7px 0 0">
            ${
              datos.tipo === "DIA"
                ? `Avísale a tu mentor y a los miembros. El grupo no se cierra por
                   faltar un día, pero que nadie llegue a una casa que no abrió.`
                : `Tu casa se reúne antes de las 9 de la mañana, así que el aviso
                   de mañana temprano te llegaría cuando ya estuvieras reunida.`
            }
          </p>
        </div>`;

  return enviarCorreo({
    to: datos.to,
    subject: asunto,
    registro: datos.registro,
    html: MARCO(`
      <p>Hola ${escapar(nombre)}.</p>
      ${
        datos.aviso.propias.length > 0
          ? `<p style="font-size:15px">${cuando} te reúnes con ${
              datos.aviso.propias.length === 1
                ? "tu Casa de Fe"
                : `<strong>${datos.aviso.propias.length}</strong> Casas de Fe`
            }.</p>${propias}`
          : ""
      }
      ${bloqueDeLinea}
      ${cierre}
      <p style="font-size:12px;color:#8a929a;margin-top:22px">
        Este aviso sale solo los días que tus casas se reúnen. Si cambias el día
        o la hora en la plataforma, el recordatorio cambia contigo.
      </p>
    `),
  });
}
