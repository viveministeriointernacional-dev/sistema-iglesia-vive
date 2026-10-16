"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  agruparSaltos,
  CLASES_TONO,
  CLASES_TONO_TEXTO,
  type Desglose,
  type Extremo,
  type FilaDetalle,
  type Indicador,
  type MovimientosOp72,
  type Pestana,
  pestanaPorDefecto,
  TITULO_GRUPO,
  TONO_GRUPO,
  tituloDelSalto,
} from "@/lib/informe-detalle-catalogo";
import type { Comparacion } from "@/lib/informe";
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

  const cambiarPestana = useCallback(
    (pestana: Pestana) => {
      if (peticion?.tipo !== "indicador") return;
      void cargar({ ...peticion, pestana });
    },
    [cargar, peticion],
  );

  return (
    <Contexto.Provider value={{ abrirIndicador, abrirSalto }}>
      {children}
      <Ventana
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

// ------------------------------------------------------------------- La ventana

function Ventana({
  abierta,
  datos,
  cargando,
  error,
  alCerrar,
  alCambiarPestana,
}: {
  abierta: boolean;
  datos: Desglose | null;
  cargando: boolean;
  error: string | null;
  alCerrar: () => void;
  alCambiarPestana: (pestana: Pestana) => void;
}) {
  const referencia = useRef<HTMLDialogElement>(null);

  // `<dialog>` nativo: el Escape y el fondo oscuro los da el navegador, y el
  // foco queda atrapado dentro sin escribir nada.
  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (abierta && !dialogo.open) dialogo.showModal();
    if (!abierta && dialogo.open) dialogo.close();
  }, [abierta]);

  return (
    <dialog
      ref={referencia}
      onClose={alCerrar}
      aria-labelledby="titulo-desglose"
      // En el celular sube desde abajo y ocupa casi todo (`mt-auto mb-0`); en
      // pantalla grande vuelve al centro, que es el margen `auto` que el propio
      // `<dialog>` trae. Ojo: esto NO puede ir en un `style` inline, porque
      // entonces gana al `sm:` y la ventana se queda abajo también en
      // escritorio.
      className="mx-0 mt-auto mb-0 max-h-[88vh] w-full max-w-none rounded-t-[20px] border-0 bg-white p-0 shadow-[0_18px_48px_rgba(14,42,78,.3)] backdrop:bg-[rgba(14,42,78,.5)] sm:mx-auto sm:mt-auto sm:mb-auto sm:max-h-[86vh] sm:max-w-[720px] sm:rounded-[16px]"
    >
      <div className="flex max-h-[88vh] flex-col sm:max-h-[86vh]">
        <div className="flex justify-center pt-[9px] sm:hidden">
          <span aria-hidden="true" className="h-1 w-[42px] rounded-[4px] bg-[rgba(19,28,36,.18)]" />
        </div>

        <header className="border-b border-[rgba(19,28,36,.09)] px-[22px] pt-[15px] pb-[14px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="etiqueta-seccion" style={{ letterSpacing: ".16em" }}>
                {datos?.rotulo ?? "CARGANDO"}
              </p>
              <h2
                id="titulo-desglose"
                className="mt-[9px] font-serif text-[23px] leading-[1.12] font-normal text-tinta sm:text-[25px]"
              >
                {datos?.titulo ?? "Un momento…"}
              </h2>
              {datos ? (
                <p className="mt-[7px] text-[12.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.6)]">
                  {datos.subtitulo}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={alCerrar}
              aria-label="Cerrar"
              className="shrink-0 cursor-pointer rounded-[10px] border border-borde-control bg-white px-[13px] py-[11px] text-[14px] leading-none font-bold text-[rgba(19,28,36,.6)] sm:px-[11px] sm:py-2"
            >
              ✕
            </button>
          </div>

          {datos?.aviso ? (
            <div className="aviso-ambar mt-[13px]">
              <p className="text-[12px] leading-[1.5] font-semibold text-tinta">{datos.aviso}</p>
            </div>
          ) : null}

          {datos?.pestanas ? (
            <div className="mt-[13px] flex flex-wrap items-center gap-[5px]">
              {datos.pestanas.map((pestana) => (
                <button
                  key={pestana.clave}
                  type="button"
                  onClick={() => alCambiarPestana(pestana.clave)}
                  aria-pressed={pestana.activa}
                  className={`cursor-pointer rounded-[20px] px-[13px] py-[9px] text-[11.5px] leading-none font-semibold ${
                    pestana.activa
                      ? "bg-azul-900 font-bold text-white"
                      : "border border-borde-control bg-white text-[rgba(19,28,36,.6)]"
                  }`}
                >
                  {pestana.etiqueta}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div className="min-h-[180px] flex-1 overflow-y-auto px-[10px] py-1">
          {error ? (
            <p className="px-3 py-8 text-center text-[12.5px] leading-[1.6] font-medium text-rojo">
              {error}
            </p>
          ) : cargando || !datos ? (
            <Esqueleto />
          ) : datos.filas.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.55)]">
              {datos.pie}
            </p>
          ) : (
            datos.filas.map((fila, indice) => (
              <Fila key={fila.id} fila={fila} primera={indice === 0} />
            ))
          )}
        </div>

        {datos && datos.filas.length > 0 ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(19,28,36,.09)] bg-papel px-[22px] py-[13px]">
            <span className="text-[11.5px] leading-[1.45] font-semibold text-[rgba(19,28,36,.6)]">
              {datos.pie}
            </span>
            {datos.enlace ? (
              <Link
                href={datos.enlace.href}
                className="shrink-0 text-[11.5px] leading-none font-bold text-azul-700"
              >
                {datos.enlace.texto} →
              </Link>
            ) : null}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-1 py-2" aria-hidden="true">
      {[0, 1, 2, 3].map((fila) => (
        <div key={fila} className="flex items-start gap-3 px-3 py-[11px]">
          <span className="h-7 w-[90px] shrink-0 rounded-[6px] bg-[rgba(19,28,36,.06)]" />
          <span className="flex-1">
            <span className="block h-4 w-[55%] rounded-[6px] bg-[rgba(19,28,36,.08)]" />
            <span className="mt-2 block h-3 w-[78%] rounded-[6px] bg-[rgba(19,28,36,.05)]" />
          </span>
        </div>
      ))}
    </div>
  );
}

function Fila({ fila, primera }: { fila: FilaDetalle; primera: boolean }) {
  return (
    <article
      className={`rounded-[9px] px-3 py-[11px] ${primera ? "" : "border-t border-[rgba(19,28,36,.07)]"}`}
    >
      <div className="flex flex-wrap items-start gap-x-[14px] gap-y-2 sm:flex-nowrap">
        <span className="w-full text-[11px] leading-[1.4] font-bold text-[rgba(19,28,36,.62)] sm:w-[96px] sm:shrink-0">
          <span className="sm:block">{fila.dia}</span>
          <span className="sm:block"> · {fila.hora}</span>
        </span>

        <div className="min-w-0 flex-1">
          {fila.learnerId ? (
            <Link
              href={`/expediente/${fila.learnerId}`}
              className="text-[13.5px] leading-[1.2] font-bold text-tinta hover:text-azul-700 hover:underline"
            >
              {fila.nombre}
            </Link>
          ) : (
            <span className="text-[13.5px] leading-[1.2] font-bold text-tinta">{fila.nombre}</span>
          )}
          {fila.contexto ? (
            <p className="mt-1 text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.62)]">
              {fila.contexto}
            </p>
          ) : null}
          {fila.observacion ? (
            <p className="mt-1 text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.62)]">
              {fila.observacion}
            </p>
          ) : null}
        </div>

        {fila.chip || fila.marca ? (
          <div className="flex shrink-0 flex-col items-start gap-[5px] sm:items-end">
            {fila.chip ? (
              <span
                className={`rounded-[20px] px-[10px] py-[5px] text-[10px] leading-none font-bold ${CLASES_TONO[fila.chip.tono]}`}
              >
                {fila.chip.texto}
              </span>
            ) : null}
            {fila.marca ? (
              <span
                className={`text-[10px] leading-none font-bold ${CLASES_TONO_TEXTO[fila.marca.tono]}`}
              >
                {fila.marca.texto}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
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
