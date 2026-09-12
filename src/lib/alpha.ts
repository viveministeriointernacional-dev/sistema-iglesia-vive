import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { veTodaLaRed, type UsuarioSesion } from "@/lib/auth";
import { lideresDeMiRama } from "@/lib/red";
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

/// Crear y cerrar grupos de Alpha: decisión de dirección, no de quien lo
/// lleva. El líder del grupo lo administra, pero no lo abre ni lo elimina.
export function puedeCrearAlpha(usuario: UsuarioSesion) {
  return (
    usuario.role === Role.MENTOR ||
    usuario.role === Role.PASTOR ||
    usuario.role === Role.ADMIN
  );
}

/// Quién puede entrar a la sección de Alpha: quien tiene el permiso de
/// liderar, y quien puede abrir grupos.
export function puedeVerAlpha(usuario: UsuarioSesion) {
  return usuario.canLeadAlpha || puedeCrearAlpha(usuario);
}

/// **Quién administra un grupo concreto**: su líder, quien lo abrió, la
/// administración, o el líder que tiene al líder del grupo en su rama.
///
/// ⚠️ **`createdById` entra aquí a propósito, y sin él esto sería una
/// regresión.** Antes bastaba con ser PASTOR para administrar cualquier grupo,
/// así que un pastor que abría un Alpha y se lo asignaba a otra persona podía
/// seguir administrándolo **de rebote**. Al recortar la vista completa eso
/// desaparecía: habría abierto un grupo y al instante no habría podido tocarlo.
export async function puedeAdministrarGrupo(
  usuario: UsuarioSesion,
  grupo: { leaderId: string; createdById?: string | null },
) {
  if (grupo.leaderId === usuario.id) return true;
  if (grupo.createdById && grupo.createdById === usuario.id) return true;
  if (esVistaCompletaDeAlpha(usuario)) return true;
  return (await lideresDeMiRama(usuario.id)).includes(grupo.leaderId);
}

/// **Quién ve TODOS los Alpha de la iglesia.**
///
/// Regla del usuario (11-sep-2026), la misma que en «Mi red»: «que solamente
/// el mentor o líder pueda ver los Alpha y Casas de Fe que tiene asignado o que
/// tienen asignado las personas que lidera». Así que **el rol PASTOR ya no
/// abre todos los grupos** — ve los suyos y los de su rama.
export function esVistaCompletaDeAlpha(usuario: UsuarioSesion) {
  return veTodaLaRed(usuario);
}

export async function cargarGrupos(usuario: UsuarioSesion) {
  const prisma = await getPrisma();

  // La administración ve todo. Cualquier otro ve los que lleva, los que abrió,
  // y **los que lleva alguien de su rama** — que es lo que convierte esta
  // pantalla en «cómo van los Alpha de mi gente» en vez de un directorio.
  const deLaRama = esVistaCompletaDeAlpha(usuario)
    ? []
    : await lideresDeMiRama(usuario.id);

  const grupos = await prisma.alphaProgram.findMany({
    where: esVistaCompletaDeAlpha(usuario)
      ? {}
      : {
          OR: [
            { leaderId: usuario.id },
            { createdById: usuario.id },
            { leaderId: { in: deLaRama } },
          ],
        },
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
      createdById: true,
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

/// Quién puede quedar como líder de un grupo: cualquiera con el permiso.
export async function lideresPosibles() {
  const prisma = await getPrisma();
  return prisma.appUser.findMany({
    where: { active: true, canLeadAlpha: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true },
  });
}
