import Link from "next/link";

import { requerirVista } from "@/lib/auth";
import { momentoCorto } from "@/lib/dominio";
import {
  cargarParejas,
  cargarPorRevisarPre,
  puedeLlevarPrematrimonial,
} from "@/lib/prematrimonial";
import { TOTAL_DE_TEMAS_PRE } from "@/lib/prematrimonial-catalogo";

import { AbrirPrematrimonial } from "./abrir";
import { pastoresPosibles } from "./acciones";

export const metadata = { title: "Prematrimonial · Iglesia Vive" };
export const dynamic = "force-dynamic";

export default async function PaginaPrematrimonial() {
  const usuario = await requerirVista("prematrimonial");

  const [parejas, cola, pastores] = await Promise.all([
    cargarParejas(usuario),
    cargarPorRevisarPre(usuario),
    puedeLlevarPrematrimonial(usuario) ? pastoresPosibles() : Promise.resolve([]),
  ]);

  const abiertas = parejas.filter((p) => !p.cerrada);
  const cerradas = parejas.filter((p) => p.cerrada);
  const porDestapar = abiertas.filter((p) => p.porDestapar > 0);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-tight font-semibold">Prematrimonial</h1>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-[rgba(19,28,36,.55)]">
            Cada uno responde su taller por separado; aquí se comparan las dos
            respuestas.
          </p>
        </div>
        {puedeLlevarPrematrimonial(usuario) ? (
          <AbrirPrematrimonial pastores={pastores} />
        ) : null}
      </div>

      {/* ⚠️ LO QUE ESPERA DESTAPE VA ARRIBA DEL TODO, y no es un adorno.
          Destapar lo hace el pastor a mano (decisión del usuario), y eso se
          olvida: si quedara mezclado en la lista, una pareja termina su taller
          y se queda esperando una conversación que nadie recuerda agendar. */}
      {porDestapar.length > 0 ? (
        <section className="tarjeta border-[rgba(122,59,92,.35)] bg-[#f7eef2] p-5">
          <h2 className="etiqueta-seccion text-[#7a3b5c]">LISTAS PARA DESTAPAR</h2>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[rgba(19,28,36,.65)]">
            Los dos ya enviaron y todavía no han visto lo que respondió el otro.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {porDestapar.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/prematrimonial/${p.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] bg-white p-3 text-[13px] font-semibold text-tinta"
                >
                  <span className="flex-1">
                    {p.nombreA} &amp; {p.nombreB}
                  </span>
                  <span className="text-[11.5px] font-semibold text-[#7a3b5c]">
                    {p.porDestapar} {p.porDestapar === 1 ? "tema" : "temas"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {cola.length > 0 ? (
        <section className="tarjeta p-5">
          <h2 className="etiqueta-seccion">POR REVISAR</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {cola.map((t) => (
              <li key={`${t.coupleId}-${t.topicId}`}>
                <Link
                  href={`/prematrimonial/${t.coupleId}/${t.topicId}`}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] bg-papel p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-tinta">
                      {t.nombreA} &amp; {t.nombreB}
                    </span>
                    <span className="mt-1 block text-[11.5px] font-semibold text-[rgba(19,28,36,.5)]">
                      Tema {t.numero} · {t.nombreTema}
                    </span>
                  </span>
                  <span className="text-[11.5px] font-semibold text-[rgba(19,28,36,.5)]">
                    {momentoCorto(t.ultimoEnvio)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="tarjeta p-5">
        <h2 className="etiqueta-seccion">PAREJAS</h2>
        {abiertas.length === 0 ? (
          <p className="mt-3 text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Todavía no hay ninguna pareja en prematrimonial.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {abiertas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/prematrimonial/${p.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] bg-papel p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-tinta">
                      {p.nombreA} &amp; {p.nombreB}
                    </span>
                    <span className="mt-1 block text-[11.5px] font-semibold text-[rgba(19,28,36,.5)]">
                      {p.pastor ? `Acompaña ${p.pastor} · ` : ""}
                      desde {momentoCorto(p.empezaron)}
                    </span>
                  </span>
                  <span className="text-[11.5px] font-semibold text-[rgba(19,28,36,.5)]">
                    {p.aprobados} de {TOTAL_DE_TEMAS_PRE}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cerradas.length > 0 ? (
        <section className="tarjeta p-5">
          <h2 className="etiqueta-seccion">CERRADAS</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {cerradas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/prematrimonial/${p.id}`}
                  className="block rounded-[10px] bg-papel p-3 text-[13px] font-semibold text-[rgba(19,28,36,.6)]"
                >
                  {p.nombreA} &amp; {p.nombreB} · {p.aprobados} de {TOTAL_DE_TEMAS_PRE}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
