"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ETIQUETA_ESTADO,
  LARGO_MINIMO_RESPUESTA,
  avanceDelTaller,
  preguntaRespondida,
  puedeEnviarse,
  type PreguntaDelTaller,
  type RespuestaDelTaller,
} from "@/lib/taller-catalogo";
import { type TallerAbierto } from "@/lib/taller";

import { enviar, responder, salirDelTaller } from "./acciones";

/// Cuánto se espera desde la última tecla para guardar.
///
/// ⚠️ **Guardar en cada tecla sería una petición por letra**, y con
/// `PrismaPg max:1` (§7) cada una es una latencia contra el pooler: el celular
/// se arrastraría y la base se ahogaría. Un segundo y medio es lo que tarda
/// alguien en parar a pensar.
const ESPERA_MS = 1500;

export function Formulario({
  codigo,
  nombre,
  taller,
}: {
  codigo: string;
  nombre: string;
  taller: TallerAbierto;
}) {
  const router = useRouter();
  const [enviando, arrancarEnvio] = useTransition();

  // Lo que la persona lleva escrito, en la pantalla. Arranca de lo guardado.
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaDelTaller>>(
    () => Object.fromEntries(taller.respuestas.map((r) => [r.questionId, r])),
  );
  const [guardado, setGuardado] = useState<"quieto" | "guardando" | "listo">("quieto");
  const [error, setError] = useState<string | null>(null);
  const relojes = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Al salir de la pantalla se cancelan los relojes pendientes: sin esto,
  // React avisa de un `setState` sobre algo que ya no está montado.
  useEffect(() => {
    const vivos = relojes.current;
    return () => {
      for (const t of Object.values(vivos)) clearTimeout(t);
    };
  }, []);

  const lista = Object.values(respuestas);
  const avance = avanceDelTaller(taller.preguntas, lista);
  const sePuedeEnviar = puedeEnviarse(taller.preguntas, lista, taller.estado);
  const bloqueado = taller.estado === "ENVIADO" || taller.estado === "APROBADO";

  function guardar(questionId: string, valor: { text?: string; choice?: number }) {
    clearTimeout(relojes.current[questionId]);
    setGuardado("guardando");
    relojes.current[questionId] = setTimeout(async () => {
      const r = await responder(codigo, taller.workshopId, questionId, valor);
      if (r.ok) {
        setGuardado("listo");
      } else {
        setGuardado("quieto");
        setError(r.mensaje);
      }
    }, ESPERA_MS);
  }

  function escribir(pregunta: PreguntaDelTaller, texto: string) {
    setRespuestas((antes) => ({
      ...antes,
      [pregunta.id]: { questionId: pregunta.id, text: texto, choice: null },
    }));
    guardar(pregunta.id, { text: texto });
  }

  function marcar(pregunta: PreguntaDelTaller, indice: number) {
    setRespuestas((antes) => ({
      ...antes,
      [pregunta.id]: { questionId: pregunta.id, text: null, choice: indice },
    }));
    guardar(pregunta.id, { choice: indice });
  }

  function mandar() {
    setError(null);
    arrancarEnvio(async () => {
      // Se vacían los relojes pendientes: enviar sin que la última respuesta
      // haya llegado al servidor la perdería.
      for (const t of Object.values(relojes.current)) clearTimeout(t);
      for (const r of Object.values(respuestas)) {
        await responder(codigo, taller.workshopId, r.questionId, {
          text: r.text ?? undefined,
          choice: r.choice ?? undefined,
        });
      }
      const resultado = await enviar(codigo, taller.workshopId);
      if (resultado.ok) router.refresh();
      else setError(resultado.mensaje);
    });
  }

  return (
    <main className="min-h-dvh bg-[#faf8f1] pb-40 text-[#1a1917]">
      <div className="mx-auto max-w-[560px]">
        <header className="sticky top-0 z-10 bg-[#1a1917] px-5 py-3.5 text-[#faf8f1]">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-[0.14em] text-[#c8c0ac] uppercase">
                Tema {taller.tema.number} · {taller.tema.name}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold">Hola, {nombre}</p>
            </div>
            <span className="shrink-0 rounded-[5px] bg-[#3a3835] px-2 py-1 text-[11px] font-semibold text-[#e8e2d2]">
              {avance.respondidas} de {avance.total}
            </span>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded bg-[#3a3835]">
            <div
              className="h-full bg-[#4c9a78] transition-[width]"
              style={{
                width: `${avance.total ? (avance.respondidas / avance.total) * 100 : 0}%`,
              }}
            />
          </div>
        </header>

        <div className="px-5">
          {taller.tema.subtitle ? (
            <p className="mt-5 text-[12px] tracking-[0.06em] text-[#5c5648] uppercase">
              {taller.tema.subtitle}
            </p>
          ) : null}

          {taller.tema.memoryVerse ? (
            <section className="mt-4 rounded-[10px] border border-[#dccfa4] bg-[#fbf4dc] p-3.5">
              <p className="text-[10px] font-bold tracking-[0.13em] text-[#8a5a12] uppercase">
                Vive la Palabra
              </p>
              <p className="mt-1.5 font-serif text-[16px] font-semibold text-[#3d3311]">
                {taller.tema.memoryVerse}
              </p>
              <p className="mt-1 text-[11.5px] text-[#5c5648]">
                Versículo para memorizar esta semana
              </p>
            </section>
          ) : null}

          {taller.dias.length > 0 ? (
            <details className="mt-3 rounded-[10px] border border-[#e3ddcd] bg-white p-3.5">
              <summary className="cursor-pointer text-[13px] font-semibold">
                Vive la lección · los {taller.dias.length} días{" "}
                <span className="font-normal text-[#5c5648]">— guía</span>
              </summary>
              <ol className="mt-3 list-decimal pl-5 text-[12px] leading-[1.65] text-[#3a352b]">
                {taller.dias.map((d) => (
                  <li key={d.number}>{d.action}</li>
                ))}
              </ol>
            </details>
          ) : null}

          {taller.estado === "DEVUELTO" ? (
            <section className="mt-4 rounded-[10px] border border-[#e0b4ac] bg-[#fdf1ee] p-3.5">
              <p className="text-[11px] font-bold tracking-[0.1em] text-[#8a3226] uppercase">
                Tu líder te lo devolvió
              </p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-[#5b271e]">
                {taller.notaDeLaRevision ?? "Corrige lo que te indicó y vuelve a enviarlo."}
              </p>
            </section>
          ) : null}

          {bloqueado ? (
            <section className="mt-4 rounded-[10px] border border-[#bfd8cc] bg-[#eef6f2] p-3.5">
              <p className="text-[13px] leading-[1.55] font-semibold text-[#255c45]">
                {taller.estado === "APROBADO"
                  ? "¡Tu líder aprobó este tema! Ya quedó en tu expediente."
                  : "Ya lo enviaste. Tu líder lo va a revisar."}
              </p>
              <p className="mt-1 text-[12px] text-[#3f6e5c]">
                Puedes leer lo que respondiste, pero ya no se puede cambiar.
              </p>
            </section>
          ) : null}

          <ol className="mt-4 space-y-3">
            {taller.preguntas.map((p) => {
              const r = respuestas[p.id];
              const lista = preguntaRespondida(p, r);
              return (
                <li
                  key={p.id}
                  className={`rounded-[10px] border bg-white p-3.5 ${
                    lista ? "border-[#bfd8cc]" : "border-[#e3ddcd]"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-[#a79e88]">
                    Pregunta {p.number} de {taller.preguntas.length}
                    {p.kind === "OPCION" ? " · marca una" : null}
                  </p>
                  <p className="mt-1 text-[13.5px] leading-[1.5] font-semibold">
                    {p.prompt}
                  </p>

                  {p.kind === "DIBUJO" ? (
                    <p className="mt-2 rounded-lg border border-[#dccfa4] bg-[#fbf4dc] px-3 py-2 text-[11.5px] leading-[1.5] text-[#4a3d1c]">
                      Esta es de dibujar. Hazla en tu cuaderno y muéstrasela a
                      tu líder; aquí <strong>descríbela en palabras</strong>.
                    </p>
                  ) : null}

                  {p.kind === "OPCION" ? (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {p.options.map((opcion, i) => {
                        const elegida = r?.choice === i;
                        return (
                          <label
                            key={opcion}
                            className={`flex cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2.5 text-[12.5px] ${
                              elegida
                                ? "border-[1.5px] border-[#1a1917] bg-[#f4f1e6] font-semibold"
                                : "border border-[#e3ddcd]"
                            }`}
                          >
                            <input
                              type="radio"
                              name={p.id}
                              checked={elegida}
                              disabled={bloqueado}
                              onChange={() => marcar(p, i)}
                              className="h-4 w-4 shrink-0"
                            />
                            <span>{opcion}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <>
                      <textarea
                        aria-label={p.prompt}
                        rows={4}
                        disabled={bloqueado}
                        value={r?.text ?? ""}
                        onChange={(e) => escribir(p, e.target.value)}
                        className="mt-2.5 w-full resize-y rounded-lg border border-[#cfc6ae] bg-[#fdfcf8] px-3 py-2.5 text-[14px] leading-[1.55] disabled:opacity-70"
                      />
                      {!lista && (r?.text ?? "").trim().length > 0 ? (
                        <p className="mt-1 text-[11px] text-[#8a5a12]">
                          Escribe un poco más (mínimo {LARGO_MINIMO_RESPUESTA}{" "}
                          caracteres).
                        </p>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={() => salirDelTaller(codigo).then(() => router.refresh())}
            className="mt-6 w-full text-[12px] text-[#5c5648] underline underline-offset-2"
          >
            No soy {nombre} · salir
          </button>
        </div>
      </div>

      {!bloqueado ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#e3ddcd] bg-[#faf8f1] px-5 pt-2.5 pb-4">
          <div className="mx-auto max-w-[560px]">
            <div className="mb-2 flex items-center gap-2 text-[11.5px]">
              <span
                className={
                  guardado === "listo" ? "font-semibold text-[#2f6f53]" : "text-[#5c5648]"
                }
              >
                {guardado === "guardando"
                  ? "Guardando…"
                  : guardado === "listo"
                    ? "Guardado"
                    : ETIQUETA_ESTADO[taller.estado]}
              </span>
              <span className="flex-1 text-right text-[#5c5648]">
                Puedes volver cuando quieras
              </span>
            </div>

            {error ? (
              <p role="alert" className="mb-2 text-[12px] text-[#8a3226]">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={mandar}
              disabled={!sePuedeEnviar || enviando}
              className="w-full rounded-lg bg-[#1a1917] py-3.5 text-[14.5px] font-semibold text-[#faf8f1] disabled:cursor-not-allowed disabled:bg-[#cfc6ae] disabled:text-[#6e6857]"
            >
              {enviando ? "Enviando…" : "Enviar a mi líder"}
            </button>
            {!sePuedeEnviar ? (
              <p className="mt-1.5 text-center text-[11px] text-[#5c5648]">
                Te {avance.faltan === 1 ? "falta" : "faltan"} {avance.faltan}{" "}
                {avance.faltan === 1 ? "pregunta" : "preguntas"} para poder enviarlo
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
