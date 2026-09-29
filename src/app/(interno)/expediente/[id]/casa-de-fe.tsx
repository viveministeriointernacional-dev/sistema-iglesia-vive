"use client";

import { useState, useTransition } from "react";
import { FaithHouseStatus } from "@iglesia/prisma-client";
import { actualizarTema, type TemaCasaDeFe } from "./acciones";

const ESTADOS: { valor: FaithHouseStatus; etiqueta: string }[] = [
  { valor: FaithHouseStatus.PENDIENTE, etiqueta: "Pendiente" },
  { valor: FaithHouseStatus.EN_PROCESO, etiqueta: "En proceso" },
  { valor: FaithHouseStatus.COMPLETADO, etiqueta: "Completado" },
  { valor: FaithHouseStatus.REQUIERE_SEGUIMIENTO, etiqueta: "Requiere seguimiento" },
];

const ESTILO_TEMA: Record<FaithHouseStatus, string> = {
  COMPLETADO: "bg-verde-100 text-tinta",
  EN_PROCESO: "border-[1.5px] border-verde-500 bg-white text-tinta",
  REQUIERE_SEGUIMIENTO: "bg-ambar-fondo text-ambar-texto",
  PENDIENTE: "bg-[rgba(19,28,36,.045)] text-[rgba(19,28,36,.45)]",
};

