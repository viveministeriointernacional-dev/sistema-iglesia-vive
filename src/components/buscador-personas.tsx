"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  buscarPersonas,
  type PersonaEncontrada,
} from "./buscador-personas-accion";

/// Buscador global de personas por nombre o teléfono. Vive en el encabezado de
/// las vistas (árbol, red, operación 72, escuela, eventos). El alcance lo decide
/// el servidor según el rol.
///
/// `destino` decide a dónde lleva elegir un resultado:
/// - `expediente` (por defecto): abre su expediente, como siempre.
/// - `operacion-72`: se queda en el tablero y lo filtra por esa persona, para
///   ver su tarjeta y en qué fase está sin salir de la pantalla.
export function BuscadorPersonas({
  placeholder = "Buscar persona por nombre o celular…",
  destino = "expediente",
}: {
  placeholder?: string;
  destino?: "expediente" | "operacion-72";
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<PersonaEncontrada[] | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [buscando, iniciarBusqueda] = useTransition();
  const contenedor = useRef<HTMLDivElement>(null);

  // Búsqueda automática con una pausa breve: no se llama al servidor en cada
  // tecla, sino cuando la persona deja de escribir.
  useEffect(() => {
    const texto = consulta.trim();
    const temporizador = setTimeout(() => {
      if (texto.length < 2) {
        setResultados(null);
        setAbierto(false);
        return;
      }
      iniciarBusqueda(async () => {
        setResultados(await buscarPersonas(texto));
        setAbierto(true);
      });
    }, 300);
    return () => clearTimeout(temporizador);
  }, [consulta]);

  // Se cierra al hacer clic afuera o con Escape.
  useEffect(() => {
    function alClicFuera(evento: MouseEvent) {
      if (
        contenedor.current &&
        !contenedor.current.contains(evento.target as Node)
      ) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, []);

  function limpiar() {
    setConsulta("");
    setResultados(null);
    setAbierto(false);
  }

  const hayTexto = consulta.trim().length >= 2;

  return (
    <div ref={contenedor} className="relative">
      <div className="flex items-center gap-2 rounded-[10px] border border-[rgba(19,28,36,.16)] bg-white px-[14px] py-[10px]">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-[rgba(19,28,36,.4)]"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path
            d="m20 20-3.5-3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <input
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          onFocus={() => {
            if (resultados) setAbierto(true);
          }}
          onKeyDown={(evento) => {
            if (evento.key === "Escape") setAbierto(false);
          }}
          placeholder={placeholder}
          aria-label="Buscar persona por nombre o celular"
          className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] leading-none font-semibold text-tinta outline-none placeholder:text-[rgba(19,28,36,.45)]"
        />
        {buscando ? (
          <span className="shrink-0 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
            Buscando…
          </span>
        ) : consulta ? (
          <button
            type="button"
            onClick={limpiar}
            aria-label="Limpiar búsqueda"
            className="shrink-0 cursor-pointer border-0 bg-transparent text-[11.5px] leading-none font-semibold text-azul-700"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {abierto && hayTexto && resultados ? (
        <div className="tarjeta absolute z-20 mt-2 w-full overflow-hidden p-0 shadow-lg">
          {resultados.length ? (
            <ul className="flex max-h-[340px] flex-col overflow-y-auto">
              {resultados.map((persona) => (
                <li key={persona.learnerId}>
                  <Link
                    href={
                      destino === "operacion-72"
                        ? `/operacion-72?q=${encodeURIComponent(persona.nombre)}`
                        : `/expediente/${persona.learnerId}`
                    }
                    onClick={limpiar}
                    className="flex items-center justify-between gap-3 border-b border-[rgba(19,28,36,.07)] px-[14px] py-[11px] last:border-b-0 hover:bg-papel"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] leading-none font-semibold text-tinta">
                        {persona.nombre}
                      </span>
                      <span className="mt-[5px] block text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
                        {persona.telefono ?? "Sin teléfono"}
                        {persona.estado !== "ACTIVO"
                          ? ` · ${persona.estado.toLowerCase()}`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-[6px] bg-azul-100 px-[8px] py-[4px] text-[9.5px] leading-none font-bold tracking-[.06em] text-azul-700">
                      {persona.fase}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-[14px] py-[13px] text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
              Nadie coincide con «{consulta.trim()}» dentro de lo que puedes ver.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
