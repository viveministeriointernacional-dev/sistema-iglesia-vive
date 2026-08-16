"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearGrupo } from "./acciones";

export function NuevoGrupo() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [inicio, setInicio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton-primario"
      >
        + Nuevo grupo
      </button>
    );
  }

  return (
    <div className="tarjeta max-w-[560px] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">Nombre del grupo</span>
          <input
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Alpha marzo · Equipo 12 Norte"
            className="campo"
          />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Primera sesión</span>
          <input
            type="date"
            value={inicio}
            onChange={(evento) => setInicio(evento.target.value)}
            className="campo"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const resultado = await crearGrupo(nombre, inicio);
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setNombre("");
              setInicio("");
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario"
        >
          {enCurso ? "Creando…" : "Crear grupo"}
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
