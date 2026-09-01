import {
  CallOutcome,
  ContactType,
  MilestoneKind,
  MilestoneStatus,
  Operation72Status,
  type Prisma,
} from "@iglesia/prisma-client";
import type { ClientePrisma } from "@/lib/prisma";
import { asignarConsolidador } from "@/lib/asignacion";
import { auditar, encolarEventoIntegracion } from "@/lib/audit";
import { colaDeTelefono, nombreCompleto, ZONA_HORARIA } from "@/lib/dominio";
import { DURACION_OPERACION_72_HORAS, ETIQUETA_LLAMADA } from "@/lib/op72";
import type { VisitaDesdeCrm } from "@/lib/highlevel";
import type { DatosRegistroValidados } from "@/lib/validacion-registro";

const FORMATO_VISITA = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  timeZone: ZONA_HORARIA,
});

/// Cuando la línea confirma una visita en el CRM, la persona pasa a «visita
/// pendiente» con su fecha. Es el mismo movimiento que hace un consolidador a
/// mano desde el tablero (`agendarVisita`), pero disparado por el webhook.
///
/// Solo avanza desde antes de la visita (INICIADA o CONTACTADA): nunca pisa una
/// visita ya agendada, una entrega ni un cierre. Devuelve si aplicó el cambio.
export async function programarVisitaDesdeCrm(
  db: ClientePrisma,
  learnerId: string,
  visita: VisitaDesdeCrm,
): Promise<boolean> {
  if (visita.confirmacion !== "confirmada" && visita.confirmacion !== "virtual") {
    return false;
  }

  const op = await db.operation72.findUnique({
    where: { learnerId },
    select: { id: true, status: true },
  });
  if (
    !op ||
    (op.status !== Operation72Status.INICIADA &&
      op.status !== Operation72Status.CONTACTADA)
  ) {
    return false;
  }

  const esVirtual = visita.confirmacion === "virtual";
  const fecha = fechaValida(visita.fechaVisita);

  // La llamada de la línea, si el CRM manda cómo salió.
  if (visita.estadoLinea) {
    const contesto = visita.estadoLinea !== CallOutcome.NO_CONTESTO;
    await db.contactAttempt.create({
      data: {
        operation72Id: op.id,
        type: contesto ? ContactType.LLAMADA : ContactType.INTENTO_LLAMADA,
        outcome: visita.estadoLinea,
        result: `${ETIQUETA_LLAMADA[visita.estadoLinea]} (línea)`,
        note: visita.observacionLinea,
        occurredAt: fechaValida(visita.fechaLinea) ?? new Date(),
      },
    });
  }

  await db.contactAttempt.create({
    data: {
      operation72Id: op.id,
      type: ContactType.VISITA,
      result: "Visita agendada",
      note: visita.observacionLinea,
      scheduledAt: fecha,
      isVirtual: esVirtual,
    },
  });

  await db.operation72.update({
    where: { id: op.id },
    data: {
      status: Operation72Status.VISITA_PENDIENTE,
      detail: [
        fecha ? `Visita ${FORMATO_VISITA.format(fecha)}` : "Visita confirmada por la línea",
        esVirtual ? "virtual" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    },
  });

  await auditar(db, {
    actorId: null,
    action: "operacion72.visita_agendada",
    entityType: "operation72",
    entityId: op.id,
    metadata: {
      origen: "highlevel",
      form: "Registro Llamada Linea",
      fechaVisita: visita.fechaVisita,
      virtual: esVirtual,
    },
  });

  return true;
}

function fechaValida(valor: string | null): Date | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export type PosibleDuplicado = {
  id: string;
  nombre: string;
  telefono: string | null;
  motivo: string;
};

export async function buscarDuplicados(
  db: ClientePrisma,
  datos: Pick<
    DatosRegistroValidados,
    "firstName" | "lastName" | "callPhone" | "whatsappPhone" | "email"
  >,
): Promise<PosibleDuplicado[]> {
  const telefonos = [
    colaDeTelefono(datos.callPhone),
    colaDeTelefono(datos.whatsappPhone),
  ].filter((valor): valor is string => Boolean(valor));

  if (telefonos.length === 0 && !datos.email) {
    const porNombre = await db.person.findMany({
      where: {
        active: true,
        firstName: { equals: datos.firstName, mode: "insensitive" },
        ...(datos.lastName
          ? { lastName: { equals: datos.lastName, mode: "insensitive" } }
          : {}),
      },
      take: 5,
      select: { id: true, firstName: true, lastName: true, callPhone: true },
    });

    return porNombre.map((persona) => ({
      id: persona.id,
      nombre: nombreCompleto(persona),
      telefono: persona.callPhone,
      motivo: "Mismo nombre registrado",
    }));
  }

  const filas = await db.$queryRaw<
    {
      id: string;
      first_name: string;
      last_name: string | null;
      call_phone: string | null;
      por_telefono: boolean;
    }[]
  >`
    SELECT id, first_name, last_name, call_phone,
           (right(regexp_replace(coalesce(call_phone, ''), '\\D', '', 'g'), 10) = ANY(${telefonos})
            OR right(regexp_replace(coalesce(whatsapp_phone, ''), '\\D', '', 'g'), 10) = ANY(${telefonos})) AS por_telefono
    FROM person
    WHERE active = true
      AND (
        right(regexp_replace(coalesce(call_phone, ''), '\\D', '', 'g'), 10) = ANY(${telefonos})
        OR right(regexp_replace(coalesce(whatsapp_phone, ''), '\\D', '', 'g'), 10) = ANY(${telefonos})
        OR (${datos.email}::text IS NOT NULL AND lower(email) = ${datos.email})
      )
    LIMIT 5
  `;

  return filas.map((fila) => ({
    id: fila.id,
    nombre: nombreCompleto({
      firstName: fila.first_name,
      lastName: fila.last_name,
    }),
    telefono: fila.call_phone,
    motivo: fila.por_telefono
      ? "Mismo teléfono registrado"
      : "Mismo correo registrado",
  }));
}

export async function crearRegistroEnTransaccion(
  db: ClientePrisma,
  datos: DatosRegistroValidados,
  opciones: {
    actorId: string | null;
    duplicadoConfirmadoPorHumano?: boolean;
    metadata?: Prisma.InputJsonObject;
    /// Cuando el registro llega del CRM, el propietario del contacto es su
    /// consolidador. Si se pasa (aunque sea `null`), se usa ese y no el reparto
    /// automático por género y carga. `undefined` = reparto automático.
    consolidadorForzado?: { id: string } | null;
  },
) {
  const fuerzaConsolidador = "consolidadorForzado" in opciones;
  const ahora = new Date();
  const deadlineAt = new Date(
    ahora.getTime() + DURACION_OPERACION_72_HORAS * 3_600_000,
  );

  const invitador = datos.invitedByPersonId
    ? await db.person.findUnique({
        where: { id: datos.invitedByPersonId },
        select: { id: true, firstName: true, lastName: true },
      })
    : null;

  const nombreDelInvitador =
    (invitador ? nombreCompleto(invitador) : null) ?? datos.invitedByName;

  const persona = await db.person.create({
    data: {
      firstName: datos.firstName,
      lastName: datos.lastName,
      gender: datos.gender,
      birthDate: datos.birthDate ? new Date(datos.birthDate) : null,
      callPhone: datos.callPhone,
      whatsappPhone: datos.whatsappPhone,
      email: datos.email,
      address: datos.address,
      prayerRequest: datos.prayerRequest,
      callSchedules: datos.callSchedules,
      callScheduleNote: datos.callScheduleNote,
    },
    select: { id: true, gender: true },
  });

  const elegido = fuerzaConsolidador
    ? opciones.consolidadorForzado
      ? { id: opciones.consolidadorForzado.id, carga: null as number | null }
      : null
    : await asignarConsolidador(db, persona.gender);
  const aprendiz = await db.learnerProfile.create({
    data: {
      personId: persona.id,
      entryPoint: datos.entryPoint ?? null,
      entryPointOther: datos.entryPointOther,
      churchAttendance: datos.churchAttendance ?? null,
      churchName: datos.churchName,
      invitationKind: datos.invitationKind ?? null,
      invitedByPersonId: invitador?.id ?? null,
      lineOfOrigin: nombreDelInvitador,
      consolidatorId: elegido?.id ?? null,
      teamId: null,
      registeredById: opciones.actorId,
    },
    select: { id: true },
  });

  await db.operation72.create({
    data: {
      learnerId: aprendiz.id,
      startedAt: ahora,
      deadlineAt,
      detail: elegido
        ? "Consolidador asignado · bienvenida por WhatsApp enviada"
        : "Sin consolidador con cupo · requiere asignación de un líder",
      lineKnown: Boolean(invitador),
    },
  });

  await db.milestone.createMany({
    data: [
      {
        learnerId: aprendiz.id,
        kind: MilestoneKind.REGISTRO,
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        recordedById: opciones.actorId,
      },
      {
        learnerId: aprendiz.id,
        kind: MilestoneKind.OPERACION_72,
        status: MilestoneStatus.EN_CURSO,
        recordedById: opciones.actorId,
      },
    ],
  });

  const metadatosComunes: Prisma.InputJsonObject = {
    personId: persona.id,
    learnerId: aprendiz.id,
    entryPoint: datos.entryPoint ?? null,
    churchAttendance: datos.churchAttendance ?? null,
    churchName: datos.churchName ?? null,
    invitationKind: datos.invitationKind ?? null,
    invitadorSinExpediente: Boolean(datos.invitedByName && !invitador),
    duplicadoConfirmadoPorHumano:
      opciones.duplicadoConfirmadoPorHumano ?? false,
    ...opciones.metadata,
  };

  await auditar(db, {
    actorId: opciones.actorId,
    action: "persona.registrada",
    entityType: "learner_profile",
    entityId: aprendiz.id,
    metadata: metadatosComunes,
  });

  if (elegido) {
    await auditar(db, {
      actorId: opciones.actorId,
      action: "consolidador.asignado",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: {
        consolidadorId: elegido.id,
        criterio: fuerzaConsolidador
          ? "propietario del contacto en HighLevel"
          : "mismo género · menor carga",
        cargaPrevia: elegido.carga,
      },
    });
  }

  await auditar(db, {
    actorId: opciones.actorId,
    action: "operacion72.iniciada",
    entityType: "learner_profile",
    entityId: aprendiz.id,
    metadata: { deadlineAt: deadlineAt.toISOString() },
  });

  await encolarEventoIntegracion(db, "aprendiz_creado", metadatosComunes);
  await encolarEventoIntegracion(db, "operacion72_iniciada", {
    learnerId: aprendiz.id,
    deadlineAt: deadlineAt.toISOString(),
  });

  return { personId: persona.id, learnerId: aprendiz.id };
}
