import { Prisma } from "@iglesia/prisma-client";
import { ETIQUETA_HITO } from "@/lib/administracion";
import { telefonoLegible, ZONA_HORARIA } from "@/lib/dominio";
import {
  type Desglose,
  type Etiqueta,
  type Extremo,
  type Indicador,
  type MovimientosOp72,
  type PestanaLlamadas,
  ROTULO_INDICADOR,
  type Salto,
  ETIQUETA_EXTREMO,
  grupoDelSalto,
  tituloDelSalto,
} from "@/lib/informe-detalle-catalogo";
import type { Rango } from "@/lib/informe";
import type { ClientePrisma } from "@/lib/prisma";

export * from "@/lib/informe-detalle-catalogo";

/// **El desglose de cada indicador del informe, y el histórico de Operación
/// 72.** Lo que los totales nunca contestan: quiénes fueron, qué día, a qué
/// hora y quién lo hizo.
///
/// Dos reglas que gobiernan este módulo:
///
/// 1. **Un solo viaje a la base por ventana.** Con `PrismaPg max: 1` las
///    consultas se serializan (§12.5), así que cada desglose es UNA consulta:
///    el total viaja en la misma fila con `count(*) OVER ()` en vez de pedirlo
///    aparte.
/// 2. **Nada se carga hasta que alguien abre la ventana.** Si el informe
///    trajera los seis desgloses por si acaso, serían seis viajes más en cada
///    carga, para datos que casi nunca se miran.
///
/// El día y la hora se escriben **aquí**, en hora de Colombia, y viajan ya
/// hechos: formatearlos en el navegador es la trampa de las cinco horas.

const DIA_FILA = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: ZONA_HORARIA,
});

const HORA_FILA = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

/// Cuántas filas trae la ventana. Medido el 15-oct-2026: en una semana el
/// indicador más grande son 89 marcaciones, pero en un mes son 735 — por eso
/// hay tope y por eso el pie dice siempre cuántas se están viendo.
const TOPE = 60;

/// **Desde cuándo se puede reconstruir el histórico de Operación 72.** No hay
/// tabla de historial: los saltos se derivan de `audit_log`, y la primera
/// acción de Operación 72 que quedó auditada es del **15-ago-2026** (medido:
/// `contacto_registrado` y `visita_agendada`, ambas ese día). Antes de esa
/// fecha el histórico está vacío por fuerza, y eso **se dice en pantalla** en
/// vez de pintar un cero que parezca un dato.
export const INICIO_AUDITORIA_OP72 = new Date("2026-08-15T05:00:00.000Z");

function dia(fecha: Date) {
  return DIA_FILA.format(fecha).replace(".", "").replace(",", "");
}

function hora(fecha: Date) {
  return HORA_FILA.format(fecha);
}

function nombreDe(first: string, last: string | null) {
  return [first, last].filter(Boolean).join(" ");
}

/// Junta las piezas de la línea gris saltándose las que están en blanco: un
/// dato que falta no deja un « · » colgando.
function contexto(...piezas: (string | null | undefined)[]) {
  const limpias = piezas.filter((pieza): pieza is string => Boolean(pieza));
  return limpias.length > 0 ? limpias.join(" · ") : null;
}

/// Las observaciones del equipo vienen de un campo libre y algunas son varios
/// párrafos (medido: 260 caracteres en una sola llamada del 16-oct). En la
/// ventana se recortan para que una fila no empuje a las demás fuera de la
/// pantalla; el expediente las tiene completas.
const TOPE_OBSERVACION = 200;

function comillas(texto: string | null | undefined) {
  const limpio = texto?.trim().replace(/\s+/g, " ");
  if (!limpio) return null;
  if (limpio.length <= TOPE_OBSERVACION) return `«${limpio}»`;
  return `«${limpio.slice(0, TOPE_OBSERVACION).trimEnd()}…»`;
}

const ETIQUETA_ESTADO: Record<string, Etiqueta> = {
  INICIADA: { texto: "Iniciada", tono: "neutro" },
  SEGUIMIENTO: { texto: "Seguimiento", tono: "ambar" },
  CONTACTADA: { texto: "Contactada", tono: "azul" },
  VISITA_PENDIENTE: { texto: "Visita pendiente", tono: "verde" },
  LISTA_PARA_ENTREGA: { texto: "Lista para entrega", tono: "verde" },
  ENTREGADA: { texto: "Entregada", tono: "verde" },
  CERRADA: { texto: "Asistente", tono: "neutro" },
};

