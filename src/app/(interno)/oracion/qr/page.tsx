import { headers } from "next/headers";
import Link from "next/link";
import { requerirVista } from "@/lib/auth";
import { enlaceDePedirOracion, qrComoSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

export const metadata = { title: "QR de oración y consejería · Iglesia Vive" };

/// **El cartel para imprimir y el enlace para compartir.**
///
/// Vive dentro de `/oracion` y no como vista propia del menú para heredar su
/// permiso (§12.6): quien ve las peticiones ve cómo repartir el link, y no hay
/// que encender nada nuevo en el configurador.
export default async function PaginaQrDeOracion() {
  await requerirVista("oracion");

  // El dominio sale de la petición: un QR impreso desde la vista previa tiene
  // que llevar a la vista previa, no a producción.
  const origen = `https://${(await headers()).get("host")}`;
  const enlace = enlaceDePedirOracion(origen);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[560px]">
        <header className="print:hidden">
          <Link
            href="/oracion"
            className="text-[11.5px] leading-none font-semibold text-azul-700"
          >
            ← Volver a las peticiones
          </Link>
          <h1 className="mt-3 font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            El enlace para pedir oración
          </h1>
          <p className="mt-2 text-[13px] leading-[1.6] font-medium text-[rgba(19,28,36,.6)]">
            Quien lo abra puede pedir oración, pedir consejería o decir que
            quiere empezar un proceso. Si no está registrado, se registra solo.
          </p>
        </header>

        <section className="tarjeta mt-6 p-6 text-center">
          <div
            className="mx-auto w-[260px] max-w-full"
            // El SVG lo genera `qrComoSvg` a partir del enlace de arriba: no
            // hay nada de afuera dentro de esta cadena.
            dangerouslySetInnerHTML={{
              __html: qrComoSvg(enlace, { celda: 6, margen: 2 }),
            }}
          />
          <p className="mt-4 font-serif text-[21px] leading-[1.2] text-tinta">
            ¿Necesitas oración?
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
