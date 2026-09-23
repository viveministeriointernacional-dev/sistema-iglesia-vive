"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  diaCivilLargo,
  esDiaFuturo,
  rejillaDelMes,
} from "@/lib/gi-catalogo";
import { marcarDevocional } from "../acciones";

const ROTULOS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

/// **El mes de un joven**: la rejilla, de lunes a domingo.
///
/// Los huecos del principio van vacíos y no con los días del mes anterior: una
/// marca puesta ahí caería en un mes que no se está mirando.
export function MesDeGi({
  mes,
  hoy,
  marcados: iniciales,
  learnerId,
  puedeMarcar,
}: {
  mes: string;
  hoy: string;
  marcados: string[];
  learnerId: string;
  puedeMarcar: boolean;
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState(() => new Set(iniciales));
  const [error, setError] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();

  function alternar(dia: string) {
    if (!puedeMarcar || esDiaFuturo(dia, hoy)) return;
    const estaba = marcados.has(dia);
    const siguiente = new Set(marcados);
    if (estaba) siguiente.delete(dia);
    else siguiente.add(dia);
    setMarcados(siguiente);
    setError(null);

    iniciar(async () => {
      const r = await marcarDevocional(learnerId, dia, !estaba);
      if (!r.ok) {
        setMarcados(new Set(marcados));
        setError(r.mensaje);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {ROTULOS.map((rotulo) => (
          <p
            key={rotulo}
            className="text-[9.5px] leading-none font-bold tracking-[.08em] text-[rgba(19,28,36,.45)]"
          >
            {rotulo}
          </p>
        ))}

        {rejillaDelMes(mes).map((dia, i) =>
          dia === null ? (
            <div key={`hueco-${i}`} className="h-[72px]" />
          ) : (
            <Casilla
              key={dia}
              dia={dia}
              hecho={marcados.has(dia)}
              futuro={esDiaFuturo(dia, hoy)}
              esHoy={dia === hoy}
              puedeMarcar={puedeMarcar}
              trabajando={trabajando}
              onClick={() => alternar(dia)}
            />
          ),
        )}
      </div>

      {error ? (
        <p className="mt-3 text-[12px] leading-[1.5] font-semibold text-ambar-texto">
          {error}
        </p>
      ) : null}
    </>
  );
}

function Casilla({
  dia,
  hecho,
  futuro,
  esHoy,
  puedeMarcar,
  trabajando,
  onClick,
}: {
  dia: string;
  hecho: boolean;
  futuro: boolean;
  esHoy: boolean;
  puedeMarcar: boolean;
  trabajando: boolean;
  onClick: () => void;
}) {
  const numero = Number(dia.slice(8));
  const etiqueta = `${diaCivilLargo(dia)}, ${
    hecho ? "hizo el devocional" : futuro ? "aún no llega" : "sin marcar"
  }`;

  if (futuro) {
    return (
      <div
        aria-label={etiqueta}
        className="h-[72px] rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] bg-papel p-2 text-[12px] leading-none font-bold text-[rgba(19,28,36,.3)]"
      >
        {numero}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={!puedeMarcar || trabajando}
      onClick={onClick}
      aria-pressed={hecho}
      aria-label={etiqueta}
      className={`flex h-[72px] flex-col items-start justify-between rounded-[10px] p-2 text-left ${
        hecho
          ? "border-none bg-verde-700 text-white"
          : "border border-[rgba(19,28,36,.2)] bg-white text-tinta"
      } ${esHoy && !hecho ? "border-[1.5px] border-azul-900" : ""} ${
        puedeMarcar ? "" : "cursor-default"
      }`}
    >
      <span className="text-[12px] leading-none font-bold">{numero}</span>
      {hecho ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12.5 L9.5 18 L20 6" />
        </svg>
      ) : null}
    </button>
  );
}
