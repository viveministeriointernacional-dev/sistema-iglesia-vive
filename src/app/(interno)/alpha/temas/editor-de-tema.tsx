"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { guardarTema, rehacerCodigo } from "./acciones";

export function EditorDeTema({
  topicId,
  nombre,
  subtitulo,
  versiculo,
  tieneAvance,
}: {
  topicId: string;
  nombre: string;
  subtitulo: string;
  versiculo: string;
  /// Si alguien ya tiene este tema marcado, renombrarlo cambia el significado
  /// de lo que tiene. La pantalla lo avisa en el momento, no en general.
  tieneAvance: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [n, setN] = useState(nombre);
  const [s, setS] = useState(subtitulo);
  const [v, setV] = useState(versiculo);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, arrancar] = useTransition();

  const cambioElNombre = n.trim() !== nombre;

  function guardar() {
    setError(null);
    arrancar(async () => {
      const r = await guardarTema(topicId, { nombre: n, subtitulo: s, versiculo: v });
      if (r.ok) {
        setAbierto(false);
        // Sin esto la tarjeta seguiría mostrando el nombre viejo: la acción
        // guarda, pero `revalidatePath` no repinta lo que el navegador ya tiene
        // (la regla del 11-sep-2026).
        router.refresh();
      } else {
        setError(r.mensaje);
      }
    });
  }

  function rehacer() {
    setError(null);
    arrancar(async () => {
      const r = await rehacerCodigo(topicId);
      if (r.ok) router.refresh();
      else setError(r.mensaje);
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-3 w-full rounded-[6px] border border-[rgba(19,28,36,.2)] py-2 text-[12px] font-semibold text-tinta"
      >
        Editar
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[8px] border border-[rgba(19,28,36,.14)] bg-[rgba(19,28,36,.03)] p-3">
      <label className="block text-[11px] font-semibold" htmlFor={`n-${topicId}`}>
        Nombre del tema
      </label>
      <input
        id={`n-${topicId}`}
        value={n}
        onChange={(e) => setN(e.target.value)}
        className="mt-1 w-full rounded border border-[rgba(19,28,36,.2)] bg-white px-2.5 py-2 text-[13px]"
      />

      <label className="mt-2.5 block text-[11px] font-semibold" htmlFor={`s-${topicId}`}>
        Subtítulo <span className="font-normal text-[rgba(19,28,36,.5)]">— opcional</span>
      </label>
      <input
        id={`s-${topicId}`}
        value={s}
        onChange={(e) => setS(e.target.value)}
        className="mt-1 w-full rounded border border-[rgba(19,28,36,.2)] bg-white px-2.5 py-2 text-[13px]"
      />

      <label className="mt-2.5 block text-[11px] font-semibold" htmlFor={`v-${topicId}`}>
        Versículo para memorizar
      </label>
      <input
        id={`v-${topicId}`}
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="mt-1 w-full rounded border border-[rgba(19,28,36,.2)] bg-white px-2.5 py-2 text-[13px]"
      />

      {cambioElNombre && tieneAvance ? (
        <p className="mt-2.5 rounded border border-[#dccfa4] bg-[#fbf4dc] px-2.5 py-2 text-[11.5px] leading-[1.45] text-[#4a3d1c]">
          Hay gente con este tema marcado. Al renombrarlo, <strong>lo que ya
          tienen pasa a llamarse así</strong>: el avance apunta al número del
          tema, no al nombre.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] text-[#8a3226]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente}
          className="flex-1 rounded-[6px] bg-azul-900 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setN(nombre);
            setS(subtitulo);
            setV(versiculo);
            setError(null);
          }}
          className="flex-1 rounded-[6px] border border-[rgba(19,28,36,.2)] py-2 text-[12px] font-semibold text-tinta"
        >
          Cancelar
        </button>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] text-[rgba(19,28,36,.55)]">
          Rehacer el código del QR
        </summary>
        <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[#8a3226]">
          ⚠️ Esto deja <strong>inservibles los carteles ya impresos</strong> de
          este tema. Solo si el código se filtró donde no debía.
        </p>
        <button
          type="button"
          onClick={rehacer}
          disabled={pendiente}
          className="mt-2 rounded-[6px] border border-[#a63d2f] px-3 py-1.5 text-[11.5px] font-semibold text-[#a63d2f] disabled:opacity-60"
        >
          Rehacerlo de todos modos
        </button>
      </details>
    </div>
  );
}
