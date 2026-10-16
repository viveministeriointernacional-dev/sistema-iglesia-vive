"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { Desglose } from "@/lib/informe-detalle-catalogo";
import {
  ETIQUETA_LISTA,
  type Lista,
  LISTAS,
  type MovimientoDelTablero,
} from "@/lib/movimiento-op72-catalogo";
import { VentanaDesglose } from "@/components/ventana-desglose";
import { pedirEntradasDeLista, pedirSalidasDelTablero } from "./acciones-movimiento";

/// **La fila de contadores del tablero, con el ⊕ de cada lista y el ⊖ final.**
///
/// Los contadores ya estaban: dicen cuánta gente hay **hoy** en cada lista.
/// Lo que añade esta fila es el movimiento del periodo elegido —cuántas
/// entraron a cada una, y cuántas salieron de Operación 72— y que **cada
/// número se abre** para ver quiénes fueron, qué día y a qué hora.
///
/// Tres decisiones que no son de estilo:
///
/// 1. **Los contadores siguen siendo enlaces** (filtran el tablero), y los ⊕
///    son botones aparte. Mezclarlos en un solo control haría que filtrar y
///    mirar el detalle fueran el mismo clic, y son dos cosas distintas.
/// 2. **Un ⊕ en cero no es un botón.** Se enseña el 0 —porque saber que no
///    entró nadie es información— pero sin forma de pulsarlo: un botón que no
///    lleva a ninguna parte es peor que no enseñarlo (§12.6).
/// 3. **Nada se pide hasta el clic.** El tablero cuesta una consulta más que
///    antes (la de los números); las listas de personas solo viajan cuando
///    alguien abre una ventana.
///
/// Las flechas entre contador y contador solo aparecen en pantalla ancha: en
/// el celular los contadores se acomodan en varias filas y una flecha dibujada
/// entre dos de ellos apuntaría a cualquier parte. El ⊕ se queda siempre
/// encima del suyo, que es lo que de verdad dice a qué lista entraron.

type Periodo = { inicio: string; fin: string };

type Chip = {
  clave: Lista | "todas";
  etiqueta: string;
  total: number;
  href: string;
  activo: boolean;
};

type Peticion =
  | { tipo: "entradas"; lista: Lista }
  | { tipo: "salidas"; pestana: string };

export function FilaDeContadores({
  chips,
  movimiento,
  periodo,
}: {
  chips: Chip[];
  movimiento: MovimientoDelTablero;
  periodo: Periodo;
}) {
  const [peticion, setPeticion] = useState<Peticion | null>(null);
  const [datos, setDatos] = useState<Desglose | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuál es la petición que vale. Sube con cada clic, y la respuesta que llega
  // con un número viejo se tira: sin esto, cambiar de pestaña dos veces
  // seguidas deja ganando a la respuesta más lenta.
  const vigente = useRef(0);

  // La carga va en el clic, no en un efecto: un efecto es para sincronizar con
  // algo de fuera, y pedir datos al pulsar un botón ya es un evento.
  const cargar = useCallback(
    async (siguiente: Peticion) => {
      const turno = ++vigente.current;
      setPeticion(siguiente);
      setDatos(null);
      setCargando(true);
      setError(null);

      try {
        const respuesta =
          siguiente.tipo === "entradas"
            ? await pedirEntradasDeLista({
                lista: siguiente.lista,
                desde: periodo.inicio,
                hasta: periodo.fin,
              })
            : await pedirSalidasDelTablero({
                pestana: siguiente.pestana,
                desde: periodo.inicio,
                hasta: periodo.fin,
              });
        if (turno !== vigente.current) return;
        setDatos(respuesta);
      } catch {
        if (turno !== vigente.current) return;
        setError("No se pudo cargar el detalle. Vuelve a intentarlo.");
      } finally {
        if (turno === vigente.current) setCargando(false);
      }
    },
    [periodo.inicio, periodo.fin],
  );

  const cerrar = useCallback(() => {
    vigente.current += 1;
    setPeticion(null);
  }, []);

  const cambiarPestana = useCallback(
    (pestana: string) => {
      if (peticion?.tipo !== "salidas") return;
      void cargar({ tipo: "salidas", pestana });
    },
    [cargar, peticion],
  );

  const todas = chips.find((chip) => chip.clave === "todas");
  const porLista = new Map(chips.map((chip) => [chip.clave, chip]));
  const salieron = movimiento.salieron.total;

  return (
    <>
      <div className="mt-[9px] flex flex-wrap items-end gap-x-0 gap-y-[10px]">
        {todas ? (
          <span className="mr-[14px] flex items-end border-r border-[rgba(19,28,36,.1)] pr-[14px]">
            <Contador chip={todas} />
          </span>
        ) : null}

        {LISTAS.map((lista) => {
          const chip = porLista.get(lista);
          if (!chip) return null;
          return (
            <span key={lista} className="flex items-end">
              <Flecha />
              <span className="flex flex-col items-center gap-[6px]">
                <Mas
                  cuantas={movimiento.entraron[lista]}
                  etiqueta={ETIQUETA_LISTA[lista]}
                  alAbrir={() => void cargar({ tipo: "entradas", lista })}
                />
                <Contador chip={chip} />
              </span>
            </span>
          );
        })}

        <span className="flex items-end">
          <Flecha salida />
          <Menos
            cuantas={salieron}
            alAbrir={() => void cargar({ tipo: "salidas", pestana: "todas" })}
          />
        </span>
      </div>

      <VentanaDesglose
        abierta={peticion !== null}
        datos={datos}
        cargando={cargando}
        error={error}
        alCerrar={cerrar}
        alCambiarPestana={cambiarPestana}
      />
    </>
  );
}

