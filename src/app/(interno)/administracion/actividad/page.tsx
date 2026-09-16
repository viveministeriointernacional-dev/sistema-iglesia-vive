import Link from "next/link";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { cargarActividad, TIPOS_DE_ACTIVIDAD } from "@/lib/actividad";
import { atajosDelInforme } from "@/lib/informe";
import { getPrisma } from "@/lib/prisma";
import { ListaDeActividad } from "./lista";

export const metadata = { title: "Actividad del día · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// **`hasta` solo viaja cuando de verdad hay un rango.** Si se mira un día, la
/// URL queda con `?desde=` a secas — más corta de compartir, y coherente con
/// que elegir una fecha en el calendario sea un solo gesto.
function url(
  rango: { desde: string; hasta: string },
  tipo?: string,
  q?: string,
) {
  const p = new URLSearchParams({ desde: rango.desde });
  if (rango.hasta !== rango.desde) p.set("hasta", rango.hasta);
  if (tipo) p.set("tipo", tipo);
  if (q) p.set("q", q);
  return `/administracion/actividad?${p.toString()}`;
}

export default async function PaginaActividad({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    /// Se conserva para los enlaces guardados de antes del calendario.
    dia?: string;
    tipo?: string;
    q?: string;
  }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { desde, hasta, dia, tipo, q } = await searchParams;
  const prisma = await getPrisma();
  const actividad = await cargarActividad(prisma, {
    desdeDia: desde,
    hastaDia: hasta,
    dia,
    tipo,
    consulta: q,
  });
  const rango = { desde: actividad.desde, hasta: actividad.hasta };
  const atajos = atajosDelInforme();

  const kpis = [
    { n: actividad.conteos.registros, l: "REGISTROS" },
    { n: actividad.conteos.llamadas, l: "LLAMADAS" },
    { n: actividad.conteos.contactadas, l: "CONTACTADAS" },
    { n: actividad.conteos.visitas, l: "VISITAS" },
    { n: actividad.conteos.entregas, l: "ENTREGAS A MENTOR" },
    { n: actividad.conteos.fases, l: "CAMBIOS DE FASE" },
  ];

  const chip = (activo: boolean) =>
    `rounded-[20px] border px-[13px] py-2 text-[12px] leading-none font-semibold ${
      activo
        ? "border-[1.5px] border-azul-900 bg-azul-050 text-tinta"
        : "border-[rgba(19,28,36,.18)] bg-white text-[rgba(19,28,36,.55)]"
    }`;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="etiqueta-seccion">
              <Link href="/administracion" className="hover:text-azul-700">
                ADMINISTRACIÓN
              </Link>
            </p>
            <h1 className="mt-2 font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              {actividad.esUnDia ? "Actividad del día" : "Actividad"}
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              Todo lo que se hizo en el sistema, en orden, con quién lo hizo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={url(actividad.anterior, tipo, q)}
              className="rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-3 py-[10px] text-[13px] leading-none font-bold text-tinta"
              aria-label="Día anterior"
            >
              ‹
            </Link>
            <span className="rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-[14px] py-[10px] text-[13.5px] leading-none font-bold text-tinta capitalize">
              {actividad.etiquetaDia}
            </span>
            {actividad.esHoy ? (
              <span className="rounded-[9px] border border-[rgba(19,28,36,.1)] bg-white px-3 py-[10px] text-[13px] leading-none font-bold text-[rgba(19,28,36,.3)]">
                ›
              </span>
            ) : (
              <Link
                href={url(actividad.siguiente, tipo, q)}
                className="rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-3 py-[10px] text-[13px] leading-none font-bold text-tinta"
                aria-label="Día siguiente"
              >
                ›
              </Link>
            )}
            {!actividad.esHoy || !actividad.esUnDia ? (
              <Link href="/administracion/actividad" className="ml-1 text-[12.5px] leading-none font-bold text-azul-700">
                Hoy
              </Link>
            ) : null}
          </div>
        </header>

        {/* **El calendario.** Dos `input type="date"`, que es el que abre el
            calendario nativo del sistema — sin librería y sin JS, como el resto
            de los filtros de la plataforma. «Hasta» es OPCIONAL: dejarlo vacío
            significa ese solo día, así que elegir una fecha es un gesto y
            elegir un periodo son dos. */}
        <form
          method="get"
          className="mt-[18px] flex flex-wrap items-end gap-x-3 gap-y-2 rounded-[13px] border border-[rgba(19,28,36,.1)] bg-white p-3"
        >
          {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
          {q ? <input type="hidden" name="q" value={q} /> : null}
          <label className="block">
            <span className="block text-[10px] leading-none font-extrabold tracking-[.1em] text-[rgba(19,28,36,.42)]">
              DESDE
            </span>
            <input
              type="date"
              name="desde"
              defaultValue={actividad.desde}
              max={actividad.hoy}
              className="campo mt-[6px] min-w-[150px]"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] leading-none font-extrabold tracking-[.1em] text-[rgba(19,28,36,.42)]">
              HASTA <span className="font-bold tracking-normal">· opcional</span>
            </span>
            <input
              type="date"
              name="hasta"
              defaultValue={actividad.esUnDia ? "" : actividad.hasta}
              max={actividad.hoy}
              className="campo mt-[6px] min-w-[150px]"
            />
          </label>
          <button
            type="submit"
            className="cursor-pointer rounded-[9px] border-0 bg-azul-900 px-4 py-[11px] text-[12px] leading-none font-semibold text-white"
          >
            Ver
          </button>
          <div className="flex flex-wrap items-center gap-[6px] sm:ml-auto">
            {atajos.map((a) => {
              const activo = a.inicio === actividad.desde && a.fin === actividad.hasta;
              return (
                <Link
                  key={a.clave}
                  href={url({ desde: a.inicio, hasta: a.fin }, tipo, q)}
                  className={`rounded-[20px] border px-[11px] py-[7px] text-[11.5px] leading-none font-semibold ${
                    activo
                      ? "border-[1.5px] border-azul-900 bg-azul-050 text-tinta"
                      : "border-[rgba(19,28,36,.16)] bg-white text-[rgba(19,28,36,.55)]"
                  }`}
                >
                  {a.etiqueta}
                </Link>
              );
            })}
          </div>
        </form>

        {/* ⚠️ Si la lista topó con el límite hay que DECIRLO. Los seis
            contadores salen de un `count` en la base, así que siguen exactos;
            la lista es la que queda corta, y enseñarla como si fuera todo sería
            mentir sobre un periodo largo. */}
        {actividad.recortado ? (
          <p className="mt-3 rounded-[10px] border border-[rgba(201,123,44,.35)] bg-ambar-chip px-3 py-[10px] text-[12px] leading-[1.45] font-semibold text-ambar-texto">
            El periodo trae demasiados movimientos y la lista de abajo quedó
            incompleta. Los seis indicadores sí son exactos. Acorta el rango
            para ver el detalle completo.
          </p>
        ) : null}

        <div className="mt-[18px] grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.l} className="tarjeta px-4 py-[14px]">
              <div className="font-serif text-[30px] leading-none text-tinta">{k.n}</div>
              <div className="mt-[7px] text-[10px] leading-none font-extrabold tracking-[.1em] text-[rgba(19,28,36,.42)]">
                {k.l}
              </div>
            </div>
          ))}
        </div>

        <form method="get" className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="desde" value={actividad.desde} />
          {!actividad.esUnDia ? (
            <input type="hidden" name="hasta" value={actividad.hasta} />
          ) : null}
          {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
          <Link href={url(rango, undefined, q)} className={chip(!tipo)}>
            Todo · {actividad.total}
          </Link>
          {TIPOS_DE_ACTIVIDAD.filter((t) => actividad.porTipo[t.valor] > 0).map((t) => (
            <Link key={t.valor} href={url(rango, t.valor, q)} className={chip(tipo === t.valor)}>
              {t.etiqueta} · {actividad.porTipo[t.valor]}
            </Link>
          ))}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Filtrar por persona o por quien lo hizo…"
            className="campo mt-0 min-w-[240px] flex-1 sm:ml-auto sm:max-w-[320px]"
            aria-label="Filtrar por nombre"
          />
        </form>

        <div className="mt-[14px]">
          <ListaDeActividad movimientos={actividad.movimientos} />
        </div>
      </div>
    </main>
  );
}
