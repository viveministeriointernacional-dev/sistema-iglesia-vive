import { Prisma } from "@iglesia/prisma-client";
import {
  comillas,
  contexto,
  dia,
  estadoHoy,
  ETIQUETA_RESULTADO,
  hora,
  nombreDe,
  pieDe,
  quienLoHizo,
  TOPE,
} from "@/lib/detalle-filas";
import type { Desglose, Etiqueta } from "@/lib/informe-detalle-catalogo";
import { INICIO_AUDITORIA_OP72 } from "@/lib/informe-detalle";
import {
  ETIQUETA_LISTA,
  ETIQUETA_PUERTA,
  FRASE_PUERTA,
  type Lista,
  LISTAS,
  type MovimientoDelTablero,
  type PestanaSalida,
  type Puerta,
} from "@/lib/movimiento-op72-catalogo";
import type { Rango } from "@/lib/informe";
import type { ClientePrisma } from "@/lib/prisma";

/// **Cuántas entraron a cada lista del tablero, y cuántas salieron de
/// Operación 72, dentro de un periodo.** Es lo que alimenta el ⊕ de cada
/// contador y el ⊖ rojo del final.
///
/// ## Por qué esto no reusa la cadena del informe
///
/// `informe-detalle.ts` reconstruye lo mismo, pero **recorriendo `audit_log`
/// entero** y calculando el `LAG` sobre toda la historia. Ahí da igual: el
/// informe lo abre un administrador de vez en cuando. Aquí no — el tablero lo
/// abre el equipo todo el día.
///
/// Medido el 16-oct-2026 sobre la base de producción: aquella consulta tardaba
/// **115 ms con dos recorridos secuenciales** (`audit_log` y `operation72`), y
/// habría empeorado para siempre, porque `audit_log` solo crece. La de aquí
/// tarda **21 ms sin un solo recorrido de tabla**, y lo que cuesta depende de
/// cuánta gente se movió esa semana, no de cuánta historia hay. El truco son
/// dos pasos:
///
/// 1. **`tocados`**: quiénes se movieron en el periodo, por el índice
///    `audit_log(created_at)` que ya existía.
/// 2. **`claves`**: para esos pocos expedientes, sus filas de auditoría por el
///    índice `(entity_type, entity_id)`.
///
/// El paso 2 es donde vive la trampa de §12.4: **las acciones de Operación 72
/// se auditan con DOS `entity_type` distintos** —unas contra `operation72` (el
/// id de la tarjeta) y otras contra `learner_profile` (el id del expediente)—
/// y `operacion72.entregada` está partida entre los dos. Por eso `claves` arma
/// **las dos llaves de cada expediente** antes de buscar: con una sola, la
/// mitad de la historia desaparece sin que nada falle, y el `LAG` devuelve
/// orígenes inventados.
///
/// ## Qué cuenta el ⊕, exactamente
///
/// **Las que ENTRARON a la lista, no las que estaban.** Volver a llamar a
/// alguien de Seguimiento y que no conteste deja la tarjeta donde estaba: eso
/// es un giro en el sitio (`desde = hacia`) y **no se suma**. Medido el
/// 16-oct: de las 8 «entradas» a Seguimiento de esa semana, 4 eran justo eso.
/// Si se sumaran, el ⊕ diría 8 y la cuenta no cerraría contra el contador.
/// Se cuentan aparte (`siguieronAhi`) y se dicen dentro de la ventana, que
/// para eso son trabajo hecho.

/// Las acciones que mueven una tarjeta de columna. **Las dos últimas son las
/// dos puertas de baja**, y son dos de verdad: desde el tablero se audita
/// `operacion72.dado_de_baja` y desde Administración
/// `administracion.dado_de_baja`. Medido el 16-oct: de las 8 bajas de esa
/// semana, **una entró por la segunda** — con solo la primera, el ⊖ habría
/// contado 7 y nadie lo habría notado.
const ACCIONES = [
  "operacion72.iniciada",
  "operacion72.contacto_registrado",
  "operacion72.visita_agendada",
  "operacion72.visita_cerrada",
  "operacion72.pasa_a_entrega_por_proceso_previo",
  "operacion72.entregada",
  "operacion72.marcado_asistente",
  "operacion72.columna_reasignada",
  "operacion72.estado_corregido",
  "operacion72.regresa_tras_baja",
  "operacion72.dado_de_baja",
  "administracion.dado_de_baja",
];