/// El contador de siempre: cuánta gente hay hoy en esa lista, y filtra al
/// pulsarlo. Es un enlace, no un botón, para que la vista siga siendo
/// compartible con solo copiar la dirección.
function Contador({ chip }: { chip: Chip }) {
  return (
    <Link
      href={chip.href}
      aria-current={chip.activo ? "page" : undefined}
      className={`flex items-center gap-[7px] rounded-[20px] px-[13px] py-2 text-[12px] leading-none ${
        chip.activo
          ? "border-[1.5px] border-azul-900 bg-azul-050 font-bold text-tinta"
          : "border border-borde-control bg-white font-semibold text-[rgba(19,28,36,.62)]"
      }`}
    >
      {chip.etiqueta}
      <span className="font-extrabold text-[rgba(19,28,36,.42)]">{chip.total}</span>
    </Link>
  );
}

/// Cuántas **entraron** a esta lista en el periodo.
function Mas({
  cuantas,
  etiqueta,
  alAbrir,
}: {
  cuantas: number;
  etiqueta: string;
  alAbrir: () => void;
}) {
  if (cuantas === 0) {
    return (
      <span
        className="rounded-[20px] border border-dashed border-[rgba(19,28,36,.22)] px-[9px] py-[5px] text-[11px] leading-none font-bold text-[rgba(19,28,36,.38)]"
        title={`No entró nadie a ${etiqueta} en este periodo`}
      >
        +0
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={alAbrir}
      aria-label={`Ver las ${cuantas} que entraron a ${etiqueta} en este periodo`}
      className="cursor-pointer rounded-[20px] border-0 bg-azul-900 px-[10px] py-[6px] text-[11.5px] leading-none font-extrabold text-white shadow-[0_2px_6px_rgba(14,42,78,.22)] hover:bg-azul-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-900"
    >
      +{cuantas}
    </button>
  );
}

/// Cuántas salieron de Operación 72, por cualquiera de las tres puertas.
function Menos({ cuantas, alAbrir }: { cuantas: number; alAbrir: () => void }) {
  if (cuantas === 0) {
    return (
      <span className="rounded-[20px] border border-dashed border-[rgba(19,28,36,.22)] px-[13px] py-2 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.38)]">
        −0 salieron
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={alAbrir}
      aria-label={`Ver las ${cuantas} que salieron de Operación 72 en este periodo`}
      className="flex cursor-pointer items-center gap-[7px] rounded-[20px] border-[1.5px] border-[rgba(180,70,47,.45)] bg-rojo-fondo px-[13px] py-2 text-[12px] leading-none font-bold text-rojo hover:border-rojo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo"
    >
      −{cuantas}
      <span className="font-semibold">salieron</span>
    </button>
  );
}

/// El arco que une un contador con el siguiente. Es decoración: lo que dice el
/// dato es el ⊕ de encima, así que no lleva ni texto ni papel en el orden de
/// lectura. En el celular desaparece.
function Flecha({ salida = false }: { salida?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 28"
      aria-hidden="true"
      focusable="false"
      className="mb-[7px] hidden h-[28px] w-[48px] shrink-0 sm:block"
    >
      <path
        d="M3,25 C14,4 32,4 43,21"
        fill="none"
        stroke={salida ? "#b4462f" : "#6e9a55"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray={salida ? "4 3" : undefined}
      />
      <polygon points="38,14 46,19 38,24" fill={salida ? "#b4462f" : "#6e9a55"} />
    </svg>
  );
}
