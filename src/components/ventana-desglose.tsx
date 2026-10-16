"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  CLASES_TONO,
  CLASES_TONO_TEXTO,
  type Desglose,
  type FilaDetalle,
} from "@/lib/informe-detalle-catalogo";

/// **La ventana de detalle, una sola para toda la plataforma.**
///
/// Nació dentro del informe (16-oct-2026) y salió aquí el mismo día, cuando el
/// tablero de Operación 72 estrenó las suyas: el ⊕ de cada lista y el ⊖ de las
/// salidas. Son la misma ventana con otros datos dentro, y tenerla dos veces
/// significaría arreglar el mismo detalle dos veces.
///
/// No sabe nada del dominio: el servidor le manda los textos hechos, incluidos
/// **el día y la hora ya escritos en hora de Colombia** (§12.1 — formatear
/// fechas en el navegador es la trampa de las cinco horas, y encima el reloj
/// del visitante no tiene por qué estar en Neiva).
///
/// Quien la use pone las pestañas que quiera: la clave viaja como texto y
/// **cada dueño la vuelve a validar contra su propia lista cerrada**.
export function VentanaDesglose({
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
  alCambiarPestana: (pestana: string) => void;
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
