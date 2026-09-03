import { variableDeEntorno } from "@/lib/entorno";
import type { ClientePrisma } from "@/lib/prisma";

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
