"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  agruparSaltos,
  CLASES_TONO_TEXTO,
  type Desglose,
  type Extremo,
  type Indicador,
  type MovimientosOp72,
  type Pestana,
  pestanaPorDefecto,
  pestanaValida,
  TITULO_GRUPO,
  TONO_GRUPO,
  tituloDelSalto,
} from "@/lib/informe-detalle-catalogo";
import type { Comparacion } from "@/lib/informe";
import { VentanaDesglose } from "@/components/ventana-desglose";
import { pedirDesglose, pedirPersonasDelSalto } from "./acciones";

/// **Los indicadores del informe, que ahora se abren.**
///
/// Nada se pide hasta que alguien hace clic: el informe cuesta exactamente lo
/// mismo que antes de existir esta ventana, y el desglose es un viaje a la base
/// solo cuando se pide (§12.5 — con `max: 1` cada viaje se serializa).
///
/// El periodo viaja con cada petición porque la ventana tiene que mirar el
/// mismo rango que el informe que la abrió.

type Periodo = { inicio: string; fin: string };

type Peticion =
  | { tipo: "indicador"; indicador: Indicador; pestana: Pestana }
  | { tipo: "salto"; desde: Extremo; hacia: Extremo };

type Abridor = {
  abrirIndicador: (indicador: Indicador) => void;
  abrirSalto: (desde: Extremo, hacia: Extremo) => void;
};

const Contexto = createContext<Abridor | null>(null);

function useAbridor() {
  const abridor = useContext(Contexto);
  if (!abridor) throw new Error("Falta <ProveedorDesglose> alrededor del informe.");
  return abridor;
}

export function ProveedorDesglose({
  periodo,
  children,
}: {
  periodo: Periodo;
  children: React.ReactNode;
}) {
  const [peticion, setPeticion] = useState<Peticion | null>(null);
  const [datos, setDatos] = useState<Desglose | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuál es la petición que vale. Sube con cada clic, y la respuesta que llega
  // con un número viejo se tira: sin esto, cambiar de pestaña dos veces seguidas
  // deja ganando a la respuesta más lenta.
  const vigente = useRef(0);

  // La carga va en el clic, no en un efecto: un efecto es para sincronizar con
  // algo de fuera, y pedir datos al pulsar un botón ya es un evento.
  const cargar = useCallback(
    async (siguiente: Peticion) => {
      const turno = ++vigente.current;
      setPeticion(siguiente);
      setDatos(null);
      setCargando(true);
      setError(null);

      try {
        const respuesta =
          siguiente.tipo === "indicador"
            ? await pedirDesglose({
                indicador: siguiente.indicador,
                pestana: siguiente.pestana,
                desde: periodo.inicio,
                hasta: periodo.fin,
              })
            : await pedirPersonasDelSalto({
                desde: siguiente.desde,
                hacia: siguiente.hacia,
                periodoDesde: periodo.inicio,
                periodoHasta: periodo.fin,
              });
        if (turno !== vigente.current) return;
        setDatos(respuesta);
      } catch {
        if (turno !== vigente.current) return;
        setError("No se pudo cargar el detalle. Vuelve a intentarlo.");
      } finally {
        if (turno === vigente.current) setCargando(false);
      }
    },
    [periodo.inicio, periodo.fin],
  );

  const abrirIndicador = useCallback(
    (indicador: Indicador) => {
      void cargar({ tipo: "indicador", indicador, pestana: pestanaPorDefecto(indicador) });
    },
    [cargar],
  );

  const abrirSalto = useCallback(
    (desde: Extremo, hacia: Extremo) => {
      void cargar({ tipo: "salto", desde, hacia });
    },
    [cargar],
  );

  const cerrar = useCallback(() => {
    vigente.current += 1;
    setPeticion(null);
  }, []);

  // La clave llega como texto porque la ventana es compartida con el tablero
  // de Operación 72, que tiene otras pestañas. Se vuelve a validar aquí contra
  // las del indicador: nada que venga del navegador entra sin pasar por su
  // lista cerrada.
  const cambiarPestana = useCallback(
    (pestana: string) => {
      if (peticion?.tipo !== "indicador") return;
      void cargar({ ...peticion, pestana: pestanaValida(peticion.indicador, pestana) });
    },
    [cargar, peticion],
  );

  return (
    <Contexto.Provider value={{ abrirIndicador, abrirSalto }}>
      {children}
      <VentanaDesglose
        abierta={peticion !== null}
        datos={datos}
        cargando={cargando}
        error={error}
        alCerrar={cerrar}
        alCambiarPestana={cambiarPestana}
      />
    </Contexto.Provider>
  );
}

