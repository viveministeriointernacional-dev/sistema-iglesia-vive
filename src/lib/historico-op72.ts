import { Prisma } from "@iglesia/prisma-client";
import { diaCorto, fechaDeDia, hoyEnColombia } from "@/lib/dominio";
import type { Grano } from "@/lib/informe-catalogo";
import { atajosDelInforme, type Rango } from "@/lib/informe";
import { type Extremo, grupoDelSalto } from "@/lib/informe-detalle-catalogo";
import { INICIO_AUDITORIA_OP72 } from "@/lib/informe-detalle";
import {
  ALTO_PANEL,
  ALTO_PULSO,
  ALTO_SALIDAS,
  FUERA_DEL_TABLERO,
  type Historico,
  PASOS_RECORRIDO,
  PUERTAS_SALIDA,
  type Punto,
  type Serie,
  topeDe,
} from "@/lib/historico-op72-catalogo";
import type { ClientePrisma } from "@/lib/prisma";

/// **El histórico de Operación 72: cómo se movió el tablero, tramo a tramo.**
///
/// Una sola consulta para toda la pantalla. Devuelve una fila por
/// (tramo, origen, destino) y el resto se arma en memoria: con `PrismaPg
/// max: 1` cada viaje de más se hace en fila y suma su latencia entera
/// (§12.5), así que pedir una serie por panel serían diez viajes para los
/// mismos datos.
///
/// Usa la misma cadena acotada que el tablero (ver `movimiento-op72.ts`): entra
/// por `audit_log(created_at)` para saber **quiénes se movieron** y después por
/// `(entity_type, entity_id)` para traer **solo la historia de esos pocos**.
/// Y arma **las dos llaves de cada expediente**, porque las acciones de
/// Operación 72 se auditan con dos `entity_type` distintos y con una sola
/// desaparece media historia sin que nada falle (§12.4).

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

const MES_LARGO = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });

/// Cuántas semanas enseña el histórico cuando nadie ha pedido un periodo.
///
/// **No puede heredar el defecto del informe**, que es «esta semana»: abierto
/// un viernes, el histórico saldría con un solo tramo y daría la impresión de
/// que no hay historia. Ocho semanas es lo que cabe leyéndose bien y cubre algo
/// más de un ciclo completo de consolidación.
const SEMANAS_POR_DEFECTO = 8;

/// El periodo con el que abre el histórico: las últimas ocho semanas, contadas
/// de viernes a viernes como en el informe, hasta hoy.
export function rangoPorDefectoDelHistorico(): { inicio: string; fin: string } {
  const hoy = hoyEnColombia();
  const estaSemana = atajosDelInforme(hoy).find((atajo) => atajo.clave === "semana");
  const inicio = estaSemana
    ? sumarDias(estaSemana.inicio, -7 * (SEMANAS_POR_DEFECTO - 1))
    : sumarDias(hoy, -7 * SEMANAS_POR_DEFECTO);
  return { inicio, fin: hoy };
}

/// Cuántos días cubre cada tramo. El mes no es un número fijo de días, así que
/// se trata aparte en los dos sitios: al agrupar en SQL y al listar los tramos.
const DIAS_POR_TRAMO: Record<Grano, number> = { dia: 1, semana: 7, mes: 0 };

type FilaCruda = { cubo: Date; desde: string; hacia: string; cuantas: number };

