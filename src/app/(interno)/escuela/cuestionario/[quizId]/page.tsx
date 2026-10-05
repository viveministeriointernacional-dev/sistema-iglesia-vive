import Link from "next/link";
import { notFound } from "next/navigation";

import { requerirVista } from "@/lib/auth";
import { momentoCorto } from "@/lib/dominio";
import {
  cargarRevisionDelQuiz,
  puedeRevisarCuestionario,
  type RenglonRevisado,
} from "@/lib/cuestionario";

import { PanelDeRevision } from "./panel";

export const metadata = { title: "Revisar cuestionario · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// La revisión de UN tema de UN líder.
///
/// ⚠️ **Aquí el coordinador SÍ ve la respuesta correcta de las de marcar**, al
/// contrario que el líder mientras el tema está abierto. Es su trabajo, y es
/// lo que le permite decidir sin tener el libro delante.
export default async function RevisarCuestionario({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;

  const usuario = await requerirVista("escuela");
  if (!puedeRevisarCuestionario(usuario)) notFound();

  const r = await cargarRevisionDelQuiz(quizId);
  if (!r) notFound();

  const abiertas = r.renglones.filter((x) => x.kind !== "OPCION");
  const deMarcar = r.renglones.filter((x) => x.kind === "OPCION");

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[900px]">
        <Link
          href="/escuela/cuestionario"
          className="text-[12.5px] font-semibold text-azul-900 underline underline-offset-2"
        >
          ← Volver al cuestionario de líderes
        </Link>

        <header className="mt-4">
          <h1 className="font-serif text-[28px] leading-[1.12] font-normal text-tinta">
            {r.nombre}
          </h1>
          <p className="mt-2 text-[14px] leading-[1.4] font-medium text-tinta">
            Tema {r.tema.number} · {r.tema.name}
          </p>
          {r.tema.subtitle ? (
            <p className="mt-0.5 text-[12.5px] leading-[1.4] text-[rgba(19,28,36,.55)] italic">
              {r.tema.subtitle}
            </p>
          ) : null}

          {/* ⚠️ **El encabezado dice qué juzga el sistema y qué no.** De las
              preguntas de este tema, el sistema solo puede comparar las de
              marcar; las abiertas las lee el coordinador. Decirlo evita que
              nadie lea una pantalla pensando que ya está todo calificado. */}
          <p className="mt-3 rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-[rgba(19,28,36,.72)]">
            {r.renglones.length} preguntas ·{" "}
            <strong className="font-semibold text-tinta">
              {r.abiertas} las lees tú
            </strong>{" "}
            (el sistema no las califica)
            {r.resultado.calificables > 0 ? (
              <>
                {" "}
                · en las {r.resultado.calificables} de marcar acertó{" "}
                <strong
                  className={`font-semibold ${
                    r.resultado.fallos === 0 ? "text-[#2f6f53]" : "text-[#a63d2f]"
                  }`}
                >
                  {r.resultado.aciertos} de {r.resultado.calificables}
                </strong>
              </>
            ) : null}
            {r.enviadoEl ? ` · enviado el ${momentoCorto(r.enviadoEl)}` : ""}
          </p>

          {!r.inscrito ? (
            <p className="mt-2.5 rounded-[10px] border border-[#e8d7a8] bg-[#fbf4dc] px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-[#7a5200]">
              Esta persona <strong>no está inscrita</strong> en la escuela
              abierta. El cuestionario no lo exige, pero conviene saberlo antes
              de habilitarla para dictar.
            </p>
          ) : null}

          {/* ⚠️ **Que sea un reenvío se dice arriba, no se esconde.** A este
              líder ya le devolvieron este mismo tema: si no se dijera, el
              coordinador podría estar devolviéndoselo por cuarta vez sin
              enterarse de que el problema ya no es el cuestionario. */}
          {r.vuelta > 1 ? (
            <p className="mt-2.5 rounded-[10px] border-[1.5px] border-[#e0b4ac] bg-[#fdf1ee] px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-[#8a3226]">
              Es la <strong>vuelta {r.vuelta}</strong>: ya se le devolvió este
              tema {r.vuelta - 1} {r.vuelta - 1 === 1 ? "vez" : "veces"}.
            </p>
          ) : null}
        </header>

        {r.tema.leaderNote ? (
          <section className="mt-5 rounded-[10px] border border-[#e3d2a8] bg-[#fdf6e3] px-4 py-3.5">
            <h2 className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-[#8a6300] uppercase">
              Nota para el líder · lo que este tema tiene de delicado
            </h2>
            <p className="text-[12.5px] leading-[1.55] text-[#5a4a20]">
              {r.tema.leaderNote}
            </p>
          </section>
        ) : null}

        {/* Lo que hay que juzgar a mano va PRIMERO: es el trabajo de verdad. */}
        {abiertas.length > 0 ? (
          <section className="mt-7">
            <h2 className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[rgba(19,28,36,.55)] uppercase">
              Para leer y juzgar · {abiertas.length}
            </h2>
            <div className="grid gap-3">
              {abiertas.map((x) => (
                <article
                  key={x.questionId}
                  className="rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-4 py-3.5"
                >
                  <p className="text-[13.5px] leading-[1.45] font-semibold">
                    {x.number}. {x.prompt}
                  </p>
                  {x.texto ? (
                    <p className="mt-2.5 rounded-r-[8px] border-l-[3px] border-[rgba(19,28,36,.2)] bg-[#faf8f1] px-3 py-2.5 text-[13px] leading-[1.6] whitespace-pre-wrap">
                      {x.texto}
                    </p>
                  ) : (
                    <p className="mt-2.5 text-[12.5px] leading-[1.45] text-[#a63d2f]">
                      Sin responder.
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {deMarcar.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[rgba(19,28,36,.55)] uppercase">
              Las de marcar · ya calificadas por el sistema
            </h2>
            <div className="grid gap-3">
              {deMarcar.map((x) => (
                <DeMarcar key={x.questionId} x={x} />
              ))}
            </div>
          </section>
        ) : null}

        {r.historial.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[rgba(19,28,36,.55)] uppercase">
              Lo que ya se le dijo
            </h2>
            <ul className="grid gap-2">
              {r.historial.map((h, i) => (
                <li
                  key={i}
                  className={`rounded-[10px] border px-3.5 py-2.5 ${
                    h.approved
                      ? "border-[#cfe3d8] bg-[#edf5f0]"
                      : "border-[#e0b4ac] bg-[#fdf1ee]"
                  }`}
                >
                  <p className="text-[11.5px] font-bold tracking-[0.1em] uppercase">
                    <span className={h.approved ? "text-[#2f6f53]" : "text-[#a63d2f]"}>
                      {h.approved ? "Aprobado" : "Devuelto"}
                    </span>
                    <span className="ml-2 font-medium tracking-normal text-[rgba(19,28,36,.55)] normal-case">
                      {momentoCorto(h.reviewedAt)}
                      {h.quien ? ` · ${h.quien}` : ""}
                    </span>
                  </p>
                  {h.note ? (
                    <p className="mt-1.5 text-[12.5px] leading-[1.5]">{h.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <PanelDeRevision quizId={r.quizId} estado={r.estado} nombre={r.nombre} />
      </div>
    </main>
  );
}

function DeMarcar({ x }: { x: RenglonRevisado }) {
  const acerto = x.calificacion === "ACERTO";
  const sinResponder = x.calificacion === "SIN_RESPONDER";

  return (
    <article
      className={`rounded-[10px] border px-4 py-3.5 ${
        acerto
          ? "border-[#cfe3d8] bg-[#f6faf8]"
          : "border-[1.5px] border-[#e0b4ac] bg-[#fefaf9]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="flex-1 text-[13.5px] leading-[1.45] font-semibold">
          {x.number}. {x.prompt}
        </p>
        <span
          className={`flex-none rounded-[7px] px-2 py-0.5 text-[10px] font-bold ${
            acerto
              ? "bg-[#2f6f53] text-white"
              : sinResponder
                ? "bg-[rgba(19,28,36,.5)] text-white"
                : "bg-[#a63d2f] text-white"
          }`}
        >
          {acerto ? "ACERTÓ" : sinResponder ? "SIN RESPONDER" : "FALLÓ"}
        </span>
      </div>

      <ul className="mt-2.5 grid gap-1">
        {x.options.map((opcion, i) => {
          const esCorrecta = x.correcta === i;
          const marcada = x.marcada === i;
          return (
            <li
              key={i}
              className={`flex items-start gap-2 rounded-[8px] px-2.5 py-1.5 text-[12.5px] leading-[1.45] ${
                esCorrecta
                  ? "bg-[#edf5f0] font-semibold"
                  : marcada
                    ? "bg-[#fdf1ee]"
                    : ""
              }`}
            >
              <span className="min-w-0 flex-1">{opcion}</span>
              {esCorrecta ? (
                <span className="flex-none text-[10px] font-bold text-[#2f6f53]">
                  CORRECTA
                </span>
              ) : null}
              {marcada && !esCorrecta ? (
                <span className="flex-none text-[10px] font-bold text-[#a63d2f]">
                  MARCÓ ESTA
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {x.explicacion ? (
        <p className="mt-2.5 rounded-r-[8px] border-l-[3px] border-[#8a6300] bg-[#fdf6e3] px-3 py-2 text-[12px] leading-[1.5] text-[#5a4a20]">
          {x.explicacion}
        </p>
      ) : null}
    </article>
  );
}
