import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Registro recibido · Iglesia Vive",
  robots: { index: false, follow: false },
};

export default function PaginaRegistroRecibido() {
  return (
    <main className="grid min-h-screen place-items-center bg-escritorio px-5 py-12">
      <div className="w-full max-w-[520px] rounded-[18px] bg-papel p-7 text-center shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)] sm:p-9">
        <Image
          src="/logo-vive.png"
          alt="Vive Ministerio Internacional"
          width={240}
          height={67}
          priority
          unoptimized
          className="mx-auto h-auto w-[220px] max-w-full"
        />
        <div className="mx-auto mt-8 grid h-14 w-14 place-items-center rounded-full bg-verde-100 text-2xl text-verde-700">
          ✓
        </div>
        <h1 className="mt-5 font-serif text-[31px] font-normal">
          Gracias por registrarte
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed font-medium text-tinta-55">
          Recibimos tu información. Muy pronto una persona de nuestro equipo se
          pondrá en contacto contigo.
        </p>
        <Link href="/registro" className="boton-secundario mt-7 inline-block">
          Volver al formulario
        </Link>
      </div>
    </main>
  );
}