/// Los tres destinos que sacan a alguien del tablero.
const FUERA = ["ENTREGADA", "CERRADA", "BAJA"];

/// La cadena de pasos, acotada al periodo y al alcance de quien mira.
///
/// Termina en `movimientos`, con una fila por salto: de dónde venía, a dónde
/// fue, cuándo y quién. Las consultas de abajo solo le ponen el `WHERE` y el
/// `SELECT` que necesitan.
function cadena(rango: Rango, consolidadorId: string | null) {
  return Prisma.sql`
    WITH tocados AS (
      SELECT DISTINCT COALESCE(o.learner_id, a.entity_id) AS learner_id
      FROM audit_log a
      LEFT JOIN operation72 o ON a.entity_type = 'operation72' AND o.id = a.entity_id
      WHERE a.created_at BETWEEN ${rango.desde} AND ${rango.hasta}
        AND a.action IN (${Prisma.join(ACCIONES)})
    ), claves AS (
      SELECT t.learner_id, 'learner_profile'::text AS entity_type, t.learner_id AS entity_id
      FROM tocados t
      UNION ALL
      SELECT t.learner_id, 'operation72'::text, o.id
      FROM tocados t JOIN operation72 o ON o.learner_id = t.learner_id
    ), crudo AS (
      SELECT k.learner_id, a.created_at, a.action, a.metadata, a.actor_id
      FROM claves k
      JOIN audit_log a ON a.entity_type = k.entity_type AND a.entity_id = k.entity_id
      WHERE a.action IN (${Prisma.join(ACCIONES)})
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
          WHEN 'operacion72.dado_de_baja' THEN 'BAJA'
          WHEN 'administracion.dado_de_baja' THEN 'BAJA'
          WHEN 'operacion72.columna_reasignada' THEN upper(metadata->>'hasta')
          WHEN 'operacion72.estado_corregido' THEN upper(metadata->>'a')
          WHEN 'operacion72.regresa_tras_baja' THEN upper(metadata->>'destino')
        END AS hacia
      FROM crudo
    ), con_origen AS (
      SELECT learner_id, created_at, actor_id, metadata, hacia,
             LAG(hacia) OVER (PARTITION BY learner_id ORDER BY created_at) AS previo
      FROM pasos
    ), movimientos AS (
      SELECT c.learner_id, c.created_at, c.actor_id, c.metadata, c.hacia,
             COALESCE(c.previo, CASE WHEN c.hacia = 'INICIADA' THEN 'NUEVA' ELSE 'SIN_REGISTRO' END) AS desde
      FROM con_origen c
      JOIN learner_profile lp ON lp.id = c.learner_id
      WHERE c.hacia IS NOT NULL
        AND c.created_at BETWEEN ${rango.desde} AND ${rango.hasta}
        AND (${consolidadorId}::text IS NULL OR lp.consolidator_id = ${consolidadorId}::text)
    )
  `;
}

type FilaTotales = {
  entro_iniciada: number;
  entro_seguimiento: number;
  entro_contactada: number;
  entro_visita_pendiente: number;
  entro_lista_para_entrega: number;
  siguio_iniciada: number;
  siguio_seguimiento: number;
  siguio_contactada: number;
  siguio_visita_pendiente: number;
  siguio_lista_para_entrega: number;
  entregadas: number;
  asistentes: number;
  bajas: number;
};

