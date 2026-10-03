import Link from "next/link";
import { notFound } from "next/navigation";

import { requerirVista } from "@/lib/auth";
import { momentoCorto } from "@/lib/dominio";
import { cargarPareja, puedeLlevarPrematrimonial } from "@/lib/prematrimonial";
import {
  ETIQUETA_TEMA_PAREJA,
  codigoLegiblePre,
  type EstadoTemaPareja,
} from "@/lib/prematrimonial-catalogo";

export const metadata = { title: "Pareja · Prematrimonial · Iglesia Vive" };
export const dynamic = "force-dynamic";

const TONO: Record<EstadoTemaPareja, string> = {
  APROBADO: "border-[#cfe3d8] bg-[#edf5f0] text-[#2f6f53]",
  ESPERANDO: "border-[#c9a3b6] bg-[#f7eef2] text-[#7a3b5c]",
  DEVUELTO: "border-[#e0b4ac] bg-[#fdf1ee] text-[#a63d2f]",
  UNO_ENVIO: "border-[#e8d7a8] bg-[#fbf4dc] text-[#8a5a12]",
  SIN_EMPEZAR: "border-[rgba(19,28,36,.12)] bg-white text-[rgba(19,28,36,.5)]",
};

export default async function FichaDeLaPareja({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirVista("escuela");

  // ⚠️ La vista «Escuela» no basta: la tiene también el rol MENTOR y el
  // prematrimonial es de pastores y administración (decisión del usuario).
  if (!puedeLlevarPrematrimonial(usuario)) notFound();

  const { id } = await params;

  const pareja = await cargarPareja(usuario, id);
  if (!pareja) notFound();

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-[14px]">
        <div>
          <Link
            href="/escuela/prematrimonial"
            className="text-[11.5px] font-semibold text-[rgba(19,28,36,.5)] underline"
          >
            ← Prematrimonial
          </Link>
          <h1 className="mt-2 text-[22px] leading-tight font-semibold">
            {pareja.nombreA} &amp; {pareja.nombreB}
          </h1>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-[rgba(19,28,36,.55)]">
            {pareja.pastor ? `Acompaña ${pareja.pastor} · ` : ""}
            desde {momentoCorto(pareja.empezaron)} ·{" "}
            <strong>
              {pareja.aprobados} de {pareja.total} temas
            </strong>
            {pareja.cerrada ? " · cerrado" : ""}
          </p>
        </div>

        <section className="tarjeta p-5">
          <h2 className="etiqueta-seccion">SUS CÓDIGOS</h2>
          <p className="mt-1.5 text-[12px] leading-[1.5] text-[rgba(19,28,36,.55)]">
            Cada uno entra con el suyo. Es lo que garantiza que responde él y no el
            otro por él.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-[10px] bg-papel p-3">
              <p className="etiqueta-campo">{pareja.nombreA}</p>
              <p className="mt-1 text-[19px] font-semibold tracking-[.12em] tabular-nums">
                {pareja.codigoA ? codigoLegiblePre(pareja.codigoA) : "sin código"}
              </p>
            </div>
            <div className="rounded-[10px] bg-papel p-3">
              <p className="etiqueta-campo">{pareja.nombreB}</p>
              <p className="mt-1 text-[19px] font-semibold tracking-[.12em] tabular-nums">
                {pareja.codigoB ? codigoLegiblePre(pareja.codigoB) : "sin código"}
              </p>
            </div>
          </div>
        </section>

        <section className="tarjeta p-5">
          <h2 className="etiqueta-seccion">LOS 12 TEMAS</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {pareja.temas.map((t) => {
              const cuerpo = (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-tinta">
                      {t.number}. {t.name}
                    </span>
                    {t.listoParaDestapar ? (
                      <span className="rounded-full bg-[#7a3b5c] px-2 py-0.5 text-[10px] font-bold tracking-[.06em] text-white uppercase">
                        Listo para destapar
                      </span>
                    ) : null}
                    {t.destapadoEl ? (
                      <span className="text-[10.5px] font-semibold text-[rgba(19,28,36,.45)]">
                        destapado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-[1.45] font-semibold">
                    {t.disponible
                      ? ETIQUETA_TEMA_PAREJA[t.estado]
                      : "Todavía no está el material de este tema"}
                    {t.estado === "UNO_ENVIO"
                      ? ` · falta ${t.envioA ? pareja.nombreB : pareja.nombreA}`
                      : ""}
                    {t.vecesDevuelto > 1 ? ` · devuelto ${t.vecesDevuelto} veces` : ""}
                  </p>
                </>
              );

              // ⚠️ Solo abre lo que se puede comparar. Un tema sin los dos envíos
              // llevaría a una pantalla vacía, y la regla del 16-sep dice que lo
              // que no abre no se enseña como enlace.
              const abre = t.disponible && Boolean(t.envioA && t.envioB);
              const clases = `block rounded-[10px] border p-3 ${TONO[t.estado]}`;

              return (
                <li key={t.topicId}>
                  {abre ? (
                    <Link href={`/escuela/prematrimonial/${pareja.id}/${t.topicId}`} className={clases}>
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className={clases}>{cuerpo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <p className="text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
          Al terminar los 12 se les marca el hito del prematrimonial en el
          expediente a los dos. <strong>La fase no se mueve</strong>: casarse no es
          un ascenso del recorrido, y la fase la decide su mentor.
        </p>
      </div>
    </main>
  );
}
