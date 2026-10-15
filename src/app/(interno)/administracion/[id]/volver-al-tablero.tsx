"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DESTINOS_REASIGNABLES, ETIQUETA_COLUMNA } from "@/lib/op72";
import { devolverAlTablero } from "../acciones";

/// Devolver al tablero de Operación 72 a quien volvió después de una baja.
///
/// ⚠️ **Esta sección NO se pinta siempre**: la página solo la muestra cuando la
/// persona está ACTIVA, en fase GANAR y con su Operación 72 fuera del tablero.
/// Enseñar un botón que el núcleo va a rechazar es peor que no enseñarlo (la
/// regla del 16-sep).
export function VolverAlTablero({
  learnerId,
  nombre,
}: {
  learnerId: string;
  nombre: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState<string>(DESTINOS_REASIGNABLES[0]);
  const [nota, setNota] = useState("");
  const [cuando, setCuando] = useState("");
  const [lugar, setLugar] = useState("");
  const [virtual, setVirtual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const pideVisita = destino === "VISITA_PENDIENTE";

  function enviar() {
    setError(null);
    iniciar(async () => {
      const r = await devolverAlTablero(learnerId, {
        destino,
        nota,
        ...(pideVisita ? { visita: { cuando, lugar, virtual } } : {}),
      });
      if (!r.ok) {
        setError(r.mensaje ?? "No se pudo guardar.");
        return;
      }
      setAbierto(false);
      setNota("");
      // `revalidatePath` no repinta lo que el navegador ya tiene (11-sep).
      router.refresh();
    });
  }

  return (
    <section className="tarjeta p-5">
      <h2 className="etiqueta-seccion">VOLVER AL PROCESO DE CONSOLIDACIÓN</h2>
      <p className="mt-1.5 text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.6)]">
        {nombre} está activa pero fuera del tablero: su Operación 72 se cerró al
        darla de baja. Devuélvela y el equipo volverá a verla para llamarla o
        agendarle la visita.
      </p>
      {/* ⚠️ Esto evita el viaje en balde más probable: quien solo quiere
          meterla a una Casa de Fe o asignarle mentor NO necesita el tablero,
          y esas dos cosas ya funcionan con solo estar activa. */}
      <p className="mt-2 rounded-[10px] bg-papel p-3 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
        Si lo que quieres es inscribirla en una <strong>Casa de Fe</strong> o
        <strong> asignarle mentor</strong>, no hace falta esto: ya se puede
        hacer desde «Alpha y Casa de Fe» y desde esta misma ficha.
      </p>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white"
        >
          Devolver al tablero
        </button>
      ) : (
        <div className="mt-4">
          <label className="block">
            <span className="etiqueta-campo">¿A qué columna vuelve?</span>
            <select
              className="campo"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
            >
              {DESTINOS_REASIGNABLES.map((columna) => (
                <option key={columna} value={columna}>
                  {ETIQUETA_COLUMNA[columna]}
                </option>
              ))}
            </select>
            <span className="mt-[7px] block text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
              Si ya se había hablado con ella antes de la baja, no la dejes en
              «Iniciada» o la llamarán otra vez desde cero.
            </span>
          </label>

          {pideVisita ? (
            <div className="mt-3 rounded-[10px] bg-papel p-3">
              <p className="text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.6)]">
                Esa columna se ordena por la fecha de la visita, así que hace
                falta saber cuándo es.
              </p>
              <label className="mt-2.5 block">
                <span className="etiqueta-campo">Fecha y hora</span>
                <input
                  type="datetime-local"
                  className="campo"
                  value={cuando}
                  onChange={(e) => setCuando(e.target.value)}
                />
              </label>
              <label className="mt-2.5 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={virtual}
                  onChange={(e) => setVirtual(e.target.checked)}
                  className="h-4 w-4 accent-[#1b4a7a]"
                />
                <span className="text-[12.5px] font-medium text-tinta">
                  La visita es virtual
                </span>
              </label>
              {!virtual ? (
                <label className="mt-2.5 block">
                  <span className="etiqueta-campo">Lugar</span>
                  <input
                    className="campo"
                    value={lugar}
                    onChange={(e) => setLugar(e.target.value)}
                    placeholder="Dirección o punto de encuentro"
                  />
                </label>
              ) : null}
            </div>
          ) : null}

          <label className="mt-3 block">
            <span className="etiqueta-campo">¿Por qué vuelve al proceso?</span>
            <textarea
              className="campo"
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Qué pasó para que retome, y por dónde."
            />
            <span className="mt-[7px] block text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
              Mínimo 10 caracteres. Es lo que va a leer quien la atienda.
            </span>
          </label>

          <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            El plazo de 72 horas se cuenta <strong>desde hoy</strong>: el viejo
            venció hace tiempo y la haría nacer vencida.
          </p>

          {error ? (
            <p role="alert" className="mt-3 text-[12px] leading-[1.4] font-medium text-rojo">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={enviar}
              disabled={ocupado}
              className="cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
            >
              {ocupado ? "Devolviendo…" : "Confirmar"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              disabled={ocupado}
              className="cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.5)] underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
