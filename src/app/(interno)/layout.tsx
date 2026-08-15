import Link from "next/link";
import { salir } from "@/app/ingresar/acciones";
import { ETIQUETA_ROL, requerirUsuario } from "@/lib/auth";
import { ROLES_CONSOLIDACION } from "@/lib/auth";
import { PestanasSuperiores } from "@/components/pestanas-superiores";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function LayoutInterno({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requerirUsuario();
  const puedeConsolidar = ROLES_CONSOLIDACION.includes(usuario.role);

  return (
    <div className="min-h-screen bg-escritorio">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-azul-900 px-5 py-3 text-white sm:px-[26px]">
        <div className="flex flex-wrap items-center gap-4 sm:gap-[26px]">
          <Link href="/" className="flex items-center gap-[10px] text-white">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-white text-[8px] leading-none font-bold tracking-[.08em] text-azul-900">
              LOGO
            </span>
            <span className="text-[11px] leading-none font-semibold tracking-[.16em] opacity-60">
              IGLESIA VIVE
            </span>
          </Link>

          {puedeConsolidar ? <PestanasSuperiores /> : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-[12px] leading-none font-semibold opacity-75 sm:inline">
            {usuario.fullName} · {ETIQUETA_ROL[usuario.role]}
          </span>
          <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-white/15 text-[11px] leading-none font-bold">
            {iniciales(usuario.fullName)}
          </span>
          <form action={salir}>
            <button
              type="submit"
              className="cursor-pointer rounded-[8px] border-0 bg-transparent px-2 py-2 text-[12px] leading-none font-semibold text-white/70 hover:text-white"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