// --------------------------------------------------------- Los seis recuadros

/// El recuadro de arriba del informe. **Se abre solo si hay algo que ver**: con
/// el periodo en cero no es un botón, porque un botón que no lleva a ninguna
/// parte es peor que no enseñarlo (§12.6).
export function Tile({
  indicador,
  rotulo,
  valor,
  dato,
  pie,
  alerta = false,
  alRevés = false,
}: {
  indicador: Indicador;
  rotulo: string;
  valor: number;
  dato: Comparacion;
  pie?: string;
  alerta?: boolean;
  alRevés?: boolean;
}) {
  const { abrirIndicador } = useAbridor();
  const abrible = valor > 0;

  const cuerpo = (
    <>
      <p className={`etiqueta-seccion ${alerta ? "text-rojo" : ""}`} style={{ letterSpacing: ".16em" }}>
        {rotulo}
      </p>
      <p
        className={`mt-[10px] text-[30px] leading-none font-extrabold tracking-[-.02em] ${alerta ? "text-rojo" : "text-tinta"}`}
      >
        {valor}
      </p>
      <Variacion dato={dato} alRevés={alRevés} />
      {pie ? (
        <p className="mt-[3px] text-[10.5px] leading-[1.35] font-semibold text-ambar-texto">{pie}</p>
      ) : null}
      {abrible ? (
        <span className="mt-[9px] flex items-center justify-between border-t border-[rgba(19,28,36,.09)] pt-[9px] text-[10.5px] leading-none font-bold tracking-[.04em] text-azul-700">
          VER {valor === 1 ? "EL DETALLE" : `LOS ${valor}`}
          <span aria-hidden="true">→</span>
        </span>
      ) : null}
    </>
  );

  if (!abrible) {
    return (
      <div className={`tarjeta p-[15px] ${alerta ? "border-[rgba(180,70,47,.3)]" : ""}`}>{cuerpo}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => abrirIndicador(indicador)}
      className={`tarjeta cursor-pointer p-[15px] text-left hover:border-azul-700 hover:shadow-[0_2px_10px_rgba(14,42,78,.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-900 ${
        alerta ? "border-[rgba(180,70,47,.3)]" : ""
      }`}
    >
      {cuerpo}
    </button>
  );
}

function Variacion({ dato, alRevés = false }: { dato: Comparacion; alRevés?: boolean }) {
  const sube = dato.ahora > dato.antes;
  const igual = dato.ahora === dato.antes;
  const bueno = alRevés ? !sube : sube;
  const color = igual ? "text-[rgba(19,28,36,.5)]" : bueno ? "text-verde-700" : "text-rojo";

  return (
    <>
      <p className={`mt-2 text-[12px] leading-[1.3] font-bold ${color}`}>
        {igual
          ? "igual"
          : dato.porcentaje === null
            ? `+${dato.ahora}`
            : `${dato.porcentaje > 0 ? "+" : "−"}${Math.abs(Math.round(dato.porcentaje))} %`}
      </p>
      <p className="mt-[3px] text-[10.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.45)]">
        antes: {dato.antes}
      </p>
    </>
  );
}

// ------------------------------------------------ El histórico de Operación 72