function estadoHoy(status: string | null): Etiqueta | null {
  if (!status) return null;
  const base = ETIQUETA_ESTADO[status];
  if (!base) return null;
  return { texto: `Hoy: ${base.texto.toLowerCase()}`, tono: base.tono };
}

/// Cómo salió la llamada, en palabras. `CallOutcome` del esquema.
const ETIQUETA_RESULTADO: Record<string, string> = {
  CONTESTO_BIEN: "contestó bien",
  CONTESTO_REPROGRAMO: "contestó, reprogramó",
  CONTESTO_REGULAR: "contestó, regular",
  CONTESTO_MAL: "contestó mal",
  NO_CONTESTO: "no contestó",
};

function pieDe(mostradas: number, total: number, singular: string, plural: string) {
  if (total === 0) return `No hubo ${plural} en este periodo.`;
  if (mostradas >= total) {
    return total === 1 ? `Una ${singular}.` : `Las ${total} ${plural}, de la más reciente a la más antigua.`;
  }
  return `Mostrando las ${mostradas} más recientes de ${total}.`;
}

// --------------------------------------------------------------- Los 6 indicadores

export async function cargarDesglose(
  prisma: ClientePrisma,
  opciones: { indicador: Indicador; rango: Rango; pestana?: PestanaLlamadas },
): Promise<Desglose> {
  const { indicador, rango } = opciones;
  switch (indicador) {
    case "personas-nuevas":
      return personasNuevas(prisma, rango);
    case "llamadas":
      return llamadas(prisma, rango, opciones.pestana ?? "todas");
    case "visitas":
      return visitas(prisma, rango);
    case "entregadas":
      return entregadas(prisma, rango);
    case "hitos":
      return hitos(prisma, rango);
    case "bajas":
      return bajas(prisma, rango);
  }
}

