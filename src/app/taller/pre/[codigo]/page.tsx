import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { learnerPorToken } from "@/lib/taller";
import { COOKIE_TALLER } from "@/lib/taller-catalogo";
import { abrirTallerPre } from "@/lib/prematrimonial";

import { Identificarme } from "../../[codigo]/identificarme";
import { FormularioPre } from "./formulario";

export const metadata = {
  title: "Taller del prematrimonial · Iglesia Vive",
};

export default async function TallerPrematrimonial({
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
    return <Identificarme codigo={null} titulo="Tu taller del prematrimonial" />;
  }

  const taller = await abrirTallerPre(codigo, persona.learnerId);

  // ⚠️ Un tema sin preguntas todavía, o alguien que no está en un
  // prematrimonial abierto, recibe una explicación — no un 404. Aquí el 404
  // sería desconcertante: la persona llegó con su enlace bueno.
  if (!taller.ok) {
    return (
      <main className="min-h-dvh bg-[#faf8f1] text-[#1a1917]">
        <div className="mx-auto max-w-[520px] px-5 py-10">
          <h1 className="font-serif text-[24px] leading-[1.15]">
            Todavía no puedes llenar este taller
          </h1>
          <p className="mt-3 text-[14px] leading-[1.6] text-[#5c5648]">
            {taller.mensaje}
          </p>
          <Link
            href="/taller/mis"
            className="mt-6 inline-block text-[13.5px] font-semibold text-[#7a3b5c] underline underline-offset-2"
          >
            ← Volver a mis talleres
          </Link>
        </div>
      </main>
    );
  }

  return (
    <FormularioPre codigo={codigo} nombre={persona.nombre} taller={taller.datos} />
  );
}
