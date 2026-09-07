import { LearnerStatus, Operation72Status, Phase } from "@iglesia/prisma-client";
import { ZONA_HORARIA } from "@/lib/dominio";
import {
  DIAS_DEL_PERIODO,
  periodoValido,
  type Periodo,
} from "@/lib/informe-catalogo";
import type { ClientePrisma } from "@/lib/prisma";

export * from "@/lib/informe-catalogo";

/// El informe de la plataforma: qué pasó en un periodo, en cuánto creció, y
/// qué tan efectivo fue el trabajo con la gente que entró.
///
/// **Todo se mide en hora Colombia** (el servidor corre en UTC), y la semana
/// arranca el VIERNES — ver `informe-catalogo.ts` para el porqué.

const FORMATO_DIA = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONA_HORARIA,
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: ZONA_HORARIA,
});

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  timeZone: ZONA_HORARIA,
});

export function diaDeHoyColombia(ahora = new Date()) {
  return FORMATO_DIA.format(ahora);
}

/// Mediodía en Bogotá: así ningún corrimiento de días cambia la fecha.
function fechaDeDia(dia: string) {
  return new Date(`${dia}T12:00:00-05:00`);
}

function sumarDias(dia: string, cuantos: number) {
  const fecha = fechaDeDia(dia);
  fecha.setUTCDate(fecha.getUTCDate() + cuantos);
  return FORMATO_DIA.format(fecha);
}

/// El viernes de la semana a la que pertenece ese día (él mismo si es viernes).
function viernesDe(dia: string) {
  // getUTCDay sobre el mediodía de Bogotá da el día de la semana correcto.
  const diaSemana = fechaDeDia(dia).getUTCDay(); // 0 domingo … 5 viernes
  return sumarDias(dia, -((diaSemana - 5 + 7) % 7));
}

function diaValido(valor: string | undefined) {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : diaDeHoyColombia();
}

export type Rango = {
  periodo: Periodo;
  /// Primer día del periodo, en formato aaaa-mm-dd.
  inicio: string;
  /// Último día del periodo (inclusive).
  fin: string;
  desde: Date;
  hasta: Date;
  etiqueta: string;
  anterior: string;
  siguiente: string;
  /// El periodo inmediatamente anterior, para poder comparar.
  previo: { desde: Date; hasta: Date };
};

