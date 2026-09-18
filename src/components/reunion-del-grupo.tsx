"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CamposDeReunion } from "@/components/campos-de-reunion";
import {
  enlaceComoLlegar,
  enlaceDelMapa,
  enlaceGoogleCalendar,
  etiquetaDeDuracion,
  fraseDeLaReunion,
  proximasReuniones,
  puntoDeReunion,
  type DatosDeReunion,
} from "@/lib/reunion-catalogo";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
               "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/// «2026-09-23» → «miércoles 23 de septiembre».
///
/// A mano desde el texto, no con `Intl` sobre un `Date`: es una fecha civil, y
/// construir un `Date` la leería en la zona del navegador.
function diaLargoDeTexto(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const indice = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS[indice]} ${d} de ${MESES[m - 1]}`;
}

/// **Cuándo y dónde se reúne el grupo**, en su ficha.
///
/// Quien lo administra puede editarlo aquí mismo; los demás solo lo leen — es
/// lo que ya hacía el resto de la ficha con `puedeEditar`.
export function ReunionDelGrupo({
  nombre,
  reunion,
  inicio,
  hoy,
  puedeEditar,
  guardar,
}: {
  nombre: string;
  reunion: DatosDeReunion;
  /// La fecha de arranque del grupo, «AAAA-MM-DD».
  inicio: string;
  hoy: string;
  puedeEditar: boolean;
  guardar: (datos: DatosDeReunion) => Promise<{ ok: boolean; mensaje?: string }>;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState<DatosDeReunion>(reunion);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const frase = fraseDeLaReunion(reunion);
  const punto = puntoDeReunion(reunion);
  const lugar = { address: reunion.address, punto };
  const verEnElMapa = enlaceDelMapa(lugar);
  const comoLlegar = enlaceComoLlegar(lugar);
  const proximas = proximasReuniones(
    {
      weekday: reunion.weekday,
      everyNWeeks: reunion.everyNWeeks,
      inicio,
    },
    hoy,
    1,
  );
  const proxima = frase ? proximas[0] : undefined;

  const enlaceCalendario =
    proxima && reunion.meetingTime
      ? enlaceGoogleCalendar({
          nombre,
          dia: proxima,
          hora: reunion.meetingTime,
          duracionMinutos: reunion.durationMinutes,
          direccion: reunion.address,
          punto,
        })
      : null;

  if (editando) {
    return (
      <section className="tarjeta p-5">
        <h2 className="etiqueta-seccion">CUÁNDO Y DÓNDE SE REÚNE</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CamposDeReunion
            nombre={nombre}
            valores={borrador}
            onChange={(parcial) => setBorrador((v) => ({ ...v, ...parcial }))}
            inicio={inicio}
            hoy={hoy}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={guardando}
            onClick={() => {
              setError(null);
              iniciar(async () => {
                const r = await guardar(borrador);
                if (!r.ok) {
                  setError(r.mensaje ?? "No se pudo guardar.");
                  return;
                }
                setEditando(false);
                // `revalidatePath` limpia la caché del servidor pero no repinta
                // lo que el navegador ya tiene (regla del 11-sep-2026).
                router.refresh();
              });
            }}
            className="boton-primario"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setBorrador(reunion);
              setError(null);
              setEditando(false);
            }}
            className="boton-secundario"
          >
            Cancelar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tarjeta p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="etiqueta-seccion">CUÁNDO Y DÓNDE SE REÚNE</h2>
        {puedeEditar ? (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.5)] underline hover:text-tinta"
          >
            {frase ? "Cambiar" : "Poner día, hora y dirección"}
          </button>
        ) : null}
      </div>

      {!frase ? (
        <p className="mt-4 rounded-r-[10px] border-l-[3px] border-ambar-barra bg-ambar-fondo px-4 py-3 text-[12.5px] leading-[1.6] text-ambar-texto">
          <strong>Este grupo todavía no tiene día ni hora.</strong> Funciona
          igual, pero <strong>no aparece en el calendario de nadie</strong> y no
          se puede compartir la dirección.
          {puedeEditar ? " Pon el día y la hora con el enlace de arriba." : ""}
        </p>
      ) : (
        <div className="mt-4 flex flex-col">
          <div className="flex flex-col gap-1 py-[13px]">
            <span className="text-[10px] leading-none font-bold tracking-[.07em] text-[rgba(19,28,36,.42)]">
              SE REÚNE
            </span>
            <span className="text-[14px] leading-[1.35] font-semibold">
              {frase} · dura {etiquetaDeDuracion(reunion.durationMinutes)}
            </span>
          </div>

          <div className="flex flex-col gap-1 border-t border-[rgba(19,28,36,.09)] py-[13px]">
            <span className="text-[10px] leading-none font-bold tracking-[.07em] text-[rgba(19,28,36,.42)]">
              DÓNDE
            </span>
            <span className="text-[14px] leading-[1.35] font-semibold">
              {reunion.address ?? (punto ? "Marcada solo en el mapa" : "No quedó registrada")}
            </span>
            {punto ? (
              <span className="text-[12px] leading-[1.4] font-semibold text-verde-700">
                Con el punto marcado en el mapa
              </span>
            ) : null}
            {/* Los botones salen si hay dirección **o** punto: se puede tener
                el pin puesto sin haber escrito la dirección, y ese enlace
                funciona igual —mejor, de hecho—. */}
            {verEnElMapa && comoLlegar ? (
              <div className="mt-[7px] flex flex-wrap gap-2">
                <a
                  href={verEnElMapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="boton-secundario"
                >
                  Ver en el mapa
                </a>
                <a
                  href={comoLlegar}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="boton-secundario"
                >
                  Cómo llegar
                </a>
              </div>
            ) : null}
          </div>

          {proxima ? (
            <div className="flex flex-col gap-1 border-t border-[rgba(19,28,36,.09)] py-[13px]">
              <span className="text-[10px] leading-none font-bold tracking-[.07em] text-[rgba(19,28,36,.42)]">
                PRÓXIMA REUNIÓN
              </span>
              <span className="text-[14px] leading-[1.35] font-semibold">
                {diaLargoDeTexto(proxima)}
              </span>
              {enlaceCalendario ? (
                <div className="mt-[7px] flex flex-wrap gap-2">
                  <a
                    href={enlaceCalendario}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="boton-secundario"
                  >
                    Añadir esta reunión a Google Calendar
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
