import Link from "next/link";

import { requerirVista } from "@/lib/auth";
import { momentoCorto } from "@/lib/dominio";
import { getPrisma } from "@/lib/prisma";
import { cargarPorRevisar, puedeRevisarTaller } from "@/lib/taller";
import { TOTAL_DE_TEMAS } from "@/lib/taller-catalogo";

import { PestanasDeGrupos } from "../pestanas";
import { PanelDeRevision, type RespuestaVista } from "./panel";

export default async function PorRevisar({
  searchParams,
}: {
  searchParams: Promise<{ taller?: string }>;
}) {
  const usuario = await requerirVista("grupos");
  const cola = await cargarPorRevisar(usuario);
  const parametros = await searchParams;

  // El de la URL si es suyo; si no, el primero de la cola.
  const elegido =
    cola.find((t) => t.workshopId === parametros.taller) ?? cola[0] ?? null;

  let detalle: {
    nombre: string;
    tema: number;
    temaNombre: string;
    enviadoEl: Date;
    casa: string | null;
    learnerId: string;
    completados: number;
    respuestas: RespuestaVista[];
  } | null = null;

  if (elegido) {
    // Se vuelve a comprobar el permiso: el id viene de la URL.
    if (!(await puedeRevisarTaller(usuario, elegido.learnerId))) {
      detalle = null;
    } else {
      const prisma = await getPrisma();
      const taller = await prisma.faithHouseWorkshop.findUnique({
        where: { id: elegido.workshopId },
        select: {
          topic: {
            select: {
              questions: {
                orderBy: { number: "asc" },
                select: { id: true, number: true, kind: true, prompt: true, options: true },
              },
            },
          },
          answers: { select: { questionId: true, text: true, choice: true } },
          learner: {
            select: {
              faithHouseProgress: {
                where: { status: "COMPLETADO" },
                select: { id: true },
              },
            },
          },
        },
      });

      if (taller) {
        const porPregunta = new Map(taller.answers.map((a) => [a.questionId, a]));
        detalle = {
          nombre: elegido.nombre,
          tema: elegido.tema,
          temaNombre: elegido.temaNombre,
          enviadoEl: elegido.enviadoEl,
          casa: elegido.casa,
          learnerId: elegido.learnerId,
          completados: taller.learner.faithHouseProgress.length,
          respuestas: taller.topic.questions.map((p) => {
            const r = porPregunta.get(p.id);
            return {
              number: p.number,
              kind: p.kind,
              prompt: p.prompt,
              texto: r?.text ?? null,
              elegida:
                p.kind === "OPCION" && r?.choice !== null && r?.choice !== undefined
                  ? (p.options[r.choice] ?? null)
                  : null,
            };
          }),
        };
      }
    }
  }

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Talleres por revisar
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              De los que llevas tú y los de tu red
            </p>
          </div>
          <PestanasDeGrupos activa="revisar" porRevisar={cola.length} />
        </header>

        {cola.length === 0 ? (
          <p className="mt-8 rounded-[10px] border border-dashed border-[rgba(19,28,36,.2)] px-5 py-8 text-center text-[13px] text-[rgba(19,28,36,.55)]">
            No hay talleres esperando revisión.
            <br />
            <span className="text-[12px]">
              Cuando alguien envíe el suyo desde el QR, te aparece aquí.
            </span>
          </p>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[340px_1fr]">
            <ul className="space-y-2">
              {cola.map((t) => {
                const esta = t.workshopId === elegido?.workshopId;
                return (
                  <li key={t.workshopId}>
                    <Link
                      href={`/alpha/por-revisar?taller=${t.workshopId}`}
                      aria-current={esta ? "page" : undefined}
                      className={`block rounded-[9px] bg-white p-3 ${
                        esta
                          ? "border-[1.5px] border-tinta"
                          : "border border-[rgba(19,28,36,.14)]"
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="flex-1 text-[14px] font-semibold text-tinta">
                          {t.nombre}
                        </span>
                        <span className="text-[11px] text-[rgba(19,28,36,.5)]">
                          {momentoCorto(t.enviadoEl)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[rgba(19,28,36,.55)]">
                        Tema {t.tema} · {t.temaNombre}
                      </p>
                      <p className="mt-1.5 text-[11.5px] text-[rgba(19,28,36,.55)]">
                        {t.respondidas} de {t.total} respuestas ·{" "}
                        {t.casa ?? "Sin casa asignada"}
                      </p>
                    </Link>
                  </li>
                );
              })}
              <li className="rounded-[9px] border border-dashed border-[rgba(19,28,36,.2)] p-3 text-[11.5px] leading-[1.5] text-[rgba(19,28,36,.55)]">
                Lo enviado queda <strong className="font-semibold">En proceso</strong>{" "}
                hasta que alguien lo apruebe o lo devuelva.
              </li>
            </ul>

            {detalle ? (
              <section className="rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white">
                <header className="border-b border-[rgba(19,28,36,.1)] px-5 py-4">
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-[rgba(19,28,36,.45)] uppercase">
                    Tema {detalle.tema} · {detalle.temaNombre}
                  </p>
                  <h2 className="mt-1 font-serif text-[24px] text-tinta">
                    {detalle.nombre}
                  </h2>
                  <p className="mt-1.5 text-[12.5px] text-[rgba(19,28,36,.55)]">
                    {detalle.casa ?? "Sin casa asignada"} · enviado el{" "}
                    {momentoCorto(detalle.enviadoEl)}
                  </p>
                  <Link
                    href={`/expediente/${detalle.learnerId}`}
                    className="mt-2 inline-block text-[12.5px] font-semibold text-azul-900 underline underline-offset-2"
                  >
                    Ver su expediente →
                  </Link>
                </header>

                <PanelDeRevision
                  workshopId={elegido!.workshopId}
                  respuestas={detalle.respuestas}
                  completados={detalle.completados}
                  totalDeTemas={TOTAL_DE_TEMAS}
                />
              </section>
            ) : (
              <p className="rounded-[10px] border border-[rgba(19,28,36,.14)] px-5 py-8 text-center text-[13px] text-[rgba(19,28,36,.55)]">
                Elige un taller de la lista.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