async function personasNuevas(prisma: ClientePrisma, rango: Rango): Promise<Desglose> {
  const filas = await prisma.$queryRaw<
    {
      id: string;
      cuando: Date;
      status: string;
      learner_id: string;
      first_name: string;
      last_name: string | null;
      call_phone: string | null;
      whatsapp_phone: string | null;
      consolidador: string | null;
      registrada_por: string | null;
      total: number;
    }[]
  >`
    SELECT o.id, o.started_at AS cuando, o.status::text AS status,
           lp.id AS learner_id, p.first_name, p.last_name,
           p.call_phone, p.whatsapp_phone,
           cons.full_name AS consolidador, reg.full_name AS registrada_por,
           count(*) OVER ()::int AS total
    FROM operation72 o
    JOIN learner_profile lp ON lp.id = o.learner_id
    JOIN person p ON p.id = lp.person_id
    LEFT JOIN app_user cons ON cons.id = lp.consolidator_id
    LEFT JOIN app_user reg ON reg.id = lp.registered_by_id
    WHERE o.started_at BETWEEN ${rango.desde} AND ${rango.hasta}
    ORDER BY o.started_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;
  const sinConsolidador = filas.filter((fila) => !fila.consolidador).length;

  return {
    rotulo: ROTULO_INDICADOR["personas-nuevas"],
    titulo: `${total} ${total === 1 ? "persona entró" : "personas entraron"} al tablero`,
    subtitulo: rango.etiqueta,
    aviso:
      sinConsolidador > 0
        ? `${sinConsolidador} de estas ${sinConsolidador === 1 ? "no tiene" : "no tienen"} consolidador asignado: nadie las va a llamar hasta que se les reparta.`
        : null,
    pestanas: null,
    filas: filas.map((fila) => ({
      id: fila.id,
      dia: dia(fila.cuando),
      hora: hora(fila.cuando),
      nombre: nombreDe(fila.first_name, fila.last_name),
      learnerId: fila.learner_id,
      contexto: contexto(
        telefonoLegible(fila.call_phone ?? fila.whatsapp_phone),
        fila.consolidador ? `consolida ${fila.consolidador}` : "sin consolidador",
        fila.registrada_por ? `la registró ${fila.registrada_por}` : null,
      ),
      observacion: null,
      chip: ETIQUETA_ESTADO[fila.status] ?? null,
      marca: null,
    })),
    total,
    pie: `${pieDe(filas.length, total, "persona nueva", "personas nuevas")} La etiqueta de la derecha es dónde está cada una hoy.`,
    enlace: {
      texto: "Abrir persona por persona",
      href: `/administracion/informe/personas?desde=${rango.inicio}&hasta=${rango.fin}&filtro=todas`,
    },
  };
}

/// **Llamadas: dos cifras que no son lo mismo.** La grande son las marcaciones
/// del discador (`call_log`); de ellas, las «registradas» son las que tienen un
/// formulario de llamada de esa misma persona dentro del periodo — y el
/// formulario es lo único que mueve la tarjeta (§6).
///
/// ⚠️ **La marca es por PERSONA dentro del periodo, no por marcación.** No hay
/// ningún vínculo entre una marcación y un formulario: HighLevel no lo manda.
/// Decir «esta llamada quedó registrada» sería inventar una relación que no
/// existe, así que la marca dice lo que de verdad se sabe.
async function llamadas(
  prisma: ClientePrisma,
  rango: Rango,
  pestana: PestanaLlamadas,
): Promise<Desglose> {
  const filas = await prisma.$queryRaw<
    {
      total: number;
      con: number;
      sin: number;
      id: string | null;
      cuando: Date | null;
      answered: boolean | null;
      duration_seconds: number | null;
      direction: string | null;
      contact_name: string | null;
      caller_name: string | null;
      caller_user: string | null;
      first_name: string | null;
      last_name: string | null;
      learner_id: string | null;
      registrada: boolean | null;
    }[]
  >`
    WITH base AS (
      SELECT cl.id, cl.started_at, cl.answered, cl.duration_seconds, cl.direction,
             cl.contact_name, cl.caller_name,
             u.full_name AS caller_user,
             p.first_name, p.last_name, lp.id AS learner_id,
             EXISTS (
               SELECT 1 FROM contact_attempt ca
               JOIN operation72 o ON o.id = ca.operation72_id
               WHERE o.learner_id = lp.id
                 AND ca.type IN ('LLAMADA','INTENTO_LLAMADA')
                 AND ca.annulled_at IS NULL
                 AND ca.occurred_at BETWEEN ${rango.desde} AND ${rango.hasta}
             ) AS registrada
      FROM call_log cl
      LEFT JOIN app_user u ON u.id = cl.app_user_id
      LEFT JOIN highlevel_contact hc ON hc.contact_id = cl.contact_id
      LEFT JOIN person p ON p.id = hc.person_id
      LEFT JOIN learner_profile lp ON lp.person_id = p.id
      WHERE cl.started_at BETWEEN ${rango.desde} AND ${rango.hasta}
    ), cuentas AS (
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE registrada)::int AS con,
             count(*) FILTER (WHERE NOT registrada)::int AS sin
      FROM base
    )
    SELECT c.total, c.con, c.sin,
           b.id, b.started_at AS cuando, b.answered, b.duration_seconds, b.direction,
           b.contact_name, b.caller_name, b.caller_user,
           b.first_name, b.last_name, b.learner_id, b.registrada
    FROM cuentas c
    LEFT JOIN LATERAL (
      SELECT * FROM base
      WHERE ${pestana} = 'todas'
         OR (${pestana} = 'registradas' AND base.registrada)
         OR (${pestana} = 'sin-registrar' AND NOT base.registrada)
      ORDER BY base.started_at DESC
      LIMIT ${TOPE}
    ) b ON true
  `;

  const total = filas[0]?.total ?? 0;
  const con = filas[0]?.con ?? 0;
  const sin = filas[0]?.sin ?? 0;
  const conDatos = filas.filter((fila) => fila.id !== null);
  const enPestana = pestana === "registradas" ? con : pestana === "sin-registrar" ? sin : total;

  return {
    rotulo: ROTULO_INDICADOR.llamadas,
    titulo: `${total} ${total === 1 ? "marcación" : "marcaciones"} del discador`,
    subtitulo: rango.etiqueta,
    aviso:
      sin > 0
        ? `${sin} de las ${total} se marcaron a personas que no tienen ningún formulario de llamada en el periodo. La marcación prueba que se llamó, pero solo el formulario mueve la tarjeta.`
        : null,
    pestanas: [
      { clave: "todas", etiqueta: `Todas · ${total}`, activa: pestana === "todas" },
      { clave: "registradas", etiqueta: `Con formulario · ${con}`, activa: pestana === "registradas" },
      { clave: "sin-registrar", etiqueta: `Sin formulario · ${sin}`, activa: pestana === "sin-registrar" },
    ],
    filas: conDatos.map((fila) => ({
      id: fila.id as string,
      dia: dia(fila.cuando as Date),
      hora: hora(fila.cuando as Date),
      nombre:
        nombreDe(fila.first_name ?? "", fila.last_name) ||
        fila.contact_name ||
        "Contacto sin nombre",
      learnerId: fila.learner_id,
      contexto: contexto(
        fila.caller_user || fila.caller_name ? `marcó ${fila.caller_user ?? fila.caller_name}` : "sin saber quién marcó",
        fila.direction === "inbound" ? "entrante" : "saliente",
        duracion(fila.duration_seconds ?? 0),
      ),
      observacion: null,
      chip: fila.answered
        ? { texto: "Contestó", tono: "verde" }
        : { texto: "No contestó", tono: "neutro" },
      marca: fila.registrada
        ? { texto: "✓ con formulario", tono: "verde" }
        : { texto: "— sin formulario", tono: "ambar" },
    })),
    total: enPestana,
    pie: `${pieDe(conDatos.length, enPestana, "marcación", "marcaciones")} «Con formulario» se mira por persona dentro del periodo: HighLevel no dice qué formulario corresponde a qué marcación.`,
    enlace: { texto: "Abrir el tablero de llamadas", href: "/administracion/llamadas" },
  };
}

function duracion(segundos: number) {
  if (segundos <= 0) return "sin duración";
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  if (minutos === 0) return `${resto} s`;
  return `${minutos} min ${String(resto).padStart(2, "0")} s`;
}

async function visitas(prisma: ClientePrisma, rango: Rango): Promise<Desglose> {
  const filas = await prisma.$queryRaw<
    {
      id: string;
      cuando: Date;
      scheduled_at: Date | null;
      place: string | null;
      is_virtual: boolean;
      note: string | null;
      annulled_at: Date | null;
      learner_id: string;
      first_name: string;
      last_name: string | null;
      registrada_por: string | null;
      status: string;
      total: number;
    }[]
  >`
    SELECT ca.id, ca.occurred_at AS cuando, ca.scheduled_at, ca.place, ca.is_virtual,
           ca.note, ca.annulled_at,
           lp.id AS learner_id, p.first_name, p.last_name,
           u.full_name AS registrada_por, o.status::text AS status,
           count(*) OVER ()::int AS total
    FROM contact_attempt ca
    JOIN operation72 o ON o.id = ca.operation72_id
    JOIN learner_profile lp ON lp.id = o.learner_id
    JOIN person p ON p.id = lp.person_id
    LEFT JOIN app_user u ON u.id = ca.by_user_id
    WHERE ca.type = 'VISITA' AND ca.occurred_at BETWEEN ${rango.desde} AND ${rango.hasta}
    ORDER BY ca.occurred_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;
  const anuladas = filas.filter((fila) => fila.annulled_at).length;

  return {
    rotulo: ROTULO_INDICADOR.visitas,
    titulo: `${total} ${total === 1 ? "visita acordada" : "visitas acordadas"}`,
    subtitulo: rango.etiqueta,
    aviso:
      anuladas > 0
        ? `${anuladas} de estas se anularon después por haberse agendado a la persona equivocada. Se cuentan porque el recuadro del informe también las cuenta; van marcadas.`
        : null,
    pestanas: null,
    filas: filas.map((fila) => ({
      id: fila.id,
      dia: dia(fila.cuando),
      hora: hora(fila.cuando),
      nombre: nombreDe(fila.first_name, fila.last_name),
      learnerId: fila.learner_id,
      contexto: contexto(
        fila.registrada_por ? `la agendó ${fila.registrada_por}` : "entró por el formulario",
        fila.scheduled_at ? `para el ${dia(fila.scheduled_at)} a las ${hora(fila.scheduled_at)}` : "sin fecha pactada",
        fila.is_virtual ? "virtual" : fila.place,
      ),
      observacion: comillas(fila.note),
      chip: ETIQUETA_ESTADO[fila.status] ?? null,
      marca: fila.annulled_at ? { texto: "anulada después", tono: "rojo" } : null,
    })),
    total,
    pie: pieDe(filas.length, total, "visita", "visitas"),
    enlace: { texto: "Abrir el tablero de Operación 72", href: "/operacion-72" },
  };
}

