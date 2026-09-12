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
import { enviarCorreoDeEntrega } from "@/lib/correo-entrega";
import { momentoDesdeCampo, ZONA_HORARIA } from "@/lib/dominio";
import {
  DONDE_PUEDE_MENTOREAR,
  ErrorDePermiso,
  puedeAutorizarBaja,
  puedeConfirmarEntrega,
  requerirPermisoEnAccion,
  puedeOperarOperacion72,
  puedeReasignarColumnaOp72,
  veTodaLaConsolidacion,
  type UsuarioSesion,
} from "@/lib/auth";
import { proponerMentor } from "@/lib/asignacion";
import {
  darDeBajaAprendiz,
  retirarSolicitudDeBaja,
  solicitarBaja,
} from "@/lib/baja";
import { marcarComoAsistente } from "@/lib/asistente";
import {
  anularVisitaEnHighLevel,
  exportarPrimeraLlamada,
  exportarVisita,
} from "@/lib/highlevel-salida";
import {
  contactaDeVerdad,
  DURACION_OPERACION_72_HORAS,
  ESTADOS_EN_TABLERO,
  ETIQUETA_COLUMNA,
  ETIQUETA_LLAMADA,
  MOTIVOS_DE_ASISTENTE,
  MOTIVOS_DE_BAJA,
  RESULTADOS_DE_LLAMADA,
} from "@/lib/op72";

/// El formulario da una fecha sin hora. Hoy conserva la hora real; un día
/// pasado se ancla al mediodía.
function fechaDeLaLlamada(fecha: string) {
  const ahora = new Date();
  const mes = `${ahora.getMonth() + 1}`.padStart(2, "0");
  const dia = `${ahora.getDate()}`.padStart(2, "0");
  const hoy = `${ahora.getFullYear()}-${mes}-${dia}`;
  if (fecha === hoy) return ahora;
  return new Date(`${fecha}T12:00:00`);
}

