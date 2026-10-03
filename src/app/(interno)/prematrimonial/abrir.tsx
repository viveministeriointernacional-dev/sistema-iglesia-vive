"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  abrirPareja,
  buscarCandidatosPrematrimonial,
  type CandidatoPrematrimonial,
  type PastorPosible,
} from "./acciones";

type Elegida = { learnerId: string; nombre: string } | null;

/// Abrir un prematrimonial: se buscan las dos personas y se elige quién las
/// acompaña.
///
/// ⚠️ **Las dos tienen que tener ficha** (decisión del usuario, 3-oct-2026).
/// Si alguna no la tiene, se le crea antes desde «Registrar persona» — así
/// cada uno tiene su código y su expediente, que es lo que hace que el taller
/// se le pueda atribuir a él y no a la pareja.
export function AbrirPrematrimonial({ pastores }: { pastores: PastorPosible[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [a, setA] = useState<Elegida>(null);
  const [b, setB] = useState<Elegida>(null);
  const [pastor, setPastor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function guardar() {
    if (!a || !b) return;
    setError(null);
    iniciar(async () => {
      const r = await abrirPareja(a.learnerId, b.learnerId, pastor || null);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      setA(null);
      setB(null);
      setPastor("");
      setAbierto(false);
      router.refresh();
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="cursor-pointer rounded-[9px] bg-tinta px-4 py-2.5 text-[12.5px] font-semibold text-white"
      >
        Abrir un prematrimonial
      </button>
    );
  }

  return (
    <section className="tarjeta mt-4 p-5">
      <h2 className="etiqueta-seccion">ABRIR UN PREMATRIMONIAL</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Buscar titulo="Él" elegida={a} otra={b} onElegir={setA} />
        <Buscar titulo="Ella" elegida={b} otra={a} onElegir={setB} />
      </div>

      <div className="mt-4">
        <label htmlFor="pastor" className="etiqueta-campo">
          Quién los acompaña
        </label>
        <select
          id="pastor"
          value={pastor}
          onChange={(e) => setPastor(e.target.value)}
          className="mt-1.5 w-full rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white px-3 py-2.5 text-[13px]"
        >
          <option value="">Yo</option>
          {pastores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={!a || !b || enCurso}
          onClick={guardar}
          className="cursor-pointer rounded-[9px] bg-tinta px-4 py-2.5 text-[12.5px] font-semibold text-white disabled:opacity-45"
        >
          {enCurso ? "Abriendo…" : "Abrir"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="cursor-pointer rounded-[9px] border border-[rgba(19,28,36,.16)] bg-white px-4 py-2.5 text-[12.5px] font-semibold"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}

function Buscar({
  titulo,
  elegida,
  otra,
  onElegir,
}: {
  titulo: string;
  elegida: Elegida;
  otra: Elegida;
  onElegir: (v: Elegida) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [candidatos, setCandidatos] = useState<CandidatoPrematrimonial[] | null>(null);
  const [buscando, iniciar] = useTransition();

  if (elegida) {
    return (
      <div className="rounded-[10px] border border-[rgba(19,28,36,.16)] bg-papel p-3">
        <p className="etiqueta-campo">{titulo}</p>
        <p className="mt-1 text-[13.5px] font-semibold">{elegida.nombre}</p>
        <button
          type="button"
          onClick={() => onElegir(null)}
          className="mt-1.5 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold text-[rgba(19,28,36,.5)] underline"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[rgba(19,28,36,.16)] p-3">
      <label className="etiqueta-campo" htmlFor={`buscar-${titulo}`}>
        {titulo}
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={`buscar-${titulo}`}
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Nombre"
          className="min-w-0 flex-1 rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white px-3 py-2 text-[13px]"
        />
        <button
          type="button"
          disabled={buscando}
          onClick={() =>
            iniciar(async () => setCandidatos(await buscarCandidatosPrematrimonial(consulta)))
          }
          className="cursor-pointer rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white px-3 py-2 text-[12px] font-semibold"
        >
          Buscar
        </button>
      </div>

      {candidatos ? (
        candidatos.length ? (
          <ul className="mt-2 flex flex-col gap-1">
            {candidatos.map((c) => {
              const esLaOtra = otra?.learnerId === c.learnerId;
              const bloqueada = c.yaEnOtro || esLaOtra;
              return (
                <li key={c.learnerId}>
                  <button
                    type="button"
                    disabled={bloqueada}
                    onClick={() => {
                      onElegir({ learnerId: c.learnerId, nombre: c.nombre });
                      setCandidatos(null);
                      setConsulta("");
                    }}
                    className="w-full rounded-[8px] border border-[rgba(19,28,36,.16)] bg-white p-2 text-left text-[12.5px] font-semibold disabled:opacity-50"
                  >
                    {c.nombre}
                    <span className="ml-2 text-[11px] font-semibold text-[rgba(19,28,36,.45)]">
                      {esLaOtra
                        ? "ya la elegiste arriba"
                        : c.yaEnOtro
                          ? "ya está en otro prematrimonial"
                          : (c.telefono ?? "")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
            Nadie coincide. Si todavía no tiene ficha, créasela en «Registrar
            persona».
          </p>
        )
      ) : null}
    </div>
  );
}
