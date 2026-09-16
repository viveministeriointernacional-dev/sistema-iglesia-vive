import Image from "next/image";
import Link from "next/link";
import { salir } from "@/app/ingresar/acciones";
import { ETIQUETA_ROL, requerirUsuario, ROLES_ADMIN } from "@/lib/auth";
import { VISTA_POR_ID } from "@/lib/vistas-catalogo";
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

  // **La barra se arma desde las vistas que tenga encendidas**, en el orden del
  // catálogo. Antes cada renglón traía su propio predicado de rol aquí mismo;
  // ahora esa decisión vive en `/administracion/vistas` y esto solo la pinta.
  //
  // ⚠️ Esconder una pestaña no cierra su página: cada pantalla repite el
  // guardia con `requerirVista`. Es la lección del 11-sep-2026 — quitar del
  // menú y dejar la dirección abierta sería cosmético.
  const pestanas = usuario.vistas.map((id) => {
    const vista = VISTA_POR_ID.get(id);
    return { href: vista?.ruta ?? "/", etiqueta: vista?.nombre ?? id };
  });

  // Administración no es configurable (es desde donde se configura todo lo
  // demás), así que se añade aparte y al final, como siempre.
  if (ROLES_ADMIN.includes(usuario.role)) {
    pestanas.push({ href: "/administracion", etiqueta: "Administración" });
  }

  return (
    <div className="min-h-screen bg-escritorio">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-azul-900 px-5 py-3 text-white sm:px-[26px]">
        <div className="flex flex-wrap items-center gap-4 sm:gap-[26px]">
          <Link href="/" aria-label="Iglesia Vive · inicio" className="flex items-center">
            <Image
              src="/logo-vive-firma-blanca.png"
              alt="Vive Ministerio Internacional"
              width={119}
              height={28}
              priority
              unoptimized
              className="h-7 w-auto"
            />
          </Link>

          {pestanas.length ? <PestanasSuperiores pestanas={pestanas} /> : null}
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
