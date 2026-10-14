import type { Metadata } from "next";
import Image from "next/image";
import { FormularioDeOracion } from "./formulario";

export const metadata: Metadata = {
  title: "Pide oración · Iglesia Vive",
  description:
    "Cuéntale al equipo de intercesión de Iglesia Vive por qué quieres que oremos.",
  robots: { index: false, follow: false },
};

/// Enlace público, sin cuenta ni contraseña: se llega por un QR pegado en la
/// iglesia o por WhatsApp.
///
/// ⚠️ **Reconoce a la persona, pero NO crea ficha si no la encuentra.** Es la
/// diferencia con `/actualizar-datos`, que sí da de alta: aquel sirve para
/// registrarse; este es para que alguien que ya está en la casa pida oración.
/// Crear una ficha por cada desconocido llenaría la base de personas sin
/// proceso y sin nadie que las llame.
export default function PaginaPedirOracion() {
  return (
    <main className="min-h-screen bg-escritorio">
      <div className="mx-auto w-full max-w-[560px]">
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
            Pide oración
          </h1>
          <p className="mt-[9px] text-[13px] leading-[1.55] font-medium text-white/70">
            Cuéntanos por qué quieres que oremos. El equipo de intercesión de la
            iglesia va a orar por eso.
          </p>
        </header>

        <div className="px-[14px] pb-10">
          <FormularioDeOracion />
        </div>
      </div>
    </main>
  );
}
