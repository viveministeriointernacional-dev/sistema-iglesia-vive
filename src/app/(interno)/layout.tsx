import Image from "next/image";
import Link from "next/link";
import { Role } from "@iglesia/prisma-client";
import { salir } from "@/app/ingresar/acciones";
import {
  ETIQUETA_ROL,
  requerirUsuario,
  ROLES_CON_RED,
  ROLES_CONSOLIDACION,
} from "@/lib/auth";
import { puedeVerAlpha } from "@/lib/alpha";
import { ROLES_ENTRENAR } from "@/lib/entrenar";
import { ROLES_OPERAN_EVENTOS } from "@/lib/eventos";
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

  const pestanas = [
    ...(ROLES_CON_RED.includes(usuario.role)
      ? [
          { href: "/mi-red", etiqueta: "Mi red" },
          { href: "/red", etiqueta: "Árbol" },
        ]
      : []),
    ...(ROLES_CONSOLIDACION.includes(usuario.role)
      ? [
          { href: "/operacion-72", etiqueta: "Operación 72" },
          { href: "/registro", etiqueta: "Registrar persona" },
        ]
      : []),
    ...(puedeVerAlpha(usuario)
      ? [{ href: "/alpha", etiqueta: "Alpha" }]
      : []),
    ...(ROLES_ENTRENAR.includes(usuario.role)
      ? [{ href: "/escuela", etiqueta: "Escuela" }]
      : []),
    ...(ROLES_OPERAN_EVENTOS.includes(usuario.role)
      ? [{ href: "/eventos", etiqueta: "Eventos" }]
      : []),
    ...(usuario.role === Role.APRENDIZ
      ? [{ href: "/mi-proceso", etiqueta: "Mi proceso" }]
      : []),
  ];

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
