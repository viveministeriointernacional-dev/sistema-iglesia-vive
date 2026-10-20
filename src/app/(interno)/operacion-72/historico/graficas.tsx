"use client";

import { useCallback, useRef, useState } from "react";
import {
  ALTO_PANEL,
  ALTO_PULSO,
  ALTO_SALIDAS,
  ANCHO_VISTA,
  type Historico,
  type OtroSalto,
  PUERTAS_SALIDA,
  type Punto,
  puntosEnCoordenadas,
  repartirOtrosSaltos,
  rutasDeLinea,
  type Serie,
} from "@/lib/historico-op72-catalogo";
import { type Desglose, ETIQUETA_EXTREMO } from "@/lib/informe-detalle-catalogo";
import { VentanaDesglose } from "@/components/ventana-desglose";
import { pedirPersonasDelTramo } from "./acciones";

/// **Las gráficas del histórico de Operación 72.**
///
/// Todo lo que se ve aquí **se abre**: cada punto de cada serie dice quiénes
/// fueron esas personas, qué día y a qué hora. Es la misma ventana del informe
/// y del tablero (`VentanaDesglose`), con otros datos dentro.
///
/// Las rutas SVG llegan calculadas del servidor. El navegador solo pone el
/// ratón encima y pide el detalle al pulsar: así la gráfica se ve igual antes
/// y después de hidratar, sin el salto de maquetación de dibujar en cliente.

type Peticion = { desde: string | null; hacia: string; tramoDesde: string; tramoHasta: string };

export function Graficas({
  historico,
  periodo,
}: {
  historico: Historico;
  /// El periodo entero de la pantalla. Los saltos de fuera del recorrido no
  /// tienen gráfica, así que se abren por el periodo completo, no por un tramo.
  periodo: { inicio: string; fin: string };
}) {
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState<Desglose | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vigente = useRef(0);

  const abrir = useCallback(async (peticion: Peticion) => {
    const turno = ++vigente.current;
    setAbierta(true);
    setDatos(null);
    setCargando(true);
    setError(null);
    try {
      const respuesta = await pedirPersonasDelTramo(peticion);
      if (turno !== vigente.current) return;
      setDatos(respuesta);
    } catch {
      if (turno !== vigente.current) return;
      setError("No se pudo cargar el detalle. Vuelve a intentarlo.");
    } finally {
      if (turno === vigente.current) setCargando(false);
    }
  }, []);

  const cerrar = useCallback(() => {
    vigente.current += 1;
    setAbierta(false);
  }, []);

  return (
    <>
      <Pulso historico={historico} />

      <section className="mt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">Salto por salto</h2>
          <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
            Cada panel tiene su propia escala · el número grande es el total del periodo
          </p>
        </div>
        <div className="mt-[11px] grid grid-cols-1 gap-[11px] sm:grid-cols-2 lg:grid-cols-3">
          {historico.pasos.map((serie) => (
            <Panel key={serie.clave} serie={serie} alAbrir={abrir} />
          ))}
        </div>
        <PieDeLosPasos historico={historico} periodo={periodo} alAbrir={abrir} />
      </section>

      <Salidas historico={historico} alAbrir={abrir} />
      <Tabla historico={historico} />

      <VentanaDesglose
        abierta={abierta}
        datos={datos}
        cargando={cargando}
        error={error}
        alCerrar={cerrar}
        alCambiarPestana={() => {}}
      />
    </>
  );
}

// ------------------------------------------------------------------ El pulso

