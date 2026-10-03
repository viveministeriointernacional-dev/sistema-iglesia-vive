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
///
/// ⚠️ **El MISMO formulario sirve para dos cosas, y lo decide el enlace**
/// (3-oct-2026): con `?escuela=1` —el QR del entrenamiento de Ser Líder— al
/// enviarlo la persona **queda inscrita en la Escuela**; sin el parámetro, el
/// enlace de siempre solo actualiza datos. Se hizo así porque el enlace viejo
/// **ya circula** (por ahí entraron 26 declaraciones), y si inscribiera a todo
/// el que lo llena, cualquiera que venga a corregir su celular acabaría
/// inscrito sin pedirlo y habría que darle de baja a mano.
export default async function PaginaActualizarDatos({
  searchParams,
}: {
  searchParams: Promise<{ escuela?: string }>;
}) {
  const { escuela } = await searchParams;
  const paraEscuela = escuela === "1";

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
            {paraEscuela ? "Escuela Ser Líder" : "Actualiza tus datos"}
          </h1>
          <p className="mt-[9px] text-[13px] leading-[1.55] font-medium text-white/70">
            {paraEscuela
              ? "Confirma tus datos y quedas inscrito en el entrenamiento. Toma unos 4 minutos."
              : "Para el equipo de liderazgo. Cuéntanos quién eres y por dónde vas en tu proceso. Toma unos 4 minutos."}
          </p>
        </header>

        <div className="px-[14px] pb-10">
          <FormularioLiderazgo paraEscuela={paraEscuela} />
        </div>
      </div>
    </main>
  );
}
