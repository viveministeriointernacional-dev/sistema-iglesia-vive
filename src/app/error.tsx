"use client";

import { useEffect } from "react";
import Link from "next/link";

/// La red de seguridad de todo lo que no es el taller ni una pantalla interna:
/// `/ingresar`, `/registro`, `/actualizar-datos`, `/nueva-clave`,
/// `/recuperar` y `/calendario`.
///
/// ⚠️ **Va en la raíz a propósito, para no tener que acordarse.** Cualquier
/// pantalla que se añada mañana queda cubierta sin hacer nada: Next busca el
/// `error.tsx` más cercano y, si el tramo no tiene uno propio, cae aquí. Es la
/// diferencia entre arreglar esto una vez y arreglarlo cada vez.
///
/// El tono es el del taller y no el del equipo: por aquí entra también quien
/// se registra desde un QR y no tiene cuenta.
export default function ErrorGeneral({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] la pantalla no cargó:", error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-papel px-5 py-10 text-tinta">
      <div className="mx-auto max-w-[520px]">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-tinta-42 uppercase">
          Iglesia Vive
        </p>

        <h1 className="mt-4 font-serif text-[26px] leading-[1.12]">
          Esta pantalla no alcanzó a cargar
        </h1>

        <p className="mt-3 text-[14px] leading-[1.6] text-tinta-55">
          Fue algo momentáneo. Vuelve a intentarlo: casi siempre entra al
          segundo intento.
        </p>

        <button
          type="button"
          onClick={reset}
          className="mt-7 w-full rounded-[12px] bg-azul-900 px-4 py-3.5 text-[14px] font-semibold text-white"
        >
          Volver a intentar
        </button>

        <Link
          href="/"
          className="mt-3 block w-full rounded-[12px] border border-borde-control px-4 py-3.5 text-center text-[14px] font-semibold text-tinta"
        >
          Ir al inicio
        </Link>

        {error.digest ? (
          <p className="mt-7 text-[12px] leading-[1.6] text-tinta-42">
            Si vuelve a pasar, pasa este código junto con la hora:{" "}
            <span className="font-semibold tabular-nums text-tinta-55">
              {error.digest}
            </span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
