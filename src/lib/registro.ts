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

/// El mismo, con la hora. Se usa **solo cuando la hora se conoce de verdad**
/// (ver `horaConocidaDelCrm`): imprimir el mediodía de relleno haría creer que
/// la visita quedó pactada a esa hora, cuando lo que pasa es que nadie la dijo.
const FORMATO_VISITA_CON_HORA = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

export type ResultadoSeguimientoCrm = "visita" | "llamada" | null;

/// Aplica lo que la línea registró en el CRM sobre una persona que ya está en
/// Operación 72. Es el mismo movimiento que haría un consolidador a mano desde
/// el tablero, pero disparado por el webhook:
///
/// - Si la línea **confirmó la visita** (presencial o virtual), la persona pasa
///   a VISITA PENDIENTE con su fecha. Nunca pisa una visita ya agendada, una
///   entrega ni un cierre.
/// - Si solo registró **cómo salió la llamada**, se guarda el intento y aplica
///   la regla del tablero: contestó → CONTACTADA; no contestó → SEGUIMIENTO.
///
/// Devuelve qué aplicó, o `null` si no había nada que hacer.
export async function programarVisitaDesdeCrm(
  db: ClientePrisma,
  learnerId: string,
  visita: VisitaDesdeCrm,
): Promise<ResultadoSeguimientoCrm> {
  const op = await db.operation72.findUnique({
    where: { learnerId },
    select: { id: true, status: true },
  });
  if (!op) return null;

  const antesDeLaVisita =
    op.status === Operation72Status.INICIADA ||
    op.status === Operation72Status.SEGUIMIENTO ||
    op.status === Operation72Status.CONTACTADA;
  if (!antesDeLaVisita) return null;

  const visitaConfirmada =
    visita.confirmacion === "confirmada" || visita.confirmacion === "virtual";
  const esperaContacto = op.status !== Operation72Status.CONTACTADA;

  // La llamada de la línea, si el CRM manda cómo salió. Se guarda una sola vez:
  // el mismo formulario puede reenviarse y no debe duplicar el intento.
  let llamadaRegistrada = false;
  if (visita.estadoLinea) {
    const contesto = visita.estadoLinea !== CallOutcome.NO_CONTESTO;
    const conFecha = fechaValida(visita.fechaLinea);
    const ocurrioEl = conFecha ?? new Date();
    // No duplicar si el mismo formulario se reenvía. Con fecha declarada se
    // compara exacta; sin ella (el formulario del consolidador no pregunta la
    // fecha) se usa la hora de llegada, que nunca coincide dos veces: ahí el
    // criterio es «el mismo resultado, el mismo día».
    const repetida = await db.contactAttempt.findFirst({
      where: {
        operation72Id: op.id,
        outcome: visita.estadoLinea,
        byUserId: null,
        ...(conFecha
          ? { occurredAt: conFecha }
          : {
              occurredAt: {
                gte: new Date(ocurrioEl.getTime() - 12 * 60 * 60 * 1000),
                lte: ocurrioEl,
              },
            }),
      },
      select: { id: true },
    });
    if (!repetida) {
      await db.contactAttempt.create({
        data: {
          operation72Id: op.id,
          type: contesto ? ContactType.LLAMADA : ContactType.INTENTO_LLAMADA,
          outcome: visita.estadoLinea,
          result: `${ETIQUETA_LLAMADA[visita.estadoLinea]} (línea)`,
          note: visita.observacionLinea,
          occurredAt: ocurrioEl,
        },
      });
      llamadaRegistrada = true;
    }

    if (!visitaConfirmada && esperaContacto) {
      await db.operation72.update({
        where: { id: op.id },
        data: {
          status: contesto
            ? Operation72Status.CONTACTADA
            : Operation72Status.SEGUIMIENTO,
          detail: [ETIQUETA_LLAMADA[visita.estadoLinea], visita.observacionLinea]
            .filter(Boolean)
            .join(" · "),
        },
      });
      await auditar(db, {
        actorId: null,
        action: "operacion72.contacto_registrado",
        entityType: "operation72",
        entityId: op.id,
        metadata: {
          origen: "highlevel",
          resultado: visita.estadoLinea,
          contactada: contesto,
        },
      });
    }
  }

  if (!visitaConfirmada) return llamadaRegistrada ? "llamada" : null;

  const esVirtual = visita.confirmacion === "virtual";
  const fecha = fechaValida(visita.fechaVisita, visita.horaVisita);
  const conHora = horaConocidaDelCrm(visita.fechaVisita, visita.horaVisita);

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
        fecha
          ? `Visita ${(conHora ? FORMATO_VISITA_CON_HORA : FORMATO_VISITA).format(fecha)}`
          : "Visita confirmada por la línea",
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
      form: "Registro Visita",
      fechaVisita: visita.fechaVisita,
      virtual: esVirtual,
    },
  });

  return "visita";
}

