import type { Prisma } from "@iglesia/prisma-client";
import type { ClientePrisma } from "@/lib/prisma";

/// Acciones sensibles que quedan registradas (ESPECIFICACION_PRODUCTO.md §19).
export type AccionAuditada =
  | "persona.registrada"
  | "consolidador.asignado"
  // Cambio de consolidador ya existente. `metadata.origen` dice de qué lado
  // nació: "sistema" o "highlevel" (ver src/lib/consolidador.ts).
  | "consolidador.reasignado"
  | "operacion72.iniciada"
  | "operacion72.contacto_registrado"
  | "operacion72.visita_agendada"
  | "operacion72.visita_cerrada"
  // Corrección de datos: una tarjeta que quedó en la columna equivocada por
  // reglas anteriores del sistema y se movió a la que le corresponde hoy.
  | "operacion72.estado_corregido"
  | "operacion72.entregada"
  | "operacion72.dado_de_baja"
  // Autorización de bajas: el equipo de consolidación PIDE la baja y un
  // administrador la resuelve. Nadie sale del sistema sin esa respuesta.
  | "operacion72.baja_solicitada"
  | "operacion72.baja_autorizada"
  | "operacion72.baja_rechazada"
  | "operacion72.baja_retirada"
  | "mentor.asignado"
  | "notas.reveladas"
  | "hito.registrado"
  | "casa_de_fe.tema_actualizado"
  | "casa_de_fe.grupo_abierto"
  | "casa_de_fe.grupo_cerrado"
  | "casa_de_fe.miembro_inscrito"
  | "casa_de_fe.miembro_retirado"
  | "alpha.grupo_creado"
  | "alpha.focus_day"
  | "alpha.validado"
  | "alpha.desvalidado"
  | "escuela.inscripcion"
  | "escuela.cerrada"
  | "servicio.registrado"
  | "servicio.estado_cambiado"
  | "evento.creado"
  | "evento.publicado"
  | "evento.despublicado"
  | "evento.cancelado"
  | "evento.inscripcion"
  | "evento.asistencia"
  | "fase.cambiada"
  | "highlevel.registro_importado"
  | "highlevel.contacto_vinculado"
  | "highlevel.registro_repetido"
  | "highlevel.seguimiento_recibido"
  // El CRM asignó un usuario que no está enlazado a nadie del equipo. No se
  // toca el consolidador, pero queda a la vista en «Actividad del día» en vez
  // de perderse en la respuesta del webhook.
  | "highlevel.usuario_sin_mapear"
  | "registro_publico.recibido"
  // Formulario público del liderazgo: la persona actualiza su propia ficha y
  // declara sus hitos. Lo que dice que hace queda pendiente de confirmar.
  | "liderazgo.datos_actualizados"
  | "liderazgo.declaracion_confirmada"
  | "liderazgo.declaracion_descartada"
  | "administracion.datos_actualizados"
  | "expediente.datos_actualizados"
  | "administracion.rol_actualizado"
  | "administracion.acceso_creado"
  | "administracion.contrasena_restablecida"
  | "acceso.recuperacion_solicitada"
  | "acceso.contrasena_recuperada"
  // Llave maestra: el secreto del administrador que abre cualquier perfil.
  // Cada uso dice a qué perfil entró; sin esto la entrada sería invisible.
  | "acceso.llave_maestra_cambiada"
  | "acceso.llave_maestra_revocada"
  | "acceso.llave_maestra_usada"
  | "administracion.hito_editado"
  | "administracion.mentor_asignado"
  | "administracion.dado_de_baja"
  | "administracion.reactivado"
  | "equipo.lider_asignado"
  | "equipo.acceso_creado"
  | "duplicado.detectado";

export async function auditar(
  db: ClientePrisma,
  entrada: {
    actorId: string | null;
    action: AccionAuditada;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await db.auditLog.create({
    data: {
      actorId: entrada.actorId,
      action: entrada.action,
      entityType: entrada.entityType,
      entityId: entrada.entityId ?? null,
      metadata: entrada.metadata,
    },
  });
}

/// Encola un evento de dominio para GoHighLevel / WhatsApp. El envío real lo
/// hace un worker; aquí solo se deja la intención registrada y reintentable
/// (ESPECIFICACION_PRODUCTO.md §15).
export async function encolarEventoIntegracion(
  db: ClientePrisma,
  event: string,
  payload: Prisma.InputJsonValue,
) {
  await db.integrationEvent.create({ data: { event, payload } });
}
