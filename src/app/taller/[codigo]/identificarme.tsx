"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { identificarme } from "./acciones";

/// La primera pantalla del QR: quién eres.
///
/// ⚠️ **Sin cuenta ni contraseña, a propósito.** El equipo de consolidación y
/// los miembros de las casas **no entran a la plataforma** (CLAUDE.md §6): si
/// esto pidiera iniciar sesión, el taller no lo llenaría nadie.
export function Identificarme({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [celular, setCelular] = useState("");
  const [porCorreo, setPorCorreo] = useState(false);
  const [correo, setCorreo] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    arrancar(async () => {
      const resultado = await identificarme(codigo, {
        celular,
        correo: porCorreo ? correo : undefined,
        nacimiento: porCorreo ? nacimiento : undefined,
      });
      if (resultado.ok) {
        // La pantalla cambia entera, así que hay que repintar (la regla del
        // 11-sep-2026): `revalidatePath` limpia el servidor, no el navegador.
        router.refresh();
      } else {
        setError(resultado.mensaje);
      }
    });
  }

  return (
    <main className="min-h-dvh bg-[#faf8f1] text-[#1a1917]">
      <div className="mx-auto max-w-[520px]">
        <header className="bg-[#1a1917] px-6 py-6 text-[#faf8f1]">
          <p className="text-[10.5px] font-semibold tracking-[0.16em] text-[#c8c0ac] uppercase">
            Iglesia Vive · Casa de Fe
          </p>
          <h1 className="mt-4 font-serif text-[27px] leading-[1.12]">
            El taller de tu casa de fe
          </h1>
        </header>

        <form onSubmit={enviar} className="px-6 py-7">
          <h2 className="text-[17px] leading-[1.3] font-semibold">
            Primero, dinos quién eres
          </h2>
          <p className="mt-2 text-[13px] leading-[1.55] text-[#5c5648]">
            Así el taller queda guardado en tu expediente y tu líder sabe que
            fuiste tú.
          </p>

          <div className="mt-5">
            <label htmlFor="celular" className="mb-1.5 block text-[12px] font-semibold">
              Tu número de celular
            </label>
            <input
              id="celular"
              name="celular"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="320 473 2415"
              className="w-full rounded-lg border-[1.5px] border-[#1a1917] bg-white px-3.5 py-3.5 text-[16px]"
            />
            <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[#5c5648]">
              Los 10 dígitos, con el que estás registrado en la iglesia.
            </p>
          </div>

          {porCorreo ? (
            <div className="mt-4 rounded-[10px] border border-[#e3ddcd] bg-white p-4">
              <p className="text-[12.5px] leading-[1.5] text-[#5c5648]">
                Puede que estés registrado con otro número. Te buscamos con
                estos dos datos.
              </p>
              <label htmlFor="correo" className="mt-3 mb-1.5 block text-[12px] font-semibold">
                Tu correo
              </label>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full rounded-lg border border-[#cfc6ae] bg-white px-3 py-3 text-[16px]"
              />
              <label htmlFor="nacimiento" className="mt-3 mb-1.5 block text-[12px] font-semibold">
                Tu fecha de nacimiento
              </label>
              <input
                id="nacimiento"
                type="date"
                value={nacimiento}
                onChange={(e) => setNacimiento(e.target.value)}
                className="w-full rounded-lg border border-[#cfc6ae] bg-white px-3 py-3 text-[16px]"
              />
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-[#e0b4ac] bg-[#fdf1ee] px-3.5 py-3 text-[12.5px] leading-[1.5] text-[#8a3226]"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pendiente}
            className="mt-4 w-full rounded-lg bg-[#1a1917] py-4 text-[15px] font-semibold text-[#faf8f1] disabled:opacity-60"
          >
            {pendiente ? "Buscándote…" : "Continuar"}
          </button>

          {!porCorreo ? (
            <button
              type="button"
              onClick={() => setPorCorreo(true)}
              className="mt-5 w-full text-[13px] font-semibold text-[#8a5a12] underline underline-offset-2"
            >
              ¿No te encuentra con el celular?
            </button>
          ) : null}

          <p className="mt-6 text-[11.5px] leading-[1.5] text-[#5c5648]">
            No necesitas contraseña ni cuenta. Si aparecen dos fichas con tus
            datos, esto se detiene y avisa al equipo: no queremos escribir sobre
            los datos de otra persona.
          </p>
        </form>
      </div>
    </main>
  );
}
