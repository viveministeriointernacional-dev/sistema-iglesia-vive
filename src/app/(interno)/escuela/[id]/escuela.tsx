"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrainingSessionKind } from "@iglesia/prisma-client";
import {
  buscarParaEscuela,
  cerrarEscuela,
  crearSesion,
  inscribirEnEscuela,
  registrarAsistenciaEscuela,
  type CandidatoEscuela,
} from "../acciones";

export type SesionVista = {
  id: string;
  numero: number;
  fecha: string;
  tema: string;
  kind: TrainingSessionKind;
  recurso: string | null;
  tarea: string | null;
  realizada: boolean;
};

export type ParticipanteVista = {
  enrollmentId: string;
  learnerId: string;
  nombre: string;
  presentes: number;
  sesionesRealizadas: number;
  porcentajeAsistencia: number;
  tareasEntregadas: number;
  tareasPedidas: number;
  completado: string | null;
  faltaParaCerrar: string[];
  registro: Record<string, { present: boolean; taskDelivered: boolean }>;
};

export function Escuela({
  programId,
  sesiones,
  participantes,
  asistenciaMinima,
  tareasMinimas,
  puedeEditar,
}: {
  programId: string;
  sesiones: SesionVista[];
  participantes: ParticipanteVista[];
  asistenciaMinima: number;
  tareasMinimas: number;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [sesionActiva, setSesionActiva] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const sesion =
    sesiones.find((s) => s.id === sesionActiva) ??
    sesiones.filter((s) => s.realizada).at(-1) ??
    sesiones[0] ??
    null;

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo guardar.");
      else router.refresh();
    });
  }

  return (
    <div className="mt-6 grid gap-[14px] lg:grid-cols-[1fr_380px]">
      <section className="tarjeta p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="etiqueta-seccion">SESIONES</h2>
          {sesiones.length ? (
            <div className="flex flex-wrap gap-1">
              {sesiones.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === sesion?.id}
                  onClick={() => setSesionActiva(s.id)}
                  className={`h-7 min-w-7 rounded-[7px] px-[6px] text-[11.5px] leading-none font-bold ${
                    s.id === sesion?.id
                      ? "bg-azul-900 text-white"
                      : s.realizada
                        ? "bg-verde-100 text-verde-700"
                        : "bg-[rgba(19,28,36,.06)] text-[rgba(19,28,36,.45)]"
                  }`}
                >
                  {s.numero}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {sesion ? (
          <>
            <p className="mt-3 font-serif text-[18px] leading-[1.25] font-normal text-tinta">
              Sesión {sesion.numero} · {sesion.tema}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
              <span className="rounded-[5px] bg-azul-100 px-[6px] py-[3px] text-[9.5px] font-bold tracking-[.06em] text-azul-700">
                {sesion.kind === TrainingSessionKind.PRESENCIAL
                  ? "PRESENCIAL"
                  : "VIRTUAL"}
              </span>
              <span>{sesion.fecha}</span>
              {sesion.realizada ? null : <span>· todavía no ocurre</span>}
            </p>

            {sesion.recurso ? (
              <p className="mt-2 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.6)]">
                Material:{" "}
                <a
                  href={sesion.recurso}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-azul-700 underline"
                >
                  {sesion.recurso}
                </a>
              </p>
            ) : null}
            {sesion.tarea ? (
              <p className="mt-2 rounded-[10px] bg-papel p-3 text-[12.5px] leading-[1.5] font-medium text-tinta">
                Tarea: {sesion.tarea}
              </p>
            ) : null}

            <ul className="mt-4 flex flex-col gap-2">
              {participantes.map((persona) => {
                const marca = persona.registro[sesion.id];
                const presente = marca?.present ?? false;
                const entregada = marca?.taskDelivered ?? false;
                return (
                  <li
                    key={persona.enrollmentId}
                    className="flex flex-wrap items-center gap-3 rounded-[10px] bg-papel p-3"
                  >
                    <span className="flex-1 text-[13px] leading-none font-semibold text-tinta">
                      {persona.nombre}
                    </span>
                    {puedeEditar ? (
                      <>
                        <button
                          type="button"
                          aria-pressed={presente}
                          disabled={enCurso}
                          onClick={() =>
                            ejecutar(() =>
                              registrarAsistenciaEscuela(
                                programId,
                                sesion.id,
                                persona.enrollmentId,
                                !presente,
                                entregada,
                              ),
                            )
                          }
                          className="opcion px-3 py-2 text-[12px]"
                        >
                          Asistió
                        </button>
                        {sesion.tarea ? (
                          <button
                            type="button"
                            aria-pressed={entregada}
                            disabled={enCurso}
                            onClick={() =>
                              ejecutar(() =>
                                registrarAsistenciaEscuela(
                                  programId,
                                  sesion.id,
                                  persona.enrollmentId,
                                  presente,
                                  !entregada,
                                ),
                              )
                            }
                            className="opcion px-3 py-2 text-[12px]"
                          >
                            Entregó tarea
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-[12px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
                        {presente ? "asistió" : "sin registrar"}
                        {sesion.tarea && entregada ? " · tarea entregada" : ""}
                      </span>
                    )}
                  </li>
                );
              })}
              {participantes.length === 0 ? (
                <li className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
                  Todavía no hay nadie inscrito.
                </li>
              ) : null}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Crea la primera sesión para armar la programación.
          </p>
        )}

        {puedeEditar ? <NuevaSesion programId={programId} sesiones={sesiones} /> : null}

        {error ? (
          <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
            {error}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-[14px]">
        <section className="tarjeta p-5">
          <h2 className="etiqueta-seccion">PROGRESO</h2>

          <ul className="mt-4 flex flex-col gap-3">
            {participantes.map((persona) => (
              <li key={persona.enrollmentId} className="rounded-[10px] bg-papel p-3">
                <Link
                  href={`/expediente/${persona.learnerId}`}
                  className="text-[13px] leading-none font-semibold text-tinta hover:text-azul-700 hover:underline"
                >
                  {persona.nombre}
                </Link>

                <p className="mt-2 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
                  Asistencia {persona.porcentajeAsistencia} % ({persona.presentes} de{" "}
                  {persona.sesionesRealizadas}) · mínimo {asistenciaMinima} %
                </p>
                {persona.tareasPedidas ? (
                  <p className="mt-1 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
                    Tareas {persona.tareasEntregadas} de {persona.tareasPedidas} ·
                    mínimo {tareasMinimas} %
                  </p>
                ) : null}

                {persona.completado ? (
                  <p className="mt-2 rounded-[8px] bg-verde-100 px-2 py-1 text-[10px] leading-[1.4] font-bold text-verde-700">
                    ESCUELA COMPLETADA · {persona.completado}
                  </p>
                ) : puedeEditar ? (
                  <button
                    type="button"
                    disabled={enCurso || persona.faltaParaCerrar.length > 0}
                    onClick={() =>
                      ejecutar(() => cerrarEscuela(programId, persona.enrollmentId, ""))
                    }
                    className="boton-primario mt-2 px-3 py-2 text-[11.5px]"
                  >
                    Cerrar escuela
                  </button>
                ) : null}

                {!persona.completado && persona.faltaParaCerrar.length ? (
                  <p className="mt-2 text-[11px] leading-[1.4] font-medium text-ambar-texto">
                    Falta: {persona.faltaParaCerrar.join(" y ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {puedeEditar ? <Inscribir programId={programId} /> : null}
        </section>

        <p className="text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
          Cerrar la Escuela exige {asistenciaMinima} % de asistencia sobre las
          sesiones ya realizadas y {tareasMinimas} % de las tareas pedidas. Aun
          cumpliéndose, lo cierra el líder. La fase no cambia: pasar a
          Multiplicar es decisión pastoral.
        </p>
      </div>
    </div>
  );
}

function NuevaSesion({
  programId,
  sesiones,
}: {
  programId: string;
  sesiones: SesionVista[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState("");
  const [tema, setTema] = useState("");
  const [kind, setKind] = useState<TrainingSessionKind>(TrainingSessionKind.VIRTUAL);
  const [recurso, setRecurso] = useState("");
  const [tarea, setTarea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const siguiente = (sesiones.at(-1)?.numero ?? 0) + 1;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton-secundario mt-4"
      >
        + Sesión {siguiente}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-[10px] bg-papel p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
            className="campo"
          />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Modalidad</span>
          <select
            value={kind}
            onChange={(evento) => setKind(evento.target.value as TrainingSessionKind)}
            className="campo"
          >
            <option value={TrainingSessionKind.PRESENCIAL}>Presencial</option>
            <option value={TrainingSessionKind.VIRTUAL}>Virtual</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="etiqueta-campo">Tema</span>
          <input
            value={tema}
            onChange={(evento) => setTema(evento.target.value)}
            placeholder="Carácter y liderazgo"
            className="campo font-medium"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="etiqueta-campo">Material (opcional)</span>
          <input
            value={recurso}
            onChange={(evento) => setRecurso(evento.target.value)}
            placeholder="https://…"
            className="campo font-medium"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="etiqueta-campo">Tarea (opcional)</span>
          <input
            value={tarea}
            onChange={(evento) => setTarea(evento.target.value)}
            placeholder="Escribir la visión personal en una página"
            className="campo font-medium"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const resultado = await crearSesion(
                programId,
                siguiente,
                fecha,
                tema,
                kind,
                recurso,
                tarea,
              );
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setFecha("");
              setTema("");
              setRecurso("");
              setTarea("");
              // La modalidad vuelve al valor por defecto: si no, la siguiente
              // sesión hereda en silencio la anterior.
              setKind(TrainingSessionKind.VIRTUAL);
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario"
        >
          {enCurso ? "Creando…" : `Crear sesión ${siguiente}`}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="boton-secundario">
          Cancelar
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Inscribir({ programId }: { programId: string }) {
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoEscuela[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  return (
    <div className="mt-4 border-t border-[rgba(19,28,36,.09)] pt-4">
      <span className="etiqueta-campo">Inscribir persona</span>
      <div className="mt-2 flex gap-2">
        <input
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Buscar en Fortalecer o Entrenar…"
          className="campo mt-0 flex-1"
        />
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              setCandidatos(await buscarParaEscuela(programId, consulta));
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
                      const resultado = await inscribirEnEscuela(
                        programId,
                        candidato.learnerId,
                      );
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
            Nadie coincide en Fortalecer o Entrenar.
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
