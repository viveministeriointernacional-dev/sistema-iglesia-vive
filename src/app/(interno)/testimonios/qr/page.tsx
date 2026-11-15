import { headers } from "next/headers";
import Link from "next/link";
import { requerirVista } from "@/lib/auth";
import { enlaceDeMilagros, qrComoSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

export const metadata = { title: "Enlace y QR de testimonios · Iglesia Vive" };

/// **El cartel para imprimir y el enlace para compartir** «Cuéntanos tu
/// milagro». Vive dentro de `/testimonios` para heredar su permiso (§12.6).
export default async function PaginaQrDeTestimonios() {
  await requerirVista("testimonios");

  // El dominio sale de la petición: un QR impreso desde la vista previa lleva a
  // la vista previa, no a producción.
  const origen = `https://${(await headers()).get("host")}`;
  const enlace = enlaceDeMilagros(origen);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[560px]">
        <header className="print:hidden">
          <Link
            href="/testimonios"
            className="text-[11.5px] leading-none font-semibold text-azul-700"
          >
            ← Volver a los testimonios
          </Link>
          <h1 className="mt-3 font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Enlace y QR para compartir
          </h1>
          <p className="mt-2 text-[13px] leading-[1.6] font-medium text-[rgba(19,28,36,.6)]">
            Quien lo abra puede contar su milagro con su nombre, celular y edad.
            No necesita cuenta. Lo que escriba aparece en Testimonios.
          </p>
        </header>

        <section className="tarjeta mt-6 p-6 text-center">
          <div
            className="mx-auto w-[260px] max-w-full"
            // El SVG lo genera `qrComoSvg` a partir del enlace de arriba: no hay
            // nada de afuera dentro de esta cadena.
            dangerouslySetInnerHTML={{
              __html: qrComoSvg(enlace, { celda: 6, margen: 2 }),
            }}
          />
          <p className="mt-4 font-serif text-[21px] leading-[1.2] text-tinta">
            Cuéntanos tu milagro
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.6)]">
            Apunta con la cámara de tu celular.
          </p>
          <p className="mt-4 font-mono text-[12.5px] leading-[1.4] break-all text-[rgba(19,28,36,.55)]">
            {enlace}
          </p>
        </section>

        <section className="tarjeta mt-[14px] p-5 print:hidden">
          <h2 className="etiqueta-seccion">PARA COMPARTIRLO</h2>
          <p className="mt-3 text-[13px] leading-[1.6] font-medium text-[rgba(19,28,36,.7)]">
            Copia esta dirección y mándala por WhatsApp, ponla en la
            presentación del servicio o imprime esta página y pégala en la
            cartelera.
          </p>
          <p className="mt-3 rounded-[10px] bg-papel p-3 font-mono text-[13px] leading-[1.45] break-all text-tinta">
            {enlace}
          </p>
          <p className="mt-4 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            El QR y el enlace llevan al mismo sitio. No caducan.
          </p>
        </section>
      </div>
    </main>
  );
}
