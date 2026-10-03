import Link from "next/link";
import { notFound } from "next/navigation";

import { requerirVista } from "@/lib/auth";
import { momentoCorto } from "@/lib/dominio";
import { cargarComparacion, type RenglonComparado } from "@/lib/prematrimonial";
import type { RespuestaPre } from "@/lib/prematrimonial-catalogo";

import { PanelDeRevision } from "./panel";

export const metadata = { title: "Comparar · Prematrimonial · Iglesia Vive" };
export const dynamic = "force-dynamic";

export default async function Comparar({
  params,
}: {
  params: Promise<{ id: string; topicId: string }>;
}) {
  const usuario = await requerirVista("prematrimonial");
  const { id, topicId } = await params;

  const c = await cargarComparacion(usuario, id, topicId);
  // ⚠️ `null` también cuando falta uno de los dos envíos: media comparación no
  // dice nada, y enseñarla obligaría a juzgar con un solo lado.
  if (!c) notFound();

  return (
    <div className="flex flex-col gap-[14px]">
      <div>
        <Link
          href={`/prematrimonial/${id}`}
          className="text-[11.5px] font-semibold text-[rgba(19,28,36,.5)] underline"
        >
          ← {c.nombreA} &amp; {c.nombreB}
        </Link>
        <h1 className="mt-2 text-[22px] leading-tight font-semibold">
          Tema {c.numero} · {c.nombreTema}
        </h1>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-[rgba(19,28,36,.55)]">
          {c.renglones.length} preguntas · el sistema puede comparar{" "}
          <strong>{c.comparables}</strong>
          {c.distintas > 0 ? (
            <>
              {" "}
              · <strong className="text-[#a63d2f]">{c.distintas} con respuestas distintas</strong>
            </>
          ) : null}
        </p>
      </div>

      <PanelDeRevision
        coupleId={c.coupleId}
        topicId={c.topicId}
        nombreA={c.nombreA}
        nombreB={c.nombreB}
        learnerAId={c.learnerAId}
        learnerBId={c.learnerBId}
        estado={c.estado}
        destapado={Boolean(c.destapadoEl)}
        destapadoEl={c.destapadoEl ? momentoCorto(c.destapadoEl) : null}
      />

      {/* ⚠️ EL SISTEMA NO JUZGA LAS ABIERTAS, y eso se dice en pantalla. Medir
          si dos párrafos dicen lo mismo es el juicio pastoral para el que
          existe esta página; decir «coinciden» donde hay un desacuerdo de fondo
          haría que se dejaran de leer. */}
      <section className="tarjeta p-5">
        <h2 className="etiqueta-seccion">LAS DOS RESPUESTAS, PREGUNTA POR PREGUNTA</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {c.renglones.map((r) => (
            <li key={r.questionId}>
              <Renglon renglon={r} nombreA={c.nombreA} nombreB={c.nombreB} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Renglon({
  renglon,
  nombreA,
  nombreB,
}: {
  renglon: RenglonComparado;
  nombreA: string;
  nombreB: string;
}) {
  const v = renglon.comparacion.veredicto;
  const marco =
    v === "DISTINTO"
      ? "border-[1.5px] border-[#e0b4ac] bg-[#fdf1ee]"
      : v === "COINCIDEN"
        ? "border border-[#cfe3d8] bg-[#edf5f0]"
        : "border border-[rgba(19,28,36,.12)] bg-white";

  return (
    <section className={`overflow-hidden rounded-[12px] ${marco}`}>
      <div className="flex flex-wrap items-start gap-3 border-b border-[rgba(19,28,36,.08)] px-4 py-3">
        <p className="min-w-0 flex-1 text-[13.5px] leading-[1.4] font-semibold">
          <span className="text-[rgba(19,28,36,.5)]">{renglon.number}.</span>{" "}
          {renglon.prompt}
        </p>
        {v === "DISTINTO" ? (
          <span className="rounded-full bg-[#a63d2f] px-2.5 py-1 text-[10px] font-bold tracking-[.06em] text-white uppercase">
            Respondieron distinto
          </span>
        ) : v === "COINCIDEN" ? (
          <span className="rounded-full bg-[#2f6f53] px-2.5 py-1 text-[10px] font-bold tracking-[.06em] text-white uppercase">
            Coinciden
          </span>
        ) : null}
      </div>

      <div className="grid sm:grid-cols-2">
        <div className="border-b border-[rgba(19,28,36,.08)] px-4 py-3 sm:border-r sm:border-b-0">
          <p className="mb-1.5 text-[9.5px] font-bold tracking-[.12em] text-[#2f5d7c] uppercase">
            {nombreA}
          </p>
          <Respuesta renglon={renglon} respuesta={renglon.respuestaA} />
        </div>
        <div className="px-4 py-3">
          <p className="mb-1.5 text-[9.5px] font-bold tracking-[.12em] text-[#9c5527] uppercase">
            {nombreB}
          </p>
          <Respuesta renglon={renglon} respuesta={renglon.respuestaB} />
        </div>
      </div>
    </section>
  );
}

function Respuesta({
  renglon,
  respuesta,
}: {
  renglon: RenglonComparado;
  respuesta: RespuestaPre | null;
}) {
  if (!respuesta) {
    return (
      <p className="text-[12.5px] leading-[1.5] text-[rgba(19,28,36,.45)]">
        No la respondió.
      </p>
    );
  }

  if (renglon.kind === "SI_NO" || renglon.kind === "OPCION") {
    return (
      <p className="text-[13px] leading-[1.5] font-semibold">
        {respuesta.choice !== null
          ? (renglon.options[respuesta.choice] ?? "—")
          : "—"}
      </p>
    );
  }

  if (renglon.kind === "MULTIPLE") {
    if (respuesta.choices.length === 0) {
      return (
        <p className="text-[12.5px] leading-[1.5] font-semibold text-[rgba(19,28,36,.55)]">
          No marcó ninguna.
        </p>
      );
    }
    const solo = new Set(
      // Lo que marcó solo este lado se resalta: es lo que hace útil la
      // comparación, más que el veredicto en sí.
      renglon.comparacion.soloA.concat(renglon.comparacion.soloB),
    );
    return (
      <ul className="flex flex-col gap-1">
        {respuesta.choices.map((i) => (
          <li
            key={i}
            className={`text-[12.5px] leading-[1.45] ${
              solo.has(i) ? "font-bold text-[#a63d2f]" : "font-medium"
            }`}
          >
            {solo.has(i) ? "• " : "· "}
            {renglon.options[i] ?? "—"}
          </li>
        ))}
      </ul>
    );
  }

  if (renglon.kind === "ORDEN") {
    const distintas = new Set(renglon.comparacion.posicionesDistintas);
    return (
      <ol className="flex list-none flex-col gap-1" style={{ margin: 0, padding: 0 }}>
        {respuesta.ordering.map((opcion, puesto) => (
          <li
            key={opcion}
            className={`text-[12.5px] leading-[1.45] ${
              distintas.has(opcion) ? "font-bold text-[#a63d2f]" : "font-medium"
            }`}
          >
            <span className="tabular-nums">{puesto + 1}.</span>{" "}
            {renglon.options[opcion] ?? "—"}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p className="text-[12.5px] leading-[1.55] whitespace-pre-line">
      {respuesta.text ?? "—"}
    </p>
  );
}