/// Una sola serie, así que **el título la nombra y no hace falta leyenda**. El
/// recuadro gris con el dato aparece al pasar el ratón por encima.
function Pulso({ historico }: { historico: Historico }) {
  const [encima, setEncima] = useState<number | null>(null);
  const puntos = puntosEnCoordenadas(historico.pulso, historico.pulsoTope, ALTO_PULSO);
  const activo = encima !== null ? puntos[encima] : null;
  const media = puntos.length > 0 ? Math.round(historico.pulsoTotal / puntos.length) : 0;

  return (
    <section className="tarjeta mt-3 p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">
          Movimientos del recorrido
        </h2>
        <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
          {historico.pulsoTotal} en el periodo · {media} por tramo de media
        </p>
      </div>

      <div className="relative mt-[14px]">
        <svg
          viewBox={`0 0 ${ANCHO_VISTA} ${ALTO_PULSO}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Movimientos del recorrido por tramo: ${historico.pulso.map((p) => `${p.etiqueta} ${p.valor}`).join(", ")}`}
          className="block h-[170px] w-full"
        >
          <line x1="0" y1="4" x2={ANCHO_VISTA} y2="4" stroke="rgba(19,28,36,.08)" strokeWidth="1" />
          <line
            x1="0"
            y1={ALTO_PULSO / 2}
            x2={ANCHO_VISTA}
            y2={ALTO_PULSO / 2}
            stroke="rgba(19,28,36,.08)"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={ALTO_PULSO - 4}
            x2={ANCHO_VISTA}
            y2={ALTO_PULSO - 4}
            stroke="rgba(19,28,36,.18)"
            strokeWidth="1"
          />
          <Trazo
            rutas={rutasDeLinea(historico.pulso, historico.pulsoTope, ALTO_PULSO)}
            color="#2a5a8c"
          />
        </svg>

        {/* Los puntos y sus zonas de contacto van fuera del SVG estirado: con
            `preserveAspectRatio="none"` un círculo dibujado dentro saldría
            ovalado. Aquí se posicionan en porcentaje y conservan su forma. */}
        <div className="pointer-events-none absolute inset-0">
          {puntos.map((punto, i) => (
            <span
              key={punto.dia}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-default"
              style={{ left: `${(punto.x / ANCHO_VISTA) * 100}%`, top: `${(punto.y / ALTO_PULSO) * 100}%` }}
              onMouseEnter={() => setEncima(i)}
              onMouseLeave={() => setEncima(null)}
            >
              <span className="block h-[22px] w-[22px] -translate-x-[7px] -translate-y-[7px] rounded-full" />
              <span
                className={`absolute top-0 left-0 block h-2 w-2 rounded-full border-2 border-white ${
                  encima === i ? "bg-azul-900" : "bg-azul-700"
                }`}
              />
            </span>
          ))}
        </div>

        {activo ? (
          <div
            className="pointer-events-none absolute z-10 w-[180px] -translate-x-1/2 rounded-[10px] bg-tinta px-3 py-[10px]"
            style={{
              left: `min(max(${(activo.x / ANCHO_VISTA) * 100}%, 90px), calc(100% - 90px))`,
              top: 0,
            }}
          >
            <p className="text-[10.5px] leading-none font-bold tracking-[.1em] text-[rgba(255,255,255,.65)]">
              {activo.etiqueta.toUpperCase()}
            </p>
            <p className="mt-[7px] text-[18px] leading-none font-extrabold text-white">
              {activo.valor} {activo.valor === 1 ? "movimiento" : "movimientos"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-[7px] flex justify-between">
        {historico.pulso.map((punto, i) => (
          <span
            key={punto.dia}
            className={`text-[10.5px] leading-none font-semibold text-[rgba(19,28,36,.5)] ${
              historico.pulso.length > 10 && i % 2 === 1 ? "hidden sm:block" : ""
            }`}
          >
            {punto.etiqueta}
          </span>
        ))}
      </div>
    </section>
  );
}

/// **Lo que los siete paneles NO cuentan, dicho con nombre y abrible.**
///
/// ⚠️ **Antes era una sola frase, y esa frase tapaba el 28 % de la pantalla.**
/// Medido el 20-oct sobre las últimas ocho semanas: 141 de 508 movimientos
/// caían aquí. Quien lo leía no podía saber si eran correcciones de
/// administración o trabajo del equipo mal registrado — y resulta que son las
/// dos cosas, en proporciones muy distintas.
///
/// **Se reparten en dos grupos porque son dos cosas**: 96 eran tarjetas sin
/// historial (un hueco de la auditoría, no un salto de nadie) y 45 movimientos
/// que de verdad fueron por otro camino.
///
/// ⚠️ **Y el rótulo del segundo grupo NO puede decir «se saltaron un paso»,
/// que es lo que dijo el primer día.** Medido el 20-oct después del merge:
/// **31 de esos 46 son el atajo «ya lleva proceso»** (los tres pares hacia
/// «Lista para entrega», 31 de 31 por `pasa_a_entrega_por_proceso_previo`),
/// que se salta la visita **a propósito** desde el 11-sep. Llamarle «se
/// saltaron un paso» acusaba al equipo de un descuido en dos tercios de los
/// casos. El rótulo nombra el hecho —fueron por otro camino— y el pie dice las
/// tres causas posibles sin fingir que el renglón las distingue.
///
/// Sale **solo cuando hay algo que decir**: un pie que aparece siempre, con
/// ceros, se deja de leer (§12.6).
function PieDeLosPasos({
  historico,
  periodo,
  alAbrir,
}: {
  historico: Historico;
  periodo: { inicio: string; fin: string };
  alAbrir: (peticion: Peticion) => void;
}) {
  const { conocidos, sinOrigen, totalConocidos, totalSinOrigen } = repartirOtrosSaltos(
    historico.otrosSaltos,
  );
  if (conocidos.length === 0 && sinOrigen.length === 0 && historico.giros === 0) return null;

  return (
    <div className="mt-[11px] rounded-[12px] border border-[rgba(19,28,36,.12)] bg-[rgba(19,28,36,.02)] p-[14px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[12.5px] leading-none font-bold text-tinta">Fuera del recorrido</h3>
        <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
          {historico.fueraDeCarril} movimientos que no son ninguno de los paneles de arriba
        </p>
      </div>

      {conocidos.length > 0 ? (
        <GrupoDeSaltos
          titulo="Fueron por otro camino"
          pie="Son tres cosas distintas, y el renglón no las separa: el atajo «ya lleva proceso» —que se salta la visita a propósito—, formularios llenados fuera de orden, y correcciones a mano. Ábrelo y mira quién lo hizo."
          total={totalConocidos}
          saltos={conocidos}
          periodo={periodo}
          alAbrir={alAbrir}
        />
      ) : null}

      {sinOrigen.length > 0 ? (
        <GrupoDeSaltos
          titulo="No se sabe de qué lista venían"
          pie="Su tarjeta ya existía cuando empezó la auditoría, en agosto de 2026. Es un hueco del historial, no un salto de nadie."
          total={totalSinOrigen}
          saltos={sinOrigen}
          periodo={periodo}
          alAbrir={alAbrir}
        />
      ) : null}

      {historico.giros > 0 ? (
        <p className="mt-[11px] border-t border-[rgba(19,28,36,.1)] pt-[9px] text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          {historico.giros === 1
            ? "Aparte, a una persona se le volvió a intentar sin que la tarjeta cambiara de lista:"
            : `Aparte, a ${historico.giros} personas se les volvió a intentar sin que la tarjeta cambiara de lista:`}{" "}
          es trabajo hecho, pero no es un movimiento, así que no entra en ninguna gráfica.
        </p>
      ) : null}
    </div>
  );
}

function GrupoDeSaltos({
  titulo,
  pie,
  total,
  saltos,
  periodo,
  alAbrir,
}: {
  titulo: string;
  pie: string;
  total: number;
  saltos: OtroSalto[];
  periodo: { inicio: string; fin: string };
  alAbrir: (peticion: Peticion) => void;
}) {
  return (
    <div className="mt-[11px]">
      <p className="text-[11px] leading-none font-extrabold tracking-[.1em] text-[rgba(19,28,36,.5)] uppercase">
        {titulo} · {total}
      </p>
      <ul className="mt-[7px] grid grid-cols-1 gap-[5px] sm:grid-cols-2">
        {saltos.map((salto) => (
          <li key={`${salto.desde}-${salto.hacia}`}>
            <button
              type="button"
              onClick={() =>
                alAbrir({
                  desde: salto.desde,
                  hacia: salto.hacia,
                  tramoDesde: periodo.inicio,
                  tramoHasta: periodo.fin,
                })
              }
              className="flex w-full items-baseline justify-between gap-2 rounded-[8px] bg-white px-[10px] py-[7px] text-left"
            >
              <span className="text-[11.5px] leading-[1.35] font-semibold text-tinta">
                {salto.sinOrigen
                  ? `→ ${ETIQUETA_EXTREMO[salto.hacia]}`
                  : `${ETIQUETA_EXTREMO[salto.desde]} → ${ETIQUETA_EXTREMO[salto.hacia]}`}
              </span>
              <span className="shrink-0 text-[12.5px] leading-none font-extrabold text-azul-900">
                {salto.cuantas}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-[6px] text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
        {pie}
      </p>
    </div>
  );
}

// ------------------------------------------------- Un panel por salto

function Panel({
  serie,
  alAbrir,
}: {
  serie: Serie;
  alAbrir: (peticion: Peticion) => void;
}) {
  const puntos = puntosEnCoordenadas(serie.puntos, serie.tope, ALTO_PANEL);
  const ultimo = serie.puntos[serie.puntos.length - 1];

  return (
    <article className="tarjeta p-[15px]">
      <p className="text-[12.5px] leading-[1.3] font-bold text-tinta">{serie.titulo}</p>
      <p className="mt-[5px] text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.6)]">
        {serie.pie}
      </p>
      <p className="mt-[10px] text-[28px] leading-none font-extrabold text-tinta">{serie.total}</p>

      <div className="relative mt-[10px]">
        <svg
          viewBox={`0 0 ${ANCHO_VISTA} ${ALTO_PANEL}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${serie.titulo} por tramo: ${serie.puntos.map((p) => `${p.etiqueta} ${p.valor}`).join(", ")}`}
          className="block h-[54px] w-full"
        >
          <line
            x1="0"
            y1={ALTO_PANEL - 2}
            x2={ANCHO_VISTA}
            y2={ALTO_PANEL - 2}
            stroke="rgba(19,28,36,.14)"
            strokeWidth="1"
          />
          <Trazo rutas={rutasDeLinea(serie.puntos, serie.tope, ALTO_PANEL)} color="#2a5a8c" />
        </svg>

        <div className="pointer-events-none absolute inset-0">
          {puntos.map((punto) => (
            <BotonDePunto
              key={punto.dia}
              punto={punto}
              alto={ALTO_PANEL}
              titulo={serie.titulo}
              deshabilitado={punto.valor === 0}
              alAbrir={() =>
                alAbrir({
                  desde: serie.desde,
                  hacia: serie.hacia,
                  tramoDesde: punto.dia,
                  tramoHasta: punto.fin,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="mt-[6px] flex items-baseline justify-between gap-2">
        <span className="text-[10px] leading-none font-semibold text-[rgba(19,28,36,.5)]">
          tope del panel: {serie.tope}
        </span>
        <span className="text-[10px] leading-none font-bold text-tinta">
          {ultimo ? `${ultimo.valor} en ${ultimo.etiqueta}` : ""}
        </span>
      </div>
    </article>
  );
}

/// El punto de una serie, que **se puede pulsar** para ver quiénes fueron. En
/// cero no es un botón: no hay nada que abrir, y un botón que no lleva a
/// ninguna parte es peor que no enseñarlo (§12.6).
function BotonDePunto({
  punto,
  alto,
  titulo,
  color = "#2a5a8c",
  deshabilitado,
  alAbrir,
}: {
  punto: Punto & { x: number; y: number };
  alto: number;
  titulo: string;
  color?: string;
  deshabilitado: boolean;
  alAbrir: () => void;
}) {
  const posicion = {
    left: `${(punto.x / ANCHO_VISTA) * 100}%`,
    top: `${(punto.y / alto) * 100}%`,
  };

  if (deshabilitado) {
    return (
      <span
        className="absolute block h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(19,28,36,.2)]"
        style={posicion}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={alAbrir}
      title={`${punto.etiqueta}: ${punto.valor} · ver quiénes`}
      aria-label={`${titulo}, ${punto.etiqueta}: ${punto.valor}. Ver quiénes fueron`}
      className="pointer-events-auto absolute flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-azul-900"
      style={posicion}
    >
      <span
        className="block h-2 w-2 rounded-full border-2 border-white transition-transform hover:scale-150"
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

// ------------------------------------------------------- Cómo salen

/// Tres series sobre **una escala común**, porque aquí sí se comparan entre sí:
/// la pregunta es si sale más gente por la puerta buena o por la mala. Lleva
/// leyenda siempre, y cada serie va además nombrada en la tabla de abajo: el
/// color nunca viaja solo.
function Salidas({
  historico,
  alAbrir,
}: {
  historico: Historico;
  alAbrir: (peticion: Peticion) => void;
}) {
  return (
    <section className="tarjeta mt-3 p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">
          Cómo salen de Operación 72
        </h2>
        <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
          {historico.salidasTotal} salieron en el periodo
        </p>
      </div>

      <div className="mt-[10px] flex flex-wrap gap-x-[18px] gap-y-[6px]">
        {historico.salidas.map((serie) => {
          const puerta = PUERTAS_SALIDA.find((p) => p.clave === serie.clave);
          return (
            <span
              key={serie.clave}
              className="inline-flex items-center gap-[7px] text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.72)]"
            >
              <span
                aria-hidden="true"
                className="h-[11px] w-[11px] rounded-[3px]"
                style={{ backgroundColor: puerta?.color }}
              />
              {serie.titulo} · <strong className="font-extrabold text-tinta">{serie.total}</strong>
            </span>
          );
        })}
      </div>

      <div className="relative mt-[12px]">
        <svg
          viewBox={`0 0 ${ANCHO_VISTA} ${ALTO_SALIDAS}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={historico.salidas
            .map((s) => `${s.titulo}: ${s.puntos.map((p) => `${p.etiqueta} ${p.valor}`).join(", ")}`)
            .join(". ")}
          className="block h-[150px] w-full"
        >
          <line x1="0" y1="4" x2={ANCHO_VISTA} y2="4" stroke="rgba(19,28,36,.08)" strokeWidth="1" />
          <line
            x1="0"
            y1={ALTO_SALIDAS - 4}
            x2={ANCHO_VISTA}
            y2={ALTO_SALIDAS - 4}
            stroke="rgba(19,28,36,.18)"
            strokeWidth="1"
          />
          {historico.salidas.map((serie) => {
            const puerta = PUERTAS_SALIDA.find((p) => p.clave === serie.clave);
            return (
              <Trazo
                key={serie.clave}
                rutas={rutasDeLinea(serie.puntos, historico.salidasTope, ALTO_SALIDAS)}
                color={puerta?.color ?? "#2a5a8c"}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0">
          {historico.salidas.flatMap((serie) => {
            const puerta = PUERTAS_SALIDA.find((p) => p.clave === serie.clave);
            return puntosEnCoordenadas(serie.puntos, historico.salidasTope, ALTO_SALIDAS).map(
              (punto) => (
                <BotonDePunto
                  key={`${serie.clave}-${punto.dia}`}
                  punto={punto}
                  alto={ALTO_SALIDAS}
                  titulo={serie.titulo}
                  color={puerta?.color}
                  deshabilitado={punto.valor === 0}
                  alAbrir={() =>
                    alAbrir({
                      desde: null,
                      hacia: serie.hacia,
                      tramoDesde: punto.dia,
                      tramoHasta: punto.fin,
                    })
                  }
                />
              ),
            );
          })}
        </div>
      </div>

      <div className="mt-[7px] flex justify-between">
        {historico.pulso.map((punto, i) => (
          <span
            key={punto.dia}
            className={`text-[10.5px] leading-none font-semibold text-[rgba(19,28,36,.5)] ${
              historico.pulso.length > 10 && i % 2 === 1 ? "hidden sm:block" : ""
            }`}
          >
            {punto.etiqueta}
          </span>
        ))}
      </div>
    </section>
  );
}

// -------------------------------------------------------------- La tabla

/// Lo mismo que las gráficas, en números. No es un adorno: es la vista que
/// sirve para copiar una cifra, leerla con lector de pantalla o comprobar un
/// punto que en la línea queda pegado a otro.
function Tabla({ historico }: { historico: Historico }) {
  return (
    <section className="tarjeta mt-3 overflow-x-auto p-[18px]">
      <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">Tramo a tramo, en números</h2>
      <table className="mt-[12px] w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-[rgba(19,28,36,.12)]">
            <th className="py-[7px] pr-3 text-[10px] leading-none font-extrabold tracking-[.06em] text-[rgba(19,28,36,.45)]">
              TRAMO
            </th>
            <th className="py-[7px] pr-3 text-right text-[10px] leading-none font-extrabold tracking-[.06em] text-[rgba(19,28,36,.45)]">
              RECORRIDO
            </th>
            {historico.salidas.map((serie) => (
              <th
                key={serie.clave}
                className="py-[7px] pr-3 text-right text-[10px] leading-none font-extrabold tracking-[.06em] text-[rgba(19,28,36,.45)]"
              >
                {serie.titulo.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {historico.pulso.map((punto, i) => (
            <tr key={punto.dia} className="border-b border-[rgba(19,28,36,.06)]">
              <td className="py-[9px] pr-3 text-[12px] leading-none font-bold text-tinta">
                {punto.etiqueta}
              </td>
              <td className="py-[9px] pr-3 text-right text-[12px] leading-none font-semibold text-tinta">
                {punto.valor}
              </td>
              {historico.salidas.map((serie) => (
                <td
                  key={serie.clave}
                  className="py-[9px] pr-3 text-right text-[12px] leading-none font-semibold text-[rgba(19,28,36,.7)]"
                >
                  {serie.puntos[i]?.valor ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/// La línea de una serie, en dos trazos: el firme y **el tramo en curso, con
/// raya discontinua**. La semana que va por su segundo día siempre cae a
/// plomo; dibujarla igual que las demás sería dar un susto falso cada vez que
/// alguien abre la pantalla.
function Trazo({ rutas, color }: { rutas: { firme: string; enCurso: string }; color: string }) {
  return (
    <>
      {rutas.firme ? (
        <path
          d={rutas.firme}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {rutas.enCurso ? (
        <path
          d={rutas.enCurso}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </>
  );
}
