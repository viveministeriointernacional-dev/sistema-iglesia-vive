"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { devolverAProcesoDesdeAdministracion } from "./acciones";

/// «Volver a proceso»: la devuelve al tablero con 72 horas nuevas.
///
/// Pide una nota opcional porque quien lea el expediente después va a querer
/// saber qué cambió — casi siempre es que la persona misma lo pidió.
export function VolverAProceso({
  learnerId,
  nombre,
}: {
  learnerId: string;
  nombre: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, empezar] = useTransition();
  const router = useRouter();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton-secundario"
      >
        Volver a proceso
      </button>
    );
  }

  return (
    <div className="w-full rounded-[11px] border border-[rgba(19,28,36,.16)] bg-papel p-[14px]">
      <p className="text-[12.5px] leading-[1.45] font-bold text-tinta">
        {nombre} vuelve al proceso
      </p>
      <p className="mt-1 text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
        Vuelve al tablero de Operación 72 con 72 horas nuevas, contadas desde
        hoy. Si ya está en Fortalecer o más adelante, la acompaña su mentor y no
        vuelve al tablero.
      </p>

      <label className="mt-3 block">
        <span className="etiqueta-campo">¿QUÉ CAMBIÓ? (OPCIONAL)</span>
        <textarea
          value={nota}
          onChange={(evento) => setNota(evento.target.value)}
          rows={2}
          className="campo"
          placeholder="Ella misma pidió entrar a Casa de Fe"
        />
      </label>

      {error ? (
        <p className="mt-2 text-[11.5px] leading-[1.4] font-semibold text-rojo">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enCurso}
          onClick={() =>
            empezar(async () => {
              setError(null);
              const resultado = await devolverAProcesoDesdeAdministracion(
                learnerId,
                { nota },
              );
              if (resultado.ok) {
                setAbierto(false);
                // Sin esto el renglón sigue en la lista aunque ya volvió al
                // proceso: `revalidatePath` limpia el servidor, no la pantalla.
                router.refresh();
              } else setError(resultado.mensaje);
            })
          }
          className="boton-primario"
        >
          {enCurso ? "Guardando…" : "Devolver al proceso"}
        </button>
        <button
          type="button"
          disabled={enCurso}
          onClick={() => setAbierto(false)}
          className="boton-secundario"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