/// Traduce «qué periodo y qué día ancla» a las dos marcas de tiempo que usan
/// todas las consultas, más las etiquetas y la navegación.
export function calcularRango(
  periodoCrudo: string | undefined,
  diaCrudo: string | undefined,
): Rango {
  const periodo = periodoValido(periodoCrudo);
  const ancla = diaValido(diaCrudo);
  const largo = DIAS_DEL_PERIODO[periodo];

  // El día suelto empieza donde diga el ancla; los cortes semanales y de cuatro
  // semanas siempre empiezan un viernes.
  const inicio =
    periodo === "dia"
      ? ancla
      : periodo === "semana"
        ? viernesDe(ancla)
        : sumarDias(viernesDe(ancla), -21);
  const fin = sumarDias(inicio, largo - 1);

  const desde = new Date(`${inicio}T00:00:00-05:00`);
  const hasta = new Date(`${fin}T23:59:59.999-05:00`);
  const inicioPrevio = sumarDias(inicio, -largo);

  const etiqueta =
    periodo === "dia"
      ? capitalizar(FECHA_LARGA.format(fechaDeDia(inicio)))
      : `${capitalizar(FECHA_LARGA.format(fechaDeDia(inicio)))} → ${FECHA_LARGA.format(fechaDeDia(fin))}`;

  return {
    periodo,
    inicio,
    fin,
    desde,
    hasta,
    etiqueta,
    anterior: inicioPrevio,
    siguiente: sumarDias(inicio, largo),
    previo: {
      desde: new Date(`${inicioPrevio}T00:00:00-05:00`),
      hasta: new Date(`${sumarDias(inicio, -1)}T23:59:59.999-05:00`),
    },
  };
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/// Cuánto creció una cifra respecto al periodo anterior.
export type Comparacion = {
  ahora: number;
  antes: number;
  /// Nulo cuando antes era 0: de cero a algo no es un porcentaje, es aparecer.
  porcentaje: number | null;
};

function comparar(ahora: number, antes: number): Comparacion {
  return {
    ahora,
    antes,
    porcentaje: antes === 0 ? null : ((ahora - antes) / antes) * 100,
  };
}

export type Efectividad = {
  entraron: number;
  seLlamo: number;
  contestaron: number;
  visita: number;
  entregadas: number;
  /// Entraron tan cerca del cierre que todavía les queda periodo: NO cuentan
  /// como perdidas. Con el corte de viernes son las de miércoles y jueves.
  enPlazo: number;
};

export type FilaConsolidador = {
  id: string;
  nombre: string;
  aCargo: number;
  llamo: number;
  contestaron: number;
  visitas: number;
  entrego: number;
  sinTocar: number;
};

export type Informe = {
  rango: Rango;
  registros: Comparacion;
  llamadas: Comparacion;
  visitas: Comparacion;
  entregas: Comparacion;
  hitos: Comparacion;
  bajas: Comparacion;
  bajasPendientes: number;
  efectividad: Efectividad;
  efectividadPrevia: Efectividad;
  fases: { fase: Phase; personas: number; neto: number }[];
  transiciones: { desde: Phase; hacia: Phase; cuantas: number }[];
  saltos: number;
  retrocesos: number;
  porDia: { dia: string; etiqueta: string; llamadas: number; visitas: number; registros: number }[];
  op72: { estado: Operation72Status; cuantas: number }[];
  hitosPorTipo: { kind: string; cuantos: number }[];
  consolidadores: FilaConsolidador[];
};

/// El orden en que la iglesia recorre las fases. `Phase` no lo garantiza.
const ORDEN_FASE: Phase[] = [
  Phase.GANAR,
  Phase.FORTALECER,
  Phase.ENTRENAR,
  Phase.MULTIPLICAR,
];

function posicion(fase: Phase) {
  return ORDEN_FASE.indexOf(fase);
}

export async function cargarInforme(
  prisma: ClientePrisma,
  opciones: { periodo?: string; dia?: string } = {},
): Promise<Informe> {
  const rango = calcularRango(opciones.periodo, opciones.dia);
  const { desde, hasta } = rango;
  const { desde: desdePrevio, hasta: hastaPrevio } = rango.previo;

  // Los que entraron tan cerca del cierre que todavía tienen periodo por
  // delante. Con el corte de viernes, «los dos últimos días» son miércoles y
  // jueves; en el corte de un solo día no aplica.
  const margen = rango.periodo === "dia" ? 0 : 2;
  const corteEnPlazo = new Date(hasta.getTime() - margen * 24 * 60 * 60 * 1000);

  const [
    contadores,
    efectividad,
    efectividadPrevia,
    fasesActuales,
    transiciones,
    porDia,
    op72,
    hitosPorTipo,
    consolidadores,
  ] = await Promise.all([
    contarMovimientos(prisma, desde, hasta, desdePrevio, hastaPrevio),
    medirEfectividad(prisma, desde, hasta, corteEnPlazo),
    medirEfectividad(prisma, desdePrevio, hastaPrevio, hastaPrevio),
    prisma.learnerProfile.groupBy({
      by: ["phase"],
      where: { status: LearnerStatus.ACTIVO },
      _count: { _all: true },
    }),
    prisma.phaseChange.groupBy({
      by: ["fromPhase", "toPhase"],
      where: { decidedAt: { gte: desde, lte: hasta } },
      _count: { _all: true },
    }),
    actividadPorDia(prisma, desde, hasta),
    prisma.operation72.groupBy({
      by: ["status"],
      where: {
        status: {
          notIn: [Operation72Status.ENTREGADA, Operation72Status.CERRADA],
        },
      },
      _count: { _all: true },
    }),
    prisma.milestone.groupBy({
      by: ["kind"],
      where: { status: "COMPLETADO", achievedAt: { gte: desde, lte: hasta } },
      _count: { _all: true },
    }),
    medirConsolidadores(prisma, desde, hasta),
  ]);

  const personasPorFase = new Map(
    fasesActuales.map((fila) => [fila.phase, fila._count._all]),
  );

  // Cuánto se movió cada fase en el periodo: lo que entró menos lo que salió.
  // No hay fotos históricas de la base, pero `phase_change` sí guarda cada paso,
  // así que el neto es exacto.
  const neto = new Map<Phase, number>(ORDEN_FASE.map((fase) => [fase, 0]));
  let saltos = 0;
  let retrocesos = 0;
  for (const fila of transiciones) {
    const cuantas = fila._count._all;
    neto.set(fila.toPhase, (neto.get(fila.toPhase) ?? 0) + cuantas);
    neto.set(fila.fromPhase, (neto.get(fila.fromPhase) ?? 0) - cuantas);
    const salto = posicion(fila.toPhase) - posicion(fila.fromPhase);
    if (salto > 1) saltos += cuantas;
    if (salto < 0) retrocesos += cuantas;
  }

  return {
    rango,
    ...contadores,
    efectividad,
    efectividadPrevia,
    fases: ORDEN_FASE.map((fase) => ({
      fase,
      personas: personasPorFase.get(fase) ?? 0,
      neto: neto.get(fase) ?? 0,
    })),
    transiciones: transiciones
      .map((fila) => ({
        desde: fila.fromPhase,
        hacia: fila.toPhase,
        cuantas: fila._count._all,
      }))
      .sort((a, b) => posicion(a.desde) - posicion(b.desde) || b.cuantas - a.cuantas),
    saltos,
    retrocesos,
    porDia,
    op72: op72.map((fila) => ({ estado: fila.status, cuantas: fila._count._all })),
    hitosPorTipo: hitosPorTipo
      .map((fila) => ({ kind: fila.kind as string, cuantos: fila._count._all }))
      .sort((a, b) => b.cuantos - a.cuantos),
    consolidadores,
  };
}

/// Las seis cifras de arriba, con su comparación contra el periodo anterior.
/// Van en una sola consulta: con una única conexión de base por petición, seis
/// viajes separados cuestan seis veces la latencia del pooler.
async function contarMovimientos(
  prisma: ClientePrisma,
  desde: Date,
  hasta: Date,
  desdePrevio: Date,
  hastaPrevio: Date,
) {
  const [fila] = await prisma.$queryRaw<
    {
      registros: bigint;
      registros_previo: bigint;
      llamadas: bigint;
      llamadas_previo: bigint;
      visitas: bigint;
      visitas_previo: bigint;
      entregas: bigint;
      entregas_previo: bigint;
      hitos: bigint;
      hitos_previo: bigint;
      bajas: bigint;
      bajas_previo: bigint;
      bajas_pendientes: bigint;
    }[]
  >`
    SELECT
      (SELECT count(*) FROM operation72 WHERE started_at BETWEEN ${desde} AND ${hasta}) AS registros,
      (SELECT count(*) FROM operation72 WHERE started_at BETWEEN ${desdePrevio} AND ${hastaPrevio}) AS registros_previo,
      (SELECT count(*) FROM contact_attempt WHERE type IN ('LLAMADA','INTENTO_LLAMADA') AND occurred_at BETWEEN ${desde} AND ${hasta}) AS llamadas,
      (SELECT count(*) FROM contact_attempt WHERE type IN ('LLAMADA','INTENTO_LLAMADA') AND occurred_at BETWEEN ${desdePrevio} AND ${hastaPrevio}) AS llamadas_previo,
      (SELECT count(*) FROM contact_attempt WHERE type = 'VISITA' AND occurred_at BETWEEN ${desde} AND ${hasta}) AS visitas,
      (SELECT count(*) FROM contact_attempt WHERE type = 'VISITA' AND occurred_at BETWEEN ${desdePrevio} AND ${hastaPrevio}) AS visitas_previo,
      (SELECT count(*) FROM mentor_relationship WHERE started_at BETWEEN ${desde} AND ${hasta}) AS entregas,
      (SELECT count(*) FROM mentor_relationship WHERE started_at BETWEEN ${desdePrevio} AND ${hastaPrevio}) AS entregas_previo,
      (SELECT count(*) FROM milestone WHERE status = 'COMPLETADO' AND achieved_at BETWEEN ${desde} AND ${hasta}) AS hitos,
      (SELECT count(*) FROM milestone WHERE status = 'COMPLETADO' AND achieved_at BETWEEN ${desdePrevio} AND ${hastaPrevio}) AS hitos_previo,
      (SELECT count(*) FROM learner_status_change WHERE to_status = 'RETIRADO' AND created_at BETWEEN ${desde} AND ${hasta}) AS bajas,
      (SELECT count(*) FROM learner_status_change WHERE to_status = 'RETIRADO' AND created_at BETWEEN ${desdePrevio} AND ${hastaPrevio}) AS bajas_previo,
      (SELECT count(*) FROM baja_request WHERE status = 'PENDIENTE') AS bajas_pendientes
  `;

  const n = (valor: bigint | undefined) => Number(valor ?? 0);
  return {
    registros: comparar(n(fila?.registros), n(fila?.registros_previo)),
    llamadas: comparar(n(fila?.llamadas), n(fila?.llamadas_previo)),
    visitas: comparar(n(fila?.visitas), n(fila?.visitas_previo)),
    entregas: comparar(n(fila?.entregas), n(fila?.entregas_previo)),
    hitos: comparar(n(fila?.hitos), n(fila?.hitos_previo)),
    bajas: comparar(n(fila?.bajas), n(fila?.bajas_previo)),
    bajasPendientes: n(fila?.bajas_pendientes),
  };
}

/// El embudo: de los que entraron en el periodo, hasta dónde llegó cada uno
/// **dentro del mismo periodo**. Por eso el corte va de viernes a viernes: quien
/// llega el fin de semana tiene lunes a jueves para que lo llamen.
async function medirEfectividad(
  prisma: ClientePrisma,
  desde: Date,
  hasta: Date,
  corteEnPlazo: Date,
): Promise<Efectividad> {
  const [fila] = await prisma.$queryRaw<
    {
      entraron: bigint;
      se_llamo: bigint;
      contestaron: bigint;
      visita: bigint;
      entregadas: bigint;
      en_plazo: bigint;
    }[]
  >`
    WITH cohorte AS (
      SELECT o.id, o.learner_id, o.started_at
      FROM operation72 o
      WHERE o.started_at BETWEEN ${desde} AND ${hasta}
    )
    SELECT
      count(*) AS entraron,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM contact_attempt a
        WHERE a.operation72_id = c.id AND a.type IN ('LLAMADA','INTENTO_LLAMADA')
          AND a.occurred_at BETWEEN ${desde} AND ${hasta})) AS se_llamo,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM contact_attempt a
        WHERE a.operation72_id = c.id AND a.outcome::text LIKE 'CONTESTO%'
          AND a.occurred_at BETWEEN ${desde} AND ${hasta})) AS contestaron,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM contact_attempt a
        WHERE a.operation72_id = c.id AND a.type = 'VISITA'
          AND a.occurred_at BETWEEN ${desde} AND ${hasta})) AS visita,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM mentor_relationship m
        WHERE m.learner_id = c.learner_id
          AND m.started_at BETWEEN ${desde} AND ${hasta})) AS entregadas,
      count(*) FILTER (WHERE c.started_at > ${corteEnPlazo}) AS en_plazo
    FROM cohorte c
  `;

  const n = (valor: bigint | undefined) => Number(valor ?? 0);
  return {
    entraron: n(fila?.entraron),
    seLlamo: n(fila?.se_llamo),
    contestaron: n(fila?.contestaron),
    visita: n(fila?.visita),
    entregadas: n(fila?.entregadas),
    enPlazo: n(fila?.en_plazo),
  };
}

/// Llamadas, visitas y registros día por día (o hora por hora en el corte de un
/// solo día). Los límites se corren cinco horas para agrupar por día colombiano.
async function actividadPorDia(prisma: ClientePrisma, desde: Date, hasta: Date) {
  // El día se devuelve como TEXTO a propósito. Si volviera como fecha, `pg` la
  // construiría en UTC (el servidor corre en UTC) y al formatearla en hora
  // Colombia se correría un día hacia atrás.
  const filas = await prisma.$queryRaw<
    { dia: string; llamadas: bigint; visitas: bigint; registros: bigint }[]
  >`
    WITH dias AS (
      SELECT generate_series(
        date_trunc('day', ${desde}::timestamptz AT TIME ZONE 'America/Bogota'),
        date_trunc('day', ${hasta}::timestamptz AT TIME ZONE 'America/Bogota'),
        interval '1 day'
      ) AS dia
    )
    SELECT to_char(d.dia, 'YYYY-MM-DD') AS dia,
      (SELECT count(*) FROM contact_attempt a
        WHERE a.type IN ('LLAMADA','INTENTO_LLAMADA')
          AND (a.occurred_at AT TIME ZONE 'America/Bogota')::date = d.dia::date) AS llamadas,
      (SELECT count(*) FROM contact_attempt a
        WHERE a.type = 'VISITA'
          AND (a.occurred_at AT TIME ZONE 'America/Bogota')::date = d.dia::date) AS visitas,
      (SELECT count(*) FROM operation72 o
        WHERE (o.started_at AT TIME ZONE 'America/Bogota')::date = d.dia::date) AS registros
    FROM dias d
    ORDER BY d.dia
  `;

  return filas.map((fila) => {
    const dia = fila.dia;
    return {
      dia,
      etiqueta: FECHA_CORTA.format(fechaDeDia(dia)).replace(",", ""),
      llamadas: Number(fila.llamadas),
      visitas: Number(fila.visitas),
      registros: Number(fila.registros),
    };
  });
}

/// Qué hizo cada consolidador con SUS personas en el periodo. «Sin tocar» son
/// las suyas a las que nadie les registró nada: es la cifra que de verdad se
/// mira, porque el resto puede verse bien y esconder gente abandonada.
async function medirConsolidadores(
  prisma: ClientePrisma,
  desde: Date,
  hasta: Date,
): Promise<FilaConsolidador[]> {
  const filas = await prisma.$queryRaw<
    {
      id: string;
      nombre: string;
      a_cargo: bigint;
      llamo: bigint;
      contestaron: bigint;
      visitas: bigint;
      entrego: bigint;
      sin_tocar: bigint;
    }[]
  >`
    WITH suyas AS (
      SELECT lp.consolidator_id, o.id AS op_id, lp.id AS learner_id
      FROM learner_profile lp
      JOIN operation72 o ON o.learner_id = lp.id
      WHERE lp.consolidator_id IS NOT NULL
        AND lp.status = 'ACTIVO'
        AND lp.phase = 'GANAR'
        AND o.status NOT IN ('ENTREGADA','CERRADA')
    ), movimiento AS (
      SELECT s.consolidator_id, s.op_id,
        EXISTS (SELECT 1 FROM contact_attempt a
          WHERE a.operation72_id = s.op_id AND a.occurred_at BETWEEN ${desde} AND ${hasta}) AS tocada,
        EXISTS (SELECT 1 FROM contact_attempt a
          WHERE a.operation72_id = s.op_id AND a.type IN ('LLAMADA','INTENTO_LLAMADA')
            AND a.occurred_at BETWEEN ${desde} AND ${hasta}) AS llamada,
        EXISTS (SELECT 1 FROM contact_attempt a
          WHERE a.operation72_id = s.op_id AND a.outcome::text LIKE 'CONTESTO%'
            AND a.occurred_at BETWEEN ${desde} AND ${hasta}) AS contesto,
        EXISTS (SELECT 1 FROM contact_attempt a
          WHERE a.operation72_id = s.op_id AND a.type = 'VISITA'
            AND a.occurred_at BETWEEN ${desde} AND ${hasta}) AS visita,
        EXISTS (SELECT 1 FROM mentor_relationship m
          WHERE m.learner_id = s.learner_id AND m.started_at BETWEEN ${desde} AND ${hasta}) AS entregada
      FROM suyas s
    )
    SELECT u.id, u.full_name AS nombre,
      count(*) AS a_cargo,
      count(*) FILTER (WHERE m.llamada) AS llamo,
      count(*) FILTER (WHERE m.contesto) AS contestaron,
      count(*) FILTER (WHERE m.visita) AS visitas,
      count(*) FILTER (WHERE m.entregada) AS entrego,
      count(*) FILTER (WHERE NOT m.tocada) AS sin_tocar
    FROM movimiento m
    JOIN app_user u ON u.id = m.consolidator_id
    GROUP BY u.id, u.full_name
    ORDER BY count(*) FILTER (WHERE NOT m.tocada) DESC, u.full_name
  `;

  return filas.map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    aCargo: Number(fila.a_cargo),
    llamo: Number(fila.llamo),
    contestaron: Number(fila.contestaron),
    visitas: Number(fila.visitas),
    entrego: Number(fila.entrego),
    sinTocar: Number(fila.sin_tocar),
  }));
}

