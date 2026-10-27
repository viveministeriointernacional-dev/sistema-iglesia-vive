import { Phase } from "@iglesia/prisma-client";

/// **Dónde está una persona manda sobre qué le falta por cumplir** (regla del
/// usuario, 27-oct-2026).
///
/// Hasta hoy la etapa del recorrido era una aprobación pastoral con requisitos
/// (`requisitosDeFase`, `src/lib/fases.ts`): para salir de GANAR hacían falta
/// Alpha validado y un mentor asignado, y para salir de FORTALECER el bautismo,
/// un Encuentro y los 12 temas. Inscribir a alguien en una Casa de Fe, en un
/// Alfa o en la Escuela **no tocaba la etapa**, así que la etapa decía una cosa
/// y la realidad otra: el 27-oct eran **55 personas en GANAR** estando ya en una
/// Casa de Fe o en un Alfa.
///
/// La decisión es que la etapa **refleje dónde está la persona**, no el trámite.
/// Las dos piezas de eso viven aquí porque las toca el navegador y este módulo
/// no puede ser `"use server"` (§12.4).

/// El recorrido, en orden. La posición en esta lista es lo único que decide si
/// un cambio es hacia adelante.
export const ORDEN_DE_FASES: readonly Phase[] = [
  Phase.GANAR,
  Phase.FORTALECER,
  Phase.ENTRENAR,
  Phase.MULTIPLICAR,
];

/// Qué inscripción arrastra a qué etapa.
export type MotivoDeEtapa = "CASA_DE_FE" | "ALFA" | "ESCUELA";

export const ETAPA_POR_MOTIVO: Record<MotivoDeEtapa, Phase> = {
  CASA_DE_FE: Phase.FORTALECER,
  ALFA: Phase.FORTALECER,
  ESCUELA: Phase.ENTRENAR,
};

/// La nota que queda en el historial de fases y en «Actividad del día». Dice
/// **el hecho** —entró a un grupo— y no «se aprobó su paso», que sería afirmar
/// una decisión pastoral que nadie tomó (§12.6).
export const NOTA_POR_MOTIVO: Record<MotivoDeEtapa, string> = {
  CASA_DE_FE: "Entró a una Casa de Fe",
  ALFA: "Entró a un Alfa",
  ESCUELA: "Entró a la Escuela Ser Líder",
};

export function posicionDeFase(fase: Phase): number {
  return ORDEN_DE_FASES.indexOf(fase);
}

/// A qué etapa habría que mover a alguien, o `null` si no hay que moverlo.
///
/// ⚠️ **Solo hacia adelante, nunca hacia atrás.** Quien ya está en ENTRENAR y
/// entra a una Casa de Fe a acompañar no vuelve a FORTALECER, y retirar a
/// alguien de un grupo no lo devuelve a GANAR: la etapa es un recorrido, no un
/// estado derivado que se recalcule en cada lectura.
export function etapaQueCorresponde(
  actual: Phase,
  motivo: MotivoDeEtapa,
): Phase | null {
  const destino = ETAPA_POR_MOTIVO[motivo];
  return posicionDeFase(destino) > posicionDeFase(actual) ? destino : null;
}
