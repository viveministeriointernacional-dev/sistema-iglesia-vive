import Image from "next/image";
import Link from "next/link";
import { FormularioNuevaClave } from "./formulario";

export const metadata = { title: "Crea tu contraseña · Iglesia Vive" };

export default async function PaginaNuevaClave({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

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
          Crea tu contraseña nueva
        </h1>

        {token ? (
          <>
            <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
              Es la que usarás de ahora en adelante para entrar al sistema.
            </p>
            <div className="mt-6">
              <FormularioNuevaClave token={token} />
            </div>
          </>
        ) : (
          <>
            <p className="aviso-ambar mt-4 text-[12.5px] leading-[1.5] font-medium text-ambar-texto">
              Este enlace no es válido. Pide uno nuevo desde «¿Olvidaste tu
              contraseña?».
            </p>
            <p className="mt-5 text-center">
              <Link
                href="/recuperar"
                className="text-[12.5px] leading-none font-semibold text-azul-700"
              >
                Pedir un enlace nuevo
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
