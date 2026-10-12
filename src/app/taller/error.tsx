"use client";

import { useEffect } from "react";
import Link from "next/link";

/// Lo que ve una persona cuando el taller no alcanza a cargar.
///
/// ⚠️ **ESTO EXISTE PARA QUE NADIE VUELVA A VER LA PANTALLA NEGRA DE
/// CLOUDFLARE** («This page couldn't load · A server error occurred ·
/// ERROR …»). Hasta el 12-oct-2026 el proyecto **no tenía ni un solo
/// `error.tsx`**, así que cualquier tropiezo de la base —y con Supabase en
/// plan FREE los hay (CLAUDE.md §9)— salía como esa pantalla, que no dice
/// nada, no se puede pulsar y no está en español.
///
/// ⚠️ **Y AQUÍ IMPORTA MÁS QUE EN NINGUNA OTRA PARTE, porque quien la ve no
/// es del equipo**: es un miembro de una Casa de Fe con el celular en la
/// mano, en la calle, sin cuenta y sin nadie a quien preguntar. Ante una
/// pantalla negra en inglés **abandona** y el taller se queda sin llenar; ante
/// un botón que dice «Volver a intentar» vuelve a pulsar, y casi siempre entra
/// —el fallo es intermitente, no permanente—.
///
/// ⚠️ **LO PRIMERO QUE DICE ES QUE NO PERDIÓ NADA, y no es un consuelo
/// vacío**: el taller se guarda solo 1,5 s después de la última tecla (regla
/// del 27-sep-2026), así que lo escrito está en la base. Sin esa frase, quien
/// llevaba media hora escribiendo da por perdido su trabajo y es entonces
/// cuando de verdad no vuelve.
///
/// ⚠️ **NO se le enseña el mensaje técnico del error.** No le dice nada y
/// puede traer detalles de la consulta; va a la consola, que es donde sirve.
export default function ErrorDelTaller({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[taller] la pantalla no cargó:", error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-[#faf8f1] px-5 py-10 text-[#1a1917]">
      <div className="mx-auto max-w-[520px]">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#8a8372] uppercase">
          Iglesia Vive · Mis talleres
        </p>

        <h1 className="mt-4 font-serif text-[26px] leading-[1.12]">
          La conexión se demoró
        </h1>

        <p className="mt-3 text-[14px] leading-[1.6] text-[#4a463c]">
          No alcanzamos a cargar tu taller. Casi siempre entra al segundo
          intento.
        </p>

        <div className="mt-6 rounded-[14px] border border-[#d8d1bf] bg-[#f3eedd] px-4 py-3.5">
          <p className="text-[13px] leading-[1.55] font-semibold text-[#1a1917]">
            No perdiste nada de lo que escribiste.
          </p>
          <p className="mt-1 text-[13px] leading-[1.55] text-[#4a463c]">
            Tu taller se guarda solo mientras lo llenas, así que tus respuestas
            ya quedaron guardadas.
          </p>
        </div>

        <button
          type="button"
          onClick={reset}
          className="mt-7 w-full rounded-[12px] bg-[#1a1917] px-4 py-3.5 text-[14px] font-semibold text-[#faf8f1]"
        >
          Volver a intentar
        </button>

        <Link
          href="/taller/mis"
          className="mt-3 block w-full rounded-[12px] border border-[#1a1917] px-4 py-3.5 text-center text-[14px] font-semibold text-[#1a1917]"
        >
          Entrar con mi código
        </Link>

        <p className="mt-7 text-[12px] leading-[1.6] text-[#8a8372]">
          Si vuelve a pasar, avísale a tu líder de casa y sigue más tarde: tu
          código de 6 dígitos es el mismo y tus respuestas te esperan.
        </p>
      </div>
    </main>
  );
}
