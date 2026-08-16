import { redirect } from "next/navigation";
import {
  FaithHouseStatus,
  MilestoneKind,
  MilestoneStatus,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { ETIQUETA_ROL, requerirUsuario, ROLES_CON_RED } from "@/lib/auth";
import {
  cargarExpediente,
  diasEnFase,
  FASES,
  HITOS_DEL_RECORRIDO,
} from "@/lib/expediente";
import { cargarMiAlpha, miHistoria, miProximoPaso } from "@/lib/mi-proceso";

export const metadata = { title: "Mi proceso · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

/// El recorrido visto por la persona que lo está viviendo (§10).
///
/// Es una pantalla distinta del expediente a propósito. El expediente es la
/// herramienta de quien acompaña: lleva alertas de gestión, notas pastorales y
/// el estado de la Operación 72. Nada de eso es para el aprendiz (§3.1, §10).
export default async function MiProceso() {
  const usuario = await requerirUsuario();

  const prisma = await getPrisma();
  const propio = usuario.personId
    ? await prisma.learnerProfile.findUnique({
        where: { personId: usuario.personId },
        select: { id: true },
      })
    : null;

  if (!propio) {
    if (ROLES_CON_RED.includes(usuario.role)) redirect("/mi-red");
    return <SinExpediente nombre={usuario.fullName} rol={usuario.role} />;
  }

  const expediente = await cargarExpediente(propio.id);
  if (!expediente) return <SinExpediente nombre={usuario.fullName} rol={usuario.role} />;

  const ahora = new Date();
  const alpha = await cargarMiAlpha(propio.id, ahora);

  const faseActual = FASES.findIndex((f) => f.valor === expediente.phase);
  const paso = miProximoPaso(expediente);
  const linea = miHistoria(expediente);
  const mentor = expediente.mentorRelationships.find((r) => !r.endedAt);

  const hitoDe = (kind: MilestoneKind) =>
    expediente.milestones.find((hito) => hito.kind === kind);
  const completados = HITOS_DEL_RECORRIDO.filter(
    (h) => hitoDe(h.kind)?.status === MilestoneStatus.COMPLETADO,
  ).length;

  const temasCompletados = expediente.faithHouseProgress.filter(
    (a) => a.status === FaithHouseStatus.COMPLETADO,
  ).length;

  return (
    <main className="px-5 py-[26px] pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[980px]">
        <header className="rounded-[18px] bg-papel px-6 py-7 shadow-[0_20px_44px_-24px_rgba(14,42,78,.3)] sm:px-8">
          <p className="etiqueta-seccion">TU PROCESO</p>
          <h1 className="mt-3 font-serif text-[31px] leading-[1.1] font-normal text-tinta">
            Hola, {expediente.person.firstName}
          </h1>
          <p className="mt-2 text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
            Fase {expediente.phase} · día{" "}
            {diasEnFase(expediente.phaseStartedAt, ahora)}
          </p>

          <div className="mt-5 flex gap-[6px]" aria-hidden="true">
            {FASES.map((fase, indice) => (
              <div
                key={fase.valor}
                className={`h-[10px] flex-1 rounded-[3px] ${
                  indice < faseActual
                    ? "bg-azul-900"
                    : indice === faseActual
                      ? "bg-verde-500"
                      : "bg-[rgba(19,28,36,.12)]"
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-[6px] text-[9.5px] leading-none font-bold tracking-[.1em] text-[rgba(19,28,36,.42)]">
            {FASES.map((fase, indice) => (
              <span
                key={fase.valor}
                className={`flex-1 ${indice === faseActual ? "text-verde-700" : ""}`}
              >
                {fase.etiqueta}
              </span>
            ))}
          </div>

          <section className="mt-6 rounded-[12px] bg-white p-5">
            <h2 className="text-[9.5px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
              TU PRÓXIMO PASO
            </h2>
            <p className="mt-[9px] font-serif text-[20px] leading-[1.25] font-normal text-tinta">
              {paso.titulo}
            </p>
            <p className="mt-[7px] text-[12.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
              {paso.detalle}
            </p>
          </section>
        </header>

        <div className="mt-[14px] grid gap-[14px] lg:grid-cols-2">
          <section className="tarjeta p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="etiqueta-seccion">TUS LOGROS</h2>
              <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
                {completados} de {HITOS_DEL_RECORRIDO.length}
              </p>
            </div>

            <ul className="mt-[14px] grid grid-cols-2 gap-[9px]">
              {HITOS_DEL_RECORRIDO.map(({ kind, etiqueta }) => {
                const hito = hitoDe(kind);
                const completado = hito?.status === MilestoneStatus.COMPLETADO;
                const esCasaDeFe = kind === MilestoneKind.CASA_DE_FE;
                const enCurso =
                  hito?.status === MilestoneStatus.EN_CURSO ||
                  (esCasaDeFe && temasCompletados > 0);

                return (
                  <li
                    key={kind}
                    className={`rounded-[11px] p-[14px] ${
                      completado
                        ? "bg-verde-100"
                        : enCurso
                          ? "border-[1.5px] border-verde-500 bg-verde-050"
                          : "border border-dashed border-[rgba(19,28,36,.22)]"
                    }`}
                  >
                    <p
                      className={`text-[10px] leading-none font-bold tracking-[.1em] ${
                        completado || enCurso
                          ? "text-verde-700"
                          : "text-[rgba(19,28,36,.4)]"
                      }`}
                    >
                      {completado ? "✓ " : ""}
                      {etiqueta}
                    </p>
                    <p
                      className={`mt-2 text-[13.5px] leading-none font-semibold ${
                        completado ? "text-tinta" : "text-[rgba(19,28,36,.4)]"
                      }`}
                    >
                      {esCasaDeFe
                        ? `${temasCompletados} / 12`
                        : hito?.achievedAt
                          ? FECHA_CORTA.format(hito.achievedAt)
                          : enCurso
                            ? "En curso"
                            : "Aún no"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="flex flex-col gap-[14px]">
            {alpha ? (
              <section className="tarjeta p-5">
                <h2 className="etiqueta-seccion">TU GRUPO DE ALPHA</h2>
                <p className="mt-[10px] font-serif text-[18px] leading-[1.25] font-normal text-tinta">
                  {alpha.grupo}
                </p>
                <p className="mt-1 text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
                  Con {alpha.lider} · has ido a {alpha.presentes} de{" "}
                  {alpha.realizadas}{" "}
                  {alpha.realizadas === 1 ? "sesión" : "sesiones"}
                </p>

                {alpha.proxima ? (
                  <p className="mt-3 rounded-[10px] bg-papel p-3 text-[12.5px] leading-[1.45] font-semibold text-tinta">
                    Próxima · sesión {alpha.proxima.numero} el{" "}
                    {FECHA_CORTA.format(alpha.proxima.fecha)}
                    {alpha.proxima.tema ? ` · ${alpha.proxima.tema}` : ""}
                  </p>
                ) : null}

                {alpha.validado ? (
                  <p className="mt-3 rounded-[8px] bg-verde-100 px-2 py-1 text-[10px] leading-[1.4] font-bold text-verde-700">
                    ✓ ALPHA COMPLETADO · {FECHA_CORTA.format(alpha.validado)}
                  </p>
                ) : alpha.focusDay ? (
                  <p className="mt-3 text-[11.5px] leading-[1.4] font-semibold text-verde-700">
                    ✓ Focus Day · {FECHA_CORTA.format(alpha.focusDay)}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="tarjeta p-5">
              <h2 className="etiqueta-seccion">QUIÉN TE ACOMPAÑA</h2>
              <dl className="mt-3 flex flex-col gap-[11px]">
                <div>
                  <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                    Mentor
                  </dt>
                  <dd className="mt-1 text-[13px] leading-[1.3] font-semibold text-tinta">
                    {mentor?.mentor.fullName ?? "Todavía sin asignar"}
                  </dd>
                </div>
                {expediente.consolidator ? (
                  <div>
                    <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                      Te recibió
                    </dt>
                    <dd className="mt-1 text-[13px] leading-[1.3] font-semibold text-tinta">
                      {expediente.consolidator.fullName}
                    </dd>
                  </div>
                ) : null}
                {expediente.team ? (
                  <div>
                    <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                      Equipo
                    </dt>
                    <dd className="mt-1 text-[13px] leading-[1.3] font-semibold text-tinta">
                      {expediente.team.name}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="tarjeta p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="etiqueta-seccion">CASA DE FE</h2>
                <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
                  {temasCompletados} / 12
                </p>
              </div>
              <ul className="mt-[14px] flex flex-col gap-[6px]">
                {expediente.temas.map((tema) => {
                  const avance = expediente.faithHouseProgress.find(
                    (a) => a.topic.number === tema.number,
                  );
                  const completado = avance?.status === FaithHouseStatus.COMPLETADO;
                  const enCurso = avance?.status === FaithHouseStatus.EN_PROCESO;
                  return (
                    <li
                      key={tema.id}
                      className="flex items-center gap-[10px] text-[12.5px] leading-none font-semibold"
                    >
                      <span
                        className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] text-[10px] font-bold ${
                          completado
                            ? "bg-verde-500 text-white"
                            : enCurso
                              ? "bg-verde-100 text-verde-700"
                              : "bg-[rgba(19,28,36,.07)] text-[rgba(19,28,36,.45)]"
                        }`}
                      >
                        {completado ? "✓" : tema.number}
                      </span>
                      <span
                        className={
                          completado || enCurso ? "text-tinta" : "text-[rgba(19,28,36,.5)]"
                        }
                      >
                        {tema.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>

        <section className="tarjeta mt-[14px] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="etiqueta-seccion">TU HISTORIA</h2>
            <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
              {linea.length} {linea.length === 1 ? "momento" : "momentos"}
            </p>
          </div>

          <ol className="mt-[18px] grid grid-cols-[58px_16px_1fr]">
            {linea.map((evento, indice) => {
              const ultimo = indice === linea.length - 1;
              return (
                <li key={indice} className="contents">
                  <span
                    className={`text-[11.5px] leading-[1.6] font-semibold text-[rgba(19,28,36,.45)] ${ultimo ? "" : "pb-[18px]"}`}
                  >
                    {FECHA_CORTA.format(evento.fecha)}
                  </span>
                  <span className="relative grid place-items-start justify-center">
                    {!ultimo ? (
                      <span className="absolute top-[6px] bottom-0 w-px bg-[rgba(19,28,36,.13)]" />
                    ) : null}
                    <span
                      className={`relative mt-1 h-[9px] w-[9px] rounded-full ${
                        evento.tono === "verde" ? "bg-verde-500" : "bg-azul-900"
                      }`}
                    />
                  </span>
                  <span className={`pl-3 ${ultimo ? "" : "pb-[18px]"}`}>
                    <span className="block text-[13px] leading-[1.35] font-semibold text-tinta">
                      {evento.titulo}
                    </span>
                    {evento.detalle ? (
                      <span className="mt-[3px] block text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
                        {evento.detalle}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </main>
  );
}

function SinExpediente({ nombre, rol }: { nombre: string; rol: keyof typeof ETIQUETA_ROL }) {
  return (
    <main className="grid place-items-start justify-center px-5 py-[30px] pb-16">
      <div className="w-full max-w-[740px] rounded-[18px] bg-papel px-7 py-8 shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)]">
        <p className="etiqueta-seccion">{ETIQUETA_ROL[rol].toUpperCase()}</p>
        <h1 className="mt-4 font-serif text-[29px] leading-[1.15] font-normal">
          Hola, {nombre.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          Tu cuenta todavía no está enlazada a un expediente de aprendiz. Habla
          con quien te acompaña para que la conecte con tu proceso.
        </p>
      </div>
    </main>
  );
}
