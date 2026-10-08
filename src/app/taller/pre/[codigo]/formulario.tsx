"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  LARGO_MINIMO_RESPUESTA_PRE,
  avancePre,
  esOrdenCompleto,
  respondidaPre,
  type PreguntaPre,
  type RespuestaPre,
} from "@/lib/prematrimonial-catalogo";
import type { TallerPreAbierto } from "@/lib/prematrimonial";

import { enviarPre, responderPre, salirDelTallerPre } from "./acciones";

/// El taller del prematrimonial, tal como lo llena UNA de las dos personas.
///
/// ⚠️ **Nadie ve aquí nada del otro, ni siquiera si ya envió.** Eso vive en
/// «Mis talleres»; dentro del taller no cabe, porque saber que el otro ya
/// respondió influye en lo que uno escribe.
export function FormularioPre({
  codigo,
  nombre,
  taller,
}: {
  codigo: string;
  nombre: string;
  taller: TallerPreAbierto;
}) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<RespuestaPre[]>(taller.respuestas);
  const [error, setError] = useState<string | null>(null);
  const [enviando, arrancar] = useTransition();
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const soloLectura = taller.estado === "ENVIADO" || taller.estado === "APROBADO";

  const porPregunta = useMemo(
    () => new Map(respuestas.map((r) => [r.questionId, r])),
    [respuestas],
  );

  const avance = useMemo(
    () => avancePre(taller.preguntas, respuestas),
    [taller.preguntas, respuestas],
  );

  function actualizar(questionId: string, cambio: Partial<RespuestaPre>) {
    setRespuestas((antes) => {
      const resto = antes.filter((r) => r.questionId !== questionId);
      const actual = antes.find((r) => r.questionId === questionId) ?? {
        questionId,
        text: null,
        choice: null,
        choices: [],
        ordering: [],
      };
      return [...resto, { ...actual, ...cambio }];
    });
  }

  /// ⚠️ **Se guarda 1,5 s después de la última tecla, no en cada letra.** Con
  /// `PrismaPg max:1` una petición por letra sería una latencia por letra (la
  /// regla del 27-sep con el taller de Casa de Fe).
  function guardar(
    questionId: string,
    valor: { text?: string; choice?: number; choices?: number[]; ordering?: number[] },
    conEspera = true,
  ) {
    const previo = temporizadores.current.get(questionId);
    if (previo) clearTimeout(previo);
    const lanzar = async () => {
      const r = await responderPre(codigo, taller.workshopId, questionId, valor);
      if (!r.ok) setError(r.mensaje);
    };
    if (!conEspera) {
      void lanzar();
      return;
    }
    temporizadores.current.set(questionId, setTimeout(() => void lanzar(), 1500));
  }

  function enviar() {
    setError(null);
    arrancar(async () => {
      const r = await enviarPre(codigo, taller.workshopId);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="min-h-dvh bg-[#faf8f1] text-[#1a1917]">
      <div className="mx-auto max-w-[620px]">
        <header className="bg-[#1a1917] px-5 py-6 text-[#faf8f1]">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c2a9b6] uppercase">
            Iglesia Vive · Prematrimonial
          </p>
          <h1 className="mt-3.5 font-serif text-[25px] leading-[1.12]">
            Tema {taller.tema.number} · {taller.tema.name}
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] text-[#d8d1bf]">
            {nombre}, responde tú solo. Nadie más ve lo que escribes hasta que tu
            pastor lo destape.
          </p>
        </header>

        {taller.estado === "DEVUELTO" && taller.notaDelPastor ? (
          <div className="border-b border-[#e0b4ac] bg-[#fdf1ee] px-5 py-4">
            <p className="mb-1 text-[9.5px] font-bold tracking-[0.12em] text-[#a63d2f] uppercase">
              Tu pastor te devolvió este taller
            </p>
            <p className="text-[12.5px] leading-[1.5]">{taller.notaDelPastor}</p>
          </div>
        ) : null}

        {soloLectura ? (
          <div className="border-b border-[#c9a3b6] bg-[#f7eef2] px-5 py-4">
            <p className="text-[12.5px] leading-[1.5] font-semibold text-[#7a3b5c]">
              {taller.estado === "APROBADO"
                ? "Tu pastor ya aprobó este taller. Puedes leerlo, pero no cambiarlo."
                : "Ya lo enviaste. Espera a que tu pastor lo revise."}
            </p>
          </div>
        ) : null}

        <div className="px-5 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-[16px] font-semibold">
              {avance.respondidas} de {avance.total} respondidas
            </strong>
            <span className="text-[11.5px] font-medium text-[#5c5648]">
              Se guarda solo
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8e2d2]">
            <div
              className="h-full rounded-full bg-[#7a3b5c] transition-[width]"
              style={{
                width: `${avance.total === 0 ? 0 : (avance.respondidas / avance.total) * 100}%`,
              }}
            />
          </div>
        </div>

        <ol className="list-none px-5 py-6" style={{ margin: 0, padding: "24px 20px" }}>
          {taller.preguntas.map((p) => (
            <li key={p.id} className="mb-4 list-none">
              <Pregunta
                pregunta={p}
                respuesta={porPregunta.get(p.id)}
                soloLectura={soloLectura}
                onCambio={(cambio, valor, conEspera) => {
                  actualizar(p.id, cambio);
                  guardar(p.id, valor, conEspera);
                }}
              />
            </li>
          ))}
        </ol>

        {/* ⚠️ La salida va DENTRO del taller y no solo en «Mis talleres»: aquí
            es donde la persona se da cuenta de que está en la pantalla de su
            pareja, porque lee un nombre que no es el suyo. */}
        <button
          type="button"
          onClick={() => salirDelTallerPre(codigo).then(() => router.refresh())}
          className="mx-5 mt-6 mb-2 block text-[12px] text-[#5c5648] underline underline-offset-2"
        >
          No soy {nombre} · salir
        </button>

        {error ? (
          <p
            role="alert"
            className="mx-5 mb-4 rounded-lg border border-[#e0b4ac] bg-[#fdf1ee] px-3.5 py-3 text-[12.5px] leading-[1.5] text-[#8a3226]"
          >
            {error}
          </p>
        ) : null}

        {!soloLectura ? (
          <div className="border-t border-[#e3ddcd] bg-white px-5 py-6">
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || !avance.completo}
              className="w-full rounded-lg bg-[#7a3b5c] py-4 text-[15px] font-semibold text-white disabled:opacity-45"
            >
              {enviando
                ? "Enviando…"
                : avance.completo
                  ? "Enviar a mi pastor"
                  : `Te faltan ${avance.faltan}`}
            </button>
            <p className="mt-3 text-[11.5px] leading-[1.5] text-[#5c5648]">
              Puedes irte y volver: lo que escribas queda guardado. Solo se envía
              cuando estén las {avance.total} respondidas.
            </p>
          </div>
        ) : null}

        <footer className="border-t border-[#e3ddcd] px-5 pt-5 pb-9">
          <Link
            href="/taller/mis"
            className="text-[13px] font-semibold text-[#7a3b5c] underline underline-offset-2"
          >
            ← Volver a mis talleres
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Pregunta({
  pregunta,
  respuesta,
  soloLectura,
  onCambio,
}: {
  pregunta: PreguntaPre;
  respuesta: RespuestaPre | undefined;
  soloLectura: boolean;
  onCambio: (
    cambio: Partial<RespuestaPre>,
    valor: { text?: string; choice?: number; choices?: number[]; ordering?: number[] },
    conEspera?: boolean,
  ) => void;
}) {
  const lista = respuesta ?? {
    questionId: pregunta.id,
    text: null,
    choice: null,
    choices: [],
    ordering: [],
  };
  const hecha = respondidaPre(pregunta, respuesta);

  return (
    <section
      className={`rounded-xl border bg-white p-[14px] ${hecha ? "border-[#cfe3d8]" : "border-[#e3ddcd]"}`}
    >
      <p className="text-[14px] leading-[1.4] font-semibold">
        <span className="text-[#5c5648]">{pregunta.number}.</span> {pregunta.prompt}
      </p>

      {pregunta.kind === "ABIERTA" ? (
        <>
          <label className="sr-only" htmlFor={`p-${pregunta.id}`}>
            Tu respuesta a la pregunta {pregunta.number}
          </label>
          <textarea
            id={`p-${pregunta.id}`}
            rows={4}
            disabled={soloLectura}
            defaultValue={lista.text ?? ""}
            onChange={(e) =>
              onCambio({ text: e.target.value }, { text: e.target.value })
            }
            placeholder={`Mínimo ${LARGO_MINIMO_RESPUESTA_PRE} caracteres`}
            className="mt-2.5 w-full resize-y rounded-lg border border-[#cfc6ae] bg-[#faf8f1] px-3 py-2.5 text-[14px] leading-[1.55] disabled:opacity-70"
          />
        </>
      ) : null}

      {pregunta.kind === "SI_NO" || pregunta.kind === "OPCION" ? (
        <fieldset className="mt-2.5 border-0 p-0" style={{ margin: "10px 0 0" }}>
          <legend className="sr-only">Elige una</legend>
          {pregunta.options.map((opcion, i) => (
            <label
              key={i}
              className="mt-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#e3ddcd] px-3 py-2.5 text-[14px] has-checked:border-[#7a3b5c] has-checked:bg-[#f7eef2]"
            >
              <input
                type="radio"
                name={`q-${pregunta.id}`}
                disabled={soloLectura}
                checked={lista.choice === i}
                onChange={() => onCambio({ choice: i }, { choice: i }, false)}
                className="h-4 w-4 accent-[#7a3b5c]"
              />
              {opcion}
            </label>
          ))}
        </fieldset>
      ) : null}

      {pregunta.kind === "MULTIPLE" ? (
        <fieldset className="mt-2.5 border-0 p-0" style={{ margin: "10px 0 0" }}>
          <legend className="text-[11.5px] leading-[1.45] text-[#5c5648]">
            Marca las que consideres. Puedes no marcar ninguna.
          </legend>
          {pregunta.options.map((opcion, i) => {
            const marcada = lista.choices.includes(i);
            return (
              <label
                key={i}
                className="mt-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#e3ddcd] px-3 py-2.5 text-[14px] has-checked:border-[#7a3b5c] has-checked:bg-[#f7eef2]"
              >
                <input
                  type="checkbox"
                  disabled={soloLectura}
                  checked={marcada}
                  onChange={() => {
                    const siguiente = marcada
                      ? lista.choices.filter((x) => x !== i)
                      : [...lista.choices, i].sort((a, b) => a - b);
                    onCambio({ choices: siguiente }, { choices: siguiente }, false);
                  }}
                  className="h-4 w-4 accent-[#7a3b5c]"
                />
                {opcion}
              </label>
            );
          })}
        </fieldset>
      ) : null}

      {pregunta.kind === "ORDEN" ? (
        <OrdenarOpciones
          pregunta={pregunta}
          orden={lista.ordering}
          soloLectura={soloLectura}
          onCambio={(siguiente) =>
            onCambio({ ordering: siguiente }, { ordering: siguiente }, false)
          }
        />
      ) : null}
    </section>
  );
}

