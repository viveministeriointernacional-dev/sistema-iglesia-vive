"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  LARGO_MINIMO_RESPUESTA_QUIZ,
  avanceQuiz,
  cuantasSeCalifican,
  respondidaQuiz,
  type Calificacion,
  type PreguntaQuiz,
  type RespuestaQuiz,
} from "@/lib/cuestionario-catalogo";
import type { QuizAbierto } from "@/lib/cuestionario";

import { enviarQuiz, responderQuiz } from "../acciones";

/// El cuestionario de UN tema, tal como lo llena el líder desde su celular.
///
/// ⚠️ **Mientras no esté aprobado, aquí NO hay ninguna respuesta correcta que
/// mirar — tampoco escondida en el código de la página.** El servidor las
/// borra antes de enviar los datos (ver `abrirCuestionario`), porque los
/// intentos se apilan: si viajaran «ocultas», bastaría abrir el inspector del
/// navegador para reenviar con todo acertado y el cuestionario dejaría de
/// medir quién domina el tema.
export function FormularioDelQuiz({
  codigo,
  nombre,
  quiz,
}: {
  codigo: string;
  nombre: string;
  quiz: QuizAbierto;
}) {
  const router = useRouter();
  const [respuestas, setRespuestas] = useState<RespuestaQuiz[]>(quiz.respuestas);
  const [error, setError] = useState<string | null>(null);
  const [enviando, arrancar] = useTransition();
  const temporizadores = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const soloLectura = quiz.estado === "ENVIADO" || quiz.estado === "APROBADO";

  const porPregunta = useMemo(
    () => new Map(respuestas.map((r) => [r.questionId, r])),
    [respuestas],
  );

  const avance = useMemo(
    () => avanceQuiz(quiz.preguntas, respuestas),
    [quiz.preguntas, respuestas],
  );

  const deMarcar = useMemo(() => cuantasSeCalifican(quiz.preguntas), [quiz.preguntas]);
  const abiertas = quiz.preguntas.length - deMarcar;

  function actualizar(questionId: string, cambio: Partial<RespuestaQuiz>) {
    setRespuestas((antes) => {
      const resto = antes.filter((r) => r.questionId !== questionId);
      const actual =
        antes.find((r) => r.questionId === questionId) ??
        { questionId, text: null, choice: null };
      return [...resto, { ...actual, ...cambio }];
    });
  }

  /// ⚠️ **Se guarda 1,5 s después de la última tecla, no en cada letra.** Con
  /// `PrismaPg max:1` una petición por letra sería una latencia por letra (la
  /// regla del 27-sep-2026). Al marcar una opción se guarda **al instante**:
  /// ahí no hay nada más que teclear.
  function guardar(
    questionId: string,
    valor: { text?: string; choice?: number },
    conEspera = true,
  ) {
    const previo = temporizadores.current.get(questionId);
    if (previo) clearTimeout(previo);
    const lanzar = async () => {
      const r = await responderQuiz(codigo, quiz.quizId, questionId, valor);
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
      const r = await enviarQuiz(codigo, quiz.quizId);
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
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c8c0ac] uppercase">
            Iglesia Vive · Escuela Ser Líder
          </p>
          <h1 className="mt-3.5 font-serif text-[25px] leading-[1.12]">
            Tema {quiz.tema.number} · {quiz.tema.name}
          </h1>
          {quiz.tema.subtitle ? (
            <p className="mt-1 text-[12.5px] leading-[1.4] text-[#c8c0ac] italic">
              {quiz.tema.subtitle}
            </p>
          ) : null}
          <p className="mt-2.5 text-[13px] leading-[1.5] text-[#d8d1bf]">
            {nombre.split(" ")[0]}, esto no es el taller del libro: es para
            verificar que puedes <strong className="font-semibold">enseñar</strong>{" "}
            este tema.
          </p>
          <p className="mt-2 text-[11.5px] leading-[1.45] text-[#b8b0a0]">
            {quiz.preguntas.length} preguntas · {abiertas} para explicar con tus
            palabras {deMarcar > 0 ? `· ${deMarcar} para marcar` : ""}
          </p>
        </header>

        {/* ⚠️ La «Nota para el líder» va ARRIBA, antes de las preguntas, y se
            enseña siempre. No es la solución del examen: es material de
            enseñanza, y el propio documento pide leerla y conversarla en equipo
            ANTES de dictar el tema. Ponerla al final la dejaría sin leer. */}
        {quiz.tema.leaderNote ? (
          <div className="border-b border-[#e3d2a8] bg-[#fdf6e3] px-5 py-4">
            <p className="mb-1.5 text-[9.5px] font-bold tracking-[0.12em] text-[#8a6300] uppercase">
              Nota para el líder
            </p>
            <p className="text-[12.5px] leading-[1.55] text-[#5a4a20]">
              {quiz.tema.leaderNote}
            </p>
          </div>
        ) : null}

        {quiz.estado === "DEVUELTO" && quiz.notaDelCoordinador ? (
          <div className="border-b border-[#e0b4ac] bg-[#fdf1ee] px-5 py-4">
            <p className="mb-1 text-[9.5px] font-bold tracking-[0.12em] text-[#a63d2f] uppercase">
              Tu coordinador te devolvió este tema
            </p>
            <p className="text-[12.5px] leading-[1.5]">{quiz.notaDelCoordinador}</p>
            <p className="mt-2 text-[11.5px] leading-[1.45] text-[#5c5648]">
              Repasa lo que te dice, corrige tus respuestas y vuelve a enviarlo.
            </p>
          </div>
        ) : null}

        {quiz.estado === "ENVIADO" ? (
          <div className="border-b border-[#e8d7a8] bg-[#fbf4dc] px-5 py-4">
            <p className="text-[12.5px] leading-[1.5] font-semibold text-[#8a5a12]">
              Ya lo enviaste. Espera a que tu coordinador lo revise.
            </p>
            <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[#5c5648]">
              Cuando lo apruebe verás aquí qué acertaste en las de marcar, con
              su explicación.
            </p>
          </div>
        ) : null}

        {quiz.estado === "APROBADO" ? (
          <div className="border-b border-[#cfe3d8] bg-[#edf5f0] px-5 py-4">
            <p className="text-[12.5px] leading-[1.5] font-semibold text-[#2f6f53]">
              ✓ Tu coordinador aprobó este tema: ya puedes dictarlo.
            </p>
            {quiz.resultado && quiz.resultado.calificables > 0 ? (
              <p className="mt-1.5 text-[12px] leading-[1.45] text-[#5c5648]">
                En las de marcar acertaste{" "}
                <strong className="font-semibold text-[#1a1917]">
                  {quiz.resultado.aciertos} de {quiz.resultado.calificables}
                </strong>
                . Abajo está la explicación de cada una.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="px-5 py-6">
          {quiz.preguntas.map((pregunta) => (
            <Pregunta
              key={pregunta.id}
              pregunta={pregunta}
              respuesta={porPregunta.get(pregunta.id)}
              calificacion={quiz.calificaciones[pregunta.id]}
              soloLectura={soloLectura}
              onTexto={(texto) => {
                actualizar(pregunta.id, { text: texto });
                guardar(pregunta.id, { text: texto });
              }}
              onMarca={(i) => {
                actualizar(pregunta.id, { choice: i });
                guardar(pregunta.id, { choice: i }, false);
              }}
            />
          ))}

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-[#e0b4ac] bg-[#fdf1ee] px-3.5 py-3 text-[12.5px] leading-[1.5] text-[#8a3226]"
            >
              {error}
            </p>
          ) : null}

          {!soloLectura ? (
            <div className="mt-6 rounded-xl border border-[#e3ddcd] bg-white p-4">
              <p className="text-[13px] leading-[1.5] font-semibold">
                {avance.completo
                  ? "Respondiste las " + avance.total + ". Ya puedes enviarlo."
                  : `Llevas ${avance.respondidas} de ${avance.total} · te faltan ${avance.faltan}`}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[#5c5648]">
                Se va guardando solo mientras escribes, así que puedes cerrar y
                volver. Las respuestas de explicar piden al menos{" "}
                {LARGO_MINIMO_RESPUESTA_QUIZ} caracteres.
              </p>
              {/* ⚠️ El botón nace apagado hasta que esté completo, y el
                  servidor lo comprueba otra vez: un botón apagado es una
                  sugerencia del navegador, no una garantía. */}
              <button
                type="button"
                onClick={enviar}
                disabled={!avance.completo || enviando}
                className="mt-3.5 w-full rounded-lg bg-[#1a1917] py-4 text-[15px] font-semibold text-[#faf8f1] disabled:opacity-45"
              >
                {enviando ? "Enviando…" : "Enviar a mi coordinador"}
              </button>
            </div>
          ) : null}

          <Link
            href="/taller/lider"
            className="mt-6 inline-block text-[13px] font-semibold text-[#8a5a12] underline underline-offset-2"
          >
            ← Volver a los 12 temas
          </Link>
        </div>
      </div>
    </main>
  );
}

function Pregunta({
  pregunta,
  respuesta,
  calificacion,
  soloLectura,
  onTexto,
  onMarca,
}: {
  pregunta: PreguntaQuiz;
  respuesta: RespuestaQuiz | undefined;
  calificacion: Calificacion | undefined;
  soloLectura: boolean;
  onTexto: (texto: string) => void;
  onMarca: (i: number) => void;
}) {
  const lista = pregunta.kind === "OPCION";
  const respondida = respondidaQuiz(pregunta, respuesta);
  // La calificación solo llega cuando está aprobado (el servidor la omite
  // mientras no lo esté), así que basta preguntar si vino.
  const seVe = calificacion === "ACERTO" || calificacion === "FALLO";

  return (
    <section className="mb-5 border-b border-[#ece6d6] pb-5 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <span className="mt-[2px] text-[11px] font-bold text-[#8a7f66] tabular-nums">
          {pregunta.number}.
        </span>
        <p className="flex-1 text-[14.5px] leading-[1.5] font-medium">
          {pregunta.prompt}
        </p>
      </div>

      {lista ? (
        <div className="mt-3 ml-[22px]">
          {pregunta.options.map((opcion, i) => {
            const marcada = respuesta?.choice === i;
            const esCorrecta = seVe && pregunta.correctChoice === i;
            // Al estar aprobado se enseña qué marcó y cuál era la correcta.
            const marco = esCorrecta
              ? "border-[#2f6f53] bg-[#edf5f0]"
              : seVe && marcada
                ? "border-[#a63d2f] bg-[#fdf1ee]"
                : marcada
                  ? "border-[#1a1917] bg-white"
                  : "border-[#e3ddcd] bg-white";
            return (
              <label
                key={i}
                className={`mb-2 flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5 ${marco} ${soloLectura ? "cursor-default" : ""}`}
              >
                <input
                  type="radio"
                  name={pregunta.id}
                  checked={marcada}
                  disabled={soloLectura}
                  onChange={() => onMarca(i)}
                  className="mt-[3px] flex-none accent-[#1a1917]"
                />
                <span className="flex-1 text-[13.5px] leading-[1.45]">
                  {opcion}
                </span>
                {esCorrecta ? (
                  <span className="flex-none text-[10px] font-bold text-[#2f6f53]">
                    CORRECTA
                  </span>
                ) : seVe && marcada ? (
                  <span className="flex-none text-[10px] font-bold text-[#a63d2f]">
                    TU RESPUESTA
                  </span>
                ) : null}
              </label>
            );
          })}

          {seVe && pregunta.explanation ? (
            <div className="mt-2 rounded-r-lg border-l-[3px] border-[#8a6300] bg-[#fdf6e3] px-3 py-2.5">
              <p className="mb-1 text-[9.5px] font-bold tracking-[0.12em] text-[#8a6300] uppercase">
                {calificacion === "ACERTO" ? "Por qué es la correcta" : "La correcta y por qué"}
              </p>
              <p className="text-[12px] leading-[1.5] text-[#5a4a20]">
                {pregunta.explanation}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 ml-[22px]">
          <textarea
            defaultValue={respuesta?.text ?? ""}
            disabled={soloLectura}
            rows={4}
            onChange={(e) => onTexto(e.target.value)}
            placeholder="Explícalo con tus palabras, como se lo dirías a alguien de tu casa de fe."
            className="w-full resize-y rounded-lg border border-[#cfc6ae] bg-white px-3 py-2.5 text-[14px] leading-[1.55] disabled:bg-[#f6f3ea] disabled:text-[#5c5648]"
          />
          {!soloLectura ? (
            <p
              className={`mt-1 text-[11px] ${respondida ? "text-[#2f6f53]" : "text-[#8a7f66]"}`}
            >
              {respondida
                ? "✓ Guardada"
                : `Te faltan al menos ${LARGO_MINIMO_RESPUESTA_QUIZ} caracteres`}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