const FORMATO_VISITA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
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
    veTodaLaConsolidacion(usuario) ||
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
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
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
    // Mientras la persona espera contacto (INICIADA o SEGUIMIENTO), cada
    // llamada decide la columna: contestó → CONTACTADA; no contestó →
    // SEGUIMIENTO, para que quede claro que hay que volver a llamar y no se
    // confunda con quien nunca ha recibido un intento.
    const esperaContacto =
      operacion.status === Operation72Status.INICIADA ||
      operacion.status === Operation72Status.SEGUIMIENTO;
    const laLlamadaEsLoMasImportante =
      esperaContacto || operacion.status === Operation72Status.CONTACTADA;

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        ...(esperaContacto
          ? {
              status: contactada
                ? Operation72Status.CONTACTADA
                : Operation72Status.SEGUIMIENTO,
            }
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

  // Reflejo hacia HighLevel (best-effort, fuera de la transacción).
  await exportarPrimeraLlamada(operacion.learnerId, {
    resultado: datos.resultado,
    ocurrioEl,
    observacion,
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
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "Esta persona no está en tu lista." };
  if (operacion.status !== Operation72Status.CONTACTADA) {
    return { ok: false, mensaje: "Alguien más ya movió esta tarjeta. Actualiza el tablero." };
  }
  // `momentoDesdeCampo` y no `new Date`: el campo manda la hora SIN zona y el
  // servidor corre en UTC, así que `new Date` le restaba cinco horas a cada
  // visita (4:30 p. m. quedaba guardada como 11:30 a. m.).
  const cuando = momentoDesdeCampo(datos.cuando);
  if (!cuando) {
    return { ok: false, mensaje: "La fecha y hora de la visita no son válidas." };
  }
  if (!datos.virtual && !datos.lugar.trim()) {
    return { ok: false, mensaje: "Escribe el lugar, o marca que la visita es virtual." };
  }

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

  // Reflejo hacia HighLevel (best-effort, fuera de la transacción).
  await exportarVisita(operacion.learnerId, {
    cuando,
    virtual: datos.virtual,
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
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
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

/// Atajo para quien YA lleva proceso en la iglesia: pasa directo a LISTA PARA
/// ENTREGA, pendiente de que le asignen mentor.
///
/// **El problema que resuelve.** El tablero da por hecho que la persona es
/// nueva: hay que llamarla, acordar una visita y hacerla. Pero entra gente que
/// **ya se congrega y ya lleva un proceso** —hizo Alpha, está en una Casa de
/// Fe, se bautizó— y con ella esos tres pasos no tienen sentido: no hay nada
/// que averiguar por teléfono ni ninguna casa que visitar. Lo único que le
/// falta es **un mentor que la acompañe**. Sin este atajo había que fingir una
/// llamada y una visita que nunca ocurrieron para poder entregarla.
///
/// **Sirve desde CUALQUIER columna del tablero** (iniciada, seguimiento,
/// contactada o visita pendiente): que la persona ya esté en la iglesia no
/// depende de en qué casilla haya caído su tarjeta.
///
/// **⚠️ NO se inventa ninguna visita.** `cerrarVisita` deja un
/// `contact_attempt` de tipo VISITA con «Visita realizada», porque ahí sí se
/// hizo. Aquí no se hizo nada, así que **no se crea ningún intento**: lo que
/// pasó queda en `detail` (que es lo que lee el correo al mentor) y en la
/// auditoría. Escribir «visita realizada» aquí sería meter en el expediente
/// una visita que nadie hizo — el mismo error que evitan las otras acciones.
///
/// **Sí propone mentor**, igual que `cerrarVisita`, para que la tarjeta llegue
/// a la última columna con su candidato y solo haya que confirmarlo.
/// **Las cuatro columnas a las que un administrador puede devolver una
/// tarjeta.** No están LISTA_PARA_ENTREGA (para llegar ahí hay dos caminos
/// propios, que sí dejan rastro de por qué) ni ENTREGADA/CERRADA (se sale del
/// tablero por sus acciones, no a mano).
export const DESTINOS_REASIGNABLES: Operation72Status[] = [
  Operation72Status.INICIADA,
  Operation72Status.SEGUIMIENTO,
  Operation72Status.CONTACTADA,
  Operation72Status.VISITA_PENDIENTE,
];

/// **Devolver una tarjeta a la columna que le corresponde, cuando alguien se
/// equivocó de persona.** Solo administración.
///
/// **El caso que lo pidió (Francisco Sandoval, 12-sep-2026):** un consolidador
/// lo confundió con otra persona y su nota lo mandó a LISTA PARA ENTREGA. El
/// tablero no tenía forma de devolverlo: `deshacerVisitaAgendada` solo sirve
/// desde VISITA_PENDIENTE y solo devuelve a CONTACTADA, y las demás acciones
/// únicamente avanzan. La única salida era dejarlo esperando un mentor que no
/// le correspondía.
///
/// **⚠️ NO SE INVENTA NINGUNA LLAMADA.** Mover a SEGUIMIENTO o CONTACTADA no
/// crea ningún `contact_attempt`: escribir una llamada que nadie hizo es el
/// error que evitan todas las acciones de esta pantalla. Lo que queda es la
/// nota y la auditoría. La excepción es VISITA_PENDIENTE, que **sí** pide
/// fecha, hora y lugar (decisión del usuario) — si se pone a alguien ahí es
/// porque hay una visita acordada, y sin ella la tarjeta caería al final de la
/// columna sin decir cuándo es, porque esa columna se ordena por fecha de
/// visita.
///
/// **⚠️ EL PLAZO SE REINICIA a 72 horas desde hoy** (decisión del usuario).
/// Francisco tenía plazo del 29-ago, vencido hacía dos semanas; devolverlo con
/// ese plazo lo habría dejado naciendo vencido, sin margen para atenderlo.
export async function reasignarColumnaOp72(
  operacionId: string,
  datos: {
    destino: string;
    nota: string;
    visita?: { cuando: string; lugar: string; virtual: boolean };
  },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeReasignarColumnaOp72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const destino = DESTINOS_REASIGNABLES.find((e) => e === datos.destino);
  if (!destino) return { ok: false, mensaje: "Elige a qué columna la devuelves." };

  const nota = datos.nota.trim();
  if (nota.length < 10) {
    return {
      ok: false,
      mensaje: "Escribe por qué la devuelves (mínimo 10 caracteres).",
    };
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "No encontramos esta persona." };
  // `ESTADOS_EN_TABLERO` es una tupla readonly más estrecha que el union de
  // estados, así que `includes` la rechaza. Se copia a un arreglo del tipo
  // ancho (misma trampa que el 11-sep con las cuatro columnas).
  const enElTablero: Operation72Status[] = [...ESTADOS_EN_TABLERO];
  if (!enElTablero.includes(operacion.status)) {
    return {
      ok: false,
      mensaje: "Esta persona ya salió del tablero; no se puede reasignar aquí.",
    };
  }
  if (operacion.status === destino) {
    return { ok: false, mensaje: "Ya está en esa columna." };
  }

  // La visita solo se pide —y solo se acepta— cuando el destino la necesita.
  let cuando: Date | null = null;
  let lugar: string | null = null;
  const virtual = destino === Operation72Status.VISITA_PENDIENTE
    ? Boolean(datos.visita?.virtual)
    : false;

  if (destino === Operation72Status.VISITA_PENDIENTE) {
    cuando = momentoDesdeCampo(datos.visita?.cuando ?? "");
    if (!cuando) {
      return { ok: false, mensaje: "La fecha y hora de la visita no son válidas." };
    }
    if (!virtual && !(datos.visita?.lugar ?? "").trim()) {
      return { ok: false, mensaje: "Escribe el lugar, o marca que la visita es virtual." };
    }
    lugar = virtual ? null : (datos.visita?.lugar ?? "").trim();
  }

  // Si venía con una visita acordada y se va a otra columna, esa visita deja de
  // estar en pie: se ANULA (no se borra) y se limpia el CRM. Sin esto el equipo
  // de consolidación, que trabaja solo con HighLevel, seguiría viendo «visita
  // confirmada» e iría a visitar a alguien que ya no la tiene.
  const salíaDeVisita =
    operacion.status === Operation72Status.VISITA_PENDIENTE &&
    destino !== Operation72Status.VISITA_PENDIENTE;

  const desde = operacion.status;
  const plazo = new Date(Date.now() + DURACION_OPERACION_72_HORAS * 3_600_000);
  const prisma = await getPrisma();

  await prisma.$transaction(async (tx) => {
    if (salíaDeVisita) {
      const viva = await tx.contactAttempt.findFirst({
        where: {
          operation72Id: operacion.id,
          type: ContactType.VISITA,
          scheduledAt: { not: null },
          annulledAt: null,
        },
        orderBy: { occurredAt: "desc" },
        select: { id: true },
      });
      if (viva) {
        await tx.contactAttempt.update({
          where: { id: viva.id },
          data: {
            annulledAt: new Date(),
            annulledById: usuario.id,
            annulledReason: `La tarjeta se devolvió a ${ETIQUETA_COLUMNA[destino]}: ${nota}`,
          },
        });
      }
    }

    if (cuando) {
      await tx.contactAttempt.create({
        data: {
          operation72Id: operacion.id,
          type: ContactType.VISITA,
          result: "Visita agendada",
          note: nota,
          scheduledAt: cuando,
          place: lugar,
          isVirtual: virtual,
          byUserId: usuario.id,
        },
      });
    }

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: destino,
        // El plazo se cuenta de nuevo: lo que se mide es la respuesta del
        // equipo desde que la tarjeta vuelve a estar en su sitio.
        deadlineAt: plazo,
        detail: cuando
          ? [`Visita ${FORMATO_VISITA.format(cuando)}`, virtual ? "virtual" : lugar]
              .filter(Boolean)
              .join(" · ")
          : `Devuelta a ${ETIQUETA_COLUMNA[destino]} por administración · ${nota}`,
        // Lo que traía de la entrega deja de valer: el mentor propuesto era
        // para un proceso que no le correspondía, y la nota de «ya lleva
        // proceso» era justamente el dato equivocado.
        proposedMentorId: null,
        proposedMentorNote: null,
        priorProcessNote: null,
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.columna_reasignada",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: {
        desde,
        hasta: destino,
        nota,
        plazoNuevo: plazo.toISOString(),
        ...(cuando ? { visita: cuando.toISOString(), virtual, lugar } : {}),
        ...(salíaDeVisita ? { visitaAnulada: true } : {}),
      },
    });
  });

  // Reflejo a HighLevel, best-effort y fuera de la transacción (es red).
  if (cuando) {
    await exportarVisita(operacion.learnerId, { cuando, virtual });
  } else if (salíaDeVisita) {
    await anularVisitaEnHighLevel(operacion.learnerId);
  }

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${operacion.learnerId}`);
  return { ok: true };
}

export async function pasarAEntregaPorProcesoPrevio(
  operacionId: string,
  datos: { nota: string },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "Esta persona no está en tu lista." };
  if (operacion.status === Operation72Status.LISTA_PARA_ENTREGA) {
    return { ok: false, mensaje: "Ya está lista para entrega: solo falta asignarle mentor." };
  }
  // Las cuatro columnas desde las que aplica, escritas una por una a
  // propósito: una tarjeta ENTREGADA o CERRADA ya salió del tablero.
  const enElTablero: Operation72Status[] = [
    Operation72Status.INICIADA,
    Operation72Status.SEGUIMIENTO,
    Operation72Status.CONTACTADA,
    Operation72Status.VISITA_PENDIENTE,
  ];
  if (!enElTablero.includes(operacion.status)) {
    return { ok: false, mensaje: "Alguien más ya movió esta tarjeta. Actualiza el tablero." };
  }

  // Es lo que va a leer el mentor en el correo de entrega, y lo único que le
  // explica por qué esta persona llegó sin llamada ni visita.
  const nota = datos.nota.trim();
  if (nota.length < 10) {
    return {
      ok: false,
      mensaje: "Cuenta qué proceso lleva ya: es lo que va a leer el mentor que la reciba.",
    };
  }

  const prisma = await getPrisma();
  const estadoAnterior = operacion.status;

  await prisma.$transaction(async (tx) => {
    const propuesta = await proponerMentor(tx, operacion.learnerId);

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: Operation72Status.LISTA_PARA_ENTREGA,
        detail: `Ya lleva proceso en la iglesia · ${nota}`,
        // Además de `detail`, en su propia columna: `detail` lo reescribe la
        // siguiente acción, y esto tiene que llegarle al mentor.
        priorProcessNote: nota,
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
      action: "operacion72.pasa_a_entrega_por_proceso_previo",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: { nota, desde: estadoAnterior },
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
  mentorElegidoId?: string,
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
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

  const prisma = await getPrisma();
  const elegido = mentorElegidoId?.trim();

  // Dos caminos: el mentor propuesto por el sistema (según la línea/perfil), o
  // uno escogido a mano de entre los mentores válidos. Escoger a mano no
  // requiere línea conocida; la persona la elige quien entrega.
  let mentorId: string;
  let conservaLinea: boolean;

  if (elegido) {
    const mentor = await prisma.appUser.findFirst({
      where: {
        id: elegido,
        active: true,
        ...DONDE_PUEDE_MENTOREAR,
      },
      select: { id: true },
    });
    if (!mentor) {
      return {
        ok: false,
        mensaje:
          "Ese mentor no es válido: debe tener rol de mentor, pastor o administrador y estar activo.",
      };
    }
    mentorId = mentor.id;
    conservaLinea = false;
  } else {
    if (!operacion.proposedMentorId) {
      return {
        ok: false,
        mensaje:
          "No hay mentor propuesto con cupo. Escoge un mentor de la lista para entregar.",
      };
    }
    // Sin línea conocida, la asignación por perfil la confirma un líder.
    if (!operacion.lineKnown && !puedeConfirmarEntrega(usuario)) {
      return {
        ok: false,
        mensaje:
          "Sin línea conocida la entrega la confirma un líder. Avísale para que la apruebe.",
      };
    }
    mentorId = operacion.proposedMentorId;
    conservaLinea = operacion.lineKnown;
  }

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.mentorRelationship.create({
      data: {
        learnerId: operacion.learnerId,
        mentorId,
        startedAt: ahora,
        reason: "Entrega desde Operación 72",
        authorizedById: usuario.id,
        keepsLine: conservaLinea,
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
      metadata: { mentorId },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "mentor.asignado",
      entityType: "learner_profile",
      entityId: operacion.learnerId,
      metadata: { mentorId, conservaLinea },
    });

    await encolarEventoIntegracion(tx, "mentor_asignado", {
      learnerId: operacion.learnerId,
      mentorId,
    });
  });

  // El mentor recibe por correo quién es, qué le pedimos y cómo le fue en
  // Operación 72 (best-effort: si el correo falla, la entrega ya quedó hecha).
  await enviarCorreoDeEntrega(prisma, {
    learnerId: operacion.learnerId,
    mentorId,
    entregadaPorId: usuario.id,
    conservaLinea,
  });

  revalidatePath("/operacion-72");
  return { ok: true };
}

/// Pide (o aplica) la baja desde el tablero.
///
/// **Quién puede autorizar la aplica directo; los demás la piden.** Nadie sale
/// del sistema sin que un administrador haya visto el motivo, y pedirla no
/// saca a la persona del tablero: sigue en la lista y en la carga de su
/// consolidador hasta que haya respuesta.
///
/// Alcance: el mismo de las demás acciones del tablero — un consolidador solo
/// sobre sus personas; coordinación, pastor y administrador sobre cualquiera.
/// El motivo viene de una lista cerrada para poder contar después por qué se
/// pierden personas.
export async function darDeBajaDesdeTablero(
  learnerId: string,
  datos: { motivo: string; nota: string },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  if (!(MOTIVOS_DE_BAJA as readonly string[]).includes(datos.motivo)) {
    return { ok: false, mensaje: "Elige un motivo de la lista." };
  }

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { consolidatorId: true },
  });
  const esSuya =
    aprendiz &&
    (usuario.role !== Role.CONSOLIDADOR ||
      veTodaLaConsolidacion(usuario) ||
      aprendiz.consolidatorId === usuario.id);
  if (!esSuya) return { ok: false, mensaje: "Esta persona no está en tu lista." };

  const resultado = puedeAutorizarBaja(usuario)
    ? await darDeBajaAprendiz(prisma, {
        learnerId,
        motivo: datos.motivo,
        nota: datos.nota,
        actorId: usuario.id,
        accion: "operacion72.dado_de_baja",
      })
    : await solicitarBaja(prisma, {
        learnerId,
        motivo: datos.motivo,
        nota: datos.nota,
        actorId: usuario.id,
      });
  if (!resultado.ok) return resultado;

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${learnerId}`);
  revalidatePath("/administracion");
  revalidatePath("/administracion/bajas");
  return { ok: true };
}

