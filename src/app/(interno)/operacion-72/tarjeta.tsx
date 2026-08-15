"use client";

import { useState, useTransition } from "react";
import { Operation72Status } from "@iglesia/prisma-client";
import { avanzarOperacion72, entregarAMentor } from "./acciones";

export type TarjetaPersona = {
  operacionId: string;
  estado: Operation72Status;
  nombre: string;
  origen: string;
  detalle: string;
  chip: string;
  urgencia: "vencida" | "urgente" | "normal";
  avance: number;
  accion: string;
  entrega: {
    titulo: string;
    mentor: string;
    detalle: string;
  } | null;
};

const ESTILO_CHIP: Record<TarjetaPersona["urgencia"], string> = {
  vencida: "bg-rojo-fondo text-rojo",
  urgente: "bg-ambar-chip text-ambar-texto",
  normal: "bg-verde-100 text-verde-700",
};

const ESTILO_BORDE: Record<TarjetaPersona["urgencia"], string> = {
  vencida: "border-[rgba(180,70,47,.45)]",
  urgente: "border-[rgba(201,123,44,.45)]",
  normal: "border-[rgba(19,28,36,.1)]",
};

const ESTILO_BARRA: Record<TarjetaPersona["urgencia"], string> = {
  vencida: "bg-rojo",
  urgente: "bg-ambar-barra",
  normal: "bg-verde-500",
};

export function TarjetaDePersona({ persona }: { persona: TarjetaPersona }) {
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function ejecutar() {
    setError(null);
    iniciar(async () => {
      const resultado =
        persona.estado === Operation72Status.LISTA_PARA_ENTREGA
          ? await entregarAMentor(persona.operacionId)
          : await avanzarOperacion72(persona.operacionId, persona.estado);

      if (!resultado.ok) setError(resultado.mensaje);
    });
  }

  return (
    <article
      className={`rounded-[13px] border bg-white p-4 ${ESTILO_BORDE[persona.urgencia]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] leading-[1.2] font-semibold text-tinta">
            {persona.nombre}
          </h3>
          <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
            {persona.origen}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-[20px] px-2 py-1 text-[9.5px] leading-none font-bold whitespace-nowrap ${ESTILO_CHIP[persona.urgencia]}`}
        >
          {persona.chip}
        </span>
      </div>

      <div className="mt-[14px] h-[6px] overflow-hidden rounded-[4px] bg-[rgba(19,28,36,.1)]">
        <div
          className={`h-full ${ESTILO_BARRA[persona.urgencia]}`}
          style={{ width: `${persona.avance}%` }}
        />
      </div>

      <p className="mt-[11px] text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
        {persona.detalle}
      </p>

      <button
        type="button"
        onClick={ejecutar}
        disabled={enCurso}
        className="mt-3 w-full cursor-pointer rounded-[8px] border-0 bg-azul-900 p-[10px] text-[11.5px] leading-none font-semibold text-white disabled:opacity-60"
      >
        {enCurso ? "Guardando…" : persona.accion}
      </button>

      {error ? (
        <p
          role="alert"
          className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo"
        >
          {error}
        </p>
      ) : null}

      {persona.entrega ? (
        <div className="mt-3 rounded-[10px] border border-[rgba(110,154,85,.4)] bg-verde-050 p-3">
          <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-verde-700">
            {persona.entrega.titulo}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.35] font-semibold text-tinta">
            {persona.entrega.mentor}
          </p>
          <p className="mt-1 text-[11.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
            {persona.entrega.detalle}
          </p>
        </div>
      ) : null}
    </article>
  );
}
