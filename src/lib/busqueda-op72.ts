import { type Prisma, Operation72Status, Phase } from "@iglesia/prisma-client";
import type { ClientePrisma } from "@/lib/prisma";
import { momentoLegible, nombreCompleto, normalizarBusqueda, telefonoLegible } from "@/lib/dominio";
import { ESTADOS_EN_TABLERO } from "@/lib/op72";

/// Cuántas personas devuelve la búsqueda del tablero. Con más de esto el
/// resultado deja de ser útil: mejor afinar el texto que leer una lista larga.
export const TOPE_DE_BUSQUEDA = 8;

const ETIQUETA_FASE: Record<Phase, string> = {
  [Phase.GANAR]: "GANAR",
  [Phase.FORTALECER]: "FORTALECER",
  [Phase.ENTRENAR]: "ENTRENAR",
  [Phase.MULTIPLICAR]: "MULTIPLICAR",
};

/// Dónde está una persona que se buscó desde el tablero. Responde la pregunta
/// «la busqué y no aparece: ¿dónde está?», que antes quedaba sin respuesta —
/// el tablero solo conoce a quien tiene la Operación 72 abierta, y hoy hay
/// decenas de personas en fases posteriores o dadas de baja que devolvían vacío.
export type Ubicacion = {
  learnerId: string;
  nombre: string;
  telefono: string | null;
  /// Insignia corta de la esquina: la columna, la fase, o «DADA DE BAJA».
  insignia: string;
  /// Titular: qué le pasó a esta persona.
  titulo: string;
  /// Una línea de contexto bajo el titular.
  subtitulo: string | null;
  /// Filas con rótulo, como en la tarjeta del tablero.
  filas: { rotulo: string; valor: string | null }[];
  /// Frase que explica por qué está (o no está) en el tablero.
  nota: string;
  /// Cuando sigue en el tablero, el estado de su columna: la tarjeta completa
  /// ya se dibuja abajo y aquí solo se acompaña con el «dónde está».
  enTablero: Operation72Status | null;
};

const ETIQUETA_COLUMNA: Partial<Record<Operation72Status, string>> = {
  [Operation72Status.INICIADA]: "INICIADA",
  [Operation72Status.SEGUIMIENTO]: "SEGUIMIENTO",
  [Operation72Status.CONTACTADA]: "CONTACTADA",
  [Operation72Status.VISITA_PENDIENTE]: "VISITA PENDIENTE",
  [Operation72Status.LISTA_PARA_ENTREGA]: "LISTA PARA ENTREGA",
};

