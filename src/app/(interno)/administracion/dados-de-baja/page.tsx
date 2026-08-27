import Link from "next/link";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { listarDadosDeBaja } from "@/lib/administracion";

export const metadata = { title: "Dados de baja · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function PaginaDadosDeBaja() {
  await requerirRol(ROLES_ADMIN);
  const filas = await listarDadosDeBaja();

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1000px]">
        <Link
          href="/administracion"
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver a administración
        </Link>

        <header className="mt-3">
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Dados de baja
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Personas que salieron de todos los procesos, con el motivo y la
            fecha. No se borran: entra a cada una para ver su expediente o
            reactivarla si regresa.
          </p>
        </header>

        <div className="mt-6 flex flex-col gap-2">
          {filas.map((fila) => (
            <Link
              key={fila.learnerId}
              href={`/administracion/${fila.personId}`}
              className="tarjeta flex flex-wrap items-start gap-x-4 gap-y-2 p-4 hover:border-azul-700"
            >
              <span className="min-w-[180px] flex-[2_1_220px]">
                <span className="block text-[14px] leading-[1.2] font-semibold text-tinta">
                  {fila.nombre}
                </span>
                {fila.telefono ? (
                  <span className="mt-1 block text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                    {fila.telefono}
                  </span>
                ) : null}
              </span>

              <span className="flex-[3_1_320px]">
                <span className="block text-[12.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.72)]">
                  {fila.motivo ?? "Sin motivo registrado"}
                </span>
                <span className="mt-1 block text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
                  {fila.fecha ? FECHA.format(fila.fecha) : "—"}
                  {fila.por ? ` · por ${fila.por}` : ""}
                </span>
              </span>
            </Link>
          ))}

          {filas.length === 0 ? (
            <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
              Nadie está dado de baja.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
