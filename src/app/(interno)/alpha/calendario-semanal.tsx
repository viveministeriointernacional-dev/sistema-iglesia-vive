import Link from "next/link";
import {
  DIAS_DE_LA_SEMANA,
  correrSemana,
  franjaDeLasHoras,
  horaLegible,
  leTocaEseDia,
  minutosDesdeMedianoche,
  repartirEnColumnas,
  type SemanaCivil,
} from "@/lib/reunion-catalogo";

/// **La semana de los grupos, como un calendario.**
///
/// Responde una pregunta que las listas no respondían: **cuántos grupos hay
/// cada día**. En esta iglesia la respuesta importa — el martes concentra la
/// mitad y el fin de semana está vacío.
///
/// Es un componente de servidor a propósito: moverse de semana, cambiar de día
/// en el celular y filtrar por tipo viajan **por la URL**, sin una línea de
/// JavaScript, como el resto de los filtros de la plataforma.

const ALTO_HORA = 64;

export type GrupoDelCalendario = {
  id: string;
  tipo: "alpha" | "casa-de-fe";
  nombre: string;
  lider: string;
  personas: number;
  weekday: number | null;
  meetingTime: string | null;
  everyNWeeks: number;
  durationMinutes: number;
  /// El día en que arrancó, «AAAA-MM-DD». Manda para la periodicidad.
  inicio: string;
  tienePunto: boolean;
};

/// Una reunión ya colocada: el grupo, su hueco en minutos y en qué columna va
/// si se cruza con otra.
///
/// El grupo va ANIDADO y no esparcido: `GrupoDelCalendario` ya tiene un
/// `inicio` —la fecha en que arrancó— y el reparto trabaja con otro `inicio`,
/// el minuto en que empieza la reunión. Mezclarlos en el mismo objeto hacía
/// que uno pisara al otro.
type Colocada = {
  grupo: GrupoDelCalendario;
  inicio: number;
  fin: number;
  columna: number;
  deCuantas: number;
};

const TONO = {
  "casa-de-fe": { barra: "border-l-azul-700", fondo: "bg-azul-100", hora: "text-azul-900" },
  alpha: { barra: "border-l-verde-700", fondo: "bg-verde-100", hora: "text-verde-700" },
} as const;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/// «2026-09-14» y «2026-09-20» → «14 – 20 de septiembre».
///
/// A mano desde el texto, nunca con `Intl` sobre un `Date`: son fechas
/// civiles, y construir un `Date` las leería en la zona del navegador (la
/// trampa del 8-sep-2026).
function tituloDeLaSemana(semana: SemanaCivil): string {
  const [, mesA, diaA] = semana.inicio.split("-").map(Number);
  const [, mesB, diaB] = semana.fin.split("-").map(Number);
  return mesA === mesB
    ? `${diaA} – ${diaB} de ${MESES[mesA - 1]}`
    : `${diaA} de ${MESES[mesA - 1]} – ${diaB} de ${MESES[mesB - 1]}`;
}

function numeroDelDia(dia: string): number {
  return Number(dia.split("-")[2]);
}

/// Las reuniones de un día concreto, ya repartidas en columnas si se cruzan.
function delDia(grupos: GrupoDelCalendario[], dia: string): Colocada[] {
  return repartirEnColumnas(
    grupos
      .filter((g) => g.meetingTime && leTocaEseDia(g, dia))
      .map((g) => {
        const inicio = minutosDesdeMedianoche(g.meetingTime!);
        return { grupo: g, inicio, fin: inicio + g.durationMinutes };
      }),
  );
}

function Pin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[11px] w-[11px] shrink-0" aria-hidden="true">
      <path
        d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