/// ---------------------------------------------------------------- Detalle

export const FILTROS_DETALLE = [
  "todas",
  "con-movimiento",
  "sin-tocar",
  "cambio-fase",
  "baja",
] as const;
export type FiltroDetalle = (typeof FILTROS_DETALLE)[number];

export function filtroValido(valor: string | undefined): FiltroDetalle {
  return (FILTROS_DETALLE as readonly string[]).includes(valor ?? "")
    ? (valor as FiltroDetalle)
    : "todas";
}

export type Movimiento = {
  cuando: Date;
  titulo: string;
  quien: string | null;
  observacion: string | null;
};

export type PersonaDelInforme = {
  learnerId: string;
  personId: string;
  nombre: string;
  telefono: string | null;
  fase: Phase;
  consolidador: string | null;
  movimientos: Movimiento[];
  /// Cuándo fue la última vez que alguien le registró algo, sea cuando sea.
  ultimoContacto: Date | null;
};

const TOPE_DETALLE = 80;

/// Qué se le hizo a cada persona en el periodo. Es la vista que contesta «¿y a
/// esta persona quién la atendió?», que los totales nunca responden.
export async function cargarDetallePersonas(
  prisma: ClientePrisma,
  rango: Rango,
  filtro: FiltroDetalle,
): Promise<{ personas: PersonaDelInforme[]; total: number }> {
  const { desde, hasta } = rango;

  // Quiénes entran en la lista. Siempre son personas de consolidación en curso;
  // el filtro decide cuáles de ellas.
  const candidatos = await prisma.$queryRaw<{ learner_id: string; total: bigint }[]>`
    WITH suyas AS (
      SELECT lp.id AS learner_id, o.id AS op_id
      FROM learner_profile lp
      JOIN operation72 o ON o.learner_id = lp.id
      WHERE lp.status = 'ACTIVO' AND o.status NOT IN ('ENTREGADA','CERRADA')
    ), marcadas AS (
      SELECT s.learner_id,
        EXISTS (SELECT 1 FROM contact_attempt a
          WHERE a.operation72_id = s.op_id AND a.occurred_at BETWEEN ${desde} AND ${hasta}) AS tocada,
        EXISTS (SELECT 1 FROM phase_change p
          WHERE p.learner_id = s.learner_id AND p.decided_at BETWEEN ${desde} AND ${hasta}) AS cambio_fase,
        EXISTS (SELECT 1 FROM learner_status_change c
          WHERE c.learner_id = s.learner_id AND c.to_status = 'RETIRADO'
            AND c.created_at BETWEEN ${desde} AND ${hasta}) AS baja
      FROM suyas s
    ), elegidas AS (
      SELECT learner_id FROM marcadas
      WHERE CASE ${filtro}::text
        WHEN 'con-movimiento' THEN tocada OR cambio_fase OR baja
        WHEN 'sin-tocar' THEN NOT tocada
        WHEN 'cambio-fase' THEN cambio_fase
        WHEN 'baja' THEN baja
        ELSE true
      END
    )
    SELECT learner_id, (SELECT count(*) FROM elegidas) AS total
    FROM elegidas
    LIMIT ${TOPE_DETALLE}
  `;

  if (candidatos.length === 0) return { personas: [], total: 0 };
  const ids = candidatos.map((fila) => fila.learner_id);
  const total = Number(candidatos[0]?.total ?? 0);

  const [aprendices, intentos, cambios, hitos, bajas] = await Promise.all([
    prisma.learnerProfile.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        phase: true,
        personId: true,
        consolidator: { select: { fullName: true } },
        person: {
          select: { firstName: true, lastName: true, callPhone: true, whatsappPhone: true },
        },
        operation72: { select: { id: true } },
      },
    }),
    prisma.contactAttempt.findMany({
      where: {
        operation72: { learnerId: { in: ids } },
        occurredAt: { gte: desde, lte: hasta },
      },
      orderBy: { occurredAt: "asc" },
      select: {
        type: true,
        outcome: true,
        note: true,
        occurredAt: true,
        scheduledAt: true,
        byUser: { select: { fullName: true } },
        operation72: { select: { learnerId: true } },
      },
    }),
    prisma.phaseChange.findMany({
      where: { learnerId: { in: ids }, decidedAt: { gte: desde, lte: hasta } },
      select: {
        learnerId: true,
        fromPhase: true,
        toPhase: true,
        decidedAt: true,
        note: true,
        decidedBy: { select: { fullName: true } },
      },
    }),
    prisma.milestone.findMany({
      where: {
        learnerId: { in: ids },
        status: "COMPLETADO",
        achievedAt: { gte: desde, lte: hasta },
      },
      select: {
        learnerId: true,
        kind: true,
        achievedAt: true,
        recordedBy: { select: { fullName: true } },
      },
    }),
    prisma.learnerStatusChange.findMany({
      where: { learnerId: { in: ids }, createdAt: { gte: desde, lte: hasta } },
      select: {
        learnerId: true,
        toStatus: true,
        reason: true,
        createdAt: true,
        decidedBy: { select: { fullName: true } },
      },
    }),
  ]);

  // El último contacto de siempre, para poder decir «hace 14 días» en las que
  // no se tocaron: sin eso, «sin tocar» no dice si es descuido o si la persona
  // acaba de entrar.
  const operacionDeAprendiz = new Map(
    aprendices
      .filter((aprendiz) => aprendiz.operation72)
      .map((aprendiz) => [aprendiz.operation72!.id, aprendiz.id]),
  );
  const ultimos = operacionDeAprendiz.size
    ? await prisma.contactAttempt.groupBy({
        by: ["operation72Id"],
        where: { operation72Id: { in: [...operacionDeAprendiz.keys()] } },
        _max: { occurredAt: true },
      })
    : [];
  const ultimoPorAprendiz = new Map(
    ultimos.flatMap((fila) => {
      const learnerId = operacionDeAprendiz.get(fila.operation72Id);
      return learnerId ? [[learnerId, fila._max.occurredAt] as const] : [];
    }),
  );

  const porAprendiz = new Map<string, Movimiento[]>(ids.map((id) => [id, []]));
  const agregar = (learnerId: string, movimiento: Movimiento) => {
    porAprendiz.get(learnerId)?.push(movimiento);
  };

  for (const intento of intentos) {
    const esVisita = intento.type === "VISITA";
    const resultado = intento.outcome
      ? intento.outcome.startsWith("CONTESTO")
        ? "contestó"
        : "no contestó"
      : null;
    agregar(intento.operation72.learnerId, {
      cuando: intento.occurredAt,
      titulo: esVisita
        ? "Visita agendada"
        : `Llamada${resultado ? ` · ${resultado}` : ""}`,
      quien: intento.byUser?.fullName ?? "La línea, desde el CRM",
      observacion: intento.note?.trim() || null,
    });
  }
  for (const cambio of cambios) {
    agregar(cambio.learnerId, {
      cuando: cambio.decidedAt,
      titulo: `Cambio de fase · ${cambio.fromPhase} → ${cambio.toPhase}`,
      quien: cambio.decidedBy.fullName,
      observacion: cambio.note?.trim() || null,
    });
  }
  for (const hito of hitos) {
    if (!hito.achievedAt) continue;
    agregar(hito.learnerId, {
      cuando: hito.achievedAt,
      titulo: `Hito: ${hito.kind}`,
      quien: hito.recordedBy?.fullName ?? null,
      observacion: null,
    });
  }
  for (const baja of bajas) {
    agregar(baja.learnerId, {
      cuando: baja.createdAt,
      titulo: baja.toStatus === "RETIRADO" ? "Dado de baja" : "Reactivado",
      quien: baja.decidedBy.fullName,
      observacion: baja.reason?.trim() || null,
    });
  }

  const personas = aprendices.map((aprendiz) => {
    const movimientos = (porAprendiz.get(aprendiz.id) ?? []).sort(
      (a, b) => a.cuando.getTime() - b.cuando.getTime(),
    );
    const nombre = [aprendiz.person.firstName, aprendiz.person.lastName]
      .filter(Boolean)
      .join(" ");
    return {
      learnerId: aprendiz.id,
      personId: aprendiz.personId,
      nombre,
      telefono: aprendiz.person.callPhone ?? aprendiz.person.whatsappPhone,
      fase: aprendiz.phase,
      consolidador: aprendiz.consolidator?.fullName ?? null,
      movimientos,
      ultimoContacto: ultimoPorAprendiz.get(aprendiz.id) ?? null,
    };
  });

  // Primero quienes más se movieron; las que no se tocaron, al final.
  personas.sort((a, b) => b.movimientos.length - a.movimientos.length);

  return { personas, total };
}
