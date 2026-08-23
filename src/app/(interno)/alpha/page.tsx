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
import { NuevoGrupo } from "./nuevo-grupo";

export const metadata = { title: "Alpha · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PaginaAlpha() {
  const usuario = await requerirPermiso(puedeVerAlpha);
  const [grupos, lideres] = await Promise.all([
    cargarGrupos(usuario),
    puedeCrearAlpha(usuario) ? lideresPosibles() : Promise.resolve([]),
  ]);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Alpha
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {esVistaCompletaDeAlpha(usuario)
              ? "Todos los grupos de la iglesia"
              : "Los grupos que lideras"}{" "}
            · {SESIONES_DE_ALPHA} sesiones de referencia
          </p>
        </header>

        {puedeCrearAlpha(usuario) ? (
          <div className="mt-5">
            <NuevoGrupo lideres={lideres} />
          </div>
        ) : null}

        {grupos.length === 0 ? (
          <p className="mt-6 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
            Todavía no hay grupos. {puedeCrearAlpha(usuario)
              ? "Crea el primero y elige quién lo lleva."
              : "Cuando te asignen uno, aparecerá aquí."}
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-[10px]">
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
                      Desde {FECHA.format(grupo.startDate)} · {grupo.leader.fullName}
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
      </div>
    </main>
  );
}
