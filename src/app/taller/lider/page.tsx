import Link from "next/link";
import { cookies } from "next/headers";

import { momentoCorto } from "@/lib/dominio";
import { cargarMiCuestionario, type MiTemaQuiz } from "@/lib/cuestionario";
import { ETIQUETA_TEMA_QUIZ, type EstadoTemaQuiz } from "@/lib/cuestionario-catalogo";
import { learnerPorToken } from "@/lib/taller";
import { COOKIE_TALLER, codigoLegible } from "@/lib/taller-catalogo";

import { Identificarme } from "../[codigo]/identificarme";

export const metadata = {
  title: "Cuestionario de líderes · Escuela Ser Líder · Iglesia Vive",
};

/// **El QR de la Escuela Ser Líder.** Los 12 temas del Cuestionario de Dominio
/// con el estado de cada uno.
///
/// ⚠️ **Todo se pinta en el SERVIDOR: no hay una sola línea de JavaScript.** Es
/// un tablero de lectura con doce enlaces, y lo abre un líder desde su celular
/// en una reunión — cargarle un paquete de JS para enseñar doce renglones sería
/// pagar por nada.
export default async function CuestionarioDeLideres() {
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

  const mi = await cargarMiCuestionario(persona.learnerId);
  const nombreDePila = persona.nombre.split(" ")[0] ?? persona.nombre;

  return (
    <main className="min-h-dvh bg-[#faf8f1] text-[#1a1917]">
      <div className="mx-auto max-w-[520px]">
        <header className="bg-[#1a1917] px-5 py-6 text-[#faf8f1]">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[#c8c0ac] uppercase">
            Iglesia Vive · Escuela Ser Líder
          </p>
          <h1 className="mt-3.5 font-serif text-[26px] leading-[1.12]">
            Cuestionario de líderes
          </h1>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-[#d8d1bf]">
            Hola, {nombreDePila}. Esto no es el taller del libro: es para
            verificar que dominas cada tema antes de dictarlo en una Casa de Fe.
          </p>

          <div className="mt-[18px] flex items-baseline justify-between gap-3 rounded-xl border border-[#3a3733] px-3.5 py-3">
            <div>
              <p className="mb-1 text-[9.5px] font-bold tracking-[0.14em] text-[#b8b0a0] uppercase">
                Tu código
              </p>
              <p className="text-[27px] font-medium tracking-[0.14em] tabular-nums">
                {codigoLegible(mi.codigo)}
              </p>
            </div>
            <p className="max-w-[130px] text-right text-[10.5px] leading-[1.4] text-[#b8b0a0]">
              Con estos 6 números entras desde cualquier teléfono. Es solo tuyo.
            </p>
          </div>
        </header>

        <section className="px-5 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <strong className="text-[19px] font-semibold">
              {mi.aprobados} de {mi.total} temas aprobados
            </strong>
            <span className="text-[11.5px] font-medium text-[#5c5648]">
              {mi.total - mi.aprobados === 0
                ? "¡Dominas el libro!"
                : `Te faltan ${mi.total - mi.aprobados}`}
            </span>
          </div>
          <div
            className="mt-2 flex gap-[2px] overflow-hidden rounded-full"
            role="img"
            aria-label={`${mi.aprobados} de ${mi.total} temas aprobados`}
          >
            {mi.temas.map((tema) => (
              <i key={tema.number} className={`h-2 flex-1 ${COLOR[tema.estado]}`} />
            ))}
          </div>
          <p className="mt-2.5 text-[11.5px] leading-[1.5] text-[#5c5648]">
            Cada tema lo revisa tu coordinador: las preguntas abiertas las lee
            él, y las de marcar las revisa el sistema.
          </p>
        </section>

        {mi.porCorregir.length > 0 ? (
          <section className="px-5 pt-6">
            <h2 className="mb-2.5 text-[10px] font-bold tracking-[0.14em] text-[#5c5648] uppercase">
              Primero, lo que hay que repasar
            </h2>
            {mi.porCorregir.map((tema) => (
              <Renglon key={tema.number} tema={tema} />
            ))}
          </section>
        ) : null}

        <section className="px-5 pt-6 pb-7">
          <h2 className="mb-2.5 text-[10px] font-bold tracking-[0.14em] text-[#5c5648] uppercase">
            {mi.porCorregir.length > 0 ? "Los demás temas" : "Los 12 temas del libro"}
          </h2>
          {mi.resto.map((tema) => (
            <Renglon key={tema.number} tema={tema} />
          ))}
        </section>

        <footer className="border-t border-[#e3ddcd] px-5 pt-5 pb-9 text-[11.5px] leading-[1.55] text-[#5c5648]">
          <p className="mb-2.5">
            <strong className="text-[#1a1917]">No necesitas contraseña.</strong>{" "}
            Cada cuestionario se va guardando mientras lo llenas, así que puedes
            hacerlo en varios días.
          </p>
          <Link
            href="/taller/mis"
            className="font-semibold text-[#8a5a12] underline underline-offset-2"
          >
            Ver también mis talleres de Casa de Fe
          </Link>
        </footer>
      </div>
    </main>
  );
}

const COLOR: Record<EstadoTemaQuiz, string> = {
  APROBADO: "bg-[#2f6f53]",
  ESPERANDO: "bg-[#8a5a12]",
  DEVUELTO: "bg-[#a63d2f]",
  EMPEZADO: "bg-[#cfc6ae]",
  SIN_EMPEZAR: "bg-[#e8e2d2]",
};

const MARCO: Record<EstadoTemaQuiz, string> = {
  APROBADO: "border-[#cfe3d8] bg-[#edf5f0]",
  ESPERANDO: "border-[#e8d7a8] bg-[#fbf4dc]",
  DEVUELTO: "border-[1.5px] border-[#e0b4ac] bg-[#fdf1ee]",
  EMPEZADO: "border-[#e3ddcd] bg-white",
  SIN_EMPEZAR: "border-[#e3ddcd] bg-white",
};

const NUMERO: Record<EstadoTemaQuiz, string> = {
  APROBADO: "bg-[#2f6f53] text-white",
  ESPERANDO: "bg-[#8a5a12] text-white",
  DEVUELTO: "bg-[#a63d2f] text-white",
  EMPEZADO: "bg-[#f1ece0] text-[#5c5648]",
  SIN_EMPEZAR: "bg-[#f1ece0] text-[#5c5648]",
};

const TONO: Record<EstadoTemaQuiz, string> = {
  APROBADO: "font-semibold text-[#2f6f53]",
  ESPERANDO: "font-semibold text-[#8a5a12]",
  DEVUELTO: "font-bold text-[#a63d2f]",
  EMPEZADO: "text-[#5c5648]",
  SIN_EMPEZAR: "text-[#5c5648]",
};

function Renglon({ tema }: { tema: MiTemaQuiz }) {
  // ⚠️ **Un tema aprobado SÍ abre**, al contrario que en Casa de Fe, y es a
  // propósito: ahí es donde el líder ve por fin qué acertó y qué falló, con la
  // explicación doctrinal de cada respuesta. No puede cambiar nada —el núcleo
  // lo rechaza—, pero es lo que convierte el examen en enseñanza.
  // Un tema **sin material** no abre: daría una pantalla que no promete nada.
  const abre = tema.preguntas > 0;
  const clases = `mb-2.5 block rounded-xl border p-[13px_14px] ${MARCO[tema.estado]}`;

  const cuerpo = (
    <>
      <div className="flex items-start gap-[11px]">
        <span
          className={`grid h-[26px] w-[26px] flex-none place-items-center rounded-full text-[12px] font-bold tabular-nums ${NUMERO[tema.estado]}`}
        >
          {tema.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mt-0.5 text-[15px] leading-[1.25] font-semibold">
            {tema.name}
          </p>
          {tema.subtitle ? (
            <p className="mt-0.5 text-[11.5px] leading-[1.35] text-[#5c5648] italic">
              {tema.subtitle}
            </p>
          ) : null}
          <p className={`mt-[5px] text-[11.5px] leading-[1.45] ${TONO[tema.estado]}`}>
            {rotulo(tema)}
          </p>
        </div>
        {abre ? (
          <span aria-hidden className="flex-none text-[17px] leading-[1.5] text-[#b6ac95]">
            ›
          </span>
        ) : null}
      </div>

      {tema.estado === "DEVUELTO" && tema.notaDelCoordinador ? (
        <div className="mt-2.5 ml-[37px] rounded-r-lg border-l-[3px] border-[#a63d2f] bg-white px-[11px] py-2.5">
          <p className="mb-1 text-[9.5px] font-bold tracking-[0.12em] text-[#a63d2f] uppercase">
            Tu coordinador te escribió
          </p>
          <p className="text-[12.5px] leading-[1.5]">{tema.notaDelCoordinador}</p>
        </div>
      ) : null}

      {tema.estado === "DEVUELTO" && abre ? (
        <span className="mt-[11px] ml-[37px] block rounded-[9px] bg-[#a63d2f] py-[11px] text-center text-[13.5px] font-semibold text-white">
          Repasar y volver a enviar
        </span>
      ) : null}

      {tema.vecesDevuelto > 1 ? (
        <p className="mt-2 ml-[37px] text-[11px] text-[#5c5648]">
          Te lo han devuelto {tema.vecesDevuelto} veces.
        </p>
      ) : null}
    </>
  );

  if (!abre) return <div className={clases}>{cuerpo}</div>;

  return (
    <Link href={`/taller/lider/${tema.code}`} className={clases}>
      {cuerpo}
    </Link>
  );
}

function rotulo(tema: MiTemaQuiz): string {
  if (tema.preguntas === 0) return "Todavía no está el material de este tema";
  if (tema.estado === "APROBADO") {
    const cuando = tema.aprobadoEl ? ` el ${momentoCorto(tema.aprobadoEl)}` : "";
    return `✓ Aprobado${cuando} · ya puedes dictarlo`;
  }
  return ETIQUETA_TEMA_QUIZ[tema.estado];
}