/// Fecha que manda el CRM. Los campos de fecha del formulario llegan sin hora
/// (`2026-08-29`, o `29/08/2026` si alguien lo escribió a mano): interpretados
/// en UTC caerían a las 7 p. m. del día ANTERIOR en Colombia. Una fecha sin
/// hora se ancla al mediodía en hora de Colombia; una con hora se respeta.
export function fechaDesdeCrm(
  valor: string | null,
  hora?: string | null,
): Date | null {
  if (!valor) return null;
  const dato = valor.trim();
  const co = dato.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso = co
    ? `${co[3]}-${co[2].padStart(2, "0")}-${co[1].padStart(2, "0")}`
    : dato;
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  // El formulario de HighLevel pregunta el día y la hora en campos separados.
  // Solo se juntan cuando el día viene sin hora propia: si el valor ya trae
  // hora, esa manda.
  const enPunto = soloDia ? horaDesdeCrm(hora) : null;
  const fecha = new Date(
    soloDia ? `${iso}T${enPunto ?? "12:00:00"}-05:00` : iso,
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/// ¿La hora de esta visita la dijo alguien, o es el mediodía de relleno?
///
/// `fechaDesdeCrm` cae en las 12:00 cuando no hay hora reconocible, y esa hora
/// **no es un dato**: significa «falta confirmar». Quien pinte la visita tiene
/// que poder distinguir las dos cosas, o el expediente acabará afirmando que se
/// pactó una visita a mediodía que nadie pactó.
export function horaConocidaDelCrm(
  valor: string | null,
  hora?: string | null,
): boolean {
  if (!valor) return false;
  const dato = valor.trim();
  const co = dato.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso = co
    ? `${co[3]}-${co[2].padStart(2, "0")}-${co[1].padStart(2, "0")}`
    : dato;
  // El día a secas no trae hora: depende del campo aparte. Cualquier otro
  // formato que Postgres acepte ya la lleva dentro.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return true;
  return horaDesdeCrm(hora) !== null;
}

/// La hora suelta que escribe la línea, en lo que Postgres entiende.
///
/// Se acepta como salga del formulario: «16:30», «4:30 pm», «4 p. m.», «8am».
/// Devuelve `null` si no se reconoce, y entonces la visita queda a mediodía —
/// es mejor una hora aproximada que una inventada.
export function horaDesdeCrm(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const dato = valor.trim().toLowerCase();
  if (!dato || dato.startsWith("{{")) return null;
  const partes = dato.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/);
  if (!partes) return null;

  let horas = Number(partes[1]);
  const minutos = Number(partes[2] ?? "0");
  if (!Number.isFinite(horas) || horas > 23 || minutos > 59) return null;

  const meridiano = partes[3]?.replace(/[.\s]/g, "");
  // «12 am» es medianoche y «12 pm» es mediodía: las dos son excepciones.
  if (meridiano === "pm" && horas < 12) horas += 12;
  if (meridiano === "am" && horas === 12) horas = 0;
  if (horas > 23) return null;

  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:00`;
}

const fechaValida = fechaDesdeCrm;

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
    /// Solo la ficha: gente del equipo o de la iglesia que no pasa por
    /// consolidación. Se crea la persona y su expediente, pero NO se abre
    /// Operación 72 ni se asigna consolidador; queda en Administración para
    /// darle rol y permisos.
    sinOperacion72?: boolean;
  },
) {
  const soloFicha = opciones.sinOperacion72 === true;
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

  const elegido = soloFicha
    ? null
    : fuerzaConsolidador
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

  if (!soloFicha) {
    await db.operation72.create({
      data: {
        learnerId: aprendiz.id,
        startedAt: ahora,
        deadlineAt,
        // Solo lo que el sistema sabe que hizo. El WhatsApp de bienvenida, si
        // sale, lo manda HighLevel por su cuenta: aquí no se puede afirmar.
        detail: elegido
          ? "Registrada · consolidador asignado"
          : "Registrada · sin consolidador disponible, requiere asignación de un líder",
        lineKnown: Boolean(invitador),
      },
    });
  }

  await db.milestone.createMany({
    data: [
      {
        learnerId: aprendiz.id,
        kind: MilestoneKind.REGISTRO,
        status: MilestoneStatus.COMPLETADO,
        achievedAt: ahora,
        recordedById: opciones.actorId,
      },
      ...(soloFicha
        ? []
        : [
            {
              learnerId: aprendiz.id,
              kind: MilestoneKind.OPERACION_72,
              status: MilestoneStatus.EN_CURSO,
              recordedById: opciones.actorId,
            },
          ]),
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
    sinOperacion72: soloFicha,
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

  await encolarEventoIntegracion(db, "aprendiz_creado", metadatosComunes);

  if (!soloFicha) {
    await auditar(db, {
      actorId: opciones.actorId,
      action: "operacion72.iniciada",
      entityType: "learner_profile",
      entityId: aprendiz.id,
      metadata: { deadlineAt: deadlineAt.toISOString() },
    });
    await encolarEventoIntegracion(db, "operacion72_iniciada", {
      learnerId: aprendiz.id,
      deadlineAt: deadlineAt.toISOString(),
    });
  }

  return { personId: persona.id, learnerId: aprendiz.id };
}
