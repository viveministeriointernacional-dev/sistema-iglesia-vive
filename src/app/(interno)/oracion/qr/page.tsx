import { headers } from "next/headers";
import Link from "next/link";
import { requerirVista } from "@/lib/auth";
import { enlaceDePedirOracion, qrComoSvg } from "@/lib/qr";
import {
  ENLACES,
  enlaceDeWhatsApp,
  WHATSAPP_IGLESIA,
} from "@/lib/whatsapp-enlaces-catalogo";

export const dynamic = "force-dynamic";

export const metadata = { title: "Enlaces y QR para compartir · Iglesia Vive" };

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
            Enlaces y QR para compartir
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
        <section className="tarjeta mt-[14px] p-5 print:hidden">
          <h2 className="etiqueta-seccion">ESCRÍBENOS AL WHATSAPP</h2>
          <p className="mt-3 text-[13px] leading-[1.6] font-medium text-[rgba(19,28,36,.7)]">
            Cada enlace abre el WhatsApp de la iglesia{" "}
            <span className="font-mono text-[12.5px]">+57 322 804 2438</span>{" "}
            <strong>con el mensaje ya escrito</strong>. La persona solo le da
            enviar.
          </p>
          {/* ⚠️ Esto es lo que de verdad desbloquea el WhatsApp: cuando la
              persona escribe primero se abre una ventana de 24 horas en la que
              el equipo responde texto libre, sin plantillas ni aprobación de
              Meta. */}
          <p className="mt-3 rounded-r-[10px] border-l-[3px] border-verde-500 bg-[rgba(22,122,70,.06)] px-4 py-3 text-[12.5px] leading-[1.55] font-medium text-tinta">
            Cuando alguien escribe primero, durante las 24 horas siguientes el
            equipo le puede responder lo que sea, sin plantillas. Por eso vale
            la pena repartir estos enlaces.
          </p>

          <div className="mt-4 flex flex-col gap-[14px]">
            {ENLACES.map((enlaceWa) => {
              const direccion = enlaceDeWhatsApp(enlaceWa.mensaje, WHATSAPP_IGLESIA);
              return (
                <div
                  key={enlaceWa.id}
                  className="flex flex-wrap items-start gap-4 rounded-[12px] border border-[rgba(19,28,36,.14)] p-4"
                >
                  <div
                    className="w-[108px] flex-none"
                    dangerouslySetInnerHTML={{
                      __html: qrComoSvg(direccion, { celda: 3, margen: 1 }),
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] leading-none font-bold tracking-[.07em] text-[rgba(19,28,36,.42)] uppercase">
                      {enlaceWa.donde}
                    </p>
                    <p className="mt-2 text-[14px] leading-[1.4] font-semibold text-tinta">
                      {enlaceWa.mensaje
                        ? `«${enlaceWa.mensaje}»`
                        : "Sin mensaje: el chat abre en blanco"}
                    </p>
                    <p className="mt-2 font-mono text-[11.5px] leading-[1.45] break-all text-[rgba(19,28,36,.5)]">
                      {direccion}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Todos llegan al mismo WhatsApp. Lo que cambia es el mensaje, y eso
            es lo que te dice de dónde salió cada persona.
          </p>
        </section>
      </div>
    </main>
  );
}
