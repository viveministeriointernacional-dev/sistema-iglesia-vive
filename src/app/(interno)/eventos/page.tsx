import Link from "next/link";
import { EventKind } from "@iglesia/prisma-client";
import { requerirRol } from "@/lib/auth";
import {
  cargarEventos,
  ETIQUETA_EVENTO,
  ocupanCupo,
  puedeProgramar,
  ROLES_OPERAN_EVENTOS,
} from "@/lib/eventos";
import { NuevoEvento } from "./nuevo-evento";

export const metadata = { title: "Eventos · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

type EventoDeLista = Awaited<ReturnType<typeof cargarEventos>>["proximos"][number];

export default async function PaginaEventos() {
  const usuario = await requerirRol(ROLES_OPERAN_EVENTOS);
  const { proximos, pasados } = await cargarEventos();

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Eventos
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            El Encuentro y el Bautismo cierran hitos del recorrido cuando se
            marca la asistencia
          </p>
        </header>

        {puedeProgramar(usuario) ? (
          <div className="mt-5">
            <NuevoEvento />
          </div>
        ) : null}

        <section className="mt-6">
          <h2 className="etiqueta-seccion">PRÓXIMOS</h2>
          {proximos.length ? (
            <ul className="mt-[14px] flex flex-col gap-[10px]">
              {proximos.map((evento) => (
                <Fila key={evento.id} evento={evento} />
              ))}
            </ul>
          ) : (
            <p className="mt-[14px] rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
              No hay eventos programados.
            </p>
          )}
        </section>

        {pasados.length ? (
          <section className="mt-7">
            <h2 className="etiqueta-seccion">YA OCURRIERON</h2>
            <ul className="mt-[14px] flex flex-col gap-[10px]">
              {pasados.map((evento) => (
                <Fila key={evento.id} evento={evento} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Fila({ evento }: { evento: EventoDeLista }) {
  const inscritos = ocupanCupo(evento.registrations);
  const asistieron = evento.registrations.filter((r) => r.status === "ASISTIO").length;
  const cierraHito =
    evento.kind === EventKind.ENCUENTRO || evento.kind === EventKind.BAUTISMO;

  return (
    <li className="tarjeta p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-[6px] px-2 py-1 text-[9.5px] leading-none font-bold tracking-[.08em] ${
                cierraHito
                  ? "bg-verde-100 text-verde-700"
                  : "bg-[rgba(19,28,36,.06)] text-[rgba(19,28,36,.5)]"
              }`}
            >
              {ETIQUETA_EVENTO[evento.kind].toUpperCase()}
            </span>
            <Link
              href={`/eventos/${evento.id}`}
              className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
            >
              {evento.title}
            </Link>
            {evento.cancelledAt ? (
              <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[9.5px] font-bold text-[rgba(19,28,36,.5)]">
                CANCELADO
              </span>
            ) : !evento.publishedAt ? (
              <span className="rounded-[20px] border border-[rgba(201,123,44,.35)] px-2 py-1 text-[9.5px] font-bold text-ambar-texto">
                SIN PUBLICAR
              </span>
            ) : null}
          </div>
          <p className="mt-[6px] text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
            {FECHA.format(evento.startsAt)}
            {evento.location ? ` · ${evento.location}` : ""}
            {evento.phases.length ? ` · ${evento.phases.join(", ")}` : " · toda la iglesia"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
          <span>
            {inscritos}
            {evento.capacity !== null ? ` / ${evento.capacity}` : ""} inscritos
          </span>
          {asistieron ? <span>{asistieron} asistieron</span> : null}
        </div>
      </div>
    </li>
  );
}
