import Link from "next/link";
import { ETIQUETA_ROL, requerirRol, ROLES_ADMIN } from "@/lib/auth";
import {
  detalleLlamadasPersona,
  formatoDuracion,
  rangoDesdeParametros,
  resumenLlamadas,
  type FilaLlamadasPersona,
} from "@/lib/llamadas";

export const metadata = { title: "Llamadas · Iglesia Vive" };
export const dynamic = "force-dynamic";

function paraInput(fecha: Date) {
  return fecha.toISOString().slice(0, 10);
}

function etiquetaEstado(estado: string | null, contestada: boolean) {
  if (!estado) return contestada ? "Contestada" : "—";
  const n = estado.toLowerCase();
  if (n.includes("complet") || n.includes("answer")) return "Contestada";
  if (n.includes("no-answer") || n.includes("noanswer")) return "No contestó";
  if (n.includes("busy")) return "Ocupado";
  if (n.includes("fail")) return "Falló";
  if (n.includes("voicemail")) return "Buzón";
  if (n.includes("cancel")) return "Cancelada";
  return estado;
}

function Kpi({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="tarjeta p-4">
      <p className="text-[11px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
        {etiqueta}
      </p>
      <p className="mt-2 font-serif text-[26px] leading-[1.05] font-normal text-tinta">
        {valor}
      </p>
      {detalle ? (
        <p className="mt-1 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.5)]">
          {detalle}
        </p>
      ) : null}
    </div>
  );
}

function FiltroFechas({
  desde,
  hasta,
  persona,
  hl,
}: {
  desde: Date;
  hasta: Date;
  persona?: string;
  hl?: string;
}) {
  return (
    <form
      className="mt-5 flex flex-wrap items-end gap-3"
      action="/administracion/llamadas"
    >
      {persona ? <input type="hidden" name="persona" value={persona} /> : null}
      {hl ? <input type="hidden" name="hl" value={hl} /> : null}
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
          Desde
        </span>
        <input
          type="date"
          name="desde"
          defaultValue={paraInput(desde)}
          className="rounded-[9px] border border-[rgba(19,28,36,.16)] bg-white px-[12px] py-[9px] text-[13px] leading-none font-semibold text-tinta outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
          Hasta
        </span>
        <input
          type="date"
          name="hasta"
          defaultValue={paraInput(hasta)}
          className="rounded-[9px] border border-[rgba(19,28,36,.16)] bg-white px-[12px] py-[9px] text-[13px] leading-none font-semibold text-tinta outline-none"
        />
      </label>
      <button
        type="submit"
        className="rounded-[9px] bg-azul-900 px-[16px] py-[10px] text-[12px] leading-none font-semibold text-white"
      >
        Aplicar
      </button>
    </form>
  );
}

function urlPersona(
  fila: { appUserId: string | null; highlevelUserId: string | null },
  desde: Date,
  hasta: Date,
) {
  const p = new URLSearchParams({
    desde: paraInput(desde),
    hasta: paraInput(hasta),
  });
  if (fila.appUserId) p.set("persona", fila.appUserId);
  else if (fila.highlevelUserId) p.set("hl", fila.highlevelUserId);
  return `/administracion/llamadas?${p.toString()}`;
}

