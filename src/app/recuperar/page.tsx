import Image from "next/image";
import { FormularioRecuperar } from "./formulario";

export const metadata = { title: "Recuperar contraseña · Iglesia Vive" };

export default function PaginaRecuperar() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-[420px] rounded-[18px] bg-papel p-7 shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)]">
        <Image
          src="/logo-vive.png"
          alt="Vive Ministerio Internacional"
          width={240}
          height={67}
          priority
          unoptimized
          className="h-auto w-[240px] max-w-full"
        />

        <h1 className="mt-7 font-serif text-[29px] leading-[1.15] font-normal">
          Recuperar contraseña
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          Escribe el correo con el que entras al sistema y te enviamos un enlace
          para crear una contraseña nueva.
        </p>

        <div className="mt-6">
          <FormularioRecuperar />
        </div>
      </div>
    </main>
  );
}
