"use client";

import {
  DIAS_DE_LA_SEMANA,
  DURACIONES,
  FRECUENCIAS,
  esHoraValida,
  fraseDeFrecuencia,
  horaLegible,
  proximasReuniones,
  type DatosDeReunion,
} from "@/lib/reunion-catalogo";

/// Los cinco campos de «cuándo y dónde se reúne», compartidos por Alpha y por
/// Casa de Fe, al abrir un grupo y al editarlo. Un solo sitio: si mañana se
/// añade «cada tres semanas», aparece en los cuatro formularios a la vez.
export function CamposDeReunion({
  valores,
  onChange,
  inicio,
  hoy,
}: {
  valores: DatosDeReunion;
  onChange: (parcial: Partial<DatosDeReunion>) => void;
  /// La fecha de arranque del grupo, «AAAA-MM-DD». Sirve para enseñar las
  /// próximas fechas de verdad mientras se llena el formulario.
  inicio: string;
  hoy: string;
}) {
  const hora = valores.meetingTime ?? "";
  const completo = valores.weekday !== null && esHoraValida(hora);

  const proximas =
    completo && inicio
      ? proximasReuniones(
          {
            weekday: valores.weekday,
            everyNWeeks: valores.everyNWeeks,
            inicio,
          },
          hoy,
          5,
        )
      : [];

  return (
    <>
      <label className="block">
        <span className="etiqueta-campo">Se reúne los</span>
        <select
          value={valores.weekday ?? ""}
          onChange={(e) =>
            onChange({
              weekday: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="campo"
        >
          <option value="">Sin definir todavía…</option>
          {DIAS_DE_LA_SEMANA.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="etiqueta-campo">A las</span>
        <input
          type="time"
          value={hora}
          onChange={(e) =>
            onChange({ meetingTime: e.target.value === "" ? null : e.target.value })
          }
          className="campo"
        />
      </label>

      <label className="block">
        <span className="etiqueta-campo">Cada</span>
        <select
          value={valores.everyNWeeks}
          onChange={(e) => onChange({ everyNWeeks: Number(e.target.value) })}
          className="campo"
        >
          {FRECUENCIAS.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="etiqueta-campo">Dura</span>
        <select
          value={valores.durationMinutes}
          onChange={(e) => onChange({ durationMinutes: Number(e.target.value) })}
          className="campo"
        >
          {DURACIONES.map((d) => (
            <option key={d.valor} value={d.valor}>
              {d.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="block sm:col-span-2">
        <span className="etiqueta-campo">Dirección</span>
        <input
          value={valores.address ?? ""}
          onChange={(e) =>
            onChange({ address: e.target.value === "" ? null : e.target.value })
          }
          placeholder="Calle 19 # 5-42, Barrio Álamos Norte, Neiva"
          className="campo"
        />
      </label>

      {/* La confirmación en palabras. Sin esto, «3» y «19:00» en dos casillas
          no dicen a nadie que la reunión es el miércoles por la tarde. */}
      <div className="sm:col-span-2">
        {completo ? (
          <div className="rounded-[11px] bg-azul-050 px-4 py-3">
            <p className="text-[13.5px] leading-[1.35] font-semibold text-azul-900">
              Se reúne los{" "}
              {DIAS_DE_LA_SEMANA.find((d) => d.valor === valores.weekday)?.plural}{" "}
              a las {horaLegible(hora)} · {fraseDeFrecuencia(valores.everyNWeeks)}
            </p>
            {proximas.length > 0 ? (
              <ul className="mt-2 flex list-none flex-wrap gap-[7px] p-0">
                {proximas.map((dia, i) => (
                  <li
                    key={dia}
                    className="rounded-[20px] border border-[rgba(27,74,122,.2)] bg-white px-[10px] py-[5px] text-[11.5px] leading-none font-semibold text-azul-700"
                  >
                    {i === 0 ? "próxima · " : ""}
                    {diaCortoDeTexto(dia)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11.5px] leading-[1.4] font-medium text-azul-700">
                Pon la fecha de inicio y aquí verás las próximas reuniones.
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Sin día y hora el grupo funciona igual, pero{" "}
            <strong>no aparece en el calendario de nadie</strong>.
          </p>
        )}
      </div>
    </>
  );
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun",
               "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

/// «2026-09-23» → «MIÉ 23 sep».
///
/// Se formatea a mano desde el texto y **no con `Intl` sobre un `Date`**: la
/// fecha es civil, no un instante, y construir un `Date` en el navegador la
/// leería en la zona de quien mira — que es exactamente la trampa del 8-sep.
function diaCortoDeTexto(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  const indice = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS[indice]} ${d} ${MESES[m - 1]}`;
}