/// **Cómo se movió el tablero en el periodo**, al lado de la foto de hoy. Uno
/// es la foto y el otro la película: `op72` dice dónde están paradas las
/// tarjetas ahora, y esto dice quién cambió de columna y hacia dónde.
export function BloqueMovimientos({ movimientos }: { movimientos: MovimientosOp72 }) {
  const { abrirSalto } = useAbridor();
  const bloques = agruparSaltos(movimientos.saltos);
  const mayor = Math.max(...movimientos.saltos.map((salto) => salto.cuantas), 1);

  return (
    <div className="tarjeta p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">
          Cómo se movió Operación 72
        </h2>
        <span className="text-[11.5px] leading-none font-bold text-[rgba(19,28,36,.6)]">
          {movimientos.total} {movimientos.total === 1 ? "movimiento" : "movimientos"}
        </span>
      </div>
      <p className="mt-[7px] text-[12px] leading-[1.45] font-medium text-[rgba(19,28,36,.6)]">
        Quién cambió de columna y hacia dónde. Cada renglón se abre con los nombres, el día y la
        hora.
      </p>

      {movimientos.antesDeLaAuditoria ? (
        <div className="aviso-ambar mt-[13px]">
          <p className="text-[12px] leading-[1.5] font-semibold text-tinta">
            El periodo empieza antes de agosto de 2026, y de esos días no hay registro de
            movimientos: lo que sale aquí es solo lo que ocurrió desde entonces.
          </p>
        </div>
      ) : null}

      {bloques.length === 0 ? (
        <p className="py-8 text-center text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.55)]">
          Ninguna tarjeta cambió de columna en este periodo.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-[14px]">
          {bloques.map((bloque) => (
            <section key={bloque.grupo}>
              <div
                className={`flex items-baseline justify-between border-b border-[rgba(19,28,36,.09)] pb-[6px] ${CLASES_TONO_TEXTO[TONO_GRUPO[bloque.grupo]]}`}
              >
                <span className="text-[10px] leading-none font-bold tracking-[.16em]">
                  {TITULO_GRUPO[bloque.grupo]}
                </span>
                <span className="text-[12.5px] leading-none font-extrabold">{bloque.subtotal}</span>
              </div>
              {bloque.saltos.map((salto) => (
                <button
                  key={`${salto.desde}-${salto.hacia}`}
                  type="button"
                  onClick={() => abrirSalto(salto.desde, salto.hacia)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[7px] px-2 py-[7px] text-left hover:bg-azul-050 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-azul-900"
                >
                  <span className="min-w-0 flex-1 text-[12.5px] leading-[1.3] font-semibold text-tinta">
                    {tituloDelSalto(salto.desde, salto.hacia)}
                  </span>
                  <span className="w-[26px] shrink-0 text-right text-[13px] leading-none font-extrabold text-tinta">
                    {salto.cuantas}
                  </span>
                  <span className="hidden h-[11px] w-[90px] shrink-0 rounded-[3px] bg-[rgba(19,28,36,.06)] sm:block">
                    <span
                      className={`block h-[11px] rounded-[3px] ${BARRA_GRUPO[bloque.grupo]}`}
                      style={{ width: `${Math.max(8, Math.round((salto.cuantas / mayor) * 100))}%` }}
                    />
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-[13px] font-bold text-azul-700">
                    ›
                  </span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {movimientos.sinOrigen > 0 ? (
        <p className="mt-[14px] border-t border-[rgba(19,28,36,.09)] pt-[11px] text-[11px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          De {movimientos.sinOrigen}{" "}
          {movimientos.sinOrigen === 1 ? "movimiento" : "movimientos"} no se sabe de qué columna
          venía: su tarjeta ya existía cuando empezó la auditoría, en agosto de 2026.
        </p>
      ) : null}
    </div>
  );
}

const BARRA_GRUPO: Record<string, string> = {
  avance: "bg-verde-500",
  "sin-contacto": "bg-ambar-barra",
  salida: "bg-[rgba(19,28,36,.35)]",
  retroceso: "bg-rojo",
  entrada: "bg-azul-700",
};
