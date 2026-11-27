import { ContactType, Gender } from "@iglesia/prisma-client";
import { auditar } from "@/lib/audit";
import { correoEntregaAMentor, type ResultadoCorreo } from "@/lib/correo";
import { variableDeWhatsAppDeLaEntrega } from "@/lib/entrega-a-mentor-catalogo";
import { exportarEntregaAMentor } from "@/lib/highlevel-salida";
import {
  momentoLegible,
  nombreCompleto,
  telefonoLegible,
  textoDeAsistenciaIglesia,
  textoDeEntrada,
  textoDeHorario,
} from "@/lib/dominio";
import { edadDesde, tituloDelMovimiento } from "@/lib/op72";
import type { ClientePrisma } from "@/lib/prisma";

/// **Avisa al mentor de que acaba de recibir a una persona, por los dos
/// canales.** Es el mismo aviso se entregue desde el tablero o desde
/// Administración — los dos sitios llaman aquí.
///
/// - **Por correo**, el aviso completo: quién es, qué le pedimos, cómo le fue
///   en Operación 72 y su petición de oración.
/// - **Por WhatsApp** (27-nov-2026), el toque en el bolsillo: a quién y su
///   número, que es lo único que hace falta para la primera tarea que le
///   pedimos, llamar.
///
/// ⚠️ **Se llamaba `enviarCorreoDeEntrega` y se renombró el día que empezó a
/// mandar WhatsApp.** Un nombre que afirma menos de lo que hace es cómo se
/// pierde un canal entero sin que nadie lo note — es la familia de
/// `acceso_enviado`, que afirmaba un hecho que no era nuestro (§12.6).
///
/// Las notas pastorales (privadas) NO viajan: se ven en el expediente, donde
/// cada apertura queda auditada. Las observaciones de llamadas y visitas sí,
/// porque son operativas y el mentor las necesita para saber por dónde seguir.
/// Y por WhatsApp no viaja ninguna de las dos: un WhatsApp se lee en la
/// pantalla de bloqueo, y ahí solo van el nombre y el número.
///
/// Devuelve el resultado del **correo**, que es lo que las pantallas pintan; el
/// del WhatsApp queda en `mentor.entrega_encargada`, en la auditoría.
export async function avisarAlMentorDeLaEntrega(
  prisma: ClientePrisma,
  datos: {
    learnerId: string;
    mentorId: string;
    entregadaPorId: string | null;
    conservaLinea: boolean;
  },
): Promise<ResultadoCorreo> {
  const ahora = new Date();
  const [mentor, aprendiz, entregadaPor] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: datos.mentorId },
      select: {
        email: true,
        fullName: true,
        // Para el WhatsApp: su contacto del CRM y sus NOMBRES enteros. Va en
        // esta misma consulta a propósito — con `PrismaPg max: 1` cada viaje de
        // más es una latencia de más (§12.5), y aquí no cuesta ninguno.
        person: {
          select: {
            firstName: true,
            highLevelContacts: { select: { contactId: true }, take: 1 },
          },
        },
      },
    }),
    prisma.learnerProfile.findUnique({
      where: { id: datos.learnerId },
      select: {
        id: true,
        entryPoint: true,
        entryPointOther: true,
        lineOfOrigin: true,
        churchAttendance: true,
        churchName: true,
        consolidator: { select: { fullName: true } },
        personId: true,
        person: {
          select: {
            firstName: true,
            lastName: true,
            gender: true,
            birthDate: true,
            callPhone: true,
            whatsappPhone: true,
            callSchedules: true,
            callScheduleNote: true,
            prayerRequest: true,
          },
        },
        operation72: {
          select: {
            startedAt: true,
            deliveredAt: true,
            priorProcessNote: true,
            attempts: {
              // Sin las anuladas: el correo le cuenta al mentor lo que pasó de
              // verdad con esta persona, y una visita retirada por haberse
              // apuntado a quien no era le haría perder el tiempo buscándola.
              where: { annulledAt: null },
              orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
              select: {
                type: true,
                outcome: true,
                result: true,
                note: true,
                occurredAt: true,
                scheduledAt: true,
                place: true,
                isVirtual: true,
                byUser: { select: { fullName: true } },
              },
            },
          },
        },
      },
    }),
    datos.entregadaPorId
      ? prisma.appUser.findUnique({
          where: { id: datos.entregadaPorId },
          select: { fullName: true },
        })
      : null,
  ]);

  if (!mentor || !aprendiz) {
    return { enviado: false, motivo: "no se encontró al mentor o a la persona." };
  }

  const persona = aprendiz.person;
  const nombre = nombreCompleto(persona);
  const edad = edadDesde(persona.birthDate, ahora);
  const op = aprendiz.operation72;

  // Quién la consolidó y cuándo la entregó.
  const consolido = [
    aprendiz.consolidator?.fullName ?? null,
    op?.deliveredAt ? `entregada el ${momentoLegible(op.deliveredAt, ahora)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const invito = aprendiz.lineOfOrigin?.trim()
    ? `${aprendiz.lineOfOrigin.trim()}${datos.conservaLinea ? " · se conserva su línea" : ""}`
    : null;

  const iglesia = aprendiz.churchAttendance
    ? [textoDeAsistenciaIglesia(aprendiz.churchAttendance), aprendiz.churchName?.trim()]
        .filter(Boolean)
        .join(" · ")
    : null;

  const quienEs = [
    { rotulo: "Consolidó", valor: consolido || null },
    { rotulo: "Celular", valor: telefonoLegible(persona.callPhone ?? persona.whatsappPhone) },
    { rotulo: "Llamar", valor: textoDeHorario(persona.callSchedules, persona.callScheduleNote) },
    { rotulo: "Edad", valor: edad !== null ? `${edad} años` : null },
    { rotulo: persona.gender === Gender.HOMBRE ? "Lo invitó" : "La invitó", valor: invito },
    {
      rotulo: "Llegó por",
      valor: aprendiz.entryPoint
        ? textoDeEntrada(aprendiz.entryPoint, aprendiz.entryPointOther)
        : null,
    },
    { rotulo: "Iglesia", valor: iglesia },
    // Va aquí, y no en el historial, porque no es algo que haya pasado en una
    // fecha: es quién es esta persona. Y es lo que explica por qué llega sin
    // llamada ni visita — sin esto, el mentor recibiría un historial casi
    // vacío y no sabría por qué.
    { rotulo: "Ya lleva proceso", valor: op?.priorProcessNote?.trim() ?? "" },
  ].filter((fila): fila is { rotulo: string; valor: string } => Boolean(fila.valor));

  // El historial de Operación 72, del registro a la entrega, tal cual quedó.
  const historial: {
    titulo: string;
    quien: string | null;
    cuando: string;
    observacion: string | null;
  }[] = [];
  if (op) {
    historial.push({
      titulo: "Registrada en Iglesia Vive",
      quien: aprendiz.lineOfOrigin?.trim() ? `invitada por ${aprendiz.lineOfOrigin.trim()}` : null,
      cuando: momentoLegible(op.startedAt, ahora),
      observacion: null,
    });
    let llamadasPrevias = 0;
    for (const intento of op.attempts) {
      const esLlamada =
        intento.type === ContactType.LLAMADA || intento.type === ContactType.INTENTO_LLAMADA;
      let titulo = tituloDelMovimiento({
        type: intento.type,
        outcome: intento.outcome,
        result: intento.result,
        intentosPrevios: llamadasPrevias,
      });
      if (esLlamada) llamadasPrevias += 1;
      if (intento.type === ContactType.VISITA && intento.result === "Visita realizada") {
        titulo = "Visita realizada";
      } else if (intento.type === ContactType.VISITA && intento.scheduledAt) {
        titulo = `Visita agendada · ${momentoLegible(intento.scheduledAt, ahora)}${
          intento.isVirtual ? " · virtual" : intento.place ? ` · ${intento.place}` : ""
        }`;
      }
      historial.push({
        titulo,
        quien:
          intento.byUser?.fullName ??
          (intento.type === ContactType.VISITA ? "La línea, desde el CRM" : null),
        cuando: momentoLegible(intento.occurredAt, ahora),
        observacion: intento.note?.trim() || null,
      });
    }
  }

  const correo = await correoEntregaAMentor({
    to: mentor.email,
    mentorNombre: mentor.fullName,
    personaNombre: nombre,
    genero: persona.gender,
    entregadaPor: entregadaPor?.fullName ?? null,
    quienEs,
    historial,
    peticionDeOracion: persona.prayerRequest?.trim() || null,
    learnerId: aprendiz.id,
    registro: {
      prisma,
      tipo: "entrega_a_mentor",
      personId: aprendiz.personId,
      learnerId: aprendiz.id,
      actorId: datos.entregadaPorId,
    },
  });

  // --- Y el toque en el bolsillo, por WhatsApp.
  //
  // El correo es el aviso completo; esto es lo único que hace falta para
  // empezar: a quién y su número. Sale **uno por entrega** (decisión del
  // usuario, 27-nov), y el porqué, con su medida, está en
  // `exportarEntregaAMentor`.
  //
  // ⚠️ **Best-effort, y después del correo a propósito.** La entrega ya está
  // hecha y el correo ya salió: que el CRM falle no puede deshacer ninguna de
  // las dos. Por eso no lanza, devuelve.
  const contactId = mentor.person?.highLevelContacts[0]?.contactId ?? null;
  let whatsapp: { ok: true } | { ok: false; motivo: string };
  if (!contactId) {
    // Pasa con «Administración Iglesia Vive», la cuenta del sistema: no tiene
    // ficha ni contacto en el CRM. Era 1 de las 171 entregas de la historia.
    whatsapp = { ok: false, motivo: "el mentor no tiene contacto en HighLevel" };
  } else {
    whatsapp = await exportarEntregaAMentor(
      contactId,
      variableDeWhatsAppDeLaEntrega({
        personaNombre: nombre,
        genero: persona.gender,
        celular: telefonoLegible(persona.whatsappPhone ?? persona.callPhone),
      }),
      mentor.person?.firstName ?? "",
    );
  }

  // ⚠️ **Se audita lo que de verdad hicimos, no lo que esperamos que pase
  // después** (§12.6). «Encargada» es cierto: escribimos el campo y movimos la
  // etiqueta. Que el WhatsApp SALGA lo decide HighLevel con Meta, y eso solo
  // se sabe leyendo el historial de conversaciones del CRM (§12.8).
  await auditar(prisma, {
    actorId: datos.entregadaPorId,
    action: "mentor.entrega_encargada",
    entityType: "learner_profile",
    entityId: aprendiz.id,
    metadata: {
      mentorId: datos.mentorId,
      porWhatsapp: whatsapp.ok,
      motivo: whatsapp.ok ? null : whatsapp.motivo,
    },
  });

  return correo;
}
