"use client";

import { useState, useTransition } from "react";
import { resolverDeclaracionDeLiderazgo } from "../acciones";

export type ItemPendiente = {
  id: string;
  clase: "ROL" | "ETAPA" | "HITO";
  titulo: string;
  detalle: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "DESCARTADO";
  resueltoPor: string | null;
  resueltoEl: string | null;
};

export type DeclaracionPendiente = {
  id: string;
  cuando: string;
  items: ItemPendiente[];
};

const ROTULO_GRUPO: Record<ItemPendiente["clase"], string> = {
  ROL: "ROLES QUE DICE QUE SIRVE",
  ETAPA: "ETAPA DEL RECORRIDO",
  HITO: "HITOS QUE DECLARÓ",
};

const ORDEN_GRUPO: ItemPendiente["clase"][] = ["ROL", "ETAPA", "HITO"];

/// Lo que una persona declaró de sí misma en el formulario público de
/// liderazgo. No se aplica solo a propósito (ver `src/lib/liderazgo.ts`): aquí
/// un administrador confirma o descarta **cada cosa por separado** — un rol
/// cierto y uno falso ya no se tienen que aceptar juntos.
export function DeclaracionDeLiderazgo({
  declaracion,
  personId,
  nombre,
}: {
  declaracion: DeclaracionPendiente;
  personId: string;
  nombre: string;
}) {
  const [items, setItems] = useState(declaracion.items);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const pendientes = items.filter((item) => item.estado === "PENDIENTE");

  function resolver(confirmar: boolean, itemId?: string) {
    setError(null);
    setEnCurso(itemId ?? "todo");
    iniciar(async () => {
      const resultado = await resolverDeclaracionDeLiderazgo(
        declaracion.id,
        confirmar,
        personId,
        itemId,
      );
      setEnCurso(null);
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      if (resultado.aviso) setAviso(resultado.aviso);
      const tocados = itemId
        ? [itemId]
        : pendientes.map((pendiente) => pendiente.id);
      setItems((previos) =>
        previos.map((item) =>
          tocados.includes(item.id)
            ? {
                ...item,
                estado: confirmar ? "CONFIRMADO" : "DESCARTADO",
                resueltoPor: null,
                resueltoEl: "hace un momento",
              }
            : item,
        ),
      );
    });
  }

  return (
    <section className="mt-4 rounded-[14px] border border-[rgba(201,123,44,.3)] bg-ambar-fondo p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[10px] leading-none font-bold tracking-[.16em] text-ambar-texto">
          {pendientes.length > 0 ? "PENDIENTE DE CONFIRMAR" : "DECLARACIÓN RESUELTA"}
        </h2>
        {pendientes.length > 0 ? (
          <span className="rounded-[20px] border border-[rgba(201,123,44,.35)] px-[9px] py-[5px] text-[10px] leading-none font-bold tracking-[.06em] text-ambar-texto">
            {pendientes.length}{" "}
            {pendientes.length === 1 ? "SIN RESOLVER" : "SIN RESOLVER"}
          </span>
        ) : null}
      </div>

      <p className="mt-[11px] text-[12.5px] leading-[1.55] font-medium text-pretty text-ambar-texto">
        {pendientes.length === items.length ? (
          <>
            {nombre.split(" ")[0]} llenó el formulario de liderazgo el{" "}
            <strong className="font-bold">{declaracion.cuando}</strong>. Nada de
            esto se aplicó solo: confirma o descarta cada cosa por separado.
          </>
        ) : pendientes.length > 0 ? (
          <>
            Van{" "}
            <strong className="font-bold">
              {items.length - pendientes.length} resueltas
            </strong>{" "}
            de {items.length}. Lo que falta sigue esperando.
          </>
        ) : (
          <>Todo lo que declaró quedó resuelto.</>
        )}
      </p>

      {ORDEN_GRUPO.map((clase) => {
        const delGrupo = items.filter((item) => item.clase === clase);
        if (delGrupo.length === 0) return null;
        return (
          <div key={clase}>
            <p className="mt-5 text-[10px] leading-none font-bold tracking-[.16em] text-[rgba(169,105,31,.75)]">
              {ROTULO_GRUPO[clase]}
            </p>
            {delGrupo.map((item) => (
              <Renglon
                key={item.id}
                item={item}
                enCurso={enCurso === item.id || enCurso === "todo"}
                bloqueado={enCurso !== null}
                onResolver={(confirmar) => resolver(confirmar, item.id)}
              />
            ))}
          </div>
        );
      })}

      {pendientes.length > 1 ? (
        <div className="mt-1 flex flex-wrap gap-[18px] border-t border-[rgba(201,123,44,.28)] pt-[13px]">
          <button
            type="button"
            onClick={() => resolver(true)}
            disabled={enCurso !== null}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-bold text-ambar-texto underline underline-offset-[3px] disabled:opacity-60"
          >
            Confirmar {pendientes.length === items.length ? "todo" : "lo que falta"}
          </button>
          <button
            type="button"
            onClick={() => resolver(false)}
            disabled={enCurso !== null}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.55)] underline underline-offset-[3px] disabled:opacity-60"
          >
            Descartar {pendientes.length === items.length ? "todo" : "lo que falta"}
          </button>
        </div>
      ) : null}

      {aviso ? (
        <p className="mt-3 text-[12px] leading-[1.5] font-medium text-ambar-texto">
          {aviso}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[12px] leading-[1.5] font-semibold text-rojo">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Renglon({
  item,
  enCurso,
  bloqueado,
  onResolver,
}: {
  item: ItemPendiente;
  enCurso: boolean;
  bloqueado: boolean;
  onResolver: (confirmar: boolean) => void;
}) {
  const resuelto = item.estado !== "PENDIENTE";
  const confirmado = item.estado === "CONFIRMADO";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-[rgba(201,123,44,.2)] py-[13px] last:border-b-0">
      <div className="min-w-0">
        <p
          className={`text-[13px] leading-[1.3] ${
            item.estado === "DESCARTADO"
              ? "font-semibold text-[rgba(19,28,36,.42)] line-through"
              : "font-bold text-tinta"
          }`}
        >
          {item.titulo}
        </p>
        <p
          className={`mt-1 text-[11.5px] leading-[1.35] font-medium ${
            item.estado === "DESCARTADO"
              ? "text-[rgba(19,28,36,.35)]"
              : "text-[rgba(19,28,36,.55)]"
          }`}
        >
          {resuelto
            ? [
                confirmado ? item.detalle : "Descartado",
                item.resueltoPor,
                item.resueltoEl,
              ]
                .filter(Boolean)
                .join(" · ")
            : item.detalle}
        </p>
      </div>

      {resuelto ? (
        <span
          className={`flex shrink-0 items-center gap-[6px] text-[11.5px] leading-none ${
            confirmado
              ? "font-bold text-verde-600"
              : "font-semibold text-[rgba(19,28,36,.45)]"
          }`}
        >
          <Marca confirmado={confirmado} />
          {confirmado ? "Confirmado" : "Descartado"}
        </span>
      ) : (
        <div className="flex shrink-0 gap-[7px]">
          <button
            type="button"
            onClick={() => onResolver(true)}
            disabled={bloqueado}
            className="cursor-pointer rounded-[9px] border-0 bg-azul-900 px-[13px] py-[9px] text-[11.5px] leading-none font-bold text-white disabled:opacity-60"
          >
            {enCurso ? "…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => onResolver(false)}
            disabled={bloqueado}
            className="cursor-pointer rounded-[9px] border border-borde-control bg-white px-[13px] py-[9px] text-[11.5px] leading-none font-semibold text-tinta disabled:opacity-60"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

function Marca({ confirmado }: { confirmado: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {confirmado ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
    </svg>
  );
}
