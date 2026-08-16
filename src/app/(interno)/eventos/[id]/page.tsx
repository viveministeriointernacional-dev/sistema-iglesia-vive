import { notFound } from "next/navigation";
import { EventKind } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import { nombreCompleto } from "@/lib/dominio";
import {
  cargarEvento,
  ETIQUETA_EVENTO,
  ocupanCupo,
  puedeProgramar,
  ROLES_OPERAN_EVENTOS,
} from "@/lib/eventos";
import { Evento, type InscripcionVista } from "./evento";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Solo el título: no vale la pena traerse la lista de inscritos otra vez.
  const prisma = await getPrisma();
  const evento = await prisma.event.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: evento ? `${evento.title} · Eventos` : "Eventos · Iglesia Vive" };
}

export default async function PaginaEvento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await requerirRol(ROLES_OPERAN_EVENTOS);
  const evento = await cargarEvento(id);

  if (!evento) notFound();

  const inscripciones: InscripcionVista[] = evento.registrations.map((registro) => ({
    id: registro.id,
    learnerId: registro.learnerId,
    nombre: nombreCompleto(registro.learner.person),
    fase: registro.learner.phase,
    status: registro.status,
    marcadaPor: registro.attendedBy?.fullName ?? null,
  }));

  const inscritos = ocupanCupo(evento.registrations);
  const cierraHito =
    evento.kind === EventKind.ENCUENTRO || evento.kind === EventKind.BAUTISMO;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
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
            {evento.cancelledAt ? (
              <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[9.5px] font-bold text-[rgba(19,28,36,.5)]">
                CANCELADO
              </span>
            ) : evento.publishedAt ? (
              <span className="rounded-[20px] bg-verde-100 px-2 py-1 text-[9.5px] font-bold text-verde-700">
                PUBLICADO
              </span>
            ) : (
              <span className="rounded-[20px] border border-[rgba(201,123,44,.35)] px-2 py-1 text-[9.5px] font-bold text-ambar-texto">
                SIN PUBLICAR
              </span>
            )}
          </div>

          <h1 className="mt-3 font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {evento.title}
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            {FECHA.format(evento.startsAt)}
            {evento.location ? ` · ${evento.location}` : ""}
            {" · "}
            {evento.phases.length ? evento.phases.join(", ") : "toda la iglesia"}
            {" · "}
            {inscritos}
            {evento.capacity !== null ? ` / ${evento.capacity}` : ""} inscritos
          </p>
          {evento.description ? (
            <p className="mt-3 max-w-[720px] text-[13px] leading-[1.6] font-medium text-tinta">
              {evento.description}
            </p>
          ) : null}
        </header>

        <Evento
          eventId={evento.id}
          inscripciones={inscripciones}
          cierraHito={cierraHito ? ETIQUETA_EVENTO[evento.kind] : null}
          publicado={Boolean(evento.publishedAt)}
          cancelado={Boolean(evento.cancelledAt)}
          puedeProgramar={puedeProgramar(usuario)}
          sinCupo={
            evento.capacity !== null && inscritos >= evento.capacity
          }
        />
      </div>
    </main>
  );
}
