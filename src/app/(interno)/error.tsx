"use client";

import { useEffect } from "react";
import Link from "next/link";

/// Lo que ve el equipo cuando una pantalla interna no alcanza a cargar.
///
/// Es el par de `loading.tsx`: ese cubre «el servidor está tardando», este
/// cubre «el servidor no contestó». Hasta el 12-oct-2026 no existía, así que
/// un tropiezo de la base dejaba al equipo mirando la pantalla negra de
/// Cloudflare, en inglés y sin un botón.
///
/// ⚠️ **AQUÍ SÍ SE ENSEÑA EL `digest`, al contrario que en el taller.** Quien
/// mira esto es del equipo y puede pasármelo o buscarlo en el log del worker
/// de Cloudflare — que es **el único sitio donde queda escrito** qué falló
/// (la lección del 24-sep-2026: en Supabase no queda nada). Sin ese código,
/// un «me salió un error» no se puede rastrear.
///
/// ⚠️ **NO se enseña `error.message`.** En producción Next lo reemplaza por un
/// texto genérico de todas formas, y pintarlo solo haría creer que dice algo.
export default function ErrorInterno({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[interno] la pantalla no cargó:", error);
  }, [error]);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[620px]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-ambar-texto uppercase">
          No se pudo cargar
        </p>

        <h1 className="mt-3 font-serif text-[27px] leading-[1.14] text-tinta">
          Esta pantalla no alcanzó a cargar
        </h1>

        <p className="mt-3 text-[14px] leading-[1.6] text-tinta-55">
          Casi siempre es la base de datos tardando más de lo normal. Vuelve a
          intentarlo: suele entrar al segundo intento.
        </p>

        <div className="mt-6 rounded-[14px] border border-borde-tarjeta bg-ambar-fondo px-4 py-3.5">
          <p className="text-[13px] leading-[1.55] font-semibold text-tinta">
            No se perdió nada.
          </p>
          <p className="mt-1 text-[13px] leading-[1.55] text-tinta-55">
            Esto falló al <em>leer</em>, no al guardar. Si acabas de guardar
            algo, quedó guardado.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="rounded-[11px] bg-azul-900 px-4 py-2.5 text-[13.5px] font-semibold text-white"
          >
            Volver a intentar
          </button>
          <Link
            href="/mi-red"
            className="rounded-[11px] border border-borde-control px-4 py-2.5 text-[13.5px] font-semibold text-tinta"
          >
            Ir a Mi red
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-7 text-[12px] leading-[1.6] text-tinta-42">
            Si vuelve a pasar, pasa este código junto con la hora:{" "}
            <span className="font-semibold tabular-nums text-tinta-55">
              {error.digest}
            </span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
