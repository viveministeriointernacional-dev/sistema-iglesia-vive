import type { Metadata } from "next";
import Image from "next/image";
import { FormularioLiderazgo } from "./formulario";

export const metadata: Metadata = {
  title: "Actualiza tus datos · Iglesia Vive",
  description:
    "Para el equipo de liderazgo de Iglesia Vive: actualiza tus datos y cuéntanos por dónde vas en tu proceso.",
  robots: { index: false, follow: false },
};

/// Formulario público del liderazgo. Es un enlace suelto, sin contraseña: la
/// gente del equipo no entra a la plataforma, llena esto desde el celular.
export default function PaginaActualizarDatos() {
  return (
    <main className="min-h-screen bg-escritorio">
      <div className="bg-azul-900 px-5 py-7 sm:px-8 sm:py-9">
        <div className="mx-auto w-full max-w-[560px]">
          <Image
            src="/logo-vive.png"
            alt="Vive Ministerio Internacional"
            width={240}
            height={67}
            priority
            unoptimized
            className="h-auto w-[150px] max-w-full brightness-0 invert"
          />
          <h1 className="mt-5 font-serif text-[27px] leading-[1.15] font-normal text-white sm:text-[32px]">
            Actualiza tus datos
          </h1>
          <p className="mt-[9px] text-[13px] leading-[1.55] font-medium text-white/70">
            Para el equipo de liderazgo. Cuéntanos quién eres y por dónde vas en
            tu proceso. Toma unos 4 minutos.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[560px] px-4 pb-12 sm:px-5">
        <FormularioLiderazgo />
      </div>
    </main>
  );
}