/// Mueve una visita ya acordada a otra fecha y hora.
///
/// **Lo que se pactó no se borra: se apila.** Cada reprogramación crea su
/// propio intento, así que en el expediente queda «se acordó para el 12, no se
/// pudo, se movió al 15». Si se sobrescribiera la visita anterior, nadie podría
/// ver después cuántas veces se corrió una visita — que es justo la señal de
/// que algo no está funcionando con esa persona.
///
/// La tarjeta se queda en VISITA PENDIENTE: no es un paso adelante ni atrás.
export async function reprogramarVisita(
  operacionId: string,
  datos: {
    cuando: string;
    lugar: string;
    virtual: boolean;
    nota: string;
    /// `movida` = la visita estaba pactada y se corrió · `correccion` = la
    /// fecha estaba mal escrita y nunca hubo visita a esa hora.
    motivo: "movida" | "correccion";
  },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "Esta persona no está en tu lista." };
  if (operacion.status !== Operation72Status.VISITA_PENDIENTE) {
    return { ok: false, mensaje: "Alguien más ya movió esta tarjeta. Actualiza el tablero." };
  }
  // `momentoDesdeCampo` y no `new Date`: el campo manda la hora SIN zona y el
  // servidor corre en UTC, así que `new Date` le restaba cinco horas a cada
  // visita (4:30 p. m. quedaba guardada como 11:30 a. m.).
  const cuando = momentoDesdeCampo(datos.cuando);
  if (!cuando) {
    return { ok: false, mensaje: "La fecha y hora de la visita no son válidas." };
  }
  if (!datos.virtual && !datos.lugar.trim()) {
    return { ok: false, mensaje: "Escribe el lugar, o marca que la visita es virtual." };
  }

  const lugar = datos.virtual ? null : datos.lugar.trim();
  const nota = datos.nota.trim() || null;
  const prisma = await getPrisma();

  // La visita que estaba acordada: de dónde se movió, o qué quedó mal escrito.
  const anterior = await prisma.contactAttempt.findFirst({
    where: {
      operation72Id: operacion.id,
      type: ContactType.VISITA,
      scheduledAt: { not: null },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, scheduledAt: true },
  });
  const corregir = datos.motivo === "correccion";

  await prisma.$transaction(async (tx) => {
    if (corregir && anterior) {
      // Un error de digitación se ARREGLA, no se apila: nunca hubo una visita
      // a esa hora, así que dejar un «se reprogramó» inventaría un movimiento
      // que no pasó. La corrección queda en la auditoría, que es su sitio.
      await tx.contactAttempt.update({
        where: { id: anterior.id },
        data: {
          scheduledAt: cuando,
          place: lugar,
          isVirtual: datos.virtual,
          ...(nota ? { note: nota } : {}),
        },
      });
    } else {
      await tx.contactAttempt.create({
        data: {
          operation72Id: operacion.id,
          type: ContactType.VISITA,
          result: anterior?.scheduledAt
            ? `Visita reprogramada · antes era el ${FORMATO_VISITA.format(anterior.scheduledAt)}`
            : "Visita reprogramada",
          note: nota,
          scheduledAt: cuando,
          place: lugar,
          isVirtual: datos.virtual,
          byUserId: usuario.id,
        },
      });
    }

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
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
      action: corregir
        ? "operacion72.visita_corregida"
        : "operacion72.visita_reprogramada",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: {
        cuando: cuando.toISOString(),
        antes: anterior?.scheduledAt?.toISOString() ?? null,
        virtual: datos.virtual,
        lugar,
      },
    });
  });

  // Reflejo hacia HighLevel (best-effort, fuera de la transacción).
  await exportarVisita(operacion.learnerId, { cuando, virtual: datos.virtual });

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${operacion.learnerId}`);
  return { ok: true };
}

/// Deshace una visita que se le agendó a la persona equivocada.
///
/// **Es el tercer caso de «cambiar una visita», y no se parece a los otros
/// dos.** «Se movió» apila un registro nuevo porque la visita existía y se
/// corrió; «la fecha estaba mal escrita» corrige en su sitio porque la visita
/// existía a otra hora. Aquí **la visita nunca existió para esta persona**: se
/// le apuntó a quien no era.
///
/// Por eso el registro **se anula, no se borra**. Anulado deja de pintar en la
/// tarjeta y de ordenar la columna —que es lo que había que arreglar— pero
/// sigue visible, tachado, en el expediente. Borrarlo dejaría a la ficha sin
/// ninguna explicación de por qué la tarjeta se movió y volvió, y eso es
/// exactamente lo que alguien va a querer entender dentro de seis meses.
///
/// **Vuelve a CONTACTADA, no a INICIADA ni a SEGUIMIENTO** (decisión del
/// usuario, 11-sep): la llamada a esta persona sí ocurrió y ya se habló con
/// ella. Devolverla al principio la pondría otra vez en la fila de «hay que
/// llamarla», que es falso, y le borraría de la vista el contacto que sí tuvo.
///
/// **La llamada de ese mismo envío se conserva** (decisión del usuario, mismo
/// día): alguien marcó y alguien habló — lo que se equivocó fue a qué ficha se
/// le apuntó la visita. Anularla le quitaría a esta persona un contacto que de
/// verdad recibió y la dejaría pareciendo desatendida.
export async function deshacerVisitaAgendada(
  operacionId: string,
  datos: { motivo: string },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const operacion = await cargarOperacion(operacionId, usuario);
  if (!operacion) return { ok: false, mensaje: "Esta persona no está en tu lista." };
  if (operacion.status !== Operation72Status.VISITA_PENDIENTE) {
    return { ok: false, mensaje: "Alguien más ya movió esta tarjeta. Actualiza el tablero." };
  }

  // Corto, pero obligatorio: quien lea el expediente tachado después necesita
  // saber qué pasó, y «se agendó por error» a secas no dice nada.
  const motivo = datos.motivo.trim();
  if (motivo.length < 10) {
    return {
      ok: false,
      mensaje: "Cuenta en una línea qué pasó: es lo que va a leer quien abra el expediente.",
    };
  }

  const prisma = await getPrisma();
  const visita = await prisma.contactAttempt.findFirst({
    where: {
      operation72Id: operacion.id,
      type: ContactType.VISITA,
      scheduledAt: { not: null },
      annulledAt: null,
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, scheduledAt: true },
  });
  if (!visita) {
    return {
      ok: false,
      mensaje: "Esta tarjeta no tiene una visita acordada que deshacer.",
    };
  }

  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.contactAttempt.update({
      where: { id: visita.id },
      data: {
        annulledAt: ahora,
        annulledById: usuario.id,
        annulledReason: motivo,
      },
    });

    await tx.operation72.update({
      where: { id: operacion.id },
      data: {
        status: Operation72Status.CONTACTADA,
        detail: "La visita se había agendado por error · acordar visita",
      },
    });

    await auditar(tx, {
      actorId: usuario.id,
      action: "operacion72.visita_anulada",
      entityType: "operation72",
      entityId: operacion.id,
      metadata: {
        visitaEra: visita.scheduledAt?.toISOString() ?? null,
        motivo,
      },
    });
  });

  // El CRM seguiría diciendo «visita confirmada» con su fecha, y el equipo
  // trabaja solo con el CRM: iría a visitar a quien no era.
  await anularVisitaEnHighLevel(operacion.learnerId);

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${operacion.learnerId}`);
  return { ok: true };
}

