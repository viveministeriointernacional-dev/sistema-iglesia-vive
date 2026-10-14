"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ETIQUETA_ORIGEN,
  type PeticionParaPintar,
  nombreVisible,
} from "@/lib/oracion-catalogo";
import { marcarComoOrada } from "./acciones";

/// El color del distintivo de origen. «Se acaba de registrar» va en ámbar
/// porque **pide algo hoy**: esa persona está en las 72 horas de la Operación
/// 72 y su petición es la mejor excusa para la primera llamada. Los otros tres
/// son informativos y van en gris, para que el ámbar signifique algo.
const TONO_ORIGEN: Record<string, string> = {
  REGISTRO: "border-[rgba(201,123,44,.4)] bg-ambar-fondo text-ambar-texto",
  PERSONA: "border-[rgba(19,28,36,.14)] bg-papel text-[rgba(19,28,36,.6)]",
  EQUIPO: "border-[rgba(19,28,36,.14)] bg-papel text-[rgba(19,28,36,.6)]",
  HISTORICO: "border-[rgba(19,28,36,.1)] bg-papel text-[rgba(19,28,36,.45)]",
};

export function Peticion({
  peticion,
  fechaPedida,
  fechaOrada,
}: {
  peticion: PeticionParaPintar;
  /// Las fechas llegan ya formateadas desde el servidor, en hora de Colombia.
  /// Formatearlas aquí las pintaría en la zona de quien mire (§12.1).
  fechaPedida: string;
  fechaOrada: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const pendiente = peticion.oradaEl === null;
  const nombre = nombreVisible(peticion);

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const resultado = await marcarComoOrada(peticion.id, nota);
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo guardar.");
        return;
      }
      setAbierto(false);
      // `revalidatePath` limpia la caché del servidor pero NO repinta lo que el
      // navegador ya tiene: sin esto la petición se queda a la vista y se
      // marcaría dos veces (la regla del 11-sep).
      router.refresh();
    });
  }

  return (
    <li className="tarjeta p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* ⚠️ El enlace a la ficha se conserva AUNQUE sea reservada: lo que
                la persona pidió fue que no se publique su nombre en la lista,
                no quedarse sin que nadie la acompañe. */}
            {peticion.learnerId ? (
              <Link
                href={`/expediente/${peticion.learnerId}`}
                className="text-[14px] leading-none font-semibold text-tinta hover:text-azul-700 hover:underline"
              >
                {nombre}
              </Link>
            ) : (
              <span className="text-[14px] leading-none font-semibold text-tinta">
                {nombre}
              </span>
            )}
            {peticion.reservada ? (
              <span className="rounded-full border border-[rgba(19,28,36,.16)] px-2 py-0.5 text-[10px] font-bold tracking-[.06em] text-[rgba(19,28,36,.5)] uppercase">
                Pidió reserva
              </span>
            ) : null}
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[.06em] uppercase ${
                TONO_ORIGEN[peticion.origen] ?? TONO_ORIGEN.HISTORICO
              }`}
            >
              {ETIQUETA_ORIGEN[peticion.origen]}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
            {peticion.fase ?? "Sin expediente"} · {fechaPedida}
            {peticion.registradaPor ? ` · la registró ${peticion.registradaPor}` : ""}
          </p>
        </div>

        {pendiente ? (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            disabled={enCurso}
            className="boton-secundario shrink-0 text-[12px]"
          >
            {abierto ? "Cancelar" : "Ya oramos por esto"}
          </button>
        ) : (
          <span className="shrink-0 rounded-full border border-[rgba(63,159,122,.35)] bg-[rgba(63,159,122,.09)] px-2.5 py-1 text-[10px] font-bold tracking-[.06em] text-[#2f7a5c] uppercase">
            Ya oramos
          </span>
        )}
      </div>

      {/* El texto, que es lo que de verdad importa del renglón. Va en su propio
          bloque y con el salto de línea respetado: la gente escribe párrafos. */}
      <p className="mt-3 rounded-[10px] bg-papel p-3 text-[13.5px] leading-[1.55] whitespace-pre-wrap text-tinta">
        {peticion.texto}
      </p>

      {!pendiente && fechaOrada ? (
        <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
          Oraron el {fechaOrada}
          {peticion.oradaPor ? ` · ${peticion.oradaPor}` : ""}
          {peticion.notaDeOracion ? ` — «${peticion.notaDeOracion}»` : ""}
        </p>
      ) : null}

      {abierto ? (
        <div className="mt-3 rounded-[10px] border border-[rgba(19,28,36,.14)] p-3">
          <label className="etiqueta-campo" htmlFor={`nota-${peticion.id}`}>
            ¿Quieres dejar una nota? (opcional)
          </label>
          <textarea
            id={`nota-${peticion.id}`}
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Por ejemplo: oramos en la reunión del martes"
            className="campo"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={confirmar}
              disabled={enCurso}
              className="boton-primario text-[12px]"
            >
              {enCurso ? "Guardando…" : "Confirmar"}
            </button>
            <span className="text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
              Pasa al historial. Sigue guardada en el expediente de la persona.
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </li>
  );
}
