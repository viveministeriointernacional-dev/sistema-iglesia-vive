"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CamposDeReunion } from "@/components/campos-de-reunion";
import { REUNION_VACIA, type DatosDeReunion } from "@/lib/reunion-catalogo";
import { crearCasaDeFe } from "./acciones";
import { ROTULOS, type TipoDeGrupo } from "@/lib/tipo-de-grupo";

export type LiderPosible = { id: string; fullName: string; role: string };

/// **Abre un grupo de los tres que viven en `faith_house_group`.** El
/// formulario es el mismo para los tres —nombre, primer encuentro, quién lo
/// lleva y la reunión—; lo único que cambia son los rótulos, que salen del
/// catálogo. Un formulario por tipo habría sido la misma pantalla copiada tres
/// veces, con sus tres validaciones que se van separando sin que nadie lo vea.
export function NuevaCasaDeFe({
  tipo,
  lideres,
  hoy,
}: {
  tipo: TipoDeGrupo;
  lideres: LiderPosible[];
  hoy: string;
}) {
  const r = ROTULOS[tipo];
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [inicio, setInicio] = useState("");
  const [liderId, setLiderId] = useState("");
  const [reunion, setReunion] = useState<DatosDeReunion>(REUNION_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="boton-primario"
      >
        {r.botonNuevo}
      </button>
    );
  }

  return (
    <div className="tarjeta max-w-[640px] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">Nombre {r.articulo === "la" ? "de la" : "del"} {r.singular}</span>
          <input
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder={r.ejemploDeNombre}
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
          <span className="etiqueta-campo">¿Quién {r.articulo === "la" ? "la" : "lo"} lleva?</span>
          <select
            value={liderId}
            onChange={(evento) => setLiderId(evento.target.value)}
            className="campo"
          >
            <option value="">Elige a quien {r.articulo === "la" ? "la" : "lo"} lleva…</option>
            {lideres.map((lider) => (
              <option key={lider.id} value={lider.id}>
                {lider.fullName}
              </option>
            ))}
          </select>
        </label>
        <CamposDeReunion
          nombre={nombre}
          valores={reunion}
          onChange={(parcial) => setReunion((v) => ({ ...v, ...parcial }))}
          inicio={inicio}
          hoy={hoy}
        />
      </div>

      {lideres.length === 0 ? (
        <p className="mt-3 text-[11.5px] leading-[1.5] font-medium text-ambar-texto">
          Todavía nadie tiene el permiso de liderar Casa de Fe. Habilítalo desde
          administración o desde Mi red y vuelve. Es el mismo permiso para los
          tres tipos de grupo.
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={enCurso}
          onClick={() => {
            setError(null);
            iniciar(async () => {
              const resultado = await crearCasaDeFe(tipo, nombre, inicio, liderId, reunion);
              if (!resultado.ok) {
                setError(resultado.mensaje);
                return;
              }
              setNombre("");
              setInicio("");
              setLiderId("");
              setReunion(REUNION_VACIA);
              setAbierto(false);
              router.refresh();
            });
          }}
          className="boton-primario"
        >
          {enCurso ? "Creando…" : `Crear ${r.articulo === "la" ? "la" : "el"} ${r.singular}`}
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