/// Marca a la persona como asistente de la iglesia desde el tablero.
///
/// **No pide autorización, a diferencia de la baja**, y la razón es la que
/// distingue las dos cosas: dar de baja saca a alguien del sistema y le apaga
/// el acceso, así que hacen falta dos manos; esto solo reconoce que hoy no
/// quiere proceso. Sigue en la casa, con su expediente y su acceso intactos, y
/// se le puede devolver al proceso con un clic desde Administración.
export async function marcarAsistenteDesdeTablero(
  learnerId: string,
  datos: { motivo: string; nota: string },
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  if (!(MOTIVOS_DE_ASISTENTE as readonly string[]).includes(datos.motivo)) {
    return { ok: false, mensaje: "Elige un motivo de la lista." };
  }

  const prisma = await getPrisma();
  const aprendiz = await prisma.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { consolidatorId: true },
  });
  // El mismo alcance que las demás acciones del tablero: un consolidador solo
  // toca a los suyos.
  const esSuya =
    aprendiz &&
    (usuario.role !== Role.CONSOLIDADOR ||
      veTodaLaConsolidacion(usuario) ||
      aprendiz.consolidatorId === usuario.id);
  if (!esSuya) return { ok: false, mensaje: "Esta persona no está en tu lista." };

  const resultado = await marcarComoAsistente(prisma, {
    learnerId,
    motivo: datos.motivo,
    nota: datos.nota,
    actorId: usuario.id,
  });
  if (!resultado.ok) return resultado;

  revalidatePath("/operacion-72");
  revalidatePath(`/expediente/${learnerId}`);
  revalidatePath("/administracion");
  revalidatePath("/administracion/asistentes");
  return { ok: true };
}

