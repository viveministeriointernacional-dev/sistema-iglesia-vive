"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LARGO_MINIMO_NOTA_QUIZ, type EstadoQuiz } from "@/lib/cuestionario-catalogo";

import { revisar } from "../acciones";

/// Aprobar o devolver. Es lo último de la pantalla a propósito: primero se lee
/// lo que escribió el líder, después se decide.
export function PanelDeRevision({
  quizId,
  estado,
  nombre,
}: {
  quizId: string;
  estado: EstadoQuiz;
  nombre: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<"aprobar" | "devolver" | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, arrancar] = useTransition();

  const dePila = nombre.split(" ")[0] ?? nombre;

  // ⚠️ **Si no está esperando, no se ofrece ningún botón**, y el núcleo lo
  // rechaza igual con su mensaje. Es la regla del 16-sep-2026 al derecho: si se
  // enseña, tiene que funcionar. Enseñar «Aprobar» sobre un tema ya aprobado
  // —o sobre uno que el líder todavía está llenando— sería un botón que falla
  // siempre.
  if (estado !== "ENVIADO") {
    return (
      <section className="mt-8 rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-4 py-4">
        <p className="text-[13px] leading-[1.5] text-[rgba(19,28,36,.72)]">
          {estado === "APROBADO"
            ? `Este tema ya está aprobado: ${dePila} puede dictarlo.`
            : estado === "DEVUELTO"
              ? `Se le devolvió. Cuando ${dePila} lo vuelva a enviar, aparece otra vez en «Esperando tu revisión».`
              : `${dePila} todavía no ha enviado este tema.`}
        </p>
      </section>
    );
  }

  function enviar(aprobado: boolean) {
    setError(null);
    arrancar(async () => {
      const r = await revisar(quizId, aprobado, nota);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      // La pantalla cambia entera, así que hay que repintar (la regla del
      // 11-sep-2026): `revalidatePath` limpia el servidor, no el navegador.
      router.refresh();
      setAbierto(null);
      setNota("");
    });
  }

  return (
    <section className="mt-8 rounded-[10px] border-[1.5px] border-[rgba(19,28,36,.2)] bg-white px-4 py-4">
      <h2 className="text-[14px] leading-[1.3] font-semibold">
        ¿{dePila} está listo para dictar este tema?
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[rgba(19,28,36,.62)]">
        Al aprobarlo, {dePila} ve por fin qué acertó y qué falló en las de
        marcar, con su explicación. Mientras no lo apruebes no lo ve, para que
        no pueda corregir copiando.
      </p>

      {abierto === null ? (
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setAbierto("aprobar")}
            className="rounded-[9px] bg-[#2f6f53] px-4 py-[11px] text-[13.5px] font-semibold text-white"
          >
            Aprobar · ya puede dictarlo
          </button>
          <button
            type="button"
            onClick={() => setAbierto("devolver")}
            className="rounded-[9px] border-[1.5px] border-[#a63d2f] px-4 py-[11px] text-[13.5px] font-semibold text-[#a63d2f]"
          >
            Devolver para que repase
          </button>
        </div>
      ) : (
        <div className="mt-3.5">
          <label
            htmlFor="nota"
            className="mb-1.5 block text-[12px] font-semibold"
          >
            {abierto === "devolver"
              ? "¿Qué tiene que repasar?"
              : "Algo que quieras dejarle escrito (opcional)"}
          </label>
          <textarea
            id="nota"
            rows={4}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={
              abierto === "devolver"
                ? "Lo que le falta, con el detalle suficiente para que sepa qué estudiar. Es lo único que va a leer."
                : ""
            }
            className="w-full resize-y rounded-lg border border-[rgba(19,28,36,.22)] bg-white px-3 py-2.5 text-[13.5px] leading-[1.55]"
          />
          {abierto === "devolver" ? (
            <p className="mt-1 text-[11.5px] text-[rgba(19,28,36,.55)]">
              Obligatorio, al menos {LARGO_MINIMO_NOTA_QUIZ} caracteres:
              devolver sin decir por qué lo deja sin saber qué estudiar.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-[#e0b4ac] bg-[#fdf1ee] px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-[#8a3226]"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={pendiente}
              onClick={() => enviar(abierto === "aprobar")}
              className={`rounded-[9px] px-4 py-[11px] text-[13.5px] font-semibold text-white disabled:opacity-50 ${
                abierto === "aprobar" ? "bg-[#2f6f53]" : "bg-[#a63d2f]"
              }`}
            >
              {pendiente
                ? "Guardando…"
                : abierto === "aprobar"
                  ? "Confirmar que lo apruebo"
                  : "Devolvérselo"}
            </button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                setAbierto(null);
                setError(null);
              }}
              className="rounded-[9px] border border-[rgba(19,28,36,.22)] px-4 py-[11px] text-[13.5px] font-semibold text-[rgba(19,28,36,.72)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
