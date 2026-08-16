"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Pestana = { href: string; etiqueta: string };

export function PestanasSuperiores({ pestanas }: { pestanas: Pestana[] }) {
  const ruta = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {pestanas.map((pestana) => {
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