/// Un solo viaje a la base para los seis botones. Va en el `Promise.all` del
/// tablero, pero con `PrismaPg max: 1` se serializa igual (§12.5): por eso es
/// **una** consulta y no seis.
export async function cargarMovimientoDelTablero(
  prisma: ClientePrisma,
  opciones: { rango: Rango; consolidadorId: string | null },
): Promise<MovimientoDelTablero> {
  const { rango, consolidadorId } = opciones;

  const filas = await prisma.$queryRaw<FilaTotales[]>`
    ${cadena(rango, consolidadorId)}
    SELECT
      count(*) FILTER (WHERE desde <> hacia AND hacia = 'INICIADA')::int AS entro_iniciada,
      count(*) FILTER (WHERE desde <> hacia AND hacia = 'SEGUIMIENTO')::int AS entro_seguimiento,
      count(*) FILTER (WHERE desde <> hacia AND hacia = 'CONTACTADA')::int AS entro_contactada,
      count(*) FILTER (WHERE desde <> hacia AND hacia = 'VISITA_PENDIENTE')::int AS entro_visita_pendiente,
      count(*) FILTER (WHERE desde <> hacia AND hacia = 'LISTA_PARA_ENTREGA')::int AS entro_lista_para_entrega,
      count(*) FILTER (WHERE desde = hacia AND hacia = 'INICIADA')::int AS siguio_iniciada,
      count(*) FILTER (WHERE desde = hacia AND hacia = 'SEGUIMIENTO')::int AS siguio_seguimiento,
      count(*) FILTER (WHERE desde = hacia AND hacia = 'CONTACTADA')::int AS siguio_contactada,
      count(*) FILTER (WHERE desde = hacia AND hacia = 'VISITA_PENDIENTE')::int AS siguio_visita_pendiente,
      count(*) FILTER (WHERE desde = hacia AND hacia = 'LISTA_PARA_ENTREGA')::int AS siguio_lista_para_entrega,
      count(*) FILTER (WHERE hacia = 'ENTREGADA' AND desde <> hacia)::int AS entregadas,
      count(*) FILTER (WHERE hacia = 'CERRADA' AND desde <> hacia)::int AS asistentes,
      count(*) FILTER (WHERE hacia = 'BAJA' AND desde <> ALL(${FUERA}::text[]))::int AS bajas
    FROM movimientos
  `;

  const fila = filas[0];
  const entregadas = fila?.entregadas ?? 0;
  const asistentes = fila?.asistentes ?? 0;
  const bajas = fila?.bajas ?? 0;

  return {
    entraron: {
      INICIADA: fila?.entro_iniciada ?? 0,
      SEGUIMIENTO: fila?.entro_seguimiento ?? 0,
      CONTACTADA: fila?.entro_contactada ?? 0,
      VISITA_PENDIENTE: fila?.entro_visita_pendiente ?? 0,
      LISTA_PARA_ENTREGA: fila?.entro_lista_para_entrega ?? 0,
    },
    siguieronAhi: {
      INICIADA: fila?.siguio_iniciada ?? 0,
      SEGUIMIENTO: fila?.siguio_seguimiento ?? 0,
      CONTACTADA: fila?.siguio_contactada ?? 0,
      VISITA_PENDIENTE: fila?.siguio_visita_pendiente ?? 0,
      LISTA_PARA_ENTREGA: fila?.siguio_lista_para_entrega ?? 0,
    },
    salieron: {
      total: entregadas + asistentes + bajas,
      porPuerta: { entregadas, asistentes, bajas },
    },
    antesDeLaAuditoria: rango.desde < INICIO_AUDITORIA_OP72,
  };
}

/// Las columnas que pinta una fila de la ventana, iguales en las dos consultas.
const COLUMNAS_DE_FILA = Prisma.sql`
  m.created_at AS cuando, m.learner_id, m.desde, m.hacia,
  p.first_name, p.last_name,
  u.full_name AS quien,
  m.metadata->>'resultado' AS resultado,
  m.metadata->>'motivo' AS motivo,
  nota.note AS nota,
  o.status::text AS status,
  count(*) OVER ()::int AS total
`;

/// Los `JOIN` que acompañan a `COLUMNAS_DE_FILA`. La observación sale del
/// intento de contacto registrado a la misma hora, que es lo que explica el
/// movimiento.
const UNIONES_DE_FILA = Prisma.sql`
  JOIN learner_profile lp ON lp.id = m.learner_id
  JOIN person p ON p.id = lp.person_id
  LEFT JOIN app_user u ON u.id = m.actor_id
  LEFT JOIN operation72 o ON o.learner_id = m.learner_id
  LEFT JOIN LATERAL (
    SELECT ca.note FROM contact_attempt ca
    WHERE ca.operation72_id = o.id
      AND ca.occurred_at BETWEEN m.created_at - interval '10 minutes'
                            AND m.created_at + interval '10 minutes'
    ORDER BY ca.occurred_at DESC
    LIMIT 1
  ) nota ON true
`;

type FilaCruda = {
  cuando: Date;
  learner_id: string;
  desde: string;
  hacia: string;
  first_name: string;
  last_name: string | null;
  quien: string | null;
  resultado: string | null;
  motivo: string | null;
  nota: string | null;
  status: string | null;
  total: number;
  /// Cuántas se quedaron en esta misma lista tras un intento nuevo. No están
  /// en las filas (no entraron), pero son trabajo hecho y el pie las dice.
  giros: number;
};

