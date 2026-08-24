"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buscarCandidatos,
  crearEInscribir,
  crearSesion,
  desvalidarAlpha,
  inscribir,
  marcarFocusDay,
  registrarAsistencia,
  validarAlpha,
  type CandidatoAlpha,
} from "../acciones";

export type SesionVista = {
  id: string;
  numero: number;
  fecha: string;
  tema: string;
  realizada: boolean;
};

export type ParticipanteVista = {
  enrollmentId: string;
  learnerId: string;
  nombre: string;
  presentes: number;
  sesionesRealizadas: number;
  porcentaje: number;
  cumpleAsistencia: boolean;
  tieneFocusDay: boolean;
  validado: string | null;
  faltaParaValidar: string[];
  asistencia: Record<string, { present: boolean; note: string | null }>;
};

export function Grupo({
  programId,
  sesiones,
  participantes,
  asistenciaMinima,
  puedeEditar,
}: {
  programId: string;
  sesiones: SesionVista[];
  participantes: ParticipanteVista[];
  asistenciaMinima: number;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [sesionActiva, setSesionActiva] = useState<string | null>(
    sesiones.find((s) => s.realizada)?.id ?? sesiones[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  // La sesión guardada puede no existir todavía (al crear la primera) o haber
  // desaparecido: siempre se cae a la última realizada.
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
    <div className="mt-6 grid gap-[14px] lg:grid-cols-[1fr_360px]">
      <section className="tarjeta p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="etiqueta-seccion">ASISTENCIA</h2>
          {sesiones.length ? (
            <div className="flex flex-wrap gap-1">
              {sesiones.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === sesion?.id}
                  onClick={() => setSesionActiva(s.id)}
                  className={`h-7 w-7 rounded-[7px] text-[11.5px] leading-none font-bold ${
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
            <p className="mt-1 text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
              {sesion.fecha}
              {sesion.realizada ? "" : " · todavía no ocurre"}
            </p>

            <ul className="mt-4 flex flex-col gap-2">
              {participantes.map((persona) => {
                const marca = persona.asistencia[sesion.id];
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
                          aria-pressed={marca?.present === true}
                          disabled={enCurso}
                          onClick={() =>
                            ejecutar(() =>
                              registrarAsistencia(
                                programId,
                                sesion.id,
                                persona.enrollmentId,
                                true,
                                marca?.note ?? "",
                              ),
                            )
                          }
                          className="opcion px-3 py-2 text-[12px]"
                        >
                          Asistió
                        </button>
                        <button
                          type="button"
                          aria-pressed={marca?.present === false && marca !== undefined}
                          disabled={enCurso}
                          onClick={() =>
                            ejecutar(() =>
                              registrarAsistencia(
                                programId,
                                sesion.id,
                                persona.enrollmentId,
                                false,
                                marca?.note ?? "",
                              ),
                            )
                          }
                          className="opcion px-3 py-2 text-[12px]"
                        >
                          Faltó
                        </button>
                      </>
                    ) : (
                      <span className="text-[12px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
                        {marca === undefined
                          ? "sin registrar"
                          : marca.present
                            ? "asistió"
                            : "faltó"}
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
            Crea la primera sesión para empezar a registrar asistencia.
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
          <h2 className="etiqueta-seccion">PARTICIPANTES</h2>

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
                  Asistencia {persona.porcentaje} % ({persona.presentes} de{" "}
                  {persona.sesionesRealizadas}) · mínimo {asistenciaMinima} %
                </p>

                {persona.validado ? (
                  <>
                    <p className="mt-2 rounded-[8px] bg-verde-100 px-2 py-1 text-[10px] leading-[1.4] font-bold text-verde-700">
                      ALPHA VALIDADO · {persona.validado}
                    </p>
                    {puedeEditar ? (
                      <DeshacerValidacion
                        programId={programId}
                        enrollmentId={persona.enrollmentId}
                        nombre={persona.nombre}
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {puedeEditar ? (
                      <button
                        type="button"
                        aria-pressed={persona.tieneFocusDay}
                        disabled={enCurso}
                        onClick={() =>
                          ejecutar(() =>
                            marcarFocusDay(
                              programId,
                              persona.enrollmentId,
                              !persona.tieneFocusDay,
                            ),
                          )
                        }
                        className="opcion px-3 py-2 text-[11.5px]"
                      >
                        Focus Day
                      </button>
                    ) : (
                      <span className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
                        Focus Day: {persona.tieneFocusDay ? "sí" : "pendiente"}
                      </span>
                    )}

                    {puedeEditar ? (
                      <button
                        type="button"
                        disabled={enCurso || persona.faltaParaValidar.length > 0}
                        onClick={() =>
                          ejecutar(() =>
                            validarAlpha(programId, persona.enrollmentId, ""),
                          )
                        }
                        className="boton-primario px-3 py-2 text-[11.5px]"
                      >
                        Validar Alpha
                      </button>
                    ) : null}
                  </div>
                )}

                {!persona.validado && persona.faltaParaValidar.length ? (
                  <p className="mt-2 text-[11px] leading-[1.4] font-medium text-ambar-texto">
                    Falta: {persona.faltaParaValidar.join(" y ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {puedeEditar ? <Inscribir programId={programId} /> : null}
        </section>

        <p className="text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
          La validación exige asistencia mínima del {asistenciaMinima} % sobre las
          sesiones ya realizadas y el Focus Day completado. Aun cumpliéndose, la
          emite el líder: el sistema no aprueba a nadie por su cuenta.
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
          <span className="etiqueta-campo">Tema</span>
          <input
            value={tema}
            onChange={(evento) => setTema(evento.target.value)}
            placeholder="¿Quién es Jesús?"
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
              const resultado = await crearSesion(programId, siguiente, fecha, tema);
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setFecha("");
              setTema("");
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario"
        >
          {enCurso ? "Creando…" : `Crear sesión ${siguiente}`}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton-secundario"
        >
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

/// Deshacer una validación no es una acción de un clic: pide el motivo y lo
/// confirma. Se emitió a mano, se retira a mano, y queda dicho por qué.
function DeshacerValidacion({
  programId,
  enrollmentId,
  nombre,
}: {
  programId: string;
  enrollmentId: string;
  nombre: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[11px] leading-none font-semibold text-[rgba(19,28,36,.5)] underline hover:text-rojo"
      >
        Deshacer validación
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white p-3">
      <label className="block">
        <span className="etiqueta-campo">
          ¿Por qué se deshace la validación de {nombre}?
        </span>
        <input
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Se validó por error"
          className="campo font-medium"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={enCurso || !motivo.trim()}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const resultado = await desvalidarAlpha(
                programId,
                enrollmentId,
                motivo,
              );
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setMotivo("");
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario px-3 py-2 text-[11.5px]"
        >
          {enCurso ? "Deshaciendo…" : "Deshacer"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          className="boton-secundario px-3 py-2 text-[11.5px]"
        >
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
  const [candidatos, setCandidatos] = useState<CandidatoAlpha[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  return (
    <div className="mt-4 border-t border-[rgba(19,28,36,.09)] pt-4">
      <span className="etiqueta-campo">Inscribir persona</span>
      <div className="mt-2 flex gap-2">
        <input
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          placeholder="Buscar por nombre…"
          className="campo mt-0 flex-1"
        />
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              setCandidatos(await buscarCandidatos(programId, consulta));
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
                      const resultado = await inscribir(
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
                    {candidato.telefono ? ` · ${candidato.telefono}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
            Nadie coincide. Si es alguien nuevo, agrégalo abajo.
          </p>
        )
      ) : null}

      <AltaRapida programId={programId} />

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/// A un Alpha llega gente de la que no se sabe casi nada. Pedir un registro
/// completo antes de anotarla hace que no se anote a nadie: con el nombre
/// basta, y el teléfono evita duplicarla.
function AltaRapida({ programId }: { programId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton-secundario mt-3 w-full justify-center py-[9px] text-[11.5px]"
      >
        + Alguien nuevo
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-[10px] bg-papel p-3">
      <label className="block">
        <span className="etiqueta-campo">Nombre</span>
        <input
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          placeholder="Como se presentó"
          className="campo font-medium"
        />
      </label>
      <label className="mt-2 block">
        <span className="etiqueta-campo">
          Teléfono{" "}
          <span className="font-medium text-[rgba(19,28,36,.4)]">si lo dio</span>
        </span>
        <input
          value={telefono}
          onChange={(evento) => setTelefono(evento.target.value)}
          inputMode="tel"
          placeholder="+57 300 412 4412"
          className="campo font-medium"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const resultado = await crearEInscribir(programId, nombre, telefono);
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setNombre("");
              setTelefono("");
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario flex-1 justify-center py-[9px] text-[11.5px]"
        >
          {enCurso ? "Agregando…" : "Agregar al grupo"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton-secundario py-[9px] text-[11.5px]"
        >
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