/// ⚠️ **Se ordena con un número por opción, no arrastrando.** Arrastrar en un
/// celular con el dedo es justo lo que peor funciona, y aquí hay seis cosas
/// que ordenar: un desplegable del 1 al 6 por renglón se llena con el pulgar y
/// no se equivoca. El libro además lo pide así, literalmente: «Escriba del 1 a
/// 6 según el orden que considere».
function OrdenarOpciones({
  pregunta,
  orden,
  soloLectura,
  onCambio,
}: {
  pregunta: PreguntaPre;
  orden: number[];
  soloLectura: boolean;
  onCambio: (siguiente: number[]) => void;
}) {
  const puestos = new Map<number, number>();
  orden.forEach((opcion, i) => puestos.set(opcion, i + 1));
  const total = pregunta.options.length;
  const completo = esOrdenCompleto(orden, total);

  function poner(opcion: number, puesto: number) {
    // Se reconstruye la lista: la opción va a ese puesto y las demás se corren.
    const sinEsta = orden.filter((o) => o !== opcion);
    if (puesto < 1) {
      onCambio(sinEsta);
      return;
    }
    const siguiente = [...sinEsta];
    siguiente.splice(Math.min(puesto - 1, siguiente.length), 0, opcion);
    onCambio(siguiente);
  }

  return (
    <div className="mt-2.5">
      <p className="text-[11.5px] leading-[1.45] text-[#5c5648]">
        Ponle un número a cada uno, del 1 al {total}. El 1 es lo más importante.
      </p>
      {pregunta.options.map((opcion, i) => (
        <div
          key={i}
          className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-[#e3ddcd] px-3 py-2"
        >
          <label className="sr-only" htmlFor={`o-${pregunta.id}-${i}`}>
            Puesto de {opcion}
          </label>
          <select
            id={`o-${pregunta.id}-${i}`}
            disabled={soloLectura}
            value={puestos.get(i) ?? ""}
            onChange={(e) => poner(i, Number(e.target.value) || 0)}
            className="w-[58px] rounded-md border border-[#cfc6ae] bg-[#faf8f1] px-2 py-1.5 text-[14px] font-semibold tabular-nums"
          >
            <option value="">—</option>
            {Array.from({ length: total }, (_, n) => (
              <option key={n + 1} value={n + 1}>
                {n + 1}
              </option>
            ))}
          </select>
          <span className="flex-1 text-[14px] leading-[1.35]">{opcion}</span>
        </div>
      ))}
      {!completo && orden.length > 0 ? (
        <p className="mt-2 text-[11.5px] leading-[1.45] font-semibold text-[#8a5a12]">
          Te faltan {total - orden.length} por numerar.
        </p>
      ) : null}
    </div>
  );
}
