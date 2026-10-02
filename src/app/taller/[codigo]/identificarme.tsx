"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { identificarme } from "./acciones";

/// La primera pantalla del QR: quién eres.
///
/// ⚠️ **Sin cuenta ni contraseña, a propósito.** El equipo de consolidación y
/// los miembros de las casas **no entran a la plataforma** (CLAUDE.md §6): si
/// esto pidiera iniciar sesión, el taller no lo llenaría nadie.
///
/// ⚠️ **EL CÓDIGO VA PRIMERO Y EL CELULAR ES EL SEGUNDO CAMINO**, y ese orden
/// es la razón de ser de esta pantalla (2-oct-2026). El celular identifica un
/// TELÉFONO, no una persona: una menor sin teléfono propio que escribe el de
/// su mamá acabaría llenando el taller a nombre de ella, y si las dos están
/// registradas con ese número el sistema las bloquea a las dos. El código es
/// de la persona, así que resuelve los dos casos de una.
export function Identificarme({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [pendiente, arrancar] = useTransition();
  const [modo, setModo] = useState<"codigo" | "celular">("codigo");
  const [codigoDeMiembro, setCodigoDeMiembro] = useState("");
  const [celular, setCelular] = useState("");
  const [porCorreo, setPorCorreo] = useState(false);
  const [correo, setCorreo] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    arrancar(async () => {
      const resultado = await identificarme(
        codigo,
        modo === "codigo"
          ? { codigoDeMiembro }
          : {
              celular,
              correo: porCorreo ? correo : undefined,
              nacimiento: porCorreo ? nacimiento : undefined,
            },
      );
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

          {modo === "codigo" ? (
            <>
              <div className="mt-5">
                <label
                  htmlFor="codigo-miembro"
                  className="mb-1.5 block text-[12px] font-semibold"
                >
                  Tu código
                </label>
                <input
                  id="codigo-miembro"
                  name="codigo-miembro"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={codigoDeMiembro}
                  onChange={(e) => setCodigoDeMiembro(e.target.value)}
                  placeholder="418 203"
                  className="w-full rounded-lg border-[1.5px] border-[#1a1917] bg-white px-3.5 py-3.5 text-center text-[24px] tracking-[0.18em] tabular-nums"
                />
                <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[#5c5648]">
                  Los 6 números que te dio tu líder. Es solo tuyo: no es el de
                  tu casa ni el de tu papá.
                </p>
              </div>

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
                {pendiente ? "Buscándote…" : "Entrar"}
              </button>

              <div className="mt-6 rounded-[10px] border border-[#e3ddcd] bg-white p-4">
                <p className="text-[12.5px] leading-[1.5] text-[#5c5648]">
                  <strong className="font-semibold text-[#1a1917]">
                    ¿No tienes tu código?
                  </strong>{" "}
                  Pídeselo a tu líder de casa de fe: él lo tiene.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setModo("celular");
                    setError(null);
                  }}
                  className="mt-2.5 text-[13px] font-semibold text-[#8a5a12] underline underline-offset-2"
                >
                  Prefiero entrar con mi celular
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-5">
                <label
                  htmlFor="celular"
                  className="mb-1.5 block text-[12px] font-semibold"
                >
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
                  Tiene que ser <strong>el tuyo</strong>, el que está registrado
                  a tu nombre. Si usas el de otra persona, el taller le quedaría
                  a ella.
                </p>
              </div>

              {porCorreo ? (
                <div className="mt-4 rounded-[10px] border border-[#e3ddcd] bg-white p-4">
                  <p className="text-[12.5px] leading-[1.5] text-[#5c5648]">
                    Puede que estés registrado con otro número. Te buscamos con
                    estos dos datos.
                  </p>
                  <label
                    htmlFor="correo"
                    className="mt-3 mb-1.5 block text-[12px] font-semibold"
                  >
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
                  <label
                    htmlFor="nacimiento"
                    className="mt-3 mb-1.5 block text-[12px] font-semibold"
                  >
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

              <button
                type="button"
                onClick={() => {
                  setModo("codigo");
                  setError(null);
                  setPorCorreo(false);
                }}
                className="mt-5 w-full text-[13px] font-semibold text-[#8a5a12] underline underline-offset-2"
              >
                Volver a entrar con mi código
              </button>
            </>
          )}

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
