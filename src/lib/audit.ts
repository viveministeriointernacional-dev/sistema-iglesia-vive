import type { Prisma } from "@iglesia/prisma-client";
import type { ClientePrisma } from "@/lib/prisma";

/// Acciones sensibles que quedan registradas (ESPECIFICACION_PRODUCTO.md §19).
export type AccionAuditada =
  | "persona.registrada"
  | "consolidador.asignado"
  | "operacion72.iniciada"
  | "operacion72.contacto_registrado"
  | "operacion72.visita_agendada"
  | "operacion72.visita_cerrada"
  | "operacion72.entregada"
  | "mentor.asignado"
  | "notas.reveladas"
  | "hito.registrado"
  | "casa_de_fe.tema_actualizado"
  | "casa_de_fe.grupo_abierto"
  | "casa_de_fe.grupo_cerrado"
  | "casa_de_fe.miembro_inscrito"
  | "casa_de_fe.miembro_retirado"
  | "alpha.focus_day"
  | "alpha.validado"
  | "alpha.desvalidado"
  | "escuela.inscripcion"
  | "escuela.cerrada"
  | "servicio.registrado"
  | "servicio.estado_cambiado"
  | "evento.publicado"
  | "evento.despublicado"
  | "evento.cancelado"
  | "evento.inscripcion"
  | "evento.asistencia"
  | "fase.cambiada"
  | "highlevel.registro_importado"
  | "highlevel.contacto_vinculado"
  | "highlevel.registro_repetido"
  | "registro_publico.recibido"
  | "administracion.datos_actualizados"
  | "expediente.datos_actualizados"
  | "administracion.rol_actualizado"
  | "administracion.acceso_creado"
  | "administracion.contrasena_restablecida"
  | "acceso.recuperacion_solicitada"
  | "acceso.contrasena_recuperada"
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
