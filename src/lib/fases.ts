import {
  FaithHouseStatus,
  MilestoneKind,
  MilestoneStatus,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { puedeMentorear, type UsuarioSesion } from "@/lib/auth";
import type { DatosExpediente } from "@/lib/expediente";

/// La siguiente fase del recorrido. La última no tiene siguiente: de
/// Multiplicar no se «sale», se gradúa como mentor (§8.4).
export const SIGUIENTE_FASE: Partial<Record<Phase, Phase>> = {
  GANAR: Phase.FORTALECER,
  FORTALECER: Phase.ENTRENAR,
  ENTRENAR: Phase.MULTIPLICAR,
};

/// Quién aprueba el paso de una fase a la siguiente.
///
/// Regla pastoral definida por la iglesia: basta el mentor de esa persona, y el
/// pastor de la línea también puede hacerlo. El consolidador no: acompaña las
/// primeras 72 horas, no decide el recorrido. El aprendiz nunca cambia su
/// propia fase (§3.1).
export async function puedeCambiarFase(
  usuario: UsuarioSesion,
  learnerId: string,
): Promise<boolean> {
  if (usuario.role === Role.PASTOR || usuario.role === Role.ADMIN) return true;
  // Acompañar como mentor puede venir del rol o del permiso `canMentor`.
  if (!puedeMentorear(usuario)) return false;

  const prisma = await getPrisma();
  const relacion = await prisma.mentorRelationship.findFirst({
    where: { learnerId, mentorId: usuario.id, endedAt: null },
    select: { id: true },
  });

  return Boolean(relacion);
}

export type RequisitosDeFase = {
  destino: Phase | null;
  cumplidos: string[];
  faltantes: string[];
  puedeAvanzar: boolean;
};

/// Lo que hay que haber cumplido para salir de la fase actual, leído del
/// expediente. Cada requisito sale de la especificación, no de un criterio
/// propio: Alpha y la entrega a mentor cierran Ganar (§5.6, §5.7); bautismo,
/// Encuentro y los 12 temas cierran Fortalecer (§6.4); la Escuela y el
/// servicio son el recorrido de Entrenar (§7).
export function requisitosDeFase(expediente: DatosExpediente): RequisitosDeFase {
  const destino = SIGUIENTE_FASE[expediente.phase] ?? null;

  if (!destino) {
    return { destino: null, cumplidos: [], faltantes: [], puedeAvanzar: false };
  }

  const completado = (kind: MilestoneKind) =>
    expediente.milestones.some(
      (hito) => hito.kind === kind && hito.status === MilestoneStatus.COMPLETADO,
    );

  const temasCompletados = expediente.faithHouseProgress.filter(
    (avance) => avance.status === FaithHouseStatus.COMPLETADO,
  ).length;

  const tieneMentor = expediente.mentorRelationships.some((r) => !r.endedAt);

  const revisar: { etiqueta: string; cumple: boolean }[] =
    expediente.phase === Phase.GANAR
      ? [
          { etiqueta: "Alpha validado", cumple: completado(MilestoneKind.ALPHA) },
          { etiqueta: "Entregada a un mentor", cumple: tieneMentor },
        ]
      : expediente.phase === Phase.FORTALECER
        ? [
            { etiqueta: "Bautismo", cumple: completado(MilestoneKind.BAUTISMO) },
            { etiqueta: "Al menos un Encuentro", cumple: completado(MilestoneKind.ENCUENTRO) },
            {
              etiqueta: `Los 12 temas de Casa de Fe (${temasCompletados}/12)`,
              cumple: temasCompletados >= 12,
            },
          ]
        : [
            {
              etiqueta: "Escuela Ser Líder completada",
              cumple: completado(MilestoneKind.ENTRADA_ESCUELA),
            },
            { etiqueta: "Sirviendo en un ministerio", cumple: completado(MilestoneKind.SERVICIO) },
          ];

  const cumplidos = revisar.filter((r) => r.cumple).map((r) => r.etiqueta);
  const faltantes = revisar.filter((r) => !r.cumple).map((r) => r.etiqueta);

  return { destino, cumplidos, faltantes, puedeAvanzar: faltantes.length === 0 };
}

/// El hito formal que deja cada paso. Salir de Fortalecer es la validación
/// pastoral que pide §6.4; entrar a Multiplicar es la graduación de §8.4.
export const HITO_DE_TRANSICION: Partial<Record<Phase, MilestoneKind>> = {
  FORTALECER: MilestoneKind.VALIDACION_PASTORAL,
  ENTRENAR: MilestoneKind.GRADUACION,
};

export async function cargarHistorialDeFases(learnerId: string) {
  const prisma = await getPrisma();

  return prisma.phaseChange.findMany({
    where: { learnerId },
    orderBy: { decidedAt: "desc" },
    select: {
      id: true,
      fromPhase: true,
      toPhase: true,
      decidedAt: true,
      note: true,
      decidedBy: { select: { fullName: true } },
    },
  });
}
