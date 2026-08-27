"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearCasaDeFe } from "./acciones";

export type LiderPosible = { id: string; fullName: string; role: string };

export function NuevaCasaDeFe({ lideres }: { lideres: LiderPosible[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [inicio, setInicio] = useState("");
  const [liderId, setLiderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton-primario"
      >
        + Nueva Casa de Fe
      </button>
    );
  }

  return (
    <div className="tarjeta max-w-[560px] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">Nombre de la Casa de Fe</span>
          <input
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Casa de Fe · Familia Pérez"
            className="campo"
          />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Primer encuentro</span>
          <input
            type="date"
            value={inicio}
            onChange={(evento) => setInicio(evento.target.value)}
            className="campo"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="etiqueta-campo">¿Quién la lleva?</span>
          <select
            value={liderId}
            onChange={(evento) => setLiderId(evento.target.value)}
            className="campo"
          >
            <option value="">Elige a quien la lleva…</option>
            {lideres.map((lider) => (
              <option key={lider.id} value={lider.id}>
                {lider.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {lideres.length === 0 ? (
        <p className="mt-3 text-[11.5px] leading-[1.5] font-medium text-ambar-texto">
          Todavía nadie tiene el permiso de liderar Casa de Fe. Habilítalo desde
          administración o desde Mi red y vuelve.
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const resultado = await crearCasaDeFe(nombre, inicio, liderId);
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setNombre("");
              setInicio("");
              setLiderId("");
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario"
        >
          {enCurso ? "Creando…" : "Crear Casa de Fe"}
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
