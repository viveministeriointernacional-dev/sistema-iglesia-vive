"use client";

import { useState } from "react";

import {
  materialDelTema,
  rutaDeDiapositiva,
  rutaDelPdf,
  tamanoLegible,
} from "@/lib/prematrimonial-material";

/// El material de apoyo del tema: las diapositivas de la charla, con su PDF
/// para descargar.
///
/// Va **entre el encabezado negro y las preguntas** (decisión del usuario,
/// 26-oct-2026): es lo que se repasa mientras se responde, así que leerlo
/// después de las 21 preguntas no serviría de nada.
///
/// ⚠️ **Solo se baja la diapositiva que se está mirando, y las ya vistas se
/// quedan.** Se guarda qué índices se han abierto y se pinta un `<img>` por
/// cada uno, escondiendo los que no toca: así la primera carga es una imagen de
/// ~35 KB en vez de las dieciocho (632 KB), y volver atrás es instantáneo
/// porque esa imagen ya está en el navegador.
export function MaterialDelTema({ numeroDeTema }: { numeroDeTema: number }) {
  const material = materialDelTema(numeroDeTema);

  const [actual, setActual] = useState(1);
  const [vistas, setVistas] = useState<number[]>([1]);

  // ⚠️ **Lo que no hay NO se anuncia.** Un tema sin diapositivas no enseña un
  // bloque vacío ni un «próximamente»: la persona no puede hacer nada con eso,
  // y un aviso que sale siempre se deja de leer.
  if (!material) return null;

  const total = material.diapositivas;

  function ir(a: number) {
    const destino = a < 1 ? total : a > total ? 1 : a;
    setActual(destino);
    setVistas((antes) => (antes.includes(destino) ? antes : [...antes, destino]));
  }

  return (
    <section className="border-b border-[#e3ddcd] bg-white px-5 pt-[18px] pb-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[10px] font-bold tracking-[0.14em] text-[#7a3b5c] uppercase">
          Material del tema
        </h2>
        <span className="text-[11.5px] font-medium text-[#5c5648] tabular-nums">
          {actual} de {total}
        </span>
      </div>

      <p className="mt-[7px] mb-[13px] text-[12.5px] leading-[1.5] text-[#5c5648]">
        Las diapositivas que se usaron en la charla, para que puedas repasar el
        tema mientras respondes.
      </p>

      <div className="overflow-hidden rounded-xl border border-[#e3ddcd] bg-[#f3efe4]">
        {/* ⚠️ **Tocar la diapositiva la abre sola, y no es un adorno.** En un
            celular el texto de una lámina con tres columnas queda muy pequeño,
            y ampliar con los dedos dentro de la página ampliaría la página
            entera. Abriendo la imagen sola, el navegador hace el zoom que
            hace con cualquier foto. Es gratis y evita tener que bajarse el
            PDF para poder leer una lámina. */}
        <a
          href={rutaDeDiapositiva(numeroDeTema, actual)}
          target="_blank"
          rel="noopener"
          className="relative block aspect-video border-b border-[#e3ddcd] bg-white"
          aria-label={`Ver la diapositiva ${actual} más grande`}
        >
          {vistas.map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={rutaDeDiapositiva(numeroDeTema, i)}
              alt={`Diapositiva ${i} de ${total}`}
              hidden={i !== actual}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ))}
        </a>

        <div className="flex items-center justify-between gap-2.5 bg-[#f3efe4] p-[9px_10px]">
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            aria-label="Diapositiva anterior"
            className="grid h-11 w-11 flex-none place-items-center rounded-[10px] border border-[#d8d1bf] bg-white text-[#1a1917]"
          >
            <Flecha hacia="izquierda" />
          </button>

          {/* ⚠️ **Una barra, no una fila de puntos.** Con dieciocho diapositivas
              los puntos no caben en el ancho de un celular, y recortarlos a
              ocho deja **sin encender ninguno de la novena en adelante** — que
              es justo la mitad del material. La barra vale para cualquier
              cantidad y no hay que decidir un tope. */}
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#cdc4ae]" aria-hidden>
            <div
              className="h-full rounded-full bg-[#7a3b5c] transition-[width]"
              style={{ width: `${(actual / total) * 100}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => ir(actual + 1)}
            aria-label="Diapositiva siguiente"
            className="grid h-11 w-11 flex-none place-items-center rounded-[10px] border border-[#d8d1bf] bg-white text-[#1a1917]"
          >
            <Flecha hacia="derecha" />
          </button>
        </div>
      </div>

      {/* ⚠️ La descarga va DEBAJO de la previsualización, no arriba: quien ya
          está viendo las diapositivas es quien decide si además se las lleva. */}
      <a
        href={rutaDelPdf(numeroDeTema)}
        download
        className="mt-3 flex items-center gap-2.5 rounded-[11px] border border-[#c9a3b6] bg-[#f7eef2] px-[13px] py-3 text-[#7a3b5c] no-underline"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="flex-none"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="min-w-0">
          <span className="block text-[13.5px] leading-[1.3] font-semibold">
            Descargar el material en PDF
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-[1.4] font-medium text-[#8a6479]">
            {total} diapositivas · {tamanoLegible(material.bytes)}
          </span>
        </span>
      </a>
    </section>
  );
}

function Flecha({ hacia }: { hacia: "izquierda" | "derecha" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points={hacia === "izquierda" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}
