import Link from "next/link";
import { notFound } from "next/navigation";

import { requerirVista } from "@/lib/auth";
import { momentoCorto } from "@/lib/dominio";
import {
  cargarPanelDelCuestionario,
  puedeRevisarCuestionario,
  type LiderEnElPanel,
  type QuizEnLaCola,
} from "@/lib/cuestionario";
import { puedeLlevarPrematrimonial } from "@/lib/prematrimonial";

import { PestanasDeEscuela } from "../pestanas";

export const metadata = { title: "Cuestionario de líderes · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// El panel del coordinador: quién va por dónde en el Cuestionario de Dominio.
export default async function PaginaDelCuestionario() {
  const usuario = await requerirVista("escuela");
  // ⚠️ El segundo guardia: «Escuela» la ve también MENTOR y esto es de
  // pastores y administración.
  if (!puedeRevisarCuestionario(usuario)) notFound();

  const panel = await cargarPanelDelCuestionario();

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Cuestionario de líderes
            </h1>
            <p className="mt-2 text-[13px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
              Quién domina cada tema del libro y puede dictarlo en una Casa de
              Fe
              {panel.escuela ? ` · ${panel.escuela.name}` : ""}
            </p>
          </div>

          <PestanasDeEscuela
            activa="cuestionario"
            conPrematrimonial={puedeLlevarPrematrimonial(usuario)}
            conCuestionario
            pendientesCuestionario={panel.esperando.length}
          />
        </header>

        {/* ⚠️ **ESPERANDO REVISIÓN VA ARRIBA DEL TODO.** Es lo único que le
            pide algo al coordinador ahora mismo: hasta que alguien revise, ese
            líder no puede dictar su tema. Mezclado en la lista de abajo, se
            queda esperando una revisión que nadie recuerda hacer. */}
        <section className="mt-7">
          <h2 className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[rgba(19,28,36,.55)] uppercase">
            Esperando tu revisión
            {panel.esperando.length > 0 ? ` · ${panel.esperando.length}` : ""}
          </h2>

          {panel.esperando.length === 0 ? (
            <p className="rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-4 py-4 text-[13px] leading-[1.5] text-[rgba(19,28,36,.62)]">
              No hay nada esperando. Cuando un líder envíe un tema, aparece aquí.
            </p>
          ) : (
            <ul className="grid gap-2.5">
              {panel.esperando.map((q) => (
                <EnLaCola key={q.quizId} q={q} />
              ))}
            </ul>
          )}
        </section>

        {/* El avance por tema: dónde está parado el equipo. */}
        <section className="mt-9">
          <h2 className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[rgba(19,28,36,.55)] uppercase">
            Los {panel.totalDeTemas} temas
          </h2>
          {panel.temasSinMaterial > 0 ? (
            <p className="mb-2.5 rounded-[10px] border border-[#e8d7a8] bg-[#fbf4dc] px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-[#7a5200]">
              {panel.temasSinMaterial === 1
                ? "Un tema todavía no tiene preguntas, así que nadie puede llenarlo."
                : `${panel.temasSinMaterial} temas todavía no tienen preguntas, así que nadie puede llenarlos.`}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {panel.temas.map((t) => (
              <div
                key={t.topicId}
                className="rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-3.5 py-3"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-[1px] grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-[rgba(19,28,36,.07)] text-[11px] font-bold tabular-nums">
                    {t.number}
                  </span>
                  <p className="flex-1 text-[13.5px] leading-[1.3] font-semibold">
                    {t.name}
                  </p>
                </div>
                <p className="mt-2 ml-[32px] text-[11.5px] leading-[1.5] text-[rgba(19,28,36,.62)]">
                  {t.preguntas === 0 ? (
                    <span className="text-[#8a5a12]">Sin material todavía</span>
                  ) : (
                    <>
                      <strong className="font-semibold text-[#2f6f53]">
                        {t.aprobados} aprobados
                      </strong>
                      {t.esperando > 0 ? ` · ${t.esperando} esperando` : ""}
                      {t.devueltos > 0 ? ` · ${t.devueltos} devueltos` : ""}
                      {t.empezados > 0 ? ` · ${t.empezados} empezados` : ""}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* La lista de líderes. */}
        <section className="mt-9">
          <h2 className="mb-3 text-[11px] font-bold tracking-[0.12em] text-[rgba(19,28,36,.55)] uppercase">
            El equipo · {panel.lideres.length}
          </h2>

          {panel.lideres.length === 0 ? (
            <p className="rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-4 py-4 text-[13px] leading-[1.5] text-[rgba(19,28,36,.62)]">
              Todavía no hay nadie inscrito en la escuela abierta ni nadie que
              haya empezado el cuestionario.
            </p>
          ) : (
            <ul className="grid gap-2">
              {panel.lideres.map((l) => (
                <Renglon key={l.learnerId} l={l} total={panel.totalDeTemas} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function EnLaCola({ q }: { q: QuizEnLaCola }) {
  return (
    <li>
      <Link
        href={`/escuela/cuestionario/${q.quizId}`}
        className="block rounded-[10px] border-[1.5px] border-[#e8d7a8] bg-[#fdf9ee] px-4 py-3.5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <strong className="text-[15px] leading-[1.25] font-semibold">
            {q.nombre}
          </strong>
          <span className="text-[11.5px] font-medium text-[rgba(19,28,36,.55)]">
            Enviado el {momentoCorto(q.enviadoEl)}
          </span>
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.45] text-[rgba(19,28,36,.72)]">
          Tema {q.tema} · {q.temaNombre}
        </p>
        <p className="mt-1.5 text-[11.5px] leading-[1.45] text-[rgba(19,28,36,.62)]">
          {/* Lo que le va a costar al coordinador, dicho antes de entrar: las
              abiertas son las que hay que leer y juzgar a mano. */}
          {q.abiertas} {q.abiertas === 1 ? "respuesta" : "respuestas"} para leer
          {q.calificables > 0
            ? ` · en las de marcar acertó ${q.aciertos} de ${q.calificables}`
            : ""}
          {q.vuelta > 1 ? (
            <strong className="font-bold text-[#a63d2f]"> · es la vuelta {q.vuelta}</strong>
          ) : null}
        </p>
      </Link>
    </li>
  );
}

function Renglon({ l, total }: { l: LiderEnElPanel; total: number }) {
  return (
    <li className="rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <strong className="text-[14.5px] leading-[1.25] font-semibold">
            {l.nombre}
          </strong>
          {l.dominaElLibro ? (
            <span className="rounded-[7px] bg-[#edf5f0] px-1.5 py-0.5 text-[10px] font-bold text-[#2f6f53]">
              DOMINA EL LIBRO
            </span>
          ) : null}
          {/* ⚠️ El cuestionario NO exige estar inscrito, así que puede haber
              quien lo esté llenando sin estar en la escuela. Decirlo es lo que
              le permite al coordinador inscribirlo o preguntarle. */}
          {!l.inscrito ? (
            <span className="rounded-[7px] bg-[#fbf4dc] px-1.5 py-0.5 text-[10px] font-bold text-[#8a5a12]">
              NO INSCRITO EN LA ESCUELA
            </span>
          ) : null}
        </div>
        <span className="text-[12.5px] font-semibold tabular-nums">
          {l.aprobados} de {total}
        </span>
      </div>
      <p className="mt-1 text-[11.5px] leading-[1.45] text-[rgba(19,28,36,.62)]">
        {l.esperando > 0 ? (
          <strong className="font-bold text-[#8a5a12]">
            {l.esperando} esperando revisión
          </strong>
        ) : null}
        {l.esperando > 0 && (l.devueltos > 0 || l.empezados > 0) ? " · " : ""}
        {l.devueltos > 0 ? `${l.devueltos} devueltos` : ""}
        {l.devueltos > 0 && l.empezados > 0 ? " · " : ""}
        {l.empezados > 0 ? `${l.empezados} empezados` : ""}
        {l.esperando === 0 && l.devueltos === 0 && l.empezados === 0
          ? l.aprobados === 0
            ? "No ha empezado"
            : "Nada pendiente"
          : ""}
      </p>
    </li>
  );
}
