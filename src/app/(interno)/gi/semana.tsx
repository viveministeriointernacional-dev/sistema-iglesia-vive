"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { JovenDeGi } from "@/lib/gi";
import {
  DIAS_SIN_MARCAR_AVISA,
  LARGO_MINIMO_OBSERVACION,
  diaCivilLargo,
  esDiaFuturo,
} from "@/lib/gi-catalogo";
import { guardarObservacionDeGi, marcarDevocional } from "./acciones";

const ROTULOS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function numeroDelDia(dia: string) {
  return Number(dia.slice(8));
}

/// **La semana de un líder de GI**: una fila por joven y un cuadro por día.
///
/// ⚠️ Lleva `router.refresh()` después de cada acción. `revalidatePath` limpia
/// la caché del servidor pero **no repinta lo que el navegador ya tiene** —es
/// la regla del 11-sep-2026, y aquí muerde más que en ninguna otra pantalla,
/// porque marcar un devocional no mueve nada de sitio: si no se repinta, el
/// líder pulsa, no ve cambiar nada y vuelve a pulsar.
export function SemanaDeGi({
  dias,
  hoy,
  jovenes,
  puedeMarcar,
}: {
  dias: string[];
  hoy: string;
  jovenes: JovenDeGi[];
  puedeMarcar: boolean;
}) {
  if (!jovenes.length) {
    return (
      <p className="mt-4 rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-5 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
        Todavía no hay jóvenes a tu cargo en GI. Los reparten los pastores del
        movimiento desde esta misma pantalla.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-[rgba(19,28,36,.12)] bg-white">
      <div className="hidden items-center gap-3 border-b border-[rgba(19,28,36,.12)] bg-papel px-4 py-3 text-[9.5px] leading-none font-bold tracking-[.08em] text-[rgba(19,28,36,.45)] sm:flex">
        <div className="min-w-0 flex-1">JOVEN</div>
        {dias.map((dia, i) => (
          <div key={dia} className="w-[44px] text-center">
            {ROTULOS[i]} {numeroDelDia(dia)}
          </div>
        ))}
        <div className="w-[96px]" />
      </div>

      {jovenes.map((joven) => (
        <Fila
          key={joven.learnerId}
          joven={joven}
          dias={dias}
          hoy={hoy}
          puedeMarcar={puedeMarcar}
        />
      ))}
    </div>
  );
}

function Fila({
  joven,
  dias,
  hoy,
  puedeMarcar,
}: {
  joven: JovenDeGi;
  dias: string[];
  hoy: string;
  puedeMarcar: boolean;
}) {
  const router = useRouter();
  const [marcados, setMarcados] = useState(() => new Set(joven.marcados));
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function alternar(dia: string) {
    if (!puedeMarcar || esDiaFuturo(dia, hoy)) return;
    const estaba = marcados.has(dia);

    // Se pinta antes de que conteste el servidor: marcar es un gesto de todos
    // los días y esperar medio segundo por cada uno haría la pantalla pesada.
    // Si falla, se devuelve como estaba y se dice por qué.
    const siguiente = new Set(marcados);
    if (estaba) siguiente.delete(dia);
    else siguiente.add(dia);
    setMarcados(siguiente);
    setError(null);

    iniciar(async () => {
      const r = await marcarDevocional(joven.learnerId, dia, !estaba);
      if (!r.ok) {
        setMarcados(new Set(marcados));
        setError(r.mensaje);
        return;
      }
      router.refresh();
    });
  }

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await guardarObservacionDeGi(joven.learnerId, hoy, texto);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      setTexto("");
      setAbierto(false);
      router.refresh();
    });
  }

  const callado =
    joven.diasSinMarcar === null || joven.diasSinMarcar >= DIAS_SIN_MARCAR_AVISA;

  return (
    <div className="border-b border-[rgba(19,28,36,.08)] last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/gi/${joven.learnerId}`}
            className="text-[13.5px] leading-none font-semibold text-tinta hover:text-azul-700 hover:underline"
          >
            {joven.nombre}
          </Link>
          <p className="mt-[5px] text-[11px] leading-none font-medium text-[rgba(19,28,36,.45)]">
            {joven.edad !== null ? `${joven.edad} años · ` : ""}
            {joven.mentor ? `línea de ${joven.mentor}` : "sin mentor asignado"}
            {!puedeMarcar && joven.liderDeGi
              ? ` · GI: ${joven.liderDeGi.nombre}`
              : ""}
          </p>
        </div>

        <div className="flex gap-[6px]">
          {dias.map((dia, i) => {
            const futuro = esDiaFuturo(dia, hoy);
            const hecho = marcados.has(dia);
            return (
              <button
                key={dia}
                type="button"
                disabled={futuro || !puedeMarcar || guardando}
                onClick={() => alternar(dia)}
                aria-pressed={hecho}
                aria-label={`${joven.nombre}, ${diaCivilLargo(dia)}, ${
                  hecho ? "hizo el devocional" : "sin marcar"
                }`}
                className={`flex h-11 w-[44px] items-center justify-center rounded-[8px] text-[10px] font-bold ${
                  hecho
                    ? "border-none bg-verde-700 text-white"
                    : futuro
                      ? "cursor-default border border-dashed border-[rgba(19,28,36,.16)] bg-papel text-[rgba(19,28,36,.3)]"
                      : "border border-[rgba(19,28,36,.2)] bg-white text-[rgba(19,28,36,.4)]"
                } ${!puedeMarcar && !futuro ? "cursor-default" : ""}`}
              >
                <span className="sm:hidden">{ROTULOS[i][0]}</span>
                {hecho ? (
                  <svg
                    className="hidden sm:block"
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
          })}
        </div>

        <div className="w-full text-right sm:w-[96px]">
          {puedeMarcar ? (
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              className="py-2 text-[12px] leading-none font-semibold text-azul-700"
            >
              {abierto ? "Cerrar" : "Escribir algo"}
            </button>
          ) : null}
        </div>
      </div>

      {callado ? (
        <p className="px-4 pb-3 text-[11px] leading-none font-semibold text-ambar-texto">
          {joven.diasSinMarcar === null
            ? "No consta que se le haya marcado ningún devocional todavía"
            : `Hace ${joven.diasSinMarcar} días que no se le marca nada`}
        </p>
      ) : null}

      {joven.ultimaObservacion ? (
        <p className="px-4 pb-3 text-[11.5px] leading-[1.55] font-medium text-[rgba(19,28,36,.55)]">
          «{joven.ultimaObservacion.texto}»{" "}
          <span className="text-[rgba(19,28,36,.4)]">
            — {joven.ultimaObservacion.autor},{" "}
            {diaCivilLargo(joven.ultimaObservacion.dia).toLowerCase()}
          </span>
        </p>
      ) : null}

      {abierto ? (
        <div className="border-l-[3px] border-ambar-texto bg-papel px-4 py-4">
          <label
            htmlFor={`obs-${joven.learnerId}`}
            className="text-[12px] leading-none font-bold text-tinta"
          >
            Observación de hoy{" "}
            <span className="font-medium text-[rgba(19,28,36,.45)]">
              (opcional, al menos {LARGO_MINIMO_OBSERVACION} caracteres)
            </span>
          </label>
          <textarea
            id={`obs-${joven.learnerId}`}
            rows={3}
            className="campo mt-2 w-full"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={guardando}
              onClick={guardar}
              className="rounded-[8px] bg-azul-900 px-4 py-[10px] text-[12.5px] leading-none font-bold text-white disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <span className="text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
              La leen los pastores de GI y su mentor.
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="px-4 pb-3 text-[11.5px] leading-[1.5] font-semibold text-ambar-texto">
          {error}
        </p>
      ) : null}
    </div>
  );
}
