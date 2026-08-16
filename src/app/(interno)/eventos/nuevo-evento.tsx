"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EventKind, Phase } from "@iglesia/prisma-client";
import { crearEvento } from "./acciones";

const TIPOS: { valor: EventKind; etiqueta: string }[] = [
  { valor: EventKind.ENCUENTRO, etiqueta: "Encuentro" },
  { valor: EventKind.BAUTISMO, etiqueta: "Bautismo" },
  { valor: EventKind.SERVICIO, etiqueta: "Servicio" },
  { valor: EventKind.FOCUS_DAY, etiqueta: "Focus Day" },
  { valor: EventKind.CUMBRE, etiqueta: "Cumbre" },
  { valor: EventKind.ESCUELA, etiqueta: "Escuela Ser Líder" },
  { valor: EventKind.TALLER, etiqueta: "Taller" },
  { valor: EventKind.REUNION, etiqueta: "Reunión" },
  { valor: EventKind.ACTIVIDAD, etiqueta: "Actividad" },
];

const FASES = [Phase.GANAR, Phase.FORTALECER, Phase.ENTRENAR, Phase.MULTIPLICAR];

export function NuevoEvento() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [kind, setKind] = useState<EventKind>(EventKind.ENCUENTRO);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  const [lugar, setLugar] = useState("");
  const [cupo, setCupo] = useState("");
  const [fases, setFases] = useState<Phase[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="boton-primario">
        + Nuevo evento
      </button>
    );
  }

  return (
    <div className="tarjeta max-w-[720px] p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">Tipo</span>
          <select
            value={kind}
            onChange={(evento) => setKind(evento.target.value as EventKind)}
            className="campo"
          >
            {TIPOS.map((tipo) => (
              <option key={tipo.valor} value={tipo.valor}>
                {tipo.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="etiqueta-campo">Nombre</span>
          <input
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            placeholder="Encuentro de septiembre"
            className="campo"
          />
        </label>

        <label className="block">
          <span className="etiqueta-campo">Fecha y hora</span>
          <input
            type="datetime-local"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
            className="campo"
          />
        </label>

        <label className="block">
          <span className="etiqueta-campo">Lugar</span>
          <input
            value={lugar}
            onChange={(evento) => setLugar(evento.target.value)}
            placeholder="Sede principal"
            className="campo"
          />
        </label>

        <label className="block">
          <span className="etiqueta-campo">Cupo (opcional)</span>
          <input
            inputMode="numeric"
            value={cupo}
            onChange={(evento) => setCupo(evento.target.value)}
            placeholder="sin límite"
            className="campo"
          />
        </label>

        <div className="block">
          <span className="etiqueta-campo">Dirigido a</span>
          <div className="mt-2 flex flex-wrap gap-[6px]">
            {FASES.map((fase) => (
              <button
                key={fase}
                type="button"
                aria-pressed={fases.includes(fase)}
                onClick={() =>
                  setFases((actuales) =>
                    actuales.includes(fase)
                      ? actuales.filter((f) => f !== fase)
                      : [...actuales, fase],
                  )
                }
                className="opcion px-3 py-2 text-[11.5px]"
              >
                {fase}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.45)]">
            {fases.length ? "Solo esas fases" : "Sin marcar nada: toda la iglesia"}
          </p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="etiqueta-campo">Descripción (opcional)</span>
        <textarea
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
          rows={2}
          className="campo font-medium"
        />
      </label>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const resultado = await crearEvento({
                kind,
                titulo,
                fecha,
                lugar,
                cupo,
                fases,
                descripcion,
              });
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setTitulo("");
              setFecha("");
              setLugar("");
              setCupo("");
              setFases([]);
              setDescripcion("");
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario"
        >
          {enCurso ? "Creando…" : "Crear evento"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="boton-secundario">
          Cancelar
        </button>
      </div>

      <p className="mt-3 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.45)]">
        El evento nace sin publicar: se publica cuando esté listo, y solo
        entonces lo ve el aprendiz.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}
