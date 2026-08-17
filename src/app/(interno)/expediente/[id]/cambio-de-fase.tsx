"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Phase } from "@iglesia/prisma-client";
import { cambiarDeFase } from "./acciones";

export type HistorialDeFase = {
  id: string;
  desde: Phase;
  hasta: Phase;
  fecha: string;
  decidio: string;
  nota: string | null;
};

/// El paso de fase (§20): nunca automático, siempre con un responsable humano.
/// Lo aprueba su mentor o el pastor; el consolidador no, y el aprendiz jamás
/// ve este bloque.
export function CambioDeFase({
  learnerId,
  destino,
  cumplidos,
  faltantes,
  historial,
  puedeAprobar,
}: {
  learnerId: string;
  destino: Phase | null;
  cumplidos: string[];
  faltantes: string[];
  historial: HistorialDeFase[];
  puedeAprobar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  return (
    <section className="mt-3 rounded-[12px] bg-papel p-4">
      <h2 className="text-[9.5px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
        CAMBIO DE FASE
      </h2>

      {destino ? (
        <>
          <p className="mt-[9px] font-serif text-[17px] leading-[1.25] font-normal text-tinta">
            Paso a {destino}
          </p>

          <ul className="mt-3 flex flex-col gap-[6px]">
            {cumplidos.map((requisito) => (
              <li
                key={requisito}
                className="text-[11.5px] leading-[1.4] font-semibold text-verde-700"
              >
                ✓ {requisito}
              </li>
            ))}
            {faltantes.map((requisito) => (
              <li
                key={requisito}
                className="text-[11.5px] leading-[1.4] font-semibold text-[rgba(19,28,36,.45)]"
              >
                ○ {requisito}
              </li>
            ))}
          </ul>

          {puedeAprobar ? (
            faltantes.length ? (
              <p className="mt-3 text-[11.5px] leading-[1.5] font-medium text-ambar-texto">
                Falta cumplir lo de arriba antes de aprobar el paso.
              </p>
            ) : abierto ? (
              <div className="mt-3">
                <label className="block">
                  <span className="etiqueta-campo">Nota de la decisión</span>
                  <textarea
                    value={nota}
                    onChange={(evento) => setNota(evento.target.value)}
                    rows={2}
                    placeholder="Qué se conversó, quién estuvo"
                    className="campo font-medium"
                  />
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={enCurso}
                    onClick={() => {
                      setError(null);
                      iniciar(async () => {
                        const resultado = await cambiarDeFase(learnerId, nota);
                        if (!resultado.ok) {
                          setError(resultado.mensaje);
                          return;
                        }
                        setNota("");
                        setAbierto(false);
                        router.refresh();
                      });
                    }}
                    className="boton-primario"
                  >
                    {enCurso ? "Aprobando…" : `Aprobar paso a ${destino}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    className="boton-secundario"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAbierto(true)}
                className="boton-primario mt-3"
              >
                Aprobar paso a {destino}
              </button>
            )
          ) : (
            <p className="mt-3 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              Lo aprueba su mentor o un pastor.
            </p>
          )}
        </>
      ) : (
        <p className="mt-[9px] text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          Está en la última fase del recorrido.
        </p>
      )}

      {historial.length ? (
        <div className="mt-4 border-t border-[rgba(19,28,36,.09)] pt-3">
          <p className="text-[9.5px] leading-none font-bold tracking-[.14em] text-[rgba(19,28,36,.42)]">
            HISTORIA
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {historial.map((paso) => (
              <li key={paso.id}>
                <p className="text-[11.5px] leading-[1.4] font-semibold text-tinta">
                  {paso.desde} → {paso.hasta}
                </p>
                <p className="text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
                  {paso.fecha} · aprobó {paso.decidio}
                </p>
                {paso.nota ? (
                  <p className="mt-[3px] text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.6)]">
                    {paso.nota}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </section>
  );
}
