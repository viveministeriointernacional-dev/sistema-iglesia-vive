"use server";

import { revalidatePath } from "next/cache";
import {
  CallOutcome,
  ContactType,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import {
  ErrorDePermiso,
  requerirRolEnAccion,
  ROLES_CONFIRMAN_ENTREGA,
  ROLES_CONSOLIDACION,
  type UsuarioSesion,
} from "@/lib/auth";
import { proponerMentor } from "@/lib/asignacion";
import {
  contactaDeVerdad,
  ETIQUETA_LLAMADA,
  RESULTADOS_DE_LLAMADA,
} from "@/lib/op72";

/// El formulario da una fecha sin hora. Hoy conserva la hora real; un día
/// pasado se ancla al mediodía.
function fechaDeLaLlamada(fecha: string) {
  const ahora = new Date();
  if (fecha === ahora.toISOString().slice(0, 10)) return ahora;
  return new Date(`${fecha}T12:00:00`);
}

const FORMATO_VISITA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export type ResultadoAccion = { ok: true } | { ok: false; mensaje: string };

/// Un consolidador solo opera sobre las personas que tiene asignadas; pastor y
/// administrador ven y operan toda la iglesia.
async function cargarOperacion(id: string, usuario: UsuarioSesion) {
  const prisma = await getPrisma();
  const operacion = await prisma.operation72.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      learnerId: true,
      lineKnown: true,
      proposedMentorId: true,
      learner: { select: { consolidatorId: true, personId: true } },
    },
  });

  if (!operacion) return null;

  const esSuya =
    usuario.role !== Role.CONSOLIDADOR ||
    operacion.learner.consolidatorId === usuario.id;

  return esSuya ? operacion : null;
}

/// Registra la primera llamada —o cualquier llamada— con lo que realmente pasó.
///
/// «No contestó» no avanza la tarjeta: queda como intento y la persona sigue
/// esperando llamada. Decir «contactada» cuando nadie respondió sería mentirle
/// al tablero, y el tablero es lo que usa el equipo para saber a quién buscar.
export async function registrarLlamada(
  operacionId: string,
  datos: {
    fecha: string;
    resultado: CallOutcome;
    observacion: string;
    peticionDeOracion: string;
  },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_CONSOLIDACION);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "Esta persona no está en tu lista." };

  if (
    operacion.status === Operation72Status.ENTREGADA ||
    operacion.status === Operation72Status.CERRADA
  ) {
    return { ok: false, mensaje: "Esta persona ya salió de Operación 72." };
  }

  if (!RESULTADOS_DE_LLAMADA.some((r) => r.valor === datos.resultado)) {
    return { ok: false, mensaje: "Elige cómo salió la llamada." };
  }

  if (Number.isNaN(Date.parse(datos.fecha))) {
    return { ok: false, mensaje: "La fecha de la llamada no es válida." };
  }

  // El campo es solo fecha. Si es hoy se usa la hora real, para que la llamada
  // quede después del registro en la línea de tiempo y no antes; si es un día
  // anterior, al mediodía, que ordena bien dentro de ese día.
  const ocurrioEl = fechaDeLaLlamada(datos.fecha);
  const contactada = contactaDeVerdad(datos.resultado);
  const etiqueta = ETIQUETA_LLAMADA[datos.resultado];
  const observacion = datos.observacion.trim() || null;
  const peticion = datos.peticionDeOracion.trim();
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.contactAttempt.create({
      data: {
        operation72Id: operacion.id,
        type: contactada ? ContactType.LLAMADA : ContactType.INTENTO_LLAMADA,
        outcome: datos.resultado,
        result: etiqueta,
        note: observacion,
        occurredAt: ocurrioEl,
        byUserId: usuario.id,
      },
    });

    // Con una visita ya agendada, la tarjeta debe seguir mostrando la visita:
    // es lo que el consolidador necesita ver. Una llamada posterior queda en
    // el historial sin borrar esa cita del resumen.
    const laLlamadaEsLoMasImportante =
      operacion.status === Operation72Status.INICIADA ||
      operacion.status === Operation72Status.CONTACTADA;

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        ...(contactada && operacion.status === Operation72Status.INICIADA
          ? { status: Operation72Status.CONTACTADA }
          : {}),
        ...(laLlamadaEsLoMasImportante
          ? { detail: [etiqueta, observacion].filter(Boolean).join(" · ") }
          : {}),
      },
    });

    // La petición de oración vive en la persona, no en el intento: es algo por
    // lo que la iglesia ora. Se suma a lo que ya había: lo que pidió al
    // registrarse no se borra porque hoy cuente otra cosa.
    if (peticion) {
      const persona = await tx.person.findUnique({
        where: { id: operacion.learner.personId },
        select: { prayerRequest: true },
      });
      const previa = persona?.prayerRequest?.trim();
      await tx.person.update({
        where: { id: operacion.learner.personId },
        data: {
          prayerRequest:
            previa && previa !== peticion ? `${previa}\n\n${peticion}` : peticion,
        },
      });
    }

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.contacto_registrado",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: { resultado: datos.resultado, contactada },
    });
  });

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${operacion.learnerId}`);
  return { ok: true };
}

/// Agenda la visita con su fecha, hora y lugar. Virtual es un lugar más.
export async function agendarVisita(
  operacionId: string,
  datos: { cuando: string; lugar: string; virtual: boolean; nota: string },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_CONSOLIDACION);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "Esta persona no está en tu lista." };
  if (operacion.status !== Operation72Status.CONTACTADA) {
    return { ok: false, mensaje: "Alguien más ya movió esta tarjeta. Actualiza el tablero." };
  }
  if (Number.isNaN(Date.parse(datos.cuando))) {
    return { ok: false, mensaje: "La fecha y hora de la visita no son válidas." };
  }
  if (!datos.virtual && !datos.lugar.trim()) {
    return { ok: false, mensaje: "Escribe el lugar, o marca que la visita es virtual." };
  }

  const cuando = new Date(datos.cuando);
  const lugar = datos.virtual ? null : datos.lugar.trim();
  const nota = datos.nota.trim() || null;
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.contactAttempt.create({
      data: {
        operation72Id: operacion.id,
        type: ContactType.VISITA,
        result: "Visita agendada",
        note: nota,
        scheduledAt: cuando,
        place: lugar,
        isVirtual: datos.virtual,
        byUserId: usuario.id,
      },
    });

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: Operation72Status.VISITA_PENDIENTE,
        detail: [
          `Visita ${FORMATO_VISITA.format(cuando)}`,
          datos.virtual ? "virtual" : lugar,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.visita_agendada",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: { cuando: cuando.toISOString(), virtual: datos.virtual, lugar },
    });
  });

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${operacion.learnerId}`);
  return { ok: true };
}