async function entregadas(prisma: ClientePrisma, rango: Rango): Promise<Desglose> {
  const filas = await prisma.$queryRaw<
    {
      id: string;
      cuando: Date;
      keeps_line: boolean;
      reason: string | null;
      learner_id: string;
      first_name: string;
      last_name: string | null;
      mentor: string;
      autorizada_por: string | null;
      phase: string;
      total: number;
    }[]
  >`
    SELECT mr.id, mr.started_at AS cuando, mr.keeps_line, mr.reason,
           lp.id AS learner_id, p.first_name, p.last_name,
           m.full_name AS mentor, aut.full_name AS autorizada_por,
           lp.phase::text AS phase,
           count(*) OVER ()::int AS total
    FROM mentor_relationship mr
    JOIN learner_profile lp ON lp.id = mr.learner_id
    JOIN person p ON p.id = lp.person_id
    JOIN app_user m ON m.id = mr.mentor_id
    LEFT JOIN app_user aut ON aut.id = mr.authorized_by_id
    WHERE mr.started_at BETWEEN ${rango.desde} AND ${rango.hasta}
    ORDER BY mr.started_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;

  return {
    rotulo: ROTULO_INDICADOR.entregadas,
    titulo: `${total} ${total === 1 ? "persona entregada" : "personas entregadas"} a un mentor`,
    subtitulo: rango.etiqueta,
    aviso: null,
    pestanas: null,
    filas: filas.map((fila) => ({
      id: fila.id,
      dia: dia(fila.cuando),
      hora: hora(fila.cuando),
      nombre: nombreDe(fila.first_name, fila.last_name),
      learnerId: fila.learner_id,
      contexto: contexto(
        `a ${fila.mentor}`,
        fila.autorizada_por ? `la autorizó ${fila.autorizada_por}` : null,
        fila.keeps_line ? "conserva la línea de quien la invitó" : null,
      ),
      observacion: comillas(fila.reason),
      chip: { texto: "Entregada", tono: "verde" },
      marca: null,
    })),
    total,
    pie: pieDe(filas.length, total, "entrega", "entregas"),
    enlace: null,
  };
}

async function hitos(prisma: ClientePrisma, rango: Rango): Promise<Desglose> {
  const filas = await prisma.$queryRaw<
    {
      id: string;
      cuando: Date;
      kind: string;
      detail: string | null;
      learner_id: string;
      first_name: string;
      last_name: string | null;
      registrado_por: string | null;
      total: number;
    }[]
  >`
    SELECT ms.id, ms.achieved_at AS cuando, ms.kind::text AS kind, ms.detail,
           lp.id AS learner_id, p.first_name, p.last_name,
           u.full_name AS registrado_por,
           count(*) OVER ()::int AS total
    FROM milestone ms
    JOIN learner_profile lp ON lp.id = ms.learner_id
    JOIN person p ON p.id = lp.person_id
    LEFT JOIN app_user u ON u.id = ms.recorded_by_id
    WHERE ms.status = 'COMPLETADO' AND ms.achieved_at BETWEEN ${rango.desde} AND ${rango.hasta}
    ORDER BY ms.achieved_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;

  // Cuántos de cada tipo, para el resumen de arriba. Sale de las filas que ya
  // están en memoria: pedirlo a la base otra vez sería un viaje regalado.
  const porTipo = new Map<string, number>();
  for (const fila of filas) {
    porTipo.set(fila.kind, (porTipo.get(fila.kind) ?? 0) + 1);
  }
  const resumen = Array.from(porTipo.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([kind, cuantos]) => `${ETIQUETA_HITO[kind as keyof typeof ETIQUETA_HITO] ?? kind}: ${cuantos}`)
    .join(" · ");

  return {
    rotulo: ROTULO_INDICADOR.hitos,
    titulo: `${total} ${total === 1 ? "hito conseguido" : "hitos conseguidos"}`,
    subtitulo: resumen ? `${rango.etiqueta} · ${resumen}` : rango.etiqueta,
    aviso: null,
    pestanas: null,
    filas: filas.map((fila) => ({
      id: fila.id,
      dia: dia(fila.cuando),
      hora: hora(fila.cuando),
      nombre: nombreDe(fila.first_name, fila.last_name),
      learnerId: fila.learner_id,
      contexto: fila.registrado_por
        ? `lo marcó ${fila.registrado_por}`
        : "lo marcó el sistema",
      observacion: comillas(fila.detail),
      chip: {
        texto: ETIQUETA_HITO[fila.kind as keyof typeof ETIQUETA_HITO] ?? fila.kind,
        tono: "azul",
      },
      marca: null,
    })),
    total,
    pie: pieDe(filas.length, total, "hito", "hitos"),
    enlace: null,
  };
}

