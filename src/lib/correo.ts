import { variableDeEntorno } from "@/lib/entorno";

/// Envío de correo, best-effort. Usa Resend (una API sencilla que funciona en
/// el Worker). Si no están configurados los secretos `RESEND_API_KEY` y
/// `EMAIL_FROM`, no hace nada; y si el envío falla, se registra pero no rompe
/// la acción que lo disparó. Cambiar de proveedor es cambiar solo esta función.
async function enviarCorreo(datos: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = await variableDeEntorno("RESEND_API_KEY");
  const from = await variableDeEntorno("EMAIL_FROM");
  if (!apiKey || !from) return false;
  if (!datos.to) return false;

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
      return false;
    }
    return true;
  } catch (error) {
    console.error("No se pudo enviar el correo", error);
    return false;
  }
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
}): Promise<void> {
  await enviarCorreo({
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
}): Promise<void> {
  await enviarCorreo({
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
}): Promise<void> {
  await enviarCorreo({
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
}): Promise<void> {
  await enviarCorreo({
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