/// El consolidador se arrepiente antes de que le respondan. Mismo alcance que
/// pedirla: solo sobre sus personas.
export async function retirarSolicitudDesdeTablero(
  solicitudId: string,
): Promise<ResultadoAccion> {
  let usuario: UsuarioSesion;
  try {
    usuario = await requerirPermisoEnAccion(puedeOperarOperacion72);
  } catch (error) {
    if (error instanceof ErrorDePermiso) return { ok: false, mensaje: error.message };
    throw error;
  }

  const prisma = await getPrisma();
  const solicitud = await prisma.bajaRequest.findUnique({
    where: { id: solicitudId },
    select: { learnerId: true, learner: { select: { consolidatorId: true } } },
  });
  if (!solicitud) return { ok: false, mensaje: "No se encontró la solicitud." };

  const esSuya =
    usuario.role !== Role.CONSOLIDADOR ||
    veTodaLaConsolidacion(usuario) ||
    solicitud.learner.consolidatorId === usuario.id;
  if (!esSuya) return { ok: false, mensaje: "Esta persona no está en tu lista." };

  const resultado = await retirarSolicitudDeBaja(prisma, {
    solicitudId,
    actorId: usuario.id,
  });
  if (!resultado.ok) return resultado;

  revalidatePath("/operacion-72");
  revalidatePath("/administracion/bajas");
  return { ok: true };
}