export async function cargarHistorico(
  prisma: ClientePrisma,
  opciones: { rango: Rango; grano: Grano },
): Promise<Historico> {
  const { rango, grano } = opciones;

  // El día civil en hora de Colombia. El doble `AT TIME ZONE` es obligatorio:
  // `created_at` es `timestamp without time zone` y aplicarle la zona a secas
  // SUMA cinco horas en vez de restarlas (§12.1).
  const diaColombiano = Prisma.sql`(a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date`;

  // El tramo al que pertenece cada movimiento. La semana se ancla al PRIMER
  // día del periodo pedido, no al lunes: así «esta semana» empieza el viernes,
  // como en el informe, sin tener que saber qué día de la semana es.
  const cubo =
    grano === "mes"
      ? Prisma.sql`date_trunc('month', c.dia)::date`
      : grano === "semana"
        ? Prisma.sql`${rango.inicio}::date + (((c.dia - ${rango.inicio}::date) / 7) * 7)`
        : Prisma.sql`c.dia`;

  const filas = await prisma.$queryRaw<FilaCruda[]>`
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
      SELECT k.learner_id, a.created_at, a.action, a.metadata, ${diaColombiano} AS dia
      FROM claves k
      JOIN audit_log a ON a.entity_type = k.entity_type AND a.entity_id = k.entity_id
      WHERE a.action IN (${Prisma.join(ACCIONES)})
    ), pasos AS (
      SELECT learner_id, created_at, dia,
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
      SELECT learner_id, created_at, dia, hacia,
             LAG(hacia) OVER (PARTITION BY learner_id ORDER BY created_at) AS previo
      FROM pasos
    ), c AS (
      SELECT dia, hacia,
             COALESCE(previo, CASE WHEN hacia = 'INICIADA' THEN 'NUEVA' ELSE 'SIN_REGISTRO' END) AS desde
      FROM con_origen
      WHERE hacia IS NOT NULL
        AND created_at BETWEEN ${rango.desde} AND ${rango.hasta}
    )
    SELECT ${cubo} AS cubo, desde, hacia, count(*)::int AS cuantas
    FROM c
    GROUP BY 1, 2, 3
    ORDER BY 1
  `;

  const tramos = listarTramos(rango, grano);
  const indice = new Map(tramos.map((tramo, i) => [tramo.dia, i]));

  // Un contador por tramo para cada cosa que se dibuja. Se rellenan en una
  // sola pasada por las filas.
  const vacio = () => tramos.map(() => 0);
  const pulso = vacio();
  const porPaso = new Map(PASOS_RECORRIDO.map((paso) => [paso.clave, vacio()]));
  const porPuerta = new Map(PUERTAS_SALIDA.map((puerta) => [puerta.clave, vacio()]));
  let fueraDeCarril = 0;
  let giros = 0;
  let sinOrigen = 0;

  for (const fila of filas) {
    const posicion = indice.get(claveDeDia(fila.cubo));
    if (posicion === undefined) continue;

    const { desde, hacia, cuantas } = fila;
    if (desde === "SIN_REGISTRO") sinOrigen += cuantas;

    // Volver a intentarlo y que la tarjeta no se mueva es trabajo, pero no es
    // un movimiento: se cuenta aparte o el pulso contaría dos veces a la misma
    // persona en la misma columna (la misma regla que el ⊕ del tablero).
    if (desde === hacia) {
      giros += cuantas;
      continue;
    }

    const salida = PUERTAS_SALIDA.find((puerta) => puerta.hacia === hacia);
    if (salida) {
      // Una baja de quien ya había salido no es una salida nueva.
      if (hacia === "BAJA" && FUERA_DEL_TABLERO.includes(desde as Extremo)) continue;
      porPuerta.get(salida.clave)![posicion] += cuantas;
      continue;
    }

    pulso[posicion] += cuantas;
    const paso = PASOS_RECORRIDO.find((p) => p.desde === desde && p.hacia === hacia);
    if (paso) porPaso.get(paso.clave)![posicion] += cuantas;
    else fueraDeCarril += cuantas;
  }

  const puntos = (valores: number[]): Punto[] =>
    tramos.map((tramo, i) => ({ ...tramo, valor: valores[i] }));

  const pasos: Serie[] = PASOS_RECORRIDO.map((paso) => {
    const valores = porPaso.get(paso.clave)!;
    return {
      clave: paso.clave,
      titulo: paso.titulo,
      pie: paso.pie,
      desde: paso.desde,
      hacia: paso.hacia,
      puntos: puntos(valores),
      total: suma(valores),
      tope: topeDe(valores),
    };
  });

  const salidas: Serie[] = PUERTAS_SALIDA.map((puerta) => {
    const valores = porPuerta.get(puerta.clave)!;
    return {
      clave: puerta.clave,
      titulo: puerta.titulo,
      pie: "",
      // Las salidas se abren por su destino, sea cual sea la columna de la que
      // vinieran: la pregunta es «quiénes salieron por aquí», no «desde dónde».
      desde: "SIN_REGISTRO" as Extremo,
      hacia: puerta.hacia,
      puntos: puntos(valores),
      total: suma(valores),
      tope: topeDe(valores),
    };
  });

  return {
    pulso: puntos(pulso),
    pulsoTotal: suma(pulso),
    pulsoTope: topeDe(pulso),
    pasos,
    salidas,
    salidasTotal: salidas.reduce((total, serie) => total + serie.total, 0),
    // Las tres puertas comparten escala a propósito: aquí sí se comparan entre
    // sí, que es la pregunta («¿salen más por la puerta buena o por la mala?»).
    salidasTope: topeDe(salidas.flatMap((serie) => serie.puntos.map((p) => p.valor))),
    fueraDeCarril,
    giros,
    antesDeLaAuditoria: rango.desde < INICIO_AUDITORIA_OP72,
    sinOrigen,
  };
}