export default async function PaginaLlamadas({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    persona?: string;
    hl?: string;
  }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { desde: desdeP, hasta: hastaP, persona, hl } = await searchParams;
  const rango = rangoDesdeParametros(desdeP, hastaP);

  const rangoTexto = `${rango.desde.toLocaleDateString("es-CO")} – ${rango.hasta.toLocaleDateString("es-CO")}`;

  if (persona || hl) {
    return (
      <VistaIndividual
        selector={persona ? { appUserId: persona } : { highlevelUserId: hl }}
        rango={rango}
        rangoTexto={rangoTexto}
      />
    );
  }

  const resumen = await resumenLlamadas(rango);
  const g = resumen.global;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Llamadas
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              Comportamiento de las llamadas del personal en HighLevel · {rangoTexto}
            </p>
          </div>
          <Link
            href="/administracion"
            className="shrink-0 rounded-[9px] border border-[rgba(19,28,36,.16)] px-[14px] py-[10px] text-[12px] leading-none font-semibold text-tinta hover:border-azul-700 hover:text-azul-700"
          >
            ← Administración
          </Link>
        </header>

        <FiltroFechas desde={rango.desde} hasta={rango.hasta} />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi
            etiqueta="Llamadas"
            valor={g.llamadas.toLocaleString("es-CO")}
            detalle={`${g.salientes} salientes · ${g.entrantes} entrantes`}
          />
          <Kpi
            etiqueta="Contestadas"
            valor={g.contestadas.toLocaleString("es-CO")}
            detalle={
              g.llamadas > 0
                ? `${Math.round((g.contestadas / g.llamadas) * 100)}% del total`
                : "—"
            }
          />
          <Kpi
            etiqueta="Tiempo total"
            valor={formatoDuracion(g.duracionTotal)}
            detalle={`Promedio ${formatoDuracion(g.duracionPromedio)}`}
          />
          <Kpi
            etiqueta="Contactos alcanzados"
            valor={g.contactosAlcanzados.toLocaleString("es-CO")}
            detalle={`${g.personalActivo} del personal con actividad`}
          />
        </div>

        <h2 className="mt-8 text-[13px] leading-none font-bold tracking-[.04em] text-[rgba(19,28,36,.55)] uppercase">
          Por persona
        </h2>

        {resumen.porPersona.length === 0 ? (
          <p className="mt-3 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
            Todavía no hay personal con cuenta de HighLevel enlazada. Cada persona
            del equipo debe tener su identificador de HighLevel para aparecer aquí.
          </p>
        ) : (
          <TablaPersonas
            filas={resumen.porPersona}
            sinAsignar={resumen.sinAsignar}
            desde={rango.desde}
            hasta={rango.hasta}
          />
        )}

        {g.llamadas === 0 ? (
          <p className="mt-6 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.7] font-medium text-[rgba(19,28,36,.5)]">
            Aún no llegan llamadas al sistema en este rango. Las llamadas se
            reciben desde HighLevel por webhook; una vez configurado el workflow
            de «Estado de llamada», el historial empieza a poblarse solo.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function TablaPersonas({
  filas,
  sinAsignar,
  desde,
  hasta,
}: {
  filas: FilaLlamadasPersona[];
  sinAsignar: FilaLlamadasPersona | null;
  desde: Date;
  hasta: Date;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-[rgba(19,28,36,.12)] text-left">
            <th className="py-2 pr-3 text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
              Persona
            </th>
            <th className="py-2 px-3 text-right text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
              Llamadas
            </th>
            <th className="py-2 px-3 text-right text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
              Contestadas
            </th>
            <th className="py-2 px-3 text-right text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
              Duración total
            </th>
            <th className="py-2 pl-3 text-right text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
              Promedio
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr
              key={fila.appUserId ?? fila.highlevelUserId ?? "sin"}
              className="border-b border-[rgba(19,28,36,.07)]"
            >
              <td className="py-[10px] pr-3">
                {fila.appUserId || fila.highlevelUserId ? (
                  <Link
                    href={urlPersona(fila, desde, hasta)}
                    className="font-semibold text-tinta hover:text-azul-700"
                  >
                    {fila.nombre}
                  </Link>
                ) : (
                  <span className="font-semibold text-tinta">{fila.nombre}</span>
                )}
                {fila.rol ? (
                  <span className="ml-2 text-[11px] font-semibold text-[rgba(19,28,36,.45)]">
                    {ETIQUETA_ROL[fila.rol]}
                  </span>
                ) : !fila.enlazado && fila.highlevelUserId ? (
                  <span className="ml-2 rounded-[5px] bg-[rgba(19,28,36,.06)] px-[6px] py-[2px] text-[10px] font-bold text-[rgba(19,28,36,.5)]">
                    NO ENLAZADO
                  </span>
                ) : null}
              </td>
              <td className="py-[10px] px-3 text-right font-semibold text-tinta tabular-nums">
                {fila.llamadas.toLocaleString("es-CO")}
                <span className="ml-1 text-[11px] font-medium text-[rgba(19,28,36,.4)]">
                  {fila.salientes}↑ {fila.entrantes}↓
                </span>
              </td>
              <td className="py-[10px] px-3 text-right font-semibold text-tinta tabular-nums">
                {fila.contestadas.toLocaleString("es-CO")}
              </td>
              <td className="py-[10px] px-3 text-right font-semibold text-tinta tabular-nums">
                {formatoDuracion(fila.duracionTotal)}
              </td>
              <td className="py-[10px] pl-3 text-right font-semibold text-[rgba(19,28,36,.65)] tabular-nums">
                {formatoDuracion(fila.duracionPromedio)}
              </td>
            </tr>
          ))}
          {sinAsignar ? (
            <tr className="border-b border-[rgba(19,28,36,.07)] bg-[rgba(19,28,36,.02)]">
              <td className="py-[10px] pr-3 font-semibold text-[rgba(19,28,36,.6)] italic">
                {sinAsignar.nombre}
                <span className="ml-2 text-[11px] font-medium text-[rgba(19,28,36,.4)] not-italic">
                  usuario de HighLevel sin enlazar
                </span>
              </td>
              <td className="py-[10px] px-3 text-right font-semibold text-[rgba(19,28,36,.6)] tabular-nums">
                {sinAsignar.llamadas.toLocaleString("es-CO")}
              </td>
              <td className="py-[10px] px-3 text-right font-semibold text-[rgba(19,28,36,.6)] tabular-nums">
                {sinAsignar.contestadas.toLocaleString("es-CO")}
              </td>
              <td className="py-[10px] px-3 text-right font-semibold text-[rgba(19,28,36,.6)] tabular-nums">
                {formatoDuracion(sinAsignar.duracionTotal)}
              </td>
              <td className="py-[10px] pl-3 text-right font-semibold text-[rgba(19,28,36,.5)] tabular-nums">
                {formatoDuracion(sinAsignar.duracionPromedio)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

async function VistaIndividual({
  selector,
  rango,
  rangoTexto,
}: {
  selector: { appUserId?: string; highlevelUserId?: string };
  rango: { desde: Date; hasta: Date };
  rangoTexto: string;
}) {
  const detalle = await detalleLlamadasPersona(selector, rango);

  if (!detalle || !detalle.persona) {
    return (
      <main className="px-5 py-7 sm:px-[26px]">
        <div className="mx-auto max-w-[1240px]">
          <Link
            href="/administracion/llamadas"
            className="text-[12px] font-semibold text-azul-700"
          >
            ← Volver a llamadas
          </Link>
          <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] font-medium text-[rgba(19,28,36,.5)]">
            No se encontró a esa persona.
          </p>
        </div>
      </main>
    );
  }

  const { fila } = detalle;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <Link
          href={`/administracion/llamadas?desde=${paraInput(rango.desde)}&hasta=${paraInput(rango.hasta)}`}
          className="text-[12px] font-semibold text-azul-700"
        >
          ← Volver a llamadas
        </Link>
        <header className="mt-3">
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {detalle.persona.nombre}
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {detalle.persona.rol ? `${ETIQUETA_ROL[detalle.persona.rol]} · ` : ""}
            Historial de llamadas · {rangoTexto}
          </p>
        </header>

        <FiltroFechas
          desde={rango.desde}
          hasta={rango.hasta}
          persona={selector.appUserId}
          hl={selector.highlevelUserId}
        />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi
            etiqueta="Llamadas"
            valor={fila.llamadas.toLocaleString("es-CO")}
            detalle={`${fila.salientes} salientes · ${fila.entrantes} entrantes`}
          />
          <Kpi
            etiqueta="Contestadas"
            valor={fila.contestadas.toLocaleString("es-CO")}
            detalle={
              fila.llamadas > 0
                ? `${Math.round((fila.contestadas / fila.llamadas) * 100)}% del total`
                : "—"
            }
          />
          <Kpi
            etiqueta="Tiempo total"
            valor={formatoDuracion(fila.duracionTotal)}
          />
          <Kpi
            etiqueta="Duración promedio"
            valor={formatoDuracion(fila.duracionPromedio)}
          />
        </div>

        <h2 className="mt-8 text-[13px] leading-none font-bold tracking-[.04em] text-[rgba(19,28,36,.55)] uppercase">
          Detalle de llamadas
        </h2>

        {detalle.llamadas.length === 0 ? (
          <p className="mt-3 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] font-medium text-[rgba(19,28,36,.5)]">
            No hay llamadas de esta persona en el rango elegido.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[rgba(19,28,36,.12)] text-left">
                  <th className="py-2 pr-3 text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
                    Fecha
                  </th>
                  <th className="py-2 px-3 text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
                    A quién se llamó
                  </th>
                  <th className="py-2 px-3 text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
                    Sentido
                  </th>
                  <th className="py-2 px-3 text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
                    Estado
                  </th>
                  <th className="py-2 pl-3 text-right text-[10.5px] leading-none font-bold tracking-[.05em] text-[rgba(19,28,36,.45)] uppercase">
                    Duración
                  </th>
                </tr>
              </thead>
              <tbody>
                {detalle.llamadas.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-[rgba(19,28,36,.07)]"
                  >
                    <td className="py-[9px] pr-3 whitespace-nowrap font-semibold text-[rgba(19,28,36,.7)]">
                      {l.startedAt.toLocaleString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-[9px] px-3 font-semibold text-tinta">
                      {l.contactNombre ?? l.toNumber ?? l.fromNumber ?? "—"}
                    </td>
                    <td className="py-[9px] px-3 font-medium text-[rgba(19,28,36,.6)]">
                      {l.direction === "outbound"
                        ? "Saliente"
                        : l.direction === "inbound"
                          ? "Entrante"
                          : "—"}
                    </td>
                    <td className="py-[9px] px-3">
                      <span
                        className={`rounded-[6px] px-[8px] py-[4px] text-[10.5px] leading-none font-bold ${
                          l.answered
                            ? "bg-azul-100 text-azul-700"
                            : "bg-[rgba(19,28,36,.06)] text-[rgba(19,28,36,.5)]"
                        }`}
                      >
                        {etiquetaEstado(l.status, l.answered)}
                      </span>
                    </td>
                    <td className="py-[9px] pl-3 text-right font-semibold text-tinta tabular-nums">
                      {formatoDuracion(l.durationSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
