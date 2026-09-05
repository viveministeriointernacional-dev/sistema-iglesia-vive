"use client";

import { useState, useTransition } from "react";
import { resolverDeclaracionDeLiderazgo } from "../acciones";

export type DeclaracionPendiente = {
  id: string;
  roles: string[];
  etapa: string | null;
  cuando: string;
};

/// Lo que una persona declaró de sí misma en el formulario público de
/// liderazgo. No se aplicó solo a propósito (ver `src/lib/liderazgo.ts`):
/// aquí un administrador lo confirma o lo descarta.
export function DeclaracionDeLiderazgo({
  declaracion,
  personId,
  nombre,
}: {
  declaracion: DeclaracionPendiente;
  personId: string;
  nombre: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resuelta, setResuelta] = useState<"CONFIRMADA" | "DESCARTADA" | null>(
    null,
  );
  const [enCurso, iniciar] = useTransition();

  function resolver(confirmar: boolean) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = await resolverDeclaracionDeLiderazgo(
        declaracion.id,
        confirmar,
        personId,
      );
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setAviso(resultado.aviso ?? null);
      setResuelta(confirmar ? "CONFIRMADA" : "DESCARTADA");
    });
  }

  if (resuelta && !aviso) {
    return (
      <section className="mt-4 rounded-[12px] bg-papel p-4">
        <p className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          {resuelta === "CONFIRMADA"
            ? "Declaración confirmada."
            : "Declaración descartada."}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-[12px] border border-[rgba(201,123,44,.3)] bg-ambar-fondo p-4">
      <h2 className="text-[10px] leading-none font-bold tracking-[.16em] text-ambar-texto">
        {resuelta ? "DECLARACIÓN RESUELTA" : "PENDIENTE DE CONFIRMAR"}
      </h2>

      {resuelta ? null : (
        <>
          <p className="mt-3 text-[12.5px] leading-[1.55] font-medium text-ambar-texto">
            {nombre.split(" ")[0]} llenó el formulario de liderazgo el{" "}
            {declaracion.cuando} y declaró
            {declaracion.roles.length ? (
              <>
                {" "}
                que sirve en{" "}
                <strong className="font-bold">
                  {declaracion.roles.join(", ")}
                </strong>
              </>
            ) : null}
            {declaracion.roles.length && declaracion.etapa ? "," : ""}
            {declaracion.etapa ? (
              <>
                {" "}
                que está en la etapa{" "}
                <strong className="font-bold">{declaracion.etapa}</strong>
              </>
            ) : null}
            . Nada de eso se aplicó solo.
          </p>

          <div className="mt-[14px] flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => resolver(true)}
              disabled={enCurso}
              className="boton-primario"
            >
              {enCurso ? "Guardando…" : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => resolver(false)}
              disabled={enCurso}
              className="boton-secundario"
            >
              Descartar
            </button>
          </div>
        </>
      )}

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
