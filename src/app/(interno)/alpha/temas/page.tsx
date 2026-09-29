import { headers } from "next/headers";
import Link from "next/link";

import { FaithHouseStatus, Role } from "@iglesia/prisma-client";

import { requerirVista } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { enlaceDelTaller, qrComoSvg } from "@/lib/qr";
import { estadoDelTaller } from "@/lib/taller-catalogo";

import { PestanasDeGrupos } from "../pestanas";
import { EditorDeTema } from "./editor-de-tema";

export default async function LosDoceTemas() {
  const usuario = await requerirVista("grupos");
  const esAdmin = usuario.role === Role.ADMIN;
  const prisma = await getPrisma();

  const base = (await headers()).get("host");
  const origen = `https://${base}`;

  // Un solo viaje: con `PrismaPg max:1` cada consulta suelta es una latencia
  // más en fila (§7).
  const temas = await prisma.faithHouseTopic.findMany({
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      subtitle: true,
      memoryVerse: true,
      qrCode: true,
      _count: { select: { questions: true, days: true } },
      progress: { select: { status: true } },
      workshops: {
        select: {
          submittedAt: true,
          reviews: { orderBy: { reviewedAt: "desc" }, select: { approved: true, reviewedAt: true } },
        },
      },
    },
  });

  const conAvanceParcial = temas.some(
    (t) =>
      t.progress.some((p) => p.status === FaithHouseStatus.COMPLETADO) &&
      t.progress.length < 12,
  );

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Los 12 temas del libro
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              Son los mismos para toda la iglesia · cada tema tiene su taller y
              su QR
            </p>
          </div>
          <PestanasDeGrupos activa="temas" />
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/alpha/temas/qr"
            className="rounded-[7px] bg-azul-900 px-4 py-2.5 text-[13px] font-semibold text-white"
          >
            Ver los 12 QR para imprimir
          </Link>
          <span className="text-[12px] text-[rgba(19,28,36,.55)]">
            Una hoja por tema. Se imprime o se proyecta el del tema del día.
          </span>
        </div>

        {esAdmin ? (
          <p className="mt-5 rounded-lg border border-[#dccfa4] bg-[#fbf4dc] px-3.5 py-3 text-[12.5px] leading-[1.5] text-[#4a3d1c]">
            <strong className="font-semibold">
              Cambiar un nombre reasigna lo que ya está marcado.
            </strong>{" "}
            El avance de cada persona apunta al <em>número</em> del tema, no al
            nombre.
            {conAvanceParcial
              ? " Hay gente a mitad del recorrido: revisa antes de renombrar."
              : null}
          </p>
        ) : (
          <p className="mt-5 text-[12.5px] text-[rgba(19,28,36,.55)]">
            Solo administración puede cambiar los nombres y los talleres.
          </p>
        )}

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {temas.map((tema) => {
            const completados = tema.progress.filter(
              (p) => p.status === FaithHouseStatus.COMPLETADO,
            ).length;
            const porRevisar = tema.workshops.filter(
              (w) => estadoDelTaller(w.submittedAt, w.reviews) === "ENVIADO",
            ).length;

            return (
              <li
                key={tema.id}
                className="rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-semibold tracking-[0.12em] text-[rgba(19,28,36,.45)] uppercase">
                      Tema {tema.number}
                    </p>
                    <h2 className="mt-1 font-serif text-[17px] leading-[1.2] text-tinta">
                      {tema.name}
                    </h2>
                    {tema.subtitle ? (
                      <p className="mt-1 text-[11.5px] leading-[1.35] text-[rgba(19,28,36,.55)]">
                        {tema.subtitle}
                      </p>
                    ) : null}
                    {tema.memoryVerse ? (
                      <p className="mt-1.5 text-[11.5px] font-medium text-[#8a5a12]">
                        {tema.memoryVerse}
                      </p>
                    ) : null}
                  </div>

                  {tema.qrCode ? (
                    <div
                      className="h-[62px] w-[62px] shrink-0 overflow-hidden rounded border border-[rgba(19,28,36,.14)]"
                      // El SVG lo genera el servidor a partir del código del
                      // tema; no hay nada que el navegador pueda inyectar aquí.
                      dangerouslySetInnerHTML={{
                        __html: qrComoSvg(enlaceDelTaller(origen, tema.qrCode), {
                          celda: 2,
                          margen: 1,
                        }),
                      }}
                    />
                  ) : (
                    <span className="shrink-0 text-[11px] text-[#8a5a12]">
                      Sin QR
                    </span>
                  )}
                </div>

                <div className="mt-3 border-t border-[rgba(19,28,36,.08)] pt-2.5 text-[11.5px] text-[rgba(19,28,36,.55)]">
                  <p>
                    {tema._count.questions} preguntas · {tema._count.days} días
                  </p>
                  <p className="mt-1">{completados} lo tienen completado</p>
                  {porRevisar > 0 ? (
                    <p className="mt-1.5">
                      <Link
                        href="/alpha/por-revisar"
                        className="rounded bg-[#b45309] px-1.5 py-0.5 text-[10.5px] font-semibold text-white"
                      >
                        {porRevisar} por revisar
                      </Link>
                    </p>
                  ) : null}
                </div>

                {esAdmin ? (
                  <EditorDeTema
                    topicId={tema.id}
                    nombre={tema.name}
                    subtitulo={tema.subtitle ?? ""}
                    versiculo={tema.memoryVerse ?? ""}
                    tieneAvance={completados > 0}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
