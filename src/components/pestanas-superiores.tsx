"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/operacion-72", etiqueta: "Operación 72" },
  { href: "/registro", etiqueta: "Registrar persona" },
];

export function PestanasSuperiores() {
  const ruta = usePathname();

  return (
    <nav className="flex items-center gap-2">
      {PESTANAS.map((pestana) => {
        const activa = ruta.startsWith(pestana.href);
        return (
          <Link
            key={pestana.href}
            href={pestana.href}
            aria-current={activa ? "page" : undefined}
            className={`rounded-[8px] px-[13px] py-2 text-[12.5px] leading-none font-semibold text-white ${
              activa ? "bg-white/[.18]" : "bg-transparent"
            }`}
          >
            {pestana.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
