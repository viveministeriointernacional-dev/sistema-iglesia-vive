import Image from "next/image";
import { FormularioIngreso } from "./formulario";

export const metadata = { title: "Entrar · Iglesia Vive" };

export default async function PaginaIngreso({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string; motivo?: string }>;
}) {
  const { siguiente, motivo } = await searchParams;

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
          Transformación y propósito
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          Entra con el correo que te asignó la iglesia. El rol define lo que ves.
        </p>

        {motivo === "sin-acceso" ? (
          <p className="aviso-ambar mt-4 text-[12.5px] leading-[1.5] font-medium text-ambar-texto">
            Tu sesión no tiene un rol activo en la plataforma.
          </p>
        ) : null}

        <div className="mt-6">
          <FormularioIngreso siguiente={siguiente ?? "/"} />
        </div>
      </div>
    </main>
  );
}
