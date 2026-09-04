import type { Metadata } from "next";
import Image from "next/image";
import { FormularioLiderazgo } from "./formulario";

export const metadata: Metadata = {
  title: "Actualiza tus datos · Iglesia Vive",
  description:
    "Para el equipo de liderazgo de Iglesia Vive: actualiza tus datos y cuéntanos por dónde vas en tu proceso.",
  robots: { index: false, follow: false },
};

/// Enlace público, sin contraseña: el equipo de liderazgo no entra a la
/// plataforma. La llave es el celular (ver `src/lib/liderazgo.ts`).
export default function PaginaActualizarDatos() {
  return (
    <main className="min-h-screen bg-escritorio">
      <div className="mx-auto w-full max-w-[620px]">
        <header className="bg-azul-900 px-[22px] py-7 sm:rounded-b-[18px]">
          <Image
            src="/logo-vive.png"
            alt="Vive Ministerio Internacional"
            width={240}
            height={67}
            priority
            unoptimized
            className="h-auto w-[150px] max-w-full brightness-0 invert"
          />
          <h1 className="mt-5 font-serif text-[27px] leading-[1.15] font-normal text-white">
            Actualiza tus datos
          </h1>
          <p className="mt-[9px] text-[13px] leading-[1.55] font-medium text-white/70">
            Para el equipo de liderazgo. Cuéntanos quién eres y por dónde vas en
            tu proceso. Toma unos 4 minutos.
          </p>
        </header>

        <div className="px-[14px] pb-10">
          <FormularioLiderazgo />
        </div>
      </div>
    </main>
  );
}
