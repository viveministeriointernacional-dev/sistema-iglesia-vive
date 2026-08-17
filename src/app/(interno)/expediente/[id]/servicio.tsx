"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ServiceStatus } from "@iglesia/prisma-client";
import {
  cambiarEstadoDeServicio,
  registrarServicio,
} from "@/app/(interno)/escuela/acciones";

export type ServicioVista = {
  id: string;
  ministerio: string;
  status: ServiceStatus;
  desde: string;
  hasta: string | null;
  responsable: string | null;
  observaciones: string | null;
  evidencia: string | null;
};

const ESTADOS: { valor: ServiceStatus; etiqueta: string }[] = [
  { valor: ServiceStatus.PROPUESTO, etiqueta: "Propuesto" },
  { valor: ServiceStatus.ACTIVO, etiqueta: "Sirviendo" },
  { valor: ServiceStatus.PAUSADO, etiqueta: "En pausa" },
  { valor: ServiceStatus.FINALIZADO, etiqueta: "Finalizado" },
];

/// Servicio en ministerios (§7.4). Solo lo ven y lo editan quienes acompañan:
/// el bloque no se renderiza para el aprendiz.
export function Servicio({
  learnerId,
  servicios,
  puedeEditar,
}: {
  learnerId: string;
  servicios: ServicioVista[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ministerio, setMinisterio] = useState("");
  const [inicio, setInicio] = useState("");
  const [estado, setEstado] = useState<ServiceStatus>(ServiceStatus.PROPUESTO);
  const [observaciones, setObservaciones] = useState("");
  const [evidencia, setEvidencia] = useState("");
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

  return (
    <section className="mt-3 rounded-[12px] bg-papel p-4">
      <h2 className="text-[9.5px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
        SERVICIO
      </h2>

      <ul className="mt-3 flex flex-col gap-[10px]">
        {servicios.map((servicio) => (
          <li key={servicio.id} className="rounded-[10px] bg-white p-3">
            <p className="text-[12.5px] leading-[1.3] font-semibold text-tinta">
              {servicio.ministerio}
            </p>
            <p className="mt-1 text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
              Desde {servicio.desde}
              {servicio.hasta ? ` · hasta ${servicio.hasta}` : ""}
              {servicio.responsable ? ` · ${servicio.responsable}` : ""}
            </p>
            {servicio.observaciones ? (
              <p className="mt-2 text-[11.5px] leading-[1.45] font-medium text-tinta">
                {servicio.observaciones}
              </p>
            ) : null}
            {servicio.evidencia ? (
              <p className="mt-1 text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
                Evidencia: {servicio.evidencia}
              </p>
            ) : null}

            {puedeEditar ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {ESTADOS.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    aria-pressed={servicio.status === opcion.valor}
                    disabled={enCurso}
                    onClick={() =>
                      ejecutar(() =>
                        cambiarEstadoDeServicio(servicio.id, opcion.valor),
                      )
                    }
                    className="opcion px-[10px] py-[7px] text-[11px]"
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
                {ESTADOS.find((e) => e.valor === servicio.status)?.etiqueta}
              </p>
            )}
          </li>
        ))}
        {servicios.length === 0 ? (
          <li className="text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Todavía no sirve en ningún ministerio.
          </li>
        ) : null}
      </ul>

      {puedeEditar ? (
        abierto ? (
          <div className="mt-3 flex flex-col gap-3">
            <label className="block">
              <span className="etiqueta-campo">Ministerio</span>
              <input
                value={ministerio}
                onChange={(evento) => setMinisterio(evento.target.value)}
                placeholder="Alabanza, niños, logística…"
                className="campo font-medium"
              />
            </label>
            <label className="block">
              <span className="etiqueta-campo">Desde</span>
              <input
                type="date"
                value={inicio}
                onChange={(evento) => setInicio(evento.target.value)}
                className="campo"
              />
            </label>
            <label className="block">
              <span className="etiqueta-campo">Estado</span>
              <select
                value={estado}
                onChange={(evento) => setEstado(evento.target.value as ServiceStatus)}
                className="campo"
              >
                {ESTADOS.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="etiqueta-campo">Observaciones</span>
              <textarea
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                rows={2}
                className="campo font-medium"
              />
            </label>
            <label className="block">
              <span className="etiqueta-campo">Evidencia</span>
              <input
                value={evidencia}
                onChange={(evento) => setEvidencia(evento.target.value)}
                placeholder="Enlace o descripción"
                className="campo font-medium"
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={enCurso}
                onClick={() =>
                  ejecutar(async () => {
                    const resultado = await registrarServicio(learnerId, {
                      ministerio,
                      inicio,
                      estado,
                      observaciones,
                      evidencia,
                    });
                    if (resultado.ok) {
                      setMinisterio("");
                      setInicio("");
                      setObservaciones("");
                      setEvidencia("");
                      setAbierto(false);
                    }
                    return resultado;
                  })
                }
                className="boton-primario"
              >
                {enCurso ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="boton-secundario"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="boton-secundario mt-3"
          >
            + Registrar servicio
          </button>
        )
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </section>
  );
}
