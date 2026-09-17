"use client";

import { useState, useTransition } from "react";
import { crearMiEnlaceDeCalendario } from "./calendario-acciones";

/// **El enlace de suscripción de cada persona.**
///
/// Nace vacío: el enlace no existe hasta que alguien lo pide. Así nadie tiene
/// una credencial suelta por ahí sin haberla necesitado nunca.
export function MiCalendario({
  enlaceInicial,
  cuantasReuniones,
}: {
  enlaceInicial: string | null;
  cuantasReuniones: number;
}) {
  const [enlace, setEnlace] = useState(enlaceInicial);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [enCurso, iniciar] = useTransition();

  function pedir() {
    setError(null);
    iniciar(async () => {
      const r = await crearMiEnlaceDeCalendario();
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      setEnlace(`${window.location.origin}/calendario/${r.token}.ics`);
      setCopiado(false);
    });
  }

  return (
    <section className="tarjeta p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="etiqueta-seccion">MIS REUNIONES EN MI CALENDARIO</h2>
        <span className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
          {cuantasReuniones === 0
            ? "ningún grupo con día y hora todavía"
            : cuantasReuniones === 1
              ? "1 grupo con día y hora"
              : `${cuantasReuniones} grupos con día y hora`}
        </span>
      </div>

      <p className="mt-2 text-[12.5px] leading-[1.55] font-medium text-[rgba(19,28,36,.55)]">
        Añade este enlace una vez a tu calendario y ahí verás{" "}
        <strong>los grupos que llevas y los grupos en los que estás inscrita o
        inscrito</strong>. Si cambia la hora o la dirección, se actualiza solo.
      </p>

      {!enlace ? (
        <div className="mt-4">
          <button type="button" disabled={enCurso} onClick={pedir} className="boton-primario">
            {enCurso ? "Creando…" : "Crear mi enlace de calendario"}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-4 rounded-[9px] border border-[rgba(19,28,36,.09)] bg-papel px-3 py-[11px] font-mono text-[11.5px] leading-[1.5] break-all text-[rgba(19,28,36,.55)]">
            {enlace}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(enlace)
                  .then(() => setCopiado(true))
                  .catch(() => setError("No se pudo copiar. Selecciona el texto a mano."));
              }}
              className="boton-primario"
            >
              {copiado ? "Copiado" : "Copiar mi enlace"}
            </button>
            <button
              type="button"
              disabled={enCurso}
              onClick={pedir}
              className="boton-secundario"
            >
              {enCurso ? "Rehaciendo…" : "Rehacer el enlace"}
            </button>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="etiqueta-seccion">EN GOOGLE CALENDAR</p>
              <ol className="mt-2 list-decimal pl-5 text-[12.5px] leading-[1.65] text-[rgba(19,28,36,.55)]">
                <li>
                  Abre <strong>calendar.google.com</strong> en el computador.
                </li>
                <li>
                  A la izquierda, junto a «Otros calendarios», pulsa el{" "}
                  <strong>+</strong>.
                </li>
                <li>
                  Elige <strong>«Desde URL»</strong>.
                </li>
                <li>
                  Pega el enlace y pulsa <strong>«Añadir calendario»</strong>.
                </li>
              </ol>
            </div>
            <div>
              <p className="etiqueta-seccion">EN EL IPHONE</p>
              <ol className="mt-2 list-decimal pl-5 text-[12.5px] leading-[1.65] text-[rgba(19,28,36,.55)]">
                <li>
                  Ajustes → <strong>Calendario</strong> → Cuentas.
                </li>
                <li>
                  <strong>Añadir cuenta</strong> → Otra.
                </li>
                <li>
                  <strong>Añadir suscripción de calendario</strong>.
                </li>
                <li>Pega el enlace y guarda.</li>
              </ol>
            </div>
          </div>

          <p className="mt-5 rounded-r-[10px] border-l-[3px] border-ambar-barra bg-ambar-fondo px-4 py-[13px] text-[12.5px] leading-[1.6] text-ambar-texto">
            <strong>Trata este enlace como una contraseña.</strong> Los
            calendarios no piden usuario, así que cualquiera que tenga la
            dirección puede ver estas reuniones. Si se te fue por error, pulsa{" "}
            <strong>«Rehacer el enlace»</strong>: el anterior deja de funcionar
            al instante.
            <br />
            <strong>Google refresca estos enlaces cada varias horas</strong>, no
            al instante. Si cambias una hora para hoy mismo, avisa igual por
            WhatsApp.
          </p>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </section>
  );
}
