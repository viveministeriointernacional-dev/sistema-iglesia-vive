import Link from "next/link";
import { requerirPermiso } from "@/lib/auth";
import {
  cargarGrupos,
  esVistaCompletaDeAlpha,
  lideresPosibles,
  puedeCrearAlpha,
  puedeVerAlpha,
  SESIONES_DE_ALPHA,
} from "@/lib/alpha";
import {
  cargarCasasDeFe,
  esVistaCompletaDeCasaDeFe,
  lideresPosiblesCasaDeFe,
  puedeCrearCasaDeFe,
  puedeVerCasaDeFe,
} from "@/lib/casa-de-fe";
import { NuevoGrupo } from "./nuevo-grupo";
import { NuevaCasaDeFe } from "../casa-de-fe/nuevo-grupo";

export const metadata = { title: "Alpha y Casa de Fe · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PaginaAlpha() {
  const usuario = await requerirPermiso(
    (u) => puedeVerAlpha(u) || puedeVerCasaDeFe(u),
  );

  const veAlpha = puedeVerAlpha(usuario);
  const veCasaDeFe = puedeVerCasaDeFe(usuario);

  const [grupos, lideresAlpha, casas, lideresCasa] = await Promise.all([
    veAlpha ? cargarGrupos(usuario) : Promise.resolve([]),
    veAlpha && puedeCrearAlpha(usuario)
      ? lideresPosibles()
      : Promise.resolve([]),
    veCasaDeFe ? cargarCasasDeFe(usuario) : Promise.resolve([]),
    veCasaDeFe && puedeCrearCasaDeFe(usuario)
      ? lideresPosiblesCasaDeFe()
      : Promise.resolve([]),
  ]);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Alpha y Casa de Fe
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            Los grupos de Alpha y las Casas de Fe · elige quién lleva cada uno
          </p>
        </header>

        {veAlpha ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="etiqueta-seccion">ALPHA</h2>
              <p className="text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
                {esVistaCompletaDeAlpha(usuario)
                  ? "Todos los grupos de la iglesia"
                  : "Los grupos que lideras"}{" "}
                · {SESIONES_DE_ALPHA} sesiones de referencia
              </p>
            </div>

            {puedeCrearAlpha(usuario) ? (
              <div className="mt-4">
                <NuevoGrupo lideres={lideresAlpha} />
              </div>
            ) : null}

            {grupos.length === 0 ? (
              <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Todavía no hay grupos de Alpha.{" "}
                {puedeCrearAlpha(usuario)
                  ? "Crea el primero y elige quién lo lleva."
                  : "Cuando te asignen uno, aparecerá aquí."}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-[10px]">
                {grupos.map((grupo) => (
                  <li key={grupo.id} className="tarjeta p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/alpha/${grupo.id}`}
                          className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
                        >
                          {grupo.name}
                        </Link>
                        <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                          Desde {FECHA.format(grupo.startDate)} ·{" "}
                          {grupo.leader.fullName}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
                        <span>
                          {grupo._count.enrollments}{" "}
                          {grupo._count.enrollments === 1 ? "persona" : "personas"}
                        </span>
                        <span>
                          {grupo._count.sessions} / {SESIONES_DE_ALPHA} sesiones
                        </span>
                        {grupo.closedAt ? (
                          <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[9.5px] font-bold text-[rgba(19,28,36,.5)]">
                            CERRADO
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {veCasaDeFe ? (
          <section className="mt-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="etiqueta-seccion">CASA DE FE</h2>
              <p className="text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
                {esVistaCompletaDeCasaDeFe(usuario)
                  ? "Todas las Casas de Fe de la iglesia"
                  : "Las Casas de Fe que llevas"}{" "}
                · 12 temas de referencia
              </p>
            </div>

            {puedeCrearCasaDeFe(usuario) ? (
              <div className="mt-4">
                <NuevaCasaDeFe lideres={lideresCasa} />
              </div>
            ) : null}

            {casas.length === 0 ? (
              <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Todavía no hay Casas de Fe.{" "}
                {puedeCrearCasaDeFe(usuario)
                  ? "Abre la primera y elige quién la lleva."
                  : "Cuando te asignen una, aparecerá aquí."}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-[10px]">
                {casas.map((casa) => (
                  <li key={casa.id} className="tarjeta p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/casa-de-fe/${casa.id}`}
                          className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
                        >
                          {casa.name}
                        </Link>
                        <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                          Desde {FECHA.format(casa.startDate)} ·{" "}
                          {casa.leader.fullName}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
                        <span>
                          {casa._count.members}{" "}
                          {casa._count.members === 1 ? "persona" : "personas"}
                        </span>
                        {casa.closedAt ? (
                          <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[9.5px] font-bold text-[rgba(19,28,36,.5)]">
                            CERRADA
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
