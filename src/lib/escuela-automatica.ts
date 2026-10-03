import {
  MilestoneKind,
  MilestoneStatus,
  type Prisma,
} from "@iglesia/prisma-client";

import { auditar } from "@/lib/audit";

export type InscripcionAutomatica = {
  nombre: string;
  /// Ya estaba inscrita antes de llenar el formulario. Se distingue a propósito:
  /// decirle «quedaste inscrito» a quien lleva meses en la escuela suena a que
  /// algo se reinició.
  yaEstaba: boolean;
};

/// Inscribe en la Escuela Ser Líder a quien acaba de llenar el formulario del
/// QR (`/actualizar-datos?escuela=1`).
///
/// ⚠️ **NO comprueba la fase, y es una decisión del usuario (3-oct-2026).**
/// `inscribirEnEscuela` —el botón que usa el líder desde la ficha— exige fase
/// FORTALECER o ENTRENAR (`FASES_PARA_ESCUELA`), y eso aquí habría dejado fuera
/// a media sala: **de las 33 personas del equipo con cuenta, 13 están fuera de
/// esas dos fases, y 11 de ellas por estar en MULTIPLICAR**, que es la fase más
/// avanzada. Ser Líder es para quien **ya sirve** en un ministerio, y servir no
/// es una fase del recorrido. Quien se inscriba por error se saca con
/// «Retirar de la escuela» en la ficha del grupo.
///
/// ⚠️ **Va dentro de la transacción de quien la llama**: inscribirse es parte
/// del mismo acto de registrarse, no un añadido que pueda quedar a medias.
export async function inscribirPorFormulario(
  tx: Prisma.TransactionClient,
  learnerId: string,
): Promise<InscripcionAutomatica | null> {
  // La escuela abierta más reciente. Si hay varias abiertas se toma la que
  // arrancó después: es la promoción en curso. Si no hay ninguna abierta no se
  // inventa nada — el formulario lo dice y el pastor la inscribe luego a mano.
  const escuela = await tx.trainingProgram.findFirst({
    where: { closedAt: null },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true },
  });
  if (!escuela) return null;

  const yaInscrita = await tx.trainingEnrollment.findUnique({
    where: { programId_learnerId: { programId: escuela.id, learnerId } },
    select: { id: true },
  });
  // Llenar el formulario dos veces no reinicia nada: ni la fecha de entrada ni
  // el cierre de quien ya se graduó.
  if (yaInscrita) return { nombre: escuela.name, yaEstaba: true };

  await tx.trainingEnrollment.create({
    data: { programId: escuela.id, learnerId },
  });

  // El hito de entrada, con la misma regla que el botón de inscribir: si la
  // persona **ya completó** la Escuela antes, no se le pisa el logro con un
  // «en curso» (es la regla de las fusiones, §8).
  const hitoPrevio = await tx.milestone.findUnique({
    where: { learnerId_kind: { learnerId, kind: MilestoneKind.ENTRADA_ESCUELA } },
    select: { status: true },
  });
  if (hitoPrevio?.status !== MilestoneStatus.COMPLETADO) {
    await tx.milestone.upsert({
      where: {
        learnerId_kind: { learnerId, kind: MilestoneKind.ENTRADA_ESCUELA },
      },
      create: {
        learnerId,
        kind: MilestoneKind.ENTRADA_ESCUELA,
        status: MilestoneStatus.EN_CURSO,
        achievedAt: new Date(),
      },
      update: { status: MilestoneStatus.EN_CURSO },
    });
  }

  // ⚠️ **Sin actor a propósito**: no lo inscribió nadie del equipo, lo hizo la
  // persona desde su celular con el QR. Es la misma decisión que el taller de
  // Casa de Fe (27-sep) y el del prematrimonial.
  await auditar(tx, {
    actorId: null,
    action: "escuela.inscripcion_por_qr",
    entityType: "learner_profile",
    entityId: learnerId,
    metadata: { programId: escuela.id, escuela: escuela.name },
  });

  return { nombre: escuela.name, yaEstaba: false };
}
