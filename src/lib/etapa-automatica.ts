import { LearnerStatus, type Phase } from "@iglesia/prisma-client";

import { auditar } from "@/lib/audit";
import {
  etapaQueCorresponde,
  NOTA_POR_MOTIVO,
  type MotivoDeEtapa,
} from "@/lib/etapa-automatica-catalogo";
import type { ClientePrisma } from "@/lib/prisma";

/// Mueve la etapa del recorrido cuando la inscripción lo exige.
///
/// Regla del usuario (27-oct-2026): quien entra a una **Casa de Fe** o a un
/// **Alfa** pasa a FORTALECER, y quien entra a la **Escuela Ser Líder** pasa a
/// ENTRENAR. Ver `etapa-automatica-catalogo.ts` para el porqué y la medida.
///
/// ⚠️ **NO comprueba `requisitosDeFase`, y es el punto de la regla.** El 27-oct,
/// de las 55 personas que estaban en un grupo y seguían en GANAR, **22 no
/// tenían mentor** —el requisito para salir de GANAR—, y las 7 con la Escuela
/// marcada en GANAR no tenían ni bautismo ni los 12 temas. Pedir los requisitos
/// aquí dejaría fuera justo los casos que existen para atender (§12.6).
///
/// ⚠️ **NO escribe el hito de transición** (`HITO_DE_TRANSICION`:
/// VALIDACION_PASTORAL al salir de FORTALECER, GRADUACION al salir de
/// ENTRENAR). Esos hitos afirman que alguien validó o graduó a la persona, y
/// aquí no lo hizo nadie: es la misma regla que `casa_de_fe.acceso_enviado`
/// (§12.6) — se audita lo que de verdad pasó, no lo que se espera que siga.
///
/// Devuelve la etapa nueva, o `null` si no hubo que mover nada.
export async function ponerEnEtapaPorInscripcion(
  db: ClientePrisma,
  learnerId: string,
  motivo: MotivoDeEtapa,
  actorId: string | null,
): Promise<Phase | null> {
  const aprendiz = await db.learnerProfile.findUnique({
    where: { id: learnerId },
    select: { phase: true, status: true },
  });
  // Quien está de baja o es asistente de la iglesia no está en el recorrido:
  // moverle la etapa sería inventarle un avance que nadie va a acompañar.
  if (!aprendiz || aprendiz.status !== LearnerStatus.ACTIVO) return null;

  const desde = aprendiz.phase;
  const hasta = etapaQueCorresponde(desde, motivo);
  if (!hasta) return null;

  const ahora = new Date();

  // La condición sobre la etapa actual hace esto idempotente, igual que
  // `cambiarDeFase`: si dos líderes inscriben a la vez, solo la primera
  // escritura cuenta y no quedan dos renglones en el historial.
  const cambiadas = await db.learnerProfile.updateMany({
    where: { id: learnerId, phase: desde },
    data: { phase: hasta, phaseStartedAt: ahora },
  });
  if (cambiadas.count === 0) return null;

  const nota = NOTA_POR_MOTIVO[motivo];

  await db.phaseChange.create({
    data: {
      learnerId,
      fromPhase: desde,
      toPhase: hasta,
      // ⚠️ Nulo cuando la persona se inscribió sola con el QR de la Escuela:
      // no lo decidió nadie del equipo. La columna se volvió opcional para
      // esto (migración `20261027T000000_cambio_de_fase_sin_actor`).
      decidedById: actorId,
      decidedAt: ahora,
      note: nota,
    },
  });

  await auditar(db, {
    actorId,
    action: "fase.cambiada",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: { de: desde, a: hasta, nota, automatico: true, motivo },
  });

  return hasta;
}