export function CalendarioSemanal({
  grupos,
  semana,
  hoy,
  diaElegido,
  tipo,
  enlaceDeSemana,
  enlaceDeDia,
  enlaceDeTipo,
}: {
  grupos: GrupoDelCalendario[];
  semana: SemanaCivil;
  hoy: string;
  /// Qué día se está mirando en el celular.
  diaElegido: string;
  tipo: "todos" | "alpha" | "casa-de-fe";
  enlaceDeSemana: (inicio: string) => string;
  enlaceDeDia: (dia: string) => string;
  enlaceDeTipo: (t: "todos" | "alpha" | "casa-de-fe") => string;
}) {
  const visibles = grupos.filter((g) => tipo === "todos" || g.tipo === tipo);
  const porDia = semana.dias.map((dia) => delDia(visibles, dia));

  const { desde, hasta } = franjaDeLasHoras(porDia.flat());
  const alto = (hasta - desde) * ALTO_HORA;
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i);

  const sinDia = grupos.filter((g) => g.weekday === null || !g.meetingTime);
  const cuantos = (t: "alpha" | "casa-de-fe") =>
    grupos.filter((g) => g.tipo === t && g.weekday !== null && g.meetingTime).length;

  const indiceElegido = Math.max(0, semana.dias.indexOf(diaElegido));
  const delDiaElegido = porDia[indiceElegido] ?? [];

  return (
    <div className="mt-5 flex flex-col gap-4">
      {/* Semana y filtros. Todo son enlaces: funciona sin JavaScript. */}
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex gap-[6px]">
          <Link
            href={enlaceDeSemana(correrSemana(semana.inicio, -1))}
            aria-label="Semana anterior"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white text-[14px] leading-none font-bold text-tinta"
          >
            ‹
          </Link>
          <Link
            href={enlaceDeSemana(correrSemana(semana.inicio, 1))}
            aria-label="Semana siguiente"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white text-[14px] leading-none font-bold text-tinta"
          >
            ›
          </Link>
        </div>
        <p className="text-[14.5px] leading-none font-bold text-tinta">
          {tituloDeLaSemana(semana)}
        </p>
        <Link
          href={enlaceDeSemana(hoy)}
          className="rounded-[20px] border border-[rgba(19,28,36,.18)] bg-white px-[13px] py-2 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.55)]"
        >
          Esta semana
        </Link>

        <span className="grow" />

        {(
          [
            ["casa-de-fe", "Casa de Fe", "bg-azul-700"],
            ["alpha", "Alpha", "bg-verde-700"],
          ] as const
        ).map(([clave, nombre, punto]) => {
          const activo = tipo === clave;
          return (
            <Link
              key={clave}
              href={enlaceDeTipo(activo ? "todos" : clave)}
              className={`flex items-center gap-[6px] rounded-[20px] px-[13px] py-2 text-[11.5px] leading-none ${
                activo
                  ? "border-[1.5px] border-azul-900 bg-azul-050 font-bold text-tinta"
                  : "border border-[rgba(19,28,36,.18)] bg-white font-semibold text-[rgba(19,28,36,.55)]"
              }`}
            >
              <span className={`h-[9px] w-[9px] rounded-[3px] ${punto}`} />
              {nombre} · {cuantos(clave)}
            </Link>
          );
        })}
      </div>

      {/* ---------------------------------------- la rejilla, en pantalla grande */}
      <div className="hidden overflow-hidden rounded-[11px] border border-[rgba(19,28,36,.09)] bg-white sm:flex">
        <div className="w-[52px] shrink-0">
          <div className="h-[53px] border-b border-[rgba(19,28,36,.09)]" />
          {horas.map((h) => (
            <div key={h} className="pr-2 text-right" style={{ height: ALTO_HORA }}>
              <span className="text-[10px] leading-none font-bold text-[rgba(19,28,36,.42)]">
                {h}:00
              </span>
            </div>
          ))}
        </div>

        {semana.dias.map((dia, i) => {
          const esHoy = dia === hoy;
          const reuniones = porDia[i];
          return (
            <div key={dia} className="min-w-0 flex-1 border-l border-[rgba(19,28,36,.09)]">
              <div
                className={`border-b border-[rgba(19,28,36,.09)] py-[9px] text-center ${
                  esHoy ? "bg-papel" : ""
                }`}
              >
                <p
                  className={`text-[10px] leading-none font-extrabold tracking-[.08em] ${
                    esHoy ? "text-azul-700" : "text-[rgba(19,28,36,.42)]"
                  }`}
                >
                  {DIAS_DE_LA_SEMANA[i].etiqueta.slice(0, 3).toUpperCase()}{" "}
                  {numeroDelDia(dia)}
                  {esHoy ? " · HOY" : ""}
                </p>
                <p
                  className={`mt-[5px] text-[15px] leading-none font-extrabold ${
                    reuniones.length ? "text-tinta" : "text-[rgba(19,28,36,.42)]"
                  }`}
                >
                  {reuniones.length}
                </p>
              </div>

              <div className={`relative ${esHoy ? "bg-papel" : ""}`} style={{ height: alto }}>
                {horas.slice(1).map((h) => (
                  <div
                    key={h}
                    className="absolute right-0 left-0 border-t border-[rgba(19,28,36,.06)]"
                    style={{ top: (h - desde) * ALTO_HORA }}
                  />
                ))}

                {reuniones.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10.5px] font-semibold text-[rgba(19,28,36,.42)]">
                      sin grupos
                    </span>
                  </div>
                ) : null}

                {reuniones.map(({ grupo: g, ...r }) => {
                  const ancho = 100 / r.deCuantas;
                  const tono = TONO[g.tipo];
                  const apretada = r.deCuantas > 1 || g.durationMinutes < 60;
                  return (
                    <Link
                      key={g.id}
                      href={`/${g.tipo}/${g.id}`}
                      className={`absolute overflow-hidden rounded-[7px] border-l-[3px] px-[7px] ${tono.barra} ${tono.fondo} ${apretada ? "py-[5px]" : "py-[6px]"}`}
                      style={{
                        top: (r.inicio / 60 - desde) * ALTO_HORA,
                        height: (g.durationMinutes / 60) * ALTO_HORA - 3,
                        left: `calc(${r.columna * ancho}% + 3px)`,
                        width: `calc(${ancho}% - 6px)`,
                      }}
                    >
                      <p className={`text-[10px] leading-[1.1] font-extrabold ${tono.hora}`}>
                        {horaLegible(g.meetingTime!)}
                      </p>
                      <p className="mt-[2px] text-[10.5px] leading-[1.2] font-bold text-tinta">
                        {g.nombre}
                      </p>
                      {apretada ? null : (
                        <div className="mt-[3px] flex items-center gap-1 text-azul-700">
                          {g.tienePunto ? <Pin /> : null}
                          <span className="text-[9.5px] leading-[1.1] font-semibold text-[rgba(19,28,36,.55)]">
                            {g.lider} · {g.personas}
                          </span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------- en el celular */}
      {/* ⚠️ La rejilla de siete columnas por horas NO cabe en un teléfono:
          quedarían tarjetas de dos centímetros. Se conserva lo que importa
          —cuántas hay por día— y debajo va la lista del día que se toque. */}
      <div className="flex flex-col gap-3 sm:hidden">
        <div className="flex gap-[6px]">
          {semana.dias.map((dia, i) => {
            const activo = dia === semana.dias[indiceElegido];
            const cuantas = porDia[i].length;
            return (
              <Link
                key={dia}
                href={enlaceDeDia(dia)}
                className={`flex-1 rounded-[9px] py-2 text-center ${
                  activo
                    ? "border-[1.5px] border-azul-900 bg-azul-050"
                    : "border border-[rgba(19,28,36,.09)] bg-white"
                }`}
              >
                <p className="text-[9.5px] leading-none font-extrabold text-[rgba(19,28,36,.42)]">
                  {DIAS_DE_LA_SEMANA[i].etiqueta.slice(0, 1)}
                </p>
                <p
                  className={`mt-1 text-[13px] leading-none font-extrabold ${
                    cuantas ? "text-tinta" : "text-[rgba(19,28,36,.42)]"
                  }`}
                >
                  {cuantas}
                </p>
              </Link>
            );
          })}
        </div>

        <p className="text-[11px] leading-none font-extrabold tracking-[.1em] text-[rgba(19,28,36,.42)]">
          {DIAS_DE_LA_SEMANA[indiceElegido].etiqueta.toUpperCase()}{" "}
          {numeroDelDia(semana.dias[indiceElegido])} ·{" "}
          {delDiaElegido.length === 0
            ? "SIN GRUPOS"
            : delDiaElegido.length === 1
              ? "1 GRUPO"
              : `${delDiaElegido.length} GRUPOS`}
        </p>

        <div className="flex flex-col gap-2">
          {delDiaElegido.map(({ grupo: g }) => (
            <Link
              key={g.id}
              href={`/${g.tipo}/${g.id}`}
              className={`block rounded-[9px] border border-[rgba(19,28,36,.09)] border-l-[3px] bg-white px-[13px] py-[11px] ${TONO[g.tipo].barra}`}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={`shrink-0 text-[12.5px] leading-[1.2] font-extrabold ${TONO[g.tipo].hora}`}
                >
                  {horaLegible(g.meetingTime!)}
                </span>
                <span className="text-[13px] leading-[1.25] font-bold text-tinta">
                  {g.nombre}
                </span>
              </div>
              <div className="mt-[5px] flex items-center gap-[5px] text-azul-700">
                {g.tienePunto ? <Pin /> : null}
                <span className="text-[11px] leading-[1.3] font-semibold text-[rgba(19,28,36,.55)]">
                  {g.lider} · {g.personas} {g.personas === 1 ? "persona" : "personas"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ⚠️ Los que no tienen día NO se pueden callar: sin esto la pantalla
          mostraría 10 de 16 y cualquiera concluiría que la iglesia tiene 10
          grupos. */}
      {sinDia.length > 0 ? (
        <div className="rounded-r-[10px] border-l-[3px] border-ambar-barra bg-ambar-fondo px-4 py-[14px]">
          <p className="text-[12.5px] leading-[1.55] text-ambar-texto">
            <strong>
              {sinDia.length === 1
                ? "1 grupo no tiene día ni hora, así que no sale en el calendario."
                : `${sinDia.length} grupos no tienen día ni hora, así que no salen en el calendario.`}
            </strong>{" "}
            Funcionan igual, pero nadie puede verlos aquí ni en su teléfono hasta que su
            líder les ponga el día.
          </p>
          <div className="mt-[9px] flex flex-wrap gap-[6px]">
            {sinDia.map((g) => (
              <Link
                key={g.id}
                href={`/${g.tipo}/${g.id}`}
                className="rounded-[20px] border border-[rgba(201,123,44,.35)] bg-white px-[10px] py-[5px] text-[11px] leading-none font-semibold text-ambar-texto"
              >
                {g.nombre} · {g.lider}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
