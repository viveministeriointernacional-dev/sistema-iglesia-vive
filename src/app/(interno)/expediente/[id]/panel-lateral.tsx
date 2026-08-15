"use client";

import { useState, useTransition } from "react";
import { MilestoneKind } from "@iglesia/prisma-client";
import {
  agregarNota,
  registrarHito,
  revelarNotas,
  type NotaPastoral,
} from "./acciones";

const HITOS_DISPONIBLES: { valor: MilestoneKind; etiqueta: string }[] = [
  { valor: MilestoneKind.ALPHA, etiqueta: "Alpha" },
  { valor: MilestoneKind.FOCUS_DAY, etiqueta: "Focus Day" },
  { valor: MilestoneKind.ENCUENTRO, etiqueta: "Encuentro" },
  { valor: MilestoneKind.BAUTISMO, etiqueta: "Bautismo" },
  { valor: MilestoneKind.SERVICIO, etiqueta: "Servicio" },
];

/// Notas pastorales: ocultas hasta que alguien las pide, y cada apertura queda
/// auditada. El aprendiz nunca ve este bloque.
export function NotasPastorales({
  learnerId,
  cantidad,
  puedeEscribir,
}: {
  learnerId: string;
  cantidad: number;
  puedeEscribir: boolean;
}) {
  const [notas, setNotas] = useState<NotaPastoral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [cuerpo, setCuerpo] = useState("");
  const [tipo, setTipo] = useState("mentoría");
  const [enCurso, iniciar] = useTransition();

  function alternar() {
    if (notas) {
      setNotas(null);
      return;
    }
    setError(null);
    iniciar(async () => {
      const resultado = await revelarNotas(learnerId);
      if (resultado.ok) setNotas(resultado.notas);
      else setError(resultado.mensaje);
    });
  }

  function guardar() {
    setError(null);
    iniciar(async () => {
      const resultado = await agregarNota(learnerId, tipo, cuerpo);
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setCuerpo("");
      setEscribiendo(false);
      const refrescadas = await revelarNotas(learnerId);
      if (refrescadas.ok) setNotas(refrescadas.notas);
    });
  }

  return (
    <section className="rounded-[12px] bg-azul-900 p-4 text-white">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" aria-hidden="true">
            <path
              d="M6 11V8a6 6 0 0 1 12 0v3"
              fill="none"
              stroke="#cfe3bc"
              strokeWidth="1.8"
            />
            <rect
              x="4.5"
              y="11"
              width="15"
              height="9.5"
              rx="2.5"
              fill="none"
              stroke="#cfe3bc"
              strokeWidth="1.8"
            />
          </svg>
          <h2 className="text-[9.5px] leading-none font-bold tracking-[.14em] text-savia">
            NOTAS PASTORALES · {cantidad}
          </h2>
        </div>
        <button
          type="button"
          onClick={alternar}
          disabled={enCurso}
          className="cursor-pointer rounded-[7px] border-0 bg-white/[.16] px-[11px] py-2 text-[11.5px] leading-none font-semibold text-white disabled:opacity-60"
        >
          {enCurso ? "…" : notas ? "Ocultar" : `Revelar (${cantidad})`}
        </button>
      </header>

      {notas ? (
        notas.length ? (
          <ul className="mt-3 flex flex-col gap-[9px]">
            {notas.map((nota) => (
              <li key={nota.id} className="rounded-[10px] bg-white/[.08] p-[13px]">
                <p className="text-[11px] leading-none font-semibold text-white/50">
                  {nota.fecha} · {nota.autor} · {nota.tipo}
                </p>
                <p className="mt-2 text-[12px] leading-[1.55] font-medium text-white/90">
                  {nota.cuerpo}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12px] leading-[1.5] font-medium text-white/60">
            Todavía no hay notas escritas.
          </p>
        )
      ) : (
        <div className="mt-3 flex flex-col gap-2" aria-hidden="true">
          <div className="h-6 rounded-[7px] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.18)_0_9px,rgba(255,255,255,.06)_9px_15px)]" />
          <div className="h-6 rounded-[7px] bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.18)_0_9px,rgba(255,255,255,.06)_9px_15px)]" />
        </div>
      )}

      {puedeEscribir ? (
        escribiendo ? (
          <div className="mt-3 rounded-[10px] bg-white/[.08] p-3">
            <label className="block">
              <span className="text-[10px] leading-none font-bold tracking-[.12em] text-white/50">
                TIPO
              </span>
              <input
                value={tipo}
                onChange={(evento) => setTipo(evento.target.value)}
                className="mt-2 w-full rounded-[8px] border-0 bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-white outline-none placeholder:text-white/40"
                placeholder="mentoría, evaluación…"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-[10px] leading-none font-bold tracking-[.12em] text-white/50">
                NOTA
              </span>
              <textarea
                value={cuerpo}
                onChange={(evento) => setCuerpo(evento.target.value)}
                rows={4}
                className="mt-2 w-full resize-y rounded-[8px] border-0 bg-white/10 px-3 py-2 text-[12.5px] leading-[1.5] font-medium text-white outline-none placeholder:text-white/40"
                placeholder="Lo que necesita saber quien la acompañe después."
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={guardar}
                disabled={enCurso}
                className="cursor-pointer rounded-[8px] border-0 bg-savia px-3 py-2 text-[12px] leading-none font-bold text-bosque-900 disabled:opacity-60"
              >
                {enCurso ? "Guardando…" : "Guardar nota"}
              </button>
              <button
                type="button"
                onClick={() => setEscribiendo(false)}
                className="cursor-pointer rounded-[8px] border-0 bg-white/10 px-3 py-2 text-[12px] leading-none font-semibold text-white/80"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEscribiendo(true)}
            className="mt-3 w-full cursor-pointer rounded-[8px] border border-white/20 bg-transparent p-[10px] text-[12px] leading-none font-semibold text-white"
          >
            Añadir nota pastoral
          </button>
        )
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-savia">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-[11.5px] leading-[1.5] font-medium text-white/50">
        Privadas frente al aprendiz. Visibles para su mentor, su consolidador y el
        líder responsable de la línea. Cada apertura queda auditada.
      </p>
    </section>
  );
}

/// Marcar un hito deja fecha y responsable. Los hitos que dependen de autoridad
/// pastoral no están en esta lista.
export function RegistrarHito({ learnerId }: { learnerId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<MilestoneKind>(MilestoneKind.ENCUENTRO);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function guardar() {
    setError(null);
    iniciar(async () => {
      const resultado = await registrarHito(learnerId, kind, detalle);
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setDetalle("");
      setAbierto(false);
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="cursor-pointer rounded-[10px] border border-[rgba(19,28,36,.16)] bg-transparent p-3 text-center text-[12.5px] leading-none font-semibold text-tinta"
      >
        Registrar hito
      </button>
    );
  }

  return (
    <div className="tarjeta p-4">
      <label className="block">
        <span className="etiqueta-campo">Hito</span>
        <select
          value={kind}
          onChange={(evento) => setKind(evento.target.value as MilestoneKind)}
          className="campo"
        >
          {HITOS_DISPONIBLES.map((hito) => (
            <option key={hito.valor} value={hito.valor}>
              {hito.etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="etiqueta-campo">Detalle</span>
        <input
          value={detalle}
          onChange={(evento) => setDetalle(evento.target.value)}
          placeholder="Retiro de febrero"
          className="campo font-medium"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={enCurso}
          className="boton-primario"
        >
          {enCurso ? "Guardando…" : "Marcar como completado"}
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
