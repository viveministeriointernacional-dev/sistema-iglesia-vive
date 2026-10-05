import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { abrirCuestionario } from "@/lib/cuestionario";
import { learnerPorToken } from "@/lib/taller";
import { COOKIE_TALLER } from "@/lib/taller-catalogo";

import { Identificarme } from "../../[codigo]/identificarme";
import { FormularioDelQuiz } from "./formulario";

export const metadata = {
  title: "Cuestionario del tema · Escuela Ser Líder · Iglesia Vive",
};

export default async function CuestionarioDelTema({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;

  // El código es una credencial: uno desconocido devuelve 404 a secas, sin
  // decir si existe (la regla del token del calendario, 17-sep-2026).
  if (!/^[0-9a-f]{8,64}$/.test(codigo)) notFound();

  const token = (await cookies()).get(COOKIE_TALLER)?.value;
  const persona = token ? await learnerPorToken(token) : null;

  if (!persona) {
    return (
      <Identificarme
        codigo={null}
        rotulo="Iglesia Vive · Escuela Ser Líder"
        titulo="Cuestionario de líderes"
        ayuda="Pídeselo a tu coordinador de la Escuela Ser Líder: él lo tiene."
      />
    );
  }

  const quiz = await abrirCuestionario(codigo, persona.learnerId);

  // ⚠️ Un tema sin material todavía recibe una explicación, no un 404: el
  // líder llegó con su enlace bueno y el 404 sería desconcertante.
  if (!quiz.ok) {
    return (
      <main className="min-h-dvh bg-[#faf8f1] text-[#1a1917]">
        <div className="mx-auto max-w-[520px] px-5 py-10">
          <h1 className="font-serif text-[24px] leading-[1.15]">
            Todavía no puedes llenar este cuestionario
          </h1>
          <p className="mt-3 text-[14px] leading-[1.6] text-[#5c5648]">
            {quiz.mensaje}
          </p>
          <Link
            href="/taller/lider"
            className="mt-6 inline-block text-[13.5px] font-semibold text-[#8a5a12] underline underline-offset-2"
          >
            ← Volver a los 12 temas
          </Link>
        </div>
      </main>
    );
  }

  return (
    <FormularioDelQuiz codigo={codigo} nombre={persona.nombre} quiz={quiz.datos} />
  );
}