/// Busca personas por nombre o celular **sin importar en qué punto del recorrido
/// estén**, y describe dónde está cada una. `alcance` es el mismo filtro de red
/// que usa el tablero, para no mostrar a quien el rol no puede ver.
export async function ubicarPersonas(
  prisma: ClientePrisma,
  consulta: string,
  alcance: Prisma.LearnerProfileWhereInput,
  ahora: Date,
): Promise<Ubicacion[]> {
  const texto = consulta.trim();
  if (texto.length < 2) return [];

  // Mismo criterio que el filtro del tablero: nombre normalizado (sin tildes ni
  // mayúsculas) o celular por dígitos, porque el mismo número está guardado de
  // varias formas.
  const digitos = texto.replace(/\D/g, "");
  const porTelefono =
    digitos.length >= 4
      ? await prisma.$queryRaw<{ id: string }[]>`
          SELECT lp.id
          FROM learner_profile lp
          JOIN person p ON p.id = lp.person_id
          WHERE regexp_replace(coalesce(p.call_phone, ''), '\\D', '', 'g') LIKE ${`%${digitos}%`}
             OR regexp_replace(coalesce(p.whatsapp_phone, ''), '\\D', '', 'g') LIKE ${`%${digitos}%`}
        `
      : [];

  const coincide: Prisma.LearnerProfileWhereInput[] = [
    { person: { searchText: { contains: normalizarBusqueda(texto) } } },
  ];
  if (porTelefono.length) coincide.push({ id: { in: porTelefono.map((f) => f.id) } });

  const encontrados = await prisma.learnerProfile.findMany({
    where: { AND: [alcance, { OR: coincide }] },
    take: TOPE_DE_BUSQUEDA,
    orderBy: { person: { firstName: "asc" } },
    select: {
      id: true,
      phase: true,
      status: true,
      phaseStartedAt: true,
      consolidator: { select: { fullName: true } },
      person: {
        select: { firstName: true, lastName: true, callPhone: true, whatsappPhone: true },
      },
      operation72: { select: { status: true, startedAt: true, deliveredAt: true } },
      mentorRelationships: {
        where: { endedAt: null },
        take: 1,
        orderBy: { startedAt: "desc" },
        select: { mentor: { select: { fullName: true } } },
      },
      statusChanges: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { toStatus: true, reason: true, createdAt: true, decidedBy: { select: { fullName: true } } },
      },
    },
  });

  return encontrados.map((aprendiz) => {
    const consolidador = aprendiz.consolidator?.fullName ?? null;
    const mentor = aprendiz.mentorRelationships[0]?.mentor.fullName ?? null;
    const op72 = aprendiz.operation72;
    const enTablero =
      op72 && (ESTADOS_EN_TABLERO as readonly Operation72Status[]).includes(op72.status)
        ? op72.status
        : null;

    const comun = {
      learnerId: aprendiz.id,
      nombre: nombreCompleto(aprendiz.person),
      telefono: telefonoLegible(aprendiz.person.callPhone ?? aprendiz.person.whatsappPhone),
    };

    // 1) Dada de baja: es lo primero que hay que decir, por encima de la fase.
    if (aprendiz.status === "RETIRADO") {
      const baja = aprendiz.statusChanges[0];
      return {
        ...comun,
        insignia: "DADA DE BAJA",
        titulo: "Fuera del proceso",
        subtitulo: baja ? `Dada de baja ${momentoLegible(baja.createdAt, ahora)}` : null,
        filas: [
          { rotulo: "MOTIVO", valor: baja?.reason ?? null },
          { rotulo: "QUIÉN", valor: baja?.decidedBy.fullName ?? null },
          { rotulo: "CONSOLIDÓ", valor: consolidador },
        ],
        nota: "Se puede reactivar desde Administración si vuelve.",
        enTablero: null,
      };
    }

    // 2) Sigue en el tablero: la tarjeta completa se dibuja abajo, aquí solo
    //    se dice en qué columna está para no tener que buscarla con la vista.
    if (enTablero) {
      return {
        ...comun,
        insignia: ETIQUETA_COLUMNA[enTablero] ?? enTablero,
        titulo: `Operación 72 · ${ETIQUETA_COLUMNA[enTablero] ?? enTablero}`,
        subtitulo: op72 ? `Empezó ${momentoLegible(op72.startedAt, ahora)}` : null,
        filas: [
          { rotulo: "FASE", valor: `${ETIQUETA_FASE[aprendiz.phase]} · consolidación` },
          { rotulo: "CONSOLIDA", valor: consolidador },
          { rotulo: "MENTOR", valor: mentor },
        ],
        nota: "Está en el tablero. Su tarjeta, con las acciones, es la de al lado.",
        enTablero,
      };
    }

    // 3) Nunca tuvo Operación 72: son las fichas «solo del equipo».
    if (!op72) {
      return {
        ...comun,
        insignia: "SOLO FICHA",
        titulo: "Nunca entró a Operación 72",
        subtitulo: "Registrada solo como ficha, sin proceso de consolidación",
        filas: [
          { rotulo: "FASE", valor: ETIQUETA_FASE[aprendiz.phase] },
          { rotulo: "MENTOR", valor: mentor },
        ],
        nota: "Suele ser alguien del equipo: tiene ficha para roles y permisos.",
        enTablero: null,
      };
    }

    // 4) Ya salió del tablero: entregada, cerrada o en una fase posterior.
    return {
      ...comun,
      insignia: ETIQUETA_FASE[aprendiz.phase],
      titulo: "Ya salió de Operación 72",
      subtitulo: op72.deliveredAt
        ? `Terminó la consolidación ${momentoLegible(op72.deliveredAt, ahora)}`
        : aprendiz.phaseStartedAt
          ? `En esta fase desde ${momentoLegible(aprendiz.phaseStartedAt, ahora)}`
          : null,
      filas: [
        { rotulo: "FASE", valor: ETIQUETA_FASE[aprendiz.phase] },
        { rotulo: "MENTOR", valor: mentor },
        { rotulo: "CONSOLIDÓ", valor: consolidador },
      ],
      nota: "No está en el tablero porque ya pasó a mentoría. Su historial completo está en el expediente.",
      enTablero: null,
    };
  });
}
