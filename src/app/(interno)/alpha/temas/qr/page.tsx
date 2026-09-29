import { headers } from "next/headers";
import Link from "next/link";

import { requerirVista } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { enlaceDelTaller, qrComoSvg } from "@/lib/qr";

/// La hoja de los 12 QR, para imprimir.
///
/// ⚠️ **Es una página, no un archivo que se descarga.** Generar un PDF en el
/// worker pediría una librería pesada y una fuente embebida; el navegador ya
/// sabe imprimir y guardar como PDF, y así la hoja sale con la tipografía del
/// sistema. Cada tema ocupa su propio bloque y no se parte a la mitad
/// (`break-inside-avoid`).
export default async function HojaDeQr() {
  await requerirVista("grupos");
  const prisma = await getPrisma();

  const base = (await headers()).get("host");
  const origen = `https://${base}`;

  const temas = await prisma.faithHouseTopic.findMany({
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      name: true,
      subtitle: true,
      memoryVerse: true,
      qrCode: true,
    },
  });

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px] print:p-0">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] text-tinta">
              Los 12 QR para imprimir
            </h1>
            <p className="mt-2 text-[13px] font-medium text-[rgba(19,28,36,.55)]">
              Imprime esta página, o guárdala como PDF desde el diálogo de
              impresión. Recorta el del tema que vas a dar.
            </p>
          </div>
          <Link
            href="/alpha/temas"
            className="rounded-[7px] border border-[rgba(19,28,36,.2)] px-4 py-2.5 text-[13px] font-semibold text-tinta"
          >
            Volver a los temas
          </Link>
        </header>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-4">
          {temas.map((tema) => (
            <section
              key={tema.id}
              className="break-inside-avoid rounded-[10px] border border-[rgba(19,28,36,.25)] bg-white p-5 text-center"
            >
              <p className="text-[10.5px] font-semibold tracking-[0.14em] text-[rgba(19,28,36,.5)] uppercase">
                Iglesia Vive · Casa de Fe
              </p>
              <p className="mt-2 text-[11px] font-semibold text-[rgba(19,28,36,.55)]">
                Tema {tema.number}
              </p>
              <h2 className="mt-0.5 font-serif text-[20px] leading-[1.15] text-tinta">
                {tema.name}
              </h2>
              {tema.subtitle ? (
                <p className="mt-1 text-[11.5px] text-[rgba(19,28,36,.55)]">
                  {tema.subtitle}
                </p>
              ) : null}

              {tema.qrCode ? (
                <div
                  className="mx-auto mt-3 w-[190px]"
                  dangerouslySetInnerHTML={{
                    __html: qrComoSvg(enlaceDelTaller(origen, tema.qrCode), {
                      celda: 5,
                      margen: 2,
                    }),
                  }}
                />
              ) : (
                <p className="mt-4 text-[12px] text-[#8a3226]">
                  Este tema todavía no tiene código.
                </p>
              )}

              <p className="mt-3 text-[12.5px] leading-[1.45] font-semibold text-tinta">
                Escanea y haz tu taller
              </p>
              {tema.memoryVerse ? (
                <p className="mt-1 text-[11.5px] text-[#8a5a12]">
                  Memoriza {tema.memoryVerse}
                </p>
              ) : null}
              <p className="mt-2 text-[10.5px] text-[rgba(19,28,36,.45)]">
                No necesitas cuenta: solo tu número de celular
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
