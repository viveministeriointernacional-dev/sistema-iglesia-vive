import Link from "next/link";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { cargarActividad, TIPOS_DE_ACTIVIDAD } from "@/lib/actividad";
import { getPrisma } from "@/lib/prisma";
import { ListaDeActividad } from "./lista";

export const metadata = { title: "Actividad del día · Iglesia Vive" };
export const dynamic = "force-dynamic";

function url(dia: string, tipo?: string, q?: string) {
  const p = new URLSearchParams({ dia });
  if (tipo) p.set("tipo", tipo);
  if (q) p.set("q", q);
  return `/administracion/actividad?${p.toString()}`;
}

export default async function PaginaActividad({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; tipo?: string; q?: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { dia, tipo, q } = await searchParams;
  const prisma = await getPrisma();
  const actividad = await cargarActividad(prisma, { dia, tipo, consulta: q });

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
              Actividad del día
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              Todo lo que se hizo en el sistema, en orden, con quién lo hizo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={url(actividad.diaAnterior, tipo, q)}
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
                href={url(actividad.diaSiguiente, tipo, q)}
                className="rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-3 py-[10px] text-[13px] leading-none font-bold text-tinta"
                aria-label="Día siguiente"
              >
                ›
              </Link>
            )}
            {!actividad.esHoy ? (
              <Link href="/administracion/actividad" className="ml-1 text-[12.5px] leading-none font-bold text-azul-700">
                Hoy
              </Link>
            ) : null}
          </div>
        </header>

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
          <input type="hidden" name="dia" value={actividad.dia} />
          {tipo ? <input type="hidden" name="tipo" value={tipo} /> : null}
          <Link href={url(actividad.dia, undefined, q)} className={chip(!tipo)}>
            Todo · {actividad.total}
          </Link>
          {TIPOS_DE_ACTIVIDAD.filter((t) => actividad.porTipo[t.valor] > 0).map((t) => (
            <Link key={t.valor} href={url(actividad.dia, t.valor, q)} className={chip(tipo === t.valor)}>
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