/// Cierra la visita con su resumen y prepara la entrega a mentor.
export async function cerrarVisita(
  operacionId: string,
  resumen: string,
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_CONSOLIDACION);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "Esta persona no está en tu lista." };
  if (operacion.status !== Operation72Status.VISITA_PENDIENTE) {
    return { ok: false, mensaje: "Alguien más ya movió esta tarjeta. Actualiza el tablero." };
  }
  if (resumen.trim().length < 3) {
    return { ok: false, mensaje: "Escribe un resumen de la visita." };
  }

  const texto = resumen.trim();
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    const propuesta = await proponerMentor(tx, operacion.learnerId);

    await tx.contactAttempt.create({
      data: {
        operation72Id: operacion.id,
        type: ContactType.VISITA,
        result: "Visita realizada",
        note: texto,
        byUserId: usuario.id,
      },
    });

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: Operation72Status.LISTA_PARA_ENTREGA,
        detail: texto,
        ...(propuesta
          ? {
              proposedMentorId: propuesta.mentorId,
              proposedMentorNote: propuesta.detalle,
              lineKnown: propuesta.conservaLinea,
            }
          : {}),
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.visita_cerrada",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: { resumen: texto },
    });
  });

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${operacion.learnerId}`);
  return { ok: true };
}

/// Entrega a mentor: cierra Operación 72 y abre la relación de discipulado.
///
/// La relación queda con fecha de inicio y responsable que la autorizó; el
/// historial nunca se sobrescribe (ARQUITECTURA_VISUAL.md §11).
export async function entregarAMentor(
  operacionId: string,
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirRolEnAccion(ROLES_CONSOLIDACION);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) {
    return { ok: false, mensaje: "Esta persona no está en tu lista." };
  }

  if (operacion.status !== Operation72Status.LISTA_PARA_ENTREGA) {
    return { ok: false, mensaje: "Esta persona todavía no está lista para entrega." };
  }

  if (!operacion.proposedMentorId) {
    return {
      ok: false,
      mensaje:
        "No hay mentor propuesto con cupo. Un líder debe asignarlo antes de entregar.",
    };
  }

  // Sin línea conocida, la asignación por perfil la confirma un líder.
  if (!operacion.lineKnown && !ROLES_CONFIRMAN_ENTREGA.includes(usuario.role)) {
    return {
      ok: false,
      mensaje:
        "Sin línea conocida la entrega la confirma un líder. Avísale para que la apruebe.",
    };
  }

  const ahora = new Date();
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    await tx.mentorRelationship.create({
      data: {
        learnerId: operacion.learnerId,
        mentorId: operacion.proposedMentorId!,
        startedAt: ahora,
        reason: "Entrega desde Operación 72",
        authorizedById: usuario.id,
        keepsLine: operacion.lineKnown,
      },
    });

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: Operation72Status.ENTREGADA,
        deliveredAt: ahora,
        detail: "Entregada a mentor",
      },
    });

    await tx.milestone.upsert({
      where: {
        learnerId_kind: {
          learnerId: operacion.learnerId,
          kind: MilestoneKind.OPERACION_72,
        },
      },
      create: {
        learnerId: operacion.learnerId,
        kind: MilestoneKind.OPERACION_72,
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        recordedById: usuario.id,
      },
      update: {
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        recordedById: usuario.id,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.entregada",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: { mentorId: operacion.proposedMentorId },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "mentor.asignado",
      entityType: "learner_profile",
      entityId: operacion.learnerId,
      metadata: {
        mentorId: operacion.proposedMentorId,
        conservaLinea: operacion.lineKnown,
      },
    });

    await encolarEventoIntegracion(tx, "mentor_asignado", {
      learnerId: operacion.learnerId,
      mentorId: operacion.proposedMentorId,
    });
  });

  revalidatePath("/operacion-72");
  return { ok: true };
}
