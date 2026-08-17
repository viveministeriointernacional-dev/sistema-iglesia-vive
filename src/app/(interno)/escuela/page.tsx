import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import {
  cargarEscuelas,
  esVistaCompletaDeEscuela,
  ROLES_ENTRENAR,
} from "@/lib/entrenar";
import { NuevaEscuela } from "./nueva-escuela";

export const metadata = { title: "Escuela Ser Líder · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PaginaEscuela() {
  const usuario = await requerirRol(ROLES_ENTRENAR);
  const escuelas = await cargarEscuelas(usuario);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Escuela Ser Líder
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {esVistaCompletaDeEscuela(usuario)
              ? "Todas las escuelas de la iglesia"
              : "Las escuelas que lideras"}{" "}
            · presencial el primer sábado del mes, virtuales según programación
          </p>
        </header>

        <div className="mt-5">
          <NuevaEscuela />
        </div>

        {escuelas.length === 0 ? (
          <p className="mt-6 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
            Todavía no hay escuelas. Crea la primera y arma su programación
            sesión por sesión.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-[10px]">
            {escuelas.map((escuela) => (
              <li key={escuela.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/escuela/${escuela.id}`}
                      className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
                    >
                      {escuela.name}
                    </Link>
                    <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                      Desde {FECHA.format(escuela.startDate)} ·{" "}
                      {escuela.leader.fullName}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
                    <span>
                      {escuela._count.enrollments}{" "}
                      {escuela._count.enrollments === 1 ? "persona" : "personas"}
                    </span>
                    <span>
                      {escuela._count.sessions}{" "}
                      {escuela._count.sessions === 1 ? "sesión" : "sesiones"}
                    </span>
                    {escuela.closedAt ? (
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
      </div>
    </main>
  );
}
