"use client";

import { useState } from "react";

/// Genera una clave que ya cumple las condiciones, y la deja copiar.
///
/// Existe porque escribir una clave a mano se hace de dos maneras malas: o sale
/// corta y el sistema la rechaza, o sale «iglesia2026» y no protege nada. Lo
/// generado **se muestra en claro** a propósito: hay que poder leerlo para
/// dictarlo o copiarlo antes de guardarlo.
export function GeneradorDeClave({
  valor,
  generar,
  alGenerar,
  etiquetaBoton = "Generar una",
  nota,
}: {
  /// Lo que hay ahora en el campo, para poder copiarlo.
  valor: string;
  generar: () => string;
  alGenerar: (valor: string) => void;
  etiquetaBoton?: string;
  /// Qué decir debajo cuando ya hay algo generado (por ejemplo, que después no
  /// se va a poder volver a ver).
  nota?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles no pasa nada: la clave está a la vista y se
      // puede seleccionar a mano.
    }
  }

  return (
    <div className="mt-[7px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => {
            alGenerar(generar());
            setCopiado(false);
          }}
          className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-azul-700"
        >
          {etiquetaBoton}
        </button>

        {valor ? (
          <button
            type="button"
            onClick={copiar}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-azul-700"
          >
            {copiado ? "¡Copiada!" : "Copiar"}
          </button>
        ) : null}
      </div>

      {valor ? (
        <p className="mt-[7px] rounded-[8px] bg-papel px-[11px] py-[9px] font-mono text-[13px] leading-[1.3] font-semibold tracking-[.5px] break-all text-tinta">
          {valor}
        </p>
      ) : null}

      {valor && nota ? (
        <p className="mt-[6px] text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
          {nota}
        </p>
      ) : null}
    </div>
  );
}
