import { variableDeEntorno } from "@/lib/entorno";

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

/// Correo al mentor avisándole de una persona que le fue asignada a mentoría.
export async function correoMentorAsignado(datos: {
  to: string;
  mentorNombre: string;
  personaNombre: string;
  telefono: string | null;
  correoPersona: string | null;
  detalle: string | null;
}): Promise<ResultadoCorreo> {
  return enviarCorreo({
    to: datos.to,
    subject: `Nueva persona para acompañar: ${datos.personaNombre}`,
    html: MARCO(`
      <p>Hola ${escapar(datos.mentorNombre)}, se te asignó una nueva persona para acompañar en tu mentoría.</p>
      <table style="margin:16px 0;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#8a929a">Persona</td><td><strong>${escapar(datos.personaNombre)}</strong></td></tr>
        ${datos.telefono ? `<tr><td style="padding:4px 12px 4px 0;color:#8a929a">Teléfono</td><td>${escapar(datos.telefono)}</td></tr>` : ""}
        ${datos.correoPersona ? `<tr><td style="padding:4px 12px 4px 0;color:#8a929a">Correo</td><td>${escapar(datos.correoPersona)}</td></tr>` : ""}
      </table>
      ${datos.detalle ? `<p style="font-size:13px;color:#4a5560">${escapar(datos.detalle)}</p>` : ""}
      <p><a href="${URL_SISTEMA}/mi-red">Ver en Mi red</a></p>
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