function suma(valores: number[]) {
  return valores.reduce((total, valor) => total + valor, 0);
}

/// `pg` devuelve una `date` como `Date` a medianoche UTC. Se vuelve a texto sin
/// pasar por ninguna zona: `toISOString()` sobre medianoche UTC da el mismo
/// día, y cualquier formateo con zona lo correría (§12.1).
function claveDeDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/// Los tramos del periodo, **incluidos los vacíos**. Una semana sin
/// movimientos es un dato —el equipo no registró nada—, así que tiene que
/// aparecer como un cero en la gráfica, no desaparecer y juntar las dos
/// semanas de al lado en una línea recta que miente.
function listarTramos(
  rango: Rango,
  grano: Grano,
): { dia: string; fin: string; etiqueta: string; parcial: boolean }[] {
  const tramos: { dia: string; fin: string; etiqueta: string; parcial: boolean }[] = [];
  const dias = DIAS_POR_TRAMO[grano];
  const hoy = hoyEnColombia();
  // Un tramo está en curso si su último día todavía no ha pasado, o si el
  // periodo pedido lo corta por la mitad.
  const incompleto = (finNatural: string) => finNatural > hoy || finNatural > rango.fin;

  if (grano === "mes") {
    let [anio, mes] = partes(rango.inicio);
    const [anioFin, mesFin] = partes(rango.fin);
    while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
      const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
      const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
      const finNatural = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
      tramos.push({
        dia: inicio,
        fin: finNatural > rango.fin ? rango.fin : finNatural,
        etiqueta: capitalizar(MES_LARGO.format(new Date(`${inicio}T12:00:00Z`)).replace(" de ", " ")),
        parcial: incompleto(finNatural),
      });
      mes += 1;
      if (mes > 12) {
        mes = 1;
        anio += 1;
      }
    }
    return tramos;
  }

  let cursor = rango.inicio;
  while (cursor <= rango.fin) {
    const finNatural = sumarDias(cursor, dias - 1);
    const fecha = fechaDeDia(cursor);
    tramos.push({
      dia: cursor,
      fin: finNatural > rango.fin ? rango.fin : finNatural,
      etiqueta: fecha ? diaCorto(fecha) : cursor,
      parcial: incompleto(finNatural),
    });
    cursor = sumarDias(cursor, dias);
  }
  return tramos;
}

function partes(dia: string): [number, number] {
  const [anio, mes] = dia.split("-").map(Number);
  return [anio, mes];
}

function sumarDias(dia: string, cuantos: number): string {
  const fecha = new Date(`${dia}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + cuantos);
  return fecha.toISOString().slice(0, 10);
}

function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/// Para el bloque de «fuera de carril»: a qué grupo pertenece un salto que no
/// es ninguno de los seis pasos. Se reusa el del informe para que los dos
/// sitios agrupen igual.
export { grupoDelSalto };
export { ALTO_PANEL, ALTO_PULSO, ALTO_SALIDAS };
