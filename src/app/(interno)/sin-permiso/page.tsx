import Link from "next/link";

export const metadata = { title: "Sin permiso · Iglesia Vive" };

export default function SinPermiso() {
  return (
    <main className="grid place-items-start justify-center px-5 py-[30px] pb-16">
      <div className="w-full max-w-[560px] rounded-[18px] bg-papel px-7 py-8 shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)]">
        <h1 className="font-serif text-[29px] leading-[1.15] font-normal">
          Esta pantalla no es para tu rol
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          Cada persona ve solo lo que le corresponde por su rol y su red. Si crees
          que necesitas este acceso, pídelo a un líder responsable.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-[12.5px] leading-none font-semibold text-azul-700"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
