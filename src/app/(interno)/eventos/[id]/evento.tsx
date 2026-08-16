"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventRegistrationStatus, type Phase } from "@iglesia/prisma-client";
import {
  buscarParaInscribir,
  cancelar,
  inscribir,
  marcarEstado,
  publicar,
  type CandidatoEvento,
} from "../acciones";

export type InscripcionVista = {
  id: string;
  learnerId: string;
  nombre: string;
  fase: Phase;
  status: EventRegistrationStatus;
  marcadaPor: string | null;
};

const ESTADOS: { valor: EventRegistrationStatus; etiqueta: string }[] = [
  { valor: EventRegistrationStatus.INSCRITO, etiqueta: "Inscrito" },
  { valor: EventRegistrationStatus.CONFIRMADO, etiqueta: "Confirmó" },
  { valor: EventRegistrationStatus.ASISTIO, etiqueta: "Asistió" },
  { valor: EventRegistrationStatus.NO_ASISTIO, etiqueta: "No fue" },
  { valor: EventRegistrationStatus.CANCELADO, etiqueta: "Canceló" },
];

export function Evento({
  eventId,
  inscripciones,
  cierraHito,
  publicado,
  cancelado,
  puedeProgramar,
  sinCupo,
}: {
  eventId: string;
  inscripciones: InscripcionVista[];
  cierraHito: string | null;
  publicado: boolean;
  cancelado: boolean;
  puedeProgramar: boolean;
  sinCupo: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo guardar.");
      else router.refresh();
    });
  }

  const asistieron = inscripciones.filter(
    (i) => i.status === EventRegistrationStatus.ASISTIO,
  ).length;

  return (
    <div className="mt-6 grid gap-[14px] lg:grid-cols-[1fr_360px]">
      <section className="tarjeta p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="etiqueta-seccion">LISTA</h2>
          <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
            {asistieron} de {inscripciones.length} asistieron
          </p>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {inscripciones.map((persona) => (
            <li
              key={persona.id}
              className="flex flex-wrap items-center gap-3 rounded-[10px] bg-papel p-3"
            >
              <span className="min-w-0 flex-1">
                <Link
                  href={`/expediente/${persona.learnerId}`}
                  className="text-[13px] leading-none font-semibold text-tinta hover:text-azul-700 hover:underline"
                >
                  {persona.nombre}
                </Link>
                <span className="mt-[5px] block text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
                  {persona.fase}
                  {persona.marcadaPor ? ` · marcó ${persona.marcadaPor}` : ""}
                </span>
              </span>

              <span className="flex flex-wrap gap-1">
                {ESTADOS.map((estado) => (
                  <button
                    key={estado.valor}
                    type="button"
                    aria-pressed={persona.status === estado.valor}
                    disabled={enCurso || cancelado}
                    onClick={() =>
                      ejecutar(() => marcarEstado(eventId, persona.id, estado.valor))
                    }
                    className="opcion px-[10px] py-2 text-[11.5px]"
                  >
                    {estado.etiqueta}
                  </button>
                ))}
              </span>
            </li>
          ))}
          {inscripciones.length === 0 ? (
            <li className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              Todavía no hay nadie inscrito.
            </li>
          ) : null}
        </ul>

        {error ? (
          <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
            {error}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-[14px]">
        {puedeProgramar && !cancelado ? (
          <section className="tarjeta p-5">
            <h2 className="etiqueta-seccion">PUBLICACIÓN</h2>
            <p className="mt-[10px] text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
              {publicado
                ? "Está publicado: los aprendices a los que va dirigido lo ven en su proceso."
                : "Sin publicar: por ahora solo lo ven los líderes."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enCurso}
                onClick={() => ejecutar(() => publicar(eventId, !publicado))}
                className={publicado ? "boton-secundario" : "boton-primario"}
              >
                {publicado ? "Despublicar" : "Publicar"}
              </button>
              <button
                type="button"
                disabled={enCurso}
                onClick={() => ejecutar(() => cancelar(eventId))}
                className="boton-secundario"
              >
                Cancelar evento
              </button>
            </div>
          </section>
        ) : null}

        {!cancelado ? (
          <section className="tarjeta p-5">
            <h2 className="etiqueta-seccion">INSCRIBIR</h2>
            <Inscribir eventId={eventId} sinCupo={sinCupo} />
          </section>
        ) : null}

        {cierraHito ? (
          <p className="text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
            Marcar «Asistió» cierra el hito de {cierraHito} en el expediente de
            esa persona. Cambiarlo después lo revierte. La fase no se mueve: eso
            lo decide el pastoreo.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Inscribir({ eventId, sinCupo }: { eventId: string; sinCupo: boolean }) {
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoEvento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (sinCupo) {
    return (
      <p className="mt-[10px] text-[12px] leading-[1.5] font-medium text-ambar-texto">
        El cupo está lleno. Libera un lugar cancelando una inscripción o amplía
        el cupo del evento.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Buscar persona…"
          className="campo mt-0 flex-1"
        />
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              setCandidatos(await buscarParaInscribir(eventId, consulta));
            });
          }}
          className="boton-secundario"
        >
          Buscar
        </button>
      </div>

      {candidatos ? (
        candidatos.length ? (
          <ul className="mt-2 flex flex-col gap-1">
            {candidatos.map((candidato) => (
              <li key={candidato.learnerId}>
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() => {
                    setError(null);
                    iniciar(async () => {
                      const resultado = await inscribir(eventId, candidato.learnerId);
                      if (!resultado.ok) {
                        setError(resultado.mensaje);
                        return;
                      }
                      setCandidatos(null);
                      setConsulta("");
                      router.refresh();
                    });
                  }}
                  className="w-full rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white p-2 text-left text-[12.5px] font-semibold text-tinta"
                >
                  {candidato.nombre}
                  <span className="ml-2 text-[11px] font-semibold text-[rgba(19,28,36,.45)]">
                    {candidato.fase}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
            Nadie coincide dentro de las fases a las que va dirigido el evento.
          </p>
        )
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}
