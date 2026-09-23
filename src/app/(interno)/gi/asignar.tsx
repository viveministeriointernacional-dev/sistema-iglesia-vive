"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  asignarJovenAGi,
  buscarJovenesParaGi,
  quitarJovenDeGi,
  type CandidatoDeGi,
} from "./acciones";

/// **Repartir los jóvenes entre los líderes de GI.**
///
/// ⚠️ Se busca por nombre en vez de listar a todo el mundo: en la base hay 361
/// personas y un desplegable con todas no se lee. El panel no carga nada hasta
/// que alguien escribe — solo lo usa quien va a cambiar algo, y cargarlo
/// siempre se lo cobraría a todo el que abre la pantalla a mirar.
export function AsignarAGi({
  lideres,
}: {
  lideres: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [lider, setLider] = useState(lideres[0]?.id ?? "");
  const [encontrados, setEncontrados] = useState<CandidatoDeGi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();

  function buscar() {
    setError(null);
    iniciar(async () => {
      setEncontrados(await buscarJovenesParaGi(texto));
    });
  }

  function asignar(learnerId: string) {
    setError(null);
    iniciar(async () => {
      const r = await asignarJovenAGi(learnerId, lider);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      setEncontrados(await buscarJovenesParaGi(texto));
      router.refresh();
    });
  }

  function quitar(learnerId: string) {
    setError(null);
    iniciar(async () => {
      const r = await quitarJovenDeGi(learnerId);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      setEncontrados(await buscarJovenesParaGi(texto));
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-4 rounded-[8px] border border-[rgba(19,28,36,.2)] bg-white px-4 py-[10px] text-[12.5px] leading-none font-semibold text-azul-700"
      >
        Repartir jóvenes entre los líderes de GI
      </button>
    );
  }

  return (
    <section className="tarjeta mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="etiqueta-seccion">REPARTIR JÓVENES</h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[11.5px] leading-none font-semibold text-azul-700"
        >
          Cerrar
        </button>
      </div>

      {!lideres.length ? (
        <p className="mt-3 text-[12.5px] leading-[1.6] font-medium text-ambar-texto">
          Todavía no hay ninguna cuenta con el permiso de llevar GI. Se enciende
          en Administración, en la ficha de la persona: «Lleva GI».
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label
                htmlFor="gi-lider"
                className="text-[11px] leading-none font-bold tracking-[.06em] text-[rgba(19,28,36,.45)]"
              >
                LÍDER DE GI
              </label>
              <select
                id="gi-lider"
                className="campo mt-2 w-full"
                value={lider}
                onChange={(e) => setLider(e.target.value)}
              >
                {lideres.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px] flex-1">
              <label
                htmlFor="gi-buscar"
                className="text-[11px] leading-none font-bold tracking-[.06em] text-[rgba(19,28,36,.45)]"
              >
                BUSCAR AL JOVEN POR NOMBRE
              </label>
              <input
                id="gi-buscar"
                className="campo mt-2 w-full"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscar();
                }}
                placeholder="Al menos tres letras"
              />
            </div>
            <button
              type="button"
              disabled={trabajando}
              onClick={buscar}
              className="rounded-[8px] bg-azul-900 px-4 py-[11px] text-[12.5px] leading-none font-bold text-white disabled:opacity-60"
            >
              Buscar
            </button>
          </div>

          {encontrados ? (
            <div className="mt-4 flex flex-col gap-2">
              {encontrados.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
                  Nadie con ese nombre. Escribe al menos tres letras.
                </p>
              ) : null}
              {encontrados.map((joven) => (
                <div
                  key={joven.learnerId}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] bg-papel p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] leading-none font-semibold text-tinta">
                      {joven.nombre}
                    </span>
                    <span className="mt-[5px] block text-[11px] leading-none font-medium text-[rgba(19,28,36,.45)]">
                      {joven.edad !== null
                        ? `${joven.edad} años`
                        : "sin fecha de nacimiento"}
                      {joven.liderActual ? ` · hoy la lleva ${joven.liderActual}` : ""}
                    </span>
                  </span>
                  {joven.liderActual ? (
                    <button
                      type="button"
                      disabled={trabajando}
                      onClick={() => quitar(joven.learnerId)}
                      className="text-[12px] leading-none font-semibold text-ambar-texto"
                    >
                      Sacar de GI
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={trabajando}
                    onClick={() => asignar(joven.learnerId)}
                    className="rounded-[8px] border border-[rgba(19,28,36,.2)] bg-white px-3 py-2 text-[12px] leading-none font-semibold text-azul-700"
                  >
                    {joven.liderActual ? "Pasar a este líder" : "Poner en GI"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {error ? (
        <p className="mt-3 text-[12px] leading-[1.5] font-semibold text-ambar-texto">
          {error}
        </p>
      ) : null}
    </section>
  );
}