async function bajas(prisma: ClientePrisma, rango: Rango): Promise<Desglose> {
  const filas = await prisma.$queryRaw<
    {
      id: string;
      cuando: Date;
      reason: string | null;
      learner_id: string;
      first_name: string;
      last_name: string | null;
      decidida_por: string;
      pedida_por: string | null;
      status: string;
      reactivada: Date | null;
      total: number;
    }[]
  >`
    SELECT sc.id, sc.created_at AS cuando, sc.reason,
           lp.id AS learner_id, p.first_name, p.last_name,
           dec.full_name AS decidida_por, sol.full_name AS pedida_por,
           lp.status::text AS status,
           (SELECT max(v.created_at) FROM learner_status_change v
            WHERE v.learner_id = lp.id AND v.to_status = 'ACTIVO'
              AND v.created_at > sc.created_at) AS reactivada,
           count(*) OVER ()::int AS total
    FROM learner_status_change sc
    JOIN learner_profile lp ON lp.id = sc.learner_id
    JOIN person p ON p.id = lp.person_id
    JOIN app_user dec ON dec.id = sc.decided_by_id
    LEFT JOIN LATERAL (
      SELECT br.requested_by_id FROM baja_request br
      WHERE br.learner_id = lp.id AND br.status = 'AUTORIZADA'
      ORDER BY br.created_at DESC LIMIT 1
    ) pet ON true
    LEFT JOIN app_user sol ON sol.id = pet.requested_by_id
    WHERE sc.to_status = 'RETIRADO' AND sc.created_at BETWEEN ${rango.desde} AND ${rango.hasta}
    ORDER BY sc.created_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;
  const vueltas = filas.filter((fila) => fila.reactivada).length;

  return {
    rotulo: ROTULO_INDICADOR.bajas,
    titulo: `${total} ${total === 1 ? "persona dada" : "personas dadas"} de baja`,
    subtitulo: rango.etiqueta,
    aviso:
      vueltas > 0
        ? `${vueltas} de estas ${vueltas === 1 ? "volvió" : "volvieron"} después: están reactivadas y van marcadas.`
        : null,
    pestanas: null,
    filas: filas.map((fila) => ({
      id: fila.id,
      dia: dia(fila.cuando),
      hora: hora(fila.cuando),
      nombre: nombreDe(fila.first_name, fila.last_name),
      learnerId: fila.learner_id,
      contexto: contexto(
        fila.pedida_por ? `la pidió ${fila.pedida_por}` : null,
        `la autorizó ${fila.decidida_por}`,
      ),
      observacion: comillas(fila.reason),
      chip: fila.reactivada
        ? { texto: "Reactivada", tono: "verde" }
        : { texto: "Retirada", tono: "rojo" },
      marca: fila.reactivada ? { texto: `volvió el ${dia(fila.reactivada)}`, tono: "verde" } : null,
    })),
    total,
    pie: pieDe(filas.length, total, "baja", "bajas"),
    enlace: { texto: "Abrir dados de baja", href: "/administracion/dados-de-baja" },
  };
}

// ------------------------------------------- El histórico de Operación 72

/// Las acciones de `audit_log` que mueven una tarjeta de columna, y a qué
/// columna la dejan.
///
/// ⚠️ **DOS TRAMPAS, las dos medidas el 15-oct-2026 y las dos capaces de
/// producir un histórico que parece correcto y es falso:**
///
/// 1. **Las acciones de Operación 72 se auditan con DOS `entity_type`
///    distintos** — unas con `operation72` (el id de la tarjeta) y otras con
///    `learner_profile` (el id del expediente) — y `operacion72.entregada`
///    está **partida entre los dos** (89 y 23 filas). Si se agrupa por
///    `entity_id` a secas, el `LAG` nunca encuentra el paso anterior y TODO
///    sale como «sin origen»: medido, 80 de 136 movimientos. Por eso se
///    traduce todo a `learner_id` antes de ordenar.
/// 2. **El origen no viene escrito salvo en tres acciones.** Se deduce con un
///    `LAG` sobre los pasos de esa misma persona. Cuando no hay paso anterior y
///    el destino es INICIADA, la tarjeta acaba de nacer; si el destino es otro,
///    es una tarjeta que ya existía antes de la auditoría y se dice
///    `SIN_REGISTRO` en vez de inventarle un origen.
const PASOS_SQL = Prisma.sql`
  WITH crudo AS (
    SELECT a.created_at, a.action, a.metadata, a.actor_id,
           COALESCE(o.learner_id, a.entity_id) AS learner_id
    FROM audit_log a
    LEFT JOIN operation72 o ON a.entity_type = 'operation72' AND o.id = a.entity_id
    WHERE a.action IN (
      'operacion72.iniciada',
      'operacion72.contacto_registrado',
      'operacion72.visita_agendada',
      'operacion72.visita_cerrada',
      'operacion72.pasa_a_entrega_por_proceso_previo',
      'operacion72.entregada',
      'operacion72.marcado_asistente',
      'operacion72.columna_reasignada',
      'operacion72.estado_corregido',
      'operacion72.regresa_tras_baja'
    )
  ), pasos AS (
    SELECT learner_id, created_at, actor_id, metadata,
      CASE action
        WHEN 'operacion72.iniciada' THEN 'INICIADA'
        WHEN 'operacion72.contacto_registrado' THEN
          CASE WHEN metadata->>'contactada' = 'true' THEN 'CONTACTADA' ELSE 'SEGUIMIENTO' END
        WHEN 'operacion72.visita_agendada' THEN 'VISITA_PENDIENTE'
        WHEN 'operacion72.visita_cerrada' THEN 'LISTA_PARA_ENTREGA'
        WHEN 'operacion72.pasa_a_entrega_por_proceso_previo' THEN 'LISTA_PARA_ENTREGA'
        WHEN 'operacion72.entregada' THEN 'ENTREGADA'
        WHEN 'operacion72.marcado_asistente' THEN 'CERRADA'
        WHEN 'operacion72.columna_reasignada' THEN upper(metadata->>'hasta')
        WHEN 'operacion72.estado_corregido' THEN upper(metadata->>'a')
        WHEN 'operacion72.regresa_tras_baja' THEN upper(metadata->>'destino')
      END AS hacia
    FROM crudo
  ), con_origen AS (
    SELECT learner_id, created_at, actor_id, metadata, hacia,
           LAG(hacia) OVER (PARTITION BY learner_id ORDER BY created_at) AS previo
    FROM pasos
  ), saltos AS (
    SELECT learner_id, created_at, actor_id, metadata, hacia,
           COALESCE(previo, CASE WHEN hacia = 'INICIADA' THEN 'NUEVA' ELSE 'SIN_REGISTRO' END) AS desde
    FROM con_origen
    WHERE hacia IS NOT NULL
  )
`;

/// **Cómo se movió el tablero en el periodo.** Esto sí se carga con el informe,
/// porque es un bloque que se ve siempre; es un viaje más a la base y está
/// contado.
export async function cargarMovimientosOp72(
  prisma: ClientePrisma,
  rango: Rango,
): Promise<MovimientosOp72> {
  const filas = await prisma.$queryRaw<
    { desde: string; hacia: string; cuantas: number }[]
  >`
    ${PASOS_SQL}
    SELECT desde, hacia, count(*)::int AS cuantas
    FROM saltos
    WHERE created_at BETWEEN ${rango.desde} AND ${rango.hasta}
    GROUP BY desde, hacia
    ORDER BY cuantas DESC
  `;

  const saltos: Salto[] = filas
    .filter((fila) => esExtremo(fila.desde) && esExtremo(fila.hacia))
    .map((fila) => ({
      desde: fila.desde as Extremo,
      hacia: fila.hacia as Extremo,
      cuantas: fila.cuantas,
      grupo: grupoDelSalto(fila.desde as Extremo, fila.hacia as Extremo),
    }));

  return {
    saltos,
    total: saltos.reduce((suma, salto) => suma + salto.cuantas, 0),
    sinOrigen: saltos
      .filter((salto) => salto.desde === "SIN_REGISTRO")
      .reduce((suma, salto) => suma + salto.cuantas, 0),
    antesDeLaAuditoria: rango.desde < INICIO_AUDITORIA_OP72,
  };
}

function esExtremo(valor: string | null): valor is Extremo {
  return valor !== null && valor in ETIQUETA_EXTREMO;
}

/// Quiénes hicieron un salto concreto. La observación sale del intento de
/// contacto registrado a la misma hora, que es lo que explica el movimiento.
export async function cargarPersonasDelSalto(
  prisma: ClientePrisma,
  opciones: { rango: Rango; desde: Extremo; hacia: Extremo },
): Promise<Desglose> {
  const { rango, desde, hacia } = opciones;

  const filas = await prisma.$queryRaw<
    {
      cuando: Date;
      learner_id: string;
      first_name: string;
      last_name: string | null;
      quien: string | null;
      resultado: string | null;
      nota: string | null;
      status: string | null;
      total: number;
    }[]
  >`
    ${PASOS_SQL}
    SELECT s.created_at AS cuando, s.learner_id,
           p.first_name, p.last_name,
           u.full_name AS quien,
           s.metadata->>'resultado' AS resultado,
           nota.note AS nota,
           o.status::text AS status,
           count(*) OVER ()::int AS total
    FROM saltos s
    JOIN learner_profile lp ON lp.id = s.learner_id
    JOIN person p ON p.id = lp.person_id
    LEFT JOIN app_user u ON u.id = s.actor_id
    LEFT JOIN operation72 o ON o.learner_id = s.learner_id
    LEFT JOIN LATERAL (
      SELECT ca.note FROM contact_attempt ca
      WHERE ca.operation72_id = o.id
        AND ca.occurred_at BETWEEN s.created_at - interval '10 minutes'
                              AND s.created_at + interval '10 minutes'
      ORDER BY ca.occurred_at DESC
      LIMIT 1
    ) nota ON true
    WHERE s.created_at BETWEEN ${rango.desde} AND ${rango.hasta}
      AND s.desde = ${desde} AND s.hacia = ${hacia}
    ORDER BY s.created_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;
  const titulo = tituloDelSalto(desde, hacia);

  return {
    rotulo: "CÓMO SE MOVIÓ OPERACIÓN 72",
    titulo: `${total} ${total === 1 ? "persona" : "personas"} · ${titulo.toLowerCase()}`,
    subtitulo: rango.etiqueta,
    aviso:
      desde === "SIN_REGISTRO"
        ? "De estas no se sabe de qué columna venían: su tarjeta ya existía cuando empezó la auditoría, en agosto de 2026."
        : null,
    pestanas: null,
    filas: filas.map((fila, indice) => ({
      id: `${fila.learner_id}-${indice}`,
      dia: dia(fila.cuando),
      hora: hora(fila.cuando),
      nombre: nombreDe(fila.first_name, fila.last_name),
      learnerId: fila.learner_id,
      contexto: contexto(
        // Sin actor significa que el movimiento entró por el formulario público
        // de HighLevel, que es como trabaja el equipo de consolidación: no
        // tienen cuenta en la plataforma (§6). Decir «lo movió el sistema»
        // sería falso — lo movió una persona, llenando el formulario.
        fila.quien ? `lo registró ${fila.quien}` : "entró por el formulario",
        fila.resultado ? ETIQUETA_RESULTADO[fila.resultado] ?? fila.resultado : null,
      ),
      observacion: comillas(fila.nota),
      chip: estadoHoy(fila.status),
      marca: marcaDeAvance(hacia, fila.status),
    })),
    total,
    pie: `${pieDe(filas.length, total, "persona", "personas")} La hora es la del salto; la etiqueta de la derecha es dónde está hoy, que puede ser otra columna.`,
    enlace: { texto: "Abrir el tablero de Operación 72", href: "/operacion-72" },
  };
}

/// Si la persona se movió otra vez después del salto que se está mirando. Es lo
/// que evita que la lista engañe: alguien que pasó a contactada el lunes puede
/// estar entregada el jueves.
function marcaDeAvance(hacia: Extremo, status: string | null): Etiqueta | null {
  if (!status || status === hacia) return null;
  if (status === "CERRADA") return { texto: "salió del tablero", tono: "neutro" };
  if (status === "ENTREGADA") return { texto: "ya se entregó", tono: "verde" };
  return { texto: "siguió moviéndose", tono: "neutro" };
}
