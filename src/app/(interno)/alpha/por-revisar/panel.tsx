"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LARGO_MINIMO_NOTA } from "@/lib/taller-catalogo";

import { revisar } from "./acciones";

export type RespuestaVista = {
  number: number;
  kind: string;
  prompt: string;
  texto: string | null;
  elegida: string | null;
};

export function PanelDeRevision({
  workshopId,
  respuestas,
  completados,
  totalDeTemas,
}: {
  workshopId: string;
  respuestas: RespuestaVista[];
  /// Cuántos temas lleva aprobados ya. Es lo que le dice al líder qué está
  /// decidiendo: aprobar el doceavo cierra el recorrido.
  completados: number;
  totalDeTemas: number;
}) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, arrancar] = useTransition();

  const faltan = totalDeTemas - completados;
  const cerrariaElRecorrido = faltan === 1;

  function decidir(aprobado: boolean) {
    setError(null);
    setAviso(null);
    arrancar(async () => {
      const r = await revisar(workshopId, aprobado, nota);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      if (r.completoLosDoce) {
        setAviso(
          "Terminó los 12 temas: el sistema le marcó el hito CASA DE FE. La fase no se movió.",
        );
      }
      setNota("");
      // Sin esto la cola seguiría mostrando el taller que se acaba de revisar.
      router.refresh();
    });
  }

  const notaCorta = nota.trim().length < LARGO_MINIMO_NOTA;

  return (
    <>
      <ol className="space-y-2.5 px-5 py-4">
        {respuestas.map((r) => (
          <li
            key={r.number}
            className="rounded-[9px] border border-[rgba(19,28,36,.12)] p-3.5"
          >
            <p className="text-[11.5px] font-semibold text-[rgba(19,28,36,.45)]">
              {r.number}) {r.prompt}
            </p>
            {r.kind === "OPCION" ? (
              r.elegida ? (
                <p className="mt-2 flex items-center gap-2">
                  <span className="rounded-[5px] border border-[rgba(19,28,36,.2)] bg-[rgba(19,28,36,.04)] px-2.5 py-1 text-[12.5px] font-semibold text-tinta">
                    {r.elegida}
                  </span>
                  <span className="text-[11.5px] text-[rgba(19,28,36,.5)]">
                    marcó esta
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-[12.5px] text-[#8a5a12]">Sin marcar</p>
              )
            ) : (
              <p className="mt-1.5 text-[13.5px] leading-[1.6] whitespace-pre-line text-[rgba(19,28,36,.85)]">
                {r.texto?.trim() || (
                  <span className="text-[#8a5a12]">Sin responder</span>
                )}
              </p>
            )}
            {r.kind === "DIBUJO" ? (
              <p className="mt-2 text-[11px] text-[rgba(19,28,36,.5)]">
                Esta es de dibujar: lo describió en palabras y el dibujo lo trae
                en el cuaderno.
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="border-t border-[rgba(19,28,36,.1)] bg-[rgba(19,28,36,.03)] px-5 py-4">
        <label htmlFor="nota" className="mb-1.5 block text-[12px] font-semibold">
          Tu evaluación{" "}
          <span className="font-normal text-[rgba(19,28,36,.55)]">
            — obligatoria si lo devuelves, opcional si lo apruebas
          </span>
        </label>
        <textarea
          id="nota"
          rows={2}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="¿Qué viste en sus respuestas? Lo que escribas aquí lo lee la persona."
          className="w-full resize-none rounded-[7px] border border-[rgba(19,28,36,.2)] bg-white px-3 py-2.5 text-[13px]"
        />

        {error ? (
          <p role="alert" className="mt-2 text-[12px] text-[#8a3226]">
            {error}
          </p>
        ) : null}
        {aviso ? (
          <p className="mt-2 rounded border border-[#bfd8cc] bg-[#eef6f2] px-3 py-2 text-[12px] font-semibold text-[#255c45]">
            {aviso}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => decidir(true)}
            disabled={pendiente}
            className="rounded-[7px] bg-[#2f6f53] px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60"
          >
            Aprobar el tema
          </button>
          <button
            type="button"
            onClick={() => decidir(false)}
            disabled={pendiente || notaCorta}
            title={notaCorta ? "Escribe qué debe corregir" : undefined}
            className="rounded-[7px] border border-[#a63d2f] px-5 py-2.5 text-[13.5px] font-semibold text-[#a63d2f] disabled:opacity-50"
          >
            Devolver para corregir
          </button>
          <span className="flex-1 text-right text-[11.5px] leading-[1.45] text-[rgba(19,28,36,.55)]">
            {cerrariaElRecorrido ? (
              <strong className="font-semibold text-[#255c45]">
                Con este termina los {totalDeTemas}: se le marcaría el hito CASA
                DE FE.
              </strong>
            ) : (
              <>
                Al aprobarlo lleva {completados + 1} de {totalDeTemas}. Le
                faltarían {faltan - 1}.
              </>
            )}
          </span>
        </div>
      </div>
    </>
  );
}
