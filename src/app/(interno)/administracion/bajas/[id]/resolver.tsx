"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resolverBaja } from "../../acciones";

type Camino = "autorizar" | "devolver";

/// Las dos salidas de una solicitud de baja. Se elige una y solo entonces
/// aparece qué escribir: no hay dos botones compitiendo por el clic.
///
/// La observación es obligatoria al devolver — es lo que el consolidador va a
/// leer en la tarjeta — y opcional al autorizar, donde solo queda de registro.
export function ResolverSolicitud({
  solicitudId,
  nombre,
  consolidador,
}: {
  solicitudId: string;
  nombre: string;
  consolidador: string | null;
}) {
  const router = useRouter();
  const [camino, setCamino] = useState<Camino | null>(null);
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const quien = consolidador ?? "El consolidador";
  const primerNombre = nombre.split(" ")[0];
  const faltaObservacion = camino === "devolver" && observacion.trim().length < 10;

  function enviar() {
    if (!camino) return;
    setError(null);
    iniciar(async () => {
      const resultado = await resolverBaja(
        solicitudId,
        camino === "autorizar",
        observacion,
      );
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      router.push("/administracion/bajas");
      router.refresh();
    });
  }

  return (
    <div>
      <p className="etiqueta-seccion">¿QUÉ HACEMOS?</p>

      <div className="mt-3 flex flex-col gap-[10px]">
        <button
          type="button"
          aria-pressed={camino === "autorizar"}
          onClick={() => setCamino("autorizar")}
          className="opcion opcion-amplia"
        >
          <span className="block text-[13px] leading-[1.3] font-bold text-tinta">
            Autorizar la baja
          </span>
          <span className="mt-[6px] block text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Sale de consolidación y de todos los procesos. Se conserva el
            expediente y se puede reactivar después.
          </span>
        </button>

        <button
          type="button"
          aria-pressed={camino === "devolver"}
          onClick={() => setCamino("devolver")}
          className="opcion opcion-amplia"
        >
          <span className="block text-[13px] leading-[1.3] font-bold text-tinta">
            No autorizar · devolver a consolidación
          </span>
          <span className="mt-[6px] block text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Vuelve al tablero como estaba, con tu observación encima de la
            tarjeta.
          </span>
        </button>
      </div>

      {camino ? (
        <label className="mt-4 block">
          <span className="etiqueta-campo">
            {camino === "devolver"
              ? "¿Qué debe hacer el consolidador con esta persona?"
              : "Nota para el registro (opcional)"}
          </span>
          <textarea
            value={observacion}
            onChange={(evento) => setObservacion(evento.target.value)}
            rows={3}
            className={camino === "devolver" ? "campo" : "campo campo-opcional"}
            placeholder={
              camino === "devolver"
                ? "Por dónde intentarlo, con quién preguntar, qué falta por probar."
                : "Por qué se autoriza, si hace falta dejarlo dicho."
            }
          />
          {camino === "devolver" ? (
            <span className="mt-[7px] block text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
              Obligatorio. {quien} lo verá en la tarjeta de {primerNombre} y
              quedará en el expediente.
            </span>
          ) : null}
        </label>
      ) : null}

      <div className="mt-5">
        <button
          type="button"
          onClick={enviar}
          disabled={!camino || enCurso || faltaObservacion}
          className="boton-primario"
        >
          {enCurso
            ? "Guardando…"
            : camino === "autorizar"
              ? "Autorizar la baja"
              : camino === "devolver"
                ? "Devolver a consolidación"
                : "Elige una opción"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] leading-[1.5] font-semibold text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}
