import { ContactType, Gender } from "@iglesia/prisma-client";
import { correoEntregaAMentor, type ResultadoCorreo } from "@/lib/correo";
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

/// Arma y envía el correo con el que el mentor recibe a una persona: quién es,
/// qué le pedimos, cómo le fue en Operación 72 y su petición de oración. Es el
/// mismo correo se entregue desde el tablero o desde Administración.
///
/// Las notas pastorales (privadas) NO viajan: se ven en el expediente, donde
/// cada apertura queda auditada. Las observaciones de llamadas y visitas sí,
/// porque son operativas y el mentor las necesita para saber por dónde seguir.
export async function enviarCorreoDeEntrega(
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
      select: { email: true, fullName: true },
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
            attempts: {
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

  return correoEntregaAMentor({
    to: mentor.email,
    mentorNombre: mentor.fullName,
    personaNombre: nombre,
    genero: persona.gender,
    entregadaPor: entregadaPor?.fullName ?? null,
    quienEs,
    historial,
    peticionDeOracion: persona.prayerRequest?.trim() || null,
    learnerId: aprendiz.id,
  });
}
