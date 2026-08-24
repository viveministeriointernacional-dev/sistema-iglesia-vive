import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormularioRegistroPublico } from "./formulario";

export const metadata: Metadata = {
  title: "Registro · Iglesia Vive",
  description:
    "Déjanos tus datos para conocerte y acompañarte en Iglesia Vive.",
  robots: { index: false, follow: false },
};

export default function PaginaRegistroPublico() {
  return (
    <main className="min-h-screen bg-escritorio px-5 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-[740px]">
        <div className="rounded-[18px] bg-papel px-5 py-7 shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)] sm:px-8">
          <Image
            src="/logo-vive.png"
            alt="Vive Ministerio Internacional"
            width={240}
            height={67}
            priority
            unoptimized
            className="h-auto w-[220px] max-w-full"
          />
          <h1 className="mt-7 font-serif text-[34px] leading-tight font-normal">
            Queremos conocerte
          </h1>
          <p className="mt-2 max-w-[590px] text-[14px] leading-relaxed font-medium text-tinta-55">
            Completa este formulario y nuestro equipo podrá darte la bienvenida,
            escucharte y acompañarte. Tu información se guarda directamente en
            el sistema de Iglesia Vive.
          </p>

          <FormularioRegistroPublico />

          <p className="mt-7 text-center text-[11.5px] text-tinta-42">
            ¿Eres parte del equipo?{" "}
            <Link href="/ingresar" className="font-bold text-azul-700 underline">
              Ingresa a la plataforma
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
