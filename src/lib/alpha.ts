import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import type { UsuarioSesion } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";

/// Referencia del §5.7: 12 sesiones en unos 3 meses.
export const SESIONES_DE_ALPHA = 12;

/// Condición mínima de cierre: asistencia >= 60 %, Focus Day completado y
/// validación final del líder. El sistema no promueve a nadie solo.
export const ASISTENCIA_MINIMA = 0.6;

export type ParticipanteDeAlpha = {
  enrollmentId: string;
  learnerId: string;
  nombre: string;
  presentes: number;
  sesionesRealizadas: number;
  porcentaje: number;
  cumpleAsistencia: boolean;
  focusDay: Date | null;
  validadoEl: Date | null;
  validadoPor: string | null;
  notaDeValidacion: string | null;
  puedeValidarse: boolean;
  faltaParaValidar: string[];
};

/// Quién administra grupos de Alpha (§3.3). Pastor y administración además ven
/// todos los grupos.
export function puedeAdministrarAlpha(usuario: UsuarioSesion) {
  return (
    usuario.role === Role.LIDER_ALPHA ||
    usuario.role === Role.PASTOR ||
    usuario.role === Role.ADMIN
  );
}

export function esVistaCompletaDeAlpha(usuario: UsuarioSesion) {
  return usuario.role === Role.PASTOR || usuario.role === Role.ADMIN;
}

export async function cargarGrupos(usuario: UsuarioSesion) {
  const prisma = await getPrisma();

  const grupos = await prisma.alphaProgram.findMany({
    where: esVistaCompletaDeAlpha(usuario) ? {} : { leaderId: usuario.id },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      closedAt: true,
      leader: { select: { fullName: true } },
      _count: { select: { sessions: true, enrollments: true } },
    },
  });

  return grupos;
}

export async function cargarGrupo(programId: string) {
  const prisma = await getPrisma();

  return prisma.alphaProgram.findUnique({
    where: { id: programId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      closedAt: true,
      leaderId: true,
      leader: { select: { fullName: true } },
      sessions: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          date: true,
          topic: true,
          attendance: {
            select: {
              enrollmentId: true,
              present: true,
              note: true,
            },
          },
        },
      },
      enrollments: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          learnerId: true,
          focusDayAt: true,
          validatedAt: true,
          validationNote: true,
          validatedBy: { select: { fullName: true } },
          learner: {
            select: { person: { select: { firstName: true, lastName: true } } },
          },
          attendance: { select: { present: true, sessionId: true } },
        },
      },
    },
  });
}

export type DatosGrupo = NonNullable<Awaited<ReturnType<typeof cargarGrupo>>>;

/// Solo cuentan las sesiones ya realizadas: la asistencia de una persona no
/// puede castigarse por sesiones que todavía no ocurrieron.
export function construirParticipantes(
  grupo: DatosGrupo,
  ahora = new Date(),
): ParticipanteDeAlpha[] {
  const sesionesRealizadas = grupo.sessions.filter(
    (sesion) => sesion.date.getTime() <= ahora.getTime(),
  );
  const idsRealizadas = new Set(sesionesRealizadas.map((s) => s.id));

  return grupo.enrollments.map((inscripcion) => {
    const presentes = inscripcion.attendance.filter(
      (a) => a.present && idsRealizadas.has(a.sessionId),
    ).length;

    const total = sesionesRealizadas.length;
    const porcentaje = total ? presentes / total : 0;
    const cumpleAsistencia = total > 0 && porcentaje >= ASISTENCIA_MINIMA;

    const faltaParaValidar: string[] = [];
    if (!cumpleAsistencia) {
      faltaParaValidar.push(
        total
          ? `asistencia ${Math.round(porcentaje * 100)} % (mínimo ${ASISTENCIA_MINIMA * 100} %)`
          : "todavía no hay sesiones realizadas",
      );
    }
    if (!inscripcion.focusDayAt) faltaParaValidar.push("Focus Day");

    return {
      enrollmentId: inscripcion.id,
      learnerId: inscripcion.learnerId,
      nombre: nombreCompleto(inscripcion.learner.person),
      presentes,
      sesionesRealizadas: total,
      porcentaje: Math.round(porcentaje * 100),
      cumpleAsistencia,
      focusDay: inscripcion.focusDayAt,
      validadoEl: inscripcion.validatedAt,
      validadoPor: inscripcion.validatedBy?.fullName ?? null,
      notaDeValidacion: inscripcion.validationNote,
      puedeValidarse: faltaParaValidar.length === 0 && !inscripcion.validatedAt,
      faltaParaValidar,
    };
  });
}
