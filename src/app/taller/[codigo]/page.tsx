import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { abrirTaller, learnerPorToken } from "@/lib/taller";

import { Identificarme } from "./identificarme";
import { Formulario } from "./formulario";

export const metadata = {
  title: "Taller de Casa de Fe · Iglesia Vive",
};

export default async function TallerPublico({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;

  // El código es una credencial: uno desconocido devuelve 404 a secas, sin
  // decir si existe (la regla del token del calendario, 17-sep-2026).
  if (!/^[0-9a-f]{8,64}$/.test(codigo)) notFound();

  const token = (await cookies()).get("taller_vive")?.value;
  const persona = token ? await learnerPorToken(token) : null;

  if (!persona) {
    return <Identificarme codigo={codigo} />;
  }

  const taller = await abrirTaller(codigo, persona.learnerId);
  if (!taller.ok) notFound();

  return (
    <Formulario codigo={codigo} nombre={persona.nombre} taller={taller.datos} />
  );
}
