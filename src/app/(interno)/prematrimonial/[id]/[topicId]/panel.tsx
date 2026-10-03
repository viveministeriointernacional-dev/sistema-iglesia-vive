"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ETIQUETA_TEMA_PAREJA,
  LARGO_MINIMO_NOTA_PRE,
  type EstadoTemaPareja,
} from "@/lib/prematrimonial-catalogo";

import { destapar, revisar } from "../../acciones";

/// Lo que el pastor hace con un tema: destaparlo y aprobarlo o devolverlo.
export function PanelDeRevision({
  coupleId,
  topicId,
  nombreA,
  nombreB,
  learnerAId,
  learnerBId,
  estado,
  destapado,
  destapadoEl,
}: {
  coupleId: string;
  topicId: string;
  nombreA: string;
  nombreB: string;
  learnerAId: string;
  learnerBId: string;
  estado: EstadoTemaPareja;
  destapado: boolean;
  destapadoEl: string | null;
}) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [devueltoA, setDevueltoA] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enCurso, iniciar] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string; aviso?: string }>) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) {
        setError(r.mensaje ?? "No se pudo guardar.");
        return;
      }
      if (r.aviso) setAviso(r.aviso);
      setConfirmando(false);
      router.refresh();
    });
  }

  const yaRevisado = estado === "APROBADO" || estado === "DEVUELTO";

  return (
    <section className="tarjeta p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="etiqueta-seccion">ESTADO DEL TEMA</h2>
          <p className="mt-1.5 text-[13px] leading-[1.5] font-semibold">
            {ETIQUETA_TEMA_PAREJA[estado]}
          </p>
          <p className="mt-1 text-[11.5px] leading-[1.5] text-[rgba(19,28,36,.55)]">
            {destapado
              ? `Los dos ya pueden ver lo que respondió el otro${destapadoEl ? ` · ${destapadoEl}` : ""}.`
              : "Ellos todavía NO ven lo que respondió el otro."}
          </p>
        </div>

        {!destapado ? (
          confirmando ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-[rgba(122,59,92,.35)] bg-[#f7eef2] p-3">
              <p className="max-w-[260px] text-[11.5px] leading-[1.45] font-semibold text-[#7a3b5c]">
                Al destapar, los dos ven lo que respondió el otro.{" "}
                <strong>Esto no se puede deshacer.</strong>
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() => ejecutar(() => destapar(coupleId, topicId))}
                  className="cursor-pointer rounded-[9px] bg-[#7a3b5c] px-3.5 py-2 text-[12.5px] font-semibold text-white"
                >
                  Sí, destapar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="cursor-pointer rounded-[9px] border border-[rgba(19,28,36,.16)] bg-white px-3.5 py-2 text-[12.5px] font-semibold"
                >
                  No
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="cursor-pointer rounded-[9px] bg-[#7a3b5c] px-4 py-2.5 text-[12.5px] font-semibold text-white"
            >
              Destapar a la pareja
            </button>
          )
        ) : null}
      </div>

      {estado === "ESPERANDO" || yaRevisado ? (
        <div className="mt-4 border-t border-[rgba(19,28,36,.09)] pt-4">
          <label htmlFor="nota" className="etiqueta-campo">
            Lo que quieres conversar con ellos
          </label>
          <textarea
            id="nota"
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Al devolver es obligatorio y dice qué corregir."
            className="mt-1.5 w-full resize-y rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white px-3 py-2.5 text-[13px] leading-[1.5]"
          />

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="devuelto" className="etiqueta-campo">
                Si devuelves, ¿a quién?
              </label>
              <select
                id="devuelto"
                value={devueltoA}
                onChange={(e) => setDevueltoA(e.target.value)}
                className="mt-1.5 rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white px-3 py-2 text-[13px]"
              >
                <option value="">A los dos</option>
                <option value={learnerAId}>Solo a {nombreA}</option>
                <option value={learnerBId}>Solo a {nombreB}</option>
              </select>
            </div>

            <div className="ml-auto flex gap-2">
              <button
                type="button"
                disabled={enCurso || nota.trim().length < LARGO_MINIMO_NOTA_PRE}
                onClick={() =>
                  ejecutar(() =>
                    revisar(coupleId, topicId, false, nota, devueltoA || null),
                  )
                }
                className="cursor-pointer rounded-[9px] border border-[rgba(19,28,36,.16)] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-rojo disabled:opacity-45"
              >
                Devolver
              </button>
              <button
                type="button"
                disabled={enCurso}
                onClick={() => ejecutar(() => revisar(coupleId, topicId, true, nota, null))}
                className="cursor-pointer rounded-[9px] bg-tinta px-4 py-2.5 text-[12.5px] font-semibold text-white disabled:opacity-45"
              >
                Aprobar el tema
              </button>
            </div>
          </div>

          <p className="mt-2.5 text-[11.5px] leading-[1.5] text-[rgba(19,28,36,.5)]">
            <strong>Aprobar cuenta el tema para los dos.</strong> Devolver se lo
            pide otra vez solo a quien elijas — al otro no se le puede obligar a
            rehacer lo que hizo bien.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}

      {aviso ? (
        <p
          role="status"
          className="mt-3 rounded-[8px] border border-[rgba(47,111,83,.3)] bg-[#edf5f0] px-3 py-2.5 text-[11.5px] leading-[1.45] font-medium text-[#2f6f53]"
        >
          {aviso}
        </p>
      ) : null}
    </section>
  );
}