/// De dónde venía, en palabras.
///
/// Además de las cinco columnas hay cinco orígenes que no son columnas, y los
/// cinco salen de verdad en los datos. **`BAJA` apareció al probar** y no
/// estaba previsto: es alguien a quien se dio de baja y volvió al tablero
/// (`operacion72.regresa_tras_baja`). Vale la pena contarlo bien, porque antes
/// de meter la baja en la cadena ese regreso parecía un giro en el sitio —la
/// persona salía y volvía a la misma lista sin nada en medio— y se contaba
/// como «siguió ahí» en lugar de como la entrada que es.
function origenEnPalabras(desde: string): string {
  if (desde === "NUEVA") return "recién registrada";
  if (desde === "SIN_REGISTRO") return "sin registro previo";
  if (desde === "BAJA") return "volvió tras una baja";
  if (desde === "ENTREGADA") return "volvió tras la entrega";
  if (desde === "CERRADA") return "volvió al proceso";
  const etiqueta = ETIQUETA_LISTA[desde as Lista];
  return etiqueta ? `desde ${etiqueta}` : `desde ${desde.toLowerCase()}`;
}

/// **Quiénes entraron a una lista en el periodo.** Es la ventana del ⊕.
export async function cargarEntradasDeLista(
  prisma: ClientePrisma,
  opciones: { rango: Rango; lista: Lista; consolidadorId: string | null },
): Promise<Desglose> {
  const { rango, lista, consolidadorId } = opciones;

  const filas = await prisma.$queryRaw<FilaCruda[]>`
    ${cadena(rango, consolidadorId)}
    SELECT ${COLUMNAS_DE_FILA},
      (SELECT count(*)::int FROM movimientos g
        WHERE g.hacia = ${lista} AND g.desde = g.hacia) AS giros
    FROM movimientos m
    ${UNIONES_DE_FILA}
    WHERE m.hacia = ${lista} AND m.desde <> m.hacia
    ORDER BY m.created_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;
  const nombre = ETIQUETA_LISTA[lista];
  const giros = filas[0]?.giros ?? 0;

  // De dónde vinieron. El número solo no lo dice, y en Contactada es la mitad
  // de la historia: unas contestaron a la primera llamada y otras venían de
  // Seguimiento (§12.6 — un indicador que junta dos hechos distintos miente).
  const origenes = new Map<string, number>();
  for (const fila of filas) {
    origenes.set(fila.desde, (origenes.get(fila.desde) ?? 0) + 1);
  }
  const reparto = [...origenes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([desde, cuantas]) => `${cuantas} ${origenEnPalabras(desde)}`)
    .join(" · ");

  return {
    rotulo: `ENTRARON A ${nombre.toUpperCase()}`,
    titulo: `${total} ${total === 1 ? "persona" : "personas"}`,
    subtitulo: rango.etiqueta,
    // Solo cuando de verdad hubo giros: un aviso que sale siempre se deja de
    // leer (§12.6). En Seguimiento es casi siempre, y ahí es justo el dato que
    // explica por qué el ⊕ no cuadra con el trabajo que hizo el equipo.
    aviso:
      giros > 0
        ? `Además, a ${giros === 1 ? "una persona" : `${giros} personas`} que ya estaba${giros === 1 ? "" : "n"} en ${nombre} se le${giros === 1 ? "" : "s"} volvió a intentar sin que cambiara de lista. No cuentan como entradas, pero el trabajo se hizo.`
        : null,
    pestanas: null,
    filas: filas.map((fila, indice) => ({
      id: `${fila.learner_id}-${indice}`,
      dia: dia(fila.cuando),
      hora: hora(fila.cuando),
      nombre: nombreDe(fila.first_name, fila.last_name),
      learnerId: fila.learner_id,
      contexto: contexto(
        origenEnPalabras(fila.desde),
        fila.resultado ? ETIQUETA_RESULTADO[fila.resultado] ?? fila.resultado : null,
        quienLoHizo(fila.quien),
      ),
      observacion: comillas(fila.nota),
      chip: estadoHoy(fila.status),
      marca: marcaDeSitio(lista, fila.status),
    })),
    total,
    pie: reparto
      ? `${pieDe(filas.length, total, "persona", "personas")} ${reparto}.`
      : pieDe(filas.length, total, "persona", "personas"),
    enlace: { texto: `Ver la columna ${nombre}`, href: `/operacion-72?estado=${lista}` },
  };
}

/// Por qué puerta salió cada quien, según a dónde fue a parar.
function puertaDe(hacia: string): Puerta | null {
  if (hacia === "ENTREGADA") return "entregadas";
  if (hacia === "CERRADA") return "asistentes";
  if (hacia === "BAJA") return "bajas";
  return null;
}

const TONO_PUERTA: Record<Puerta, Etiqueta["tono"]> = {
  entregadas: "verde",
  asistentes: "neutro",
  bajas: "rojo",
};

/// **Quiénes salieron de Operación 72 en el periodo.** Es la ventana del ⊖.
///
/// Abre en «todas» porque es el número que se clicó, y las pestañas separan
/// las tres puertas: entregada a su mentor es el final bueno, asistente es que
/// no quiso proceso y baja es que se perdió. Un solo montón las confundiría.
export async function cargarSalidasDelTablero(
  prisma: ClientePrisma,
  opciones: { rango: Rango; pestana: PestanaSalida; consolidadorId: string | null },
): Promise<Desglose> {
  const { rango, pestana, consolidadorId } = opciones;

  const destinos =
    pestana === "entregadas"
      ? ["ENTREGADA"]
      : pestana === "asistentes"
        ? ["CERRADA"]
        : pestana === "bajas"
          ? ["BAJA"]
          : FUERA;

  const filas = await prisma.$queryRaw<FilaCruda[]>`
    ${cadena(rango, consolidadorId)}
    SELECT ${COLUMNAS_DE_FILA}
    FROM movimientos m
    ${UNIONES_DE_FILA}
    WHERE m.hacia = ANY(${destinos}::text[])
      AND m.desde <> m.hacia
      AND (m.hacia <> 'BAJA' OR m.desde <> ALL(${FUERA}::text[]))
    ORDER BY m.created_at DESC
    LIMIT ${TOPE}
  `;

  const total = filas[0]?.total ?? 0;

  // Las bajas de quien ya había salido no se cuentan como salida (se marcó
  // asistente la semana pasada y se le dio de baja hoy: salió una sola vez),
  // pero las que vienen de antes de la auditoría no se sabe de dónde salían.
  const sinOrigen = filas.filter((fila) => fila.desde === "SIN_REGISTRO").length;

  return {
    rotulo: "SALIERON DE OPERACIÓN 72",
    titulo: `${total} ${total === 1 ? "persona" : "personas"}`,
    subtitulo: rango.etiqueta,
    aviso:
      sinOrigen > 0
        ? `De ${sinOrigen === 1 ? "una" : sinOrigen} no se sabe de qué lista salió: su tarjeta ya existía cuando empezó la auditoría, en agosto de 2026.`
        : null,
    pestanas: [
      { clave: "todas", etiqueta: "Todas", activa: pestana === "todas" },
      { clave: "entregadas", etiqueta: ETIQUETA_PUERTA.entregadas, activa: pestana === "entregadas" },
      { clave: "asistentes", etiqueta: ETIQUETA_PUERTA.asistentes, activa: pestana === "asistentes" },
      { clave: "bajas", etiqueta: ETIQUETA_PUERTA.bajas, activa: pestana === "bajas" },
    ],
    filas: filas.map((fila, indice) => {
      const puerta = puertaDe(fila.hacia);
      return {
        id: `${fila.learner_id}-${indice}`,
        dia: dia(fila.cuando),
        hora: hora(fila.cuando),
        nombre: nombreDe(fila.first_name, fila.last_name),
        learnerId: fila.learner_id,
        contexto: contexto(
          puerta ? FRASE_PUERTA[puerta] : null,
          origenEnPalabras(fila.desde),
          quienLoHizo(fila.quien),
        ),
        observacion: comillas(fila.motivo ?? fila.nota),
        chip: puerta ? { texto: ETIQUETA_PUERTA[puerta], tono: TONO_PUERTA[puerta] } : null,
        marca: null,
      };
    }),
    total,
    pie: pieDe(filas.length, total, "persona", "personas"),
    enlace: null,
  };
}

/// Si la persona ya no está donde la dejó el movimiento. Evita que la lista
/// engañe: alguien que entró a Contactada el lunes puede estar entregada el
/// jueves, y la ventana lo tiene que decir.
function marcaDeSitio(lista: Lista, status: string | null): Etiqueta | null {
  if (!status || status === lista) return null;
  if (status === "CERRADA") return { texto: "salió del tablero", tono: "neutro" };
  if (status === "ENTREGADA") return { texto: "ya se entregó", tono: "verde" };
  return { texto: "siguió moviéndose", tono: "neutro" };
}

/// Para la prueba y para quien lea: las cinco listas en el orden del recorrido.
export { LISTAS };