/// Los 12 temas. El orden lo decide el mentor: la rejilla solo los numera, no
/// obliga a seguirlos en secuencia (ESPECIFICACION_PRODUCTO.md §6.2).
export function CasaDeFe({
  learnerId,
  temas,
  puedeEditar,
}: {
  learnerId: string;
  temas: TemaCasaDeFe[];
  puedeEditar: boolean;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const seleccionado = temas.find((tema) => tema.topicId === abierto) ?? null;
  const [borrador, setBorrador] = useState<TemaCasaDeFe | null>(null);
  const tema = borrador?.topicId === abierto ? borrador : seleccionado;

  function abrir(topicId: string) {
    setError(null);
    if (abierto === topicId) {
      setAbierto(null);
      setBorrador(null);
      return;
    }
    setAbierto(topicId);
    setBorrador(temas.find((t) => t.topicId === topicId) ?? null);
  }

  function cambiar<C extends keyof TemaCasaDeFe>(campo: C, valor: TemaCasaDeFe[C]) {
    setBorrador((previo) => (previo ? { ...previo, [campo]: valor } : previo));
  }

  function guardar() {
    if (!tema) return;
    setError(null);
    iniciar(async () => {
      const resultado = await actualizarTema(learnerId, tema.topicId, {
        status: tema.status,
        assessment: tema.assessment ?? "",
        notes: tema.notes ?? "",
        task: tema.task ?? "",
        evidence: tema.evidence ?? "",
      });
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setAbierto(null);
      setBorrador(null);
    });
  }

  return (
    <>
      <ul className="mt-[14px] grid grid-cols-2 gap-[7px] text-[11.5px] leading-[1.2] font-semibold sm:grid-cols-3">
        {temas.map((tema) => {
          const contenido = `${tema.numero} ${tema.nombre}`;
          const clase = `w-full rounded-[8px] p-[10px] text-left ${ESTILO_TEMA[tema.status]}`;
          return (
            <li key={tema.topicId}>
              {puedeEditar ? (
                <button
                  type="button"
                  onClick={() => abrir(tema.topicId)}
                  aria-expanded={abierto === tema.topicId}
                  className={`${clase} cursor-pointer`}
                >
                  {contenido}
                </button>
              ) : (
                <span className={`block ${clase}`}>{contenido}</span>
              )}
            </li>
          );
        })}
      </ul>

      {puedeEditar && tema ? (
        <div className="mt-4 rounded-[12px] bg-papel p-4">
          <h3 className="font-serif text-[18px] leading-[1.25] font-normal text-tinta">
            Tema {tema.numero} · {tema.nombre}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            {ESTADOS.map((estado) => (
              <button
                key={estado.valor}
                type="button"
                aria-pressed={tema.status === estado.valor}
                onClick={() => cambiar("status", estado.valor)}
                className="opcion px-3 py-2 text-[12px]"
              >
                {estado.etiqueta}
              </button>
            ))}
          </div>

          {tema.taller && tema.taller.respuestas.length > 0 ? (
            <section className="mt-4 rounded-[9px] border border-[rgba(19,28,36,.14)] bg-[rgba(19,28,36,.025)] p-3.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[10.5px] font-bold tracking-[0.12em] text-[rgba(19,28,36,.45)] uppercase">
                  Lo que respondió en el taller
                </span>
                {tema.taller.enviadoEl ? (
                  <span className="text-[11.5px] text-[rgba(19,28,36,.5)]">
                    lo envió desde el QR el {tema.taller.enviadoEl}
                  </span>
                ) : (
                  <span className="text-[11.5px] text-[#8a5a12]">
                    lo está llenando, todavía no lo envía
                  </span>
                )}
              </div>

              {tema.taller.estado === "DEVUELTO" && tema.taller.notaDeLaRevision ? (
                <p className="mt-2 rounded border border-[#e0b4ac] bg-[#fdf1ee] px-2.5 py-2 text-[11.5px] leading-[1.45] text-[#8a3226]">
                  Se lo devolvieron: {tema.taller.notaDeLaRevision}
                </p>
              ) : null}

              <ol className="mt-3 space-y-2.5">
                {tema.taller.respuestas.map((r) => (
                  <li key={r.numero}>
                    <p className="text-[11.5px] font-semibold text-[rgba(19,28,36,.45)]">
                      {r.numero}) {r.enunciado}
                    </p>
                    {r.elegida ? (
                      <p className="mt-1 text-[12.5px] font-semibold text-tinta">
                        {r.elegida}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12.5px] leading-[1.55] whitespace-pre-line text-[rgba(19,28,36,.8)]">
                        {r.texto?.trim() || "—"}
                      </p>
                    )}
                  </li>
                ))}
              </ol>

              <p className="mt-3 text-[11px] leading-[1.45] text-[rgba(19,28,36,.5)]">
                Esto lo escribió la persona: no es una nota pastoral. Tu
                evaluación y tus notas siguen siendo privadas.
              </p>
            </section>
          ) : null}

          <label className="mt-4 block">
            <span className="etiqueta-campo">Evaluación breve</span>
            <input
              value={tema.assessment ?? ""}
              onChange={(evento) => cambiar("assessment", evento.target.value)}
              placeholder="Qué se vio en este tema"
              className="campo font-medium"
            />
          </label>

          <label className="mt-3 block">
            <span className="etiqueta-campo">Tarea o práctica</span>
            <input
              value={tema.task ?? ""}
              onChange={(evento) => cambiar("task", evento.target.value)}
              placeholder="Lo acordado para la semana"
              className="campo font-medium"
            />
          </label>

          <label className="mt-3 block">
            <span className="etiqueta-campo">Evidencia</span>
            <input
              value={tema.evidence ?? ""}
              onChange={(evento) => cambiar("evidence", evento.target.value)}
              placeholder="Cuando corresponda"
              className="campo font-medium"
            />
          </label>

          <label className="mt-3 block">
            <span className="etiqueta-campo">Nota privada</span>
            <textarea
              value={tema.notes ?? ""}
              onChange={(evento) => cambiar("notes", evento.target.value)}
              rows={3}
              placeholder="No se muestra al aprendiz"
              className="campo resize-y font-medium"
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={enCurso}
              className="boton-primario"
            >
              {enCurso ? "Guardando…" : "Guardar tema"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(null);
                setBorrador(null);
              }}
              className="boton-secundario"
            >
              Cerrar
            </button>
            {tema.registradoPor ? (
              <span className="text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.45)]">
                Último registro: {tema.registradoPor}
              </span>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
