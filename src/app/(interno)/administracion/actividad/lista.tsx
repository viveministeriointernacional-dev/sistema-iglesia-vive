"use client";

import Link from "next/link";
import { useState } from "react";
import type { Movimiento, Tono } from "@/lib/actividad";

const PUNTO: Record<Tono, string> = {
  azul: "bg-azul-700",
  verde: "bg-verde-600",
  ambar: "bg-ambar-barra",
  rojo: "bg-rojo",
  gris: "bg-[#8a929a]",
};

const ETIQUETA: Record<Tono, string> = {
  azul: "bg-azul-100 text-azul-700",
  verde: "bg-verde-100 text-verde-700",
  ambar: "bg-ambar-chip text-ambar-texto",
  rojo: "bg-rojo-fondo text-rojo",
  gris: "bg-[#eee] text-[#4a5560]",
};

/// La lista del día agrupada por hora; al hacer clic en un movimiento con
/// detalle, se abre a la derecha lo que pasó exactamente (el correo tal cual
/// salió, lo que se llenó en la llamada, el resumen de la visita…).
export function ListaDeActividad({ movimientos }: { movimientos: Movimiento[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const seleccionado = movimientos.find((m) => m.id === abierto) ?? null;

  if (movimientos.length === 0) {
    return (
      <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-center text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.45)]">
        Nada registrado con estos filtros.
      </p>
    );
  }

  return (
    <div className={`grid gap-4 ${seleccionado ? "lg:grid-cols-[minmax(0,1fr)_460px]" : ""}`}>
      <div className="tarjeta px-[14px] pt-1 pb-4 sm:px-[22px]">
        {movimientos.map((m, indice) => {
          const nuevaFranja = indice === 0 || movimientos[indice - 1].franja !== m.franja;
          const activo = abierto === m.id;
          return (
            <div key={m.id}>
              {nuevaFranja ? (
                <p className="mt-[22px] mb-[10px] text-[10px] leading-none font-extrabold tracking-[.12em] text-[rgba(19,28,36,.42)]">
                  {m.franja}
                </p>
              ) : null}
              <div
                className={`grid grid-cols-[64px_10px_minmax(0,1fr)] items-start gap-3 rounded-[10px] border-t px-2 py-[11px] sm:grid-cols-[72px_10px_minmax(0,1fr)] ${
                  activo ? "border-t-transparent bg-azul-050" : "border-t-[rgba(19,28,36,.07)]"
                }`}
              >
                <span className="pt-[2px] text-[11.5px] font-semibold text-[rgba(19,28,36,.5)]">{m.hora}</span>
                <span className={`mt-1 h-[10px] w-[10px] rounded-full ${PUNTO[m.tono]}`} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-[1.45] font-medium text-tinta">
                    {m.frase.map((trozo, i) =>
                      trozo.href ? (
                        <Link key={i} href={trozo.href} className="font-bold text-azul-700 hover:underline">
                          {trozo.texto}
                        </Link>
                      ) : trozo.negrita ? (
                        <strong key={i} className="font-bold">{trozo.texto}</strong>
                      ) : (
                        <span key={i}>{trozo.texto}</span>
                      ),
                    )}
                    <span className={`ml-[6px] inline-block rounded-[20px] px-[7px] py-[3px] align-middle text-[9px] leading-none font-extrabold tracking-[.06em] ${ETIQUETA[m.tono]}`}>
                      {m.etiqueta}
                    </span>
                  </p>
                  {m.observacion ? (
                    <p className="mt-1 text-[12px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">«{m.observacion}»</p>
                  ) : null}
                  {m.detalle ? (
                    <button
                      type="button"
                      onClick={() => setAbierto(activo ? null : m.id)}
                      className="mt-[5px] cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-bold text-azul-700"
                    >
                      {activo ? "Cerrar ‹" : m.detalle.correo ? "Ver el correo que se envió ›" : `Ver ${m.detalle.titulo.toLowerCase()} ›`}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {seleccionado?.detalle ? (
        <aside className="tarjeta self-start px-5 py-[18px] lg:sticky lg:top-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="etiqueta-seccion">{seleccionado.detalle.correo ? "CORREO ENVIADO" : seleccionado.detalle.titulo.toUpperCase()} · {seleccionado.hora.toUpperCase()}</p>
              {seleccionado.detalle.correo ? (
                <>
                  <p className="mt-[6px] text-[13.5px] leading-[1.3] font-bold text-tinta">{seleccionado.detalle.correo.asunto}</p>
                  <p className="mt-1 text-[11.5px] font-medium text-[rgba(19,28,36,.5)]">
                    Para: {seleccionado.detalle.correo.para} ·{" "}
                    {seleccionado.detalle.correo.enviado ? (
                      <span className="font-bold text-verde-700">Aceptado por Resend</span>
                    ) : (
                      <span className="font-bold text-rojo">No salió: {seleccionado.detalle.correo.motivo}</span>
                    )}
                  </p>
                </>
              ) : null}
            </div>
            <button type="button" onClick={() => setAbierto(null)} className="cursor-pointer border-0 bg-transparent text-[18px] leading-none text-[rgba(19,28,36,.4)]" aria-label="Cerrar">
              ✕
            </button>
          </div>

          {seleccionado.detalle.filas.length ? (
            <dl className="mt-3">
              {seleccionado.detalle.filas.map((f, i) => (
                <div key={i} className="flex items-baseline gap-[10px] border-t border-[rgba(19,28,36,.07)] py-[6px]">
                  <dt className="w-[120px] shrink-0 text-[11px] font-bold text-[rgba(19,28,36,.45)]">{f.k}</dt>
                  <dd className="m-0 text-[12.5px] font-semibold text-tinta">{f.v}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {seleccionado.detalle.correo ? (
            <iframe
              title="Vista previa del correo"
              sandbox=""
              srcDoc={seleccionado.detalle.correo.html}
              className="mt-[14px] h-[640px] w-full rounded-[10px] border border-[rgba(19,28,36,.12)] bg-white"
            />
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
