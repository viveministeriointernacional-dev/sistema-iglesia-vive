import { notFound, redirect } from "next/navigation";
import {
  FaithHouseStatus,
  MilestoneKind,
  MilestoneStatus,
} from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { requerirUsuario } from "@/lib/auth";
import { ETIQUETA_ENTRADA, nombreCompleto } from "@/lib/dominio";
import { edadDesde } from "@/lib/op72";
import {
  accesoAExpediente,
  calcularAlertas,
  cargarExpediente,
  construirLineaDeTiempo,
  diasEnFase,
  FASES,
  HITOS_DEL_RECORRIDO,
  proximoPaso,
  telefonoParcial,
} from "@/lib/expediente";
import { cargarServicios, ROLES_ENTRENAR } from "@/lib/entrenar";
import {
  cargarHistorialDeFases,
  puedeCambiarFase,
  requisitosDeFase,
} from "@/lib/fases";
import { CambioDeFase, type HistorialDeFase } from "./cambio-de-fase";
import { CasaDeFe } from "./casa-de-fe";
import { Servicio, type ServicioVista } from "./servicio";
import type { TemaCasaDeFe } from "./acciones";
import { NotasPastorales, RegistrarHito } from "./panel-lateral";

export const dynamic = "force-dynamic";

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expediente = await cargarExpediente(id);
  return {
    title: expediente
      ? `${nombreCompleto(expediente.person)} · Iglesia Vive`
      : "Expediente · Iglesia Vive",
  };
}

export default async function PaginaExpediente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await requerirUsuario();
  const acceso = await accesoAExpediente(usuario, id);

  // Quien mira su propio recorrido va a «Mi proceso»: el expediente lleva
  // alertas de gestión y estado interno que no son para el aprendiz (§10).
  if (acceso.esPropio && !acceso.puedeVer) redirect("/mi-proceso");
  if (!acceso.puedeVer) notFound();

  const expediente = await cargarExpediente(id);
  if (!expediente) notFound();

  const ahora = new Date();
  const prisma = await getPrisma();
  const cantidadDeNotas = acceso.puedeVerNotas
    ? await prisma.privateNote.count({ where: { learnerId: id } })
    : 0;

  // El servicio es parte del acompañamiento, no del panel del aprendiz: solo
  // se carga para quien puede ver las notas.
  const servicios: ServicioVista[] = acceso.puedeVerNotas
    ? (await cargarServicios(id)).map((servicio) => ({
        id: servicio.id,
        ministerio: servicio.ministry,
        status: servicio.status,
        desde: FECHA_CORTA.format(servicio.startedAt),
        hasta: servicio.endedAt ? FECHA_CORTA.format(servicio.endedAt) : null,
        responsable: servicio.responsible?.fullName ?? null,
        observaciones: servicio.notes,
        evidencia: servicio.evidence,
      }))
    : [];

  // El cambio de fase es asunto de quien acompaña: ni se calcula ni se envía
  // al navegador del aprendiz.
  const requisitos = acceso.puedeVerNotas ? requisitosDeFase(expediente) : null;
  const puedeAprobarFase = acceso.puedeVerNotas
    ? await puedeCambiarFase(usuario, id)
    : false;
  const historialDeFases: HistorialDeFase[] = acceso.puedeVerNotas
    ? (await cargarHistorialDeFases(id)).map((paso) => ({
        id: paso.id,
        desde: paso.fromPhase,
        hasta: paso.toPhase,
        fecha: FECHA_CORTA.format(paso.decidedAt),
        decidio: paso.decidedBy.fullName,
        nota: paso.note,
      }))
    : [];

  const nombre = nombreCompleto(expediente.person);
  const edad = edadDesde(expediente.person.birthDate, ahora);
  const mentorActual = expediente.mentorRelationships.find((r) => !r.endedAt);
  const faseActual = FASES.findIndex((f) => f.valor === expediente.phase);
  const linea = construirLineaDeTiempo(expediente, acceso.puedeVerNotas);
  const alertas = calcularAlertas(expediente, ahora);
  const paso = proximoPaso(expediente, ahora);

  const temasCompletados = expediente.faithHouseProgress.filter(
    (a) => a.status === FaithHouseStatus.COMPLETADO,
  ).length;

  const hitoDe = (kind: MilestoneKind) =>
    expediente.milestones.find((hito) => hito.kind === kind);

  // La evaluación y las notas del tema son privadas: solo viajan al navegador
  // de quien puede verlas.
  const temasCasaDeFe: TemaCasaDeFe[] = expediente.temas.map((tema) => {
    const avance = expediente.faithHouseProgress.find(
      (a) => a.topic.number === tema.number,
    );
    return {
      topicId: tema.id,
      numero: tema.number,
      nombre: tema.name,
      status: avance?.status ?? FaithHouseStatus.PENDIENTE,
      assessment: acceso.puedeVerNotas ? (avance?.assessment ?? null) : null,
      notes: acceso.puedeVerNotas ? (avance?.notes ?? null) : null,
      // Ni siquiera viajan al navegador de quien no puede verlas.
      task: acceso.puedeVerNotas ? (avance?.task ?? null) : null,
      evidence: acceso.puedeVerNotas ? (avance?.evidence ?? null) : null,
      registradoPor: acceso.puedeVerNotas
        ? (avance?.recordedBy?.fullName ?? null)
        : null,
    };
  });

  return (
    <main className="px-5 py-[26px] pb-16 sm:px-[26px]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-stretch overflow-hidden rounded-[18px] bg-papel shadow-[0_20px_44px_-24px_rgba(14,42,78,.3)]">
        <div className="min-w-0 flex-[1_1_620px] px-5 pt-[26px] pb-8 sm:px-[26px]">
          <header className="flex flex-wrap items-center gap-[18px]">
            <div className="grid h-[62px] w-[62px] place-items-center rounded-[20px] bg-azul-100 text-[9.5px] leading-none font-semibold tracking-[.1em] text-[rgba(14,42,78,.45)]">
              FOTO
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-[31px] leading-[1.1] font-normal text-tinta">
                {nombre}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-[9px] text-[12px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
                <span className="rounded-[6px] bg-azul-900 px-[10px] py-[5px] tracking-[.08em] text-white">
                  {expediente.phase}
                </span>
                <span>día {diasEnFase(expediente.phaseStartedAt, ahora)}</span>
                {edad !== null ? (
                  <>
                    <span>·</span>
                    <span>{edad} años</span>
                  </>
                ) : null}
                <span>·</span>
                <span>
                  Mentor: {mentorActual?.mentor.fullName ?? "sin asignar"}
                </span>
                {expediente.lineOfOrigin ? (
                  <>
                    <span>·</span>
                    <span>Línea: {expediente.lineOfOrigin}</span>
                  </>
                ) : null}
                {expediente.team ? (
                  <>
                    <span>·</span>
                    <span>{expediente.team.name}</span>
                  </>
                ) : null}
              </div>
            </div>
          </header>

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

          <section className="tarjeta mt-6 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="etiqueta-seccion">HITOS</h2>
              <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
                {
                  HITOS_DEL_RECORRIDO.filter(
                    (h) => hitoDe(h.kind)?.status === MilestoneStatus.COMPLETADO,
                  ).length
                }{" "}
                de {HITOS_DEL_RECORRIDO.length} del recorrido
              </p>
            </div>

            <ul className="mt-[14px] grid grid-cols-2 gap-[9px] sm:grid-cols-4">
              {HITOS_DEL_RECORRIDO.map(({ kind, etiqueta }) => {
                const hito = hitoDe(kind);
                const completado = hito?.status === MilestoneStatus.COMPLETADO;
                const enCurso = hito?.status === MilestoneStatus.EN_CURSO;
                const esCasaDeFe = kind === MilestoneKind.CASA_DE_FE;

                return (
                  <li
                    key={kind}
                    className={`rounded-[11px] p-[14px] ${
                      completado
                        ? "bg-verde-100"
                        : enCurso || (esCasaDeFe && temasCompletados > 0)
                          ? "border-[1.5px] border-verde-500 bg-verde-050"
                          : "border border-dashed border-[rgba(19,28,36,.22)]"
                    }`}
                  >
                    <p
                      className={`text-[10px] leading-none font-bold tracking-[.1em] ${
                        completado || enCurso || (esCasaDeFe && temasCompletados > 0)
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
                            : "Pendiente"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="mt-[14px] grid gap-[14px] lg:grid-cols-2">
            <section className="tarjeta p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="etiqueta-seccion">CASA DE FE · 12 TEMAS</h2>
                <p className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
                  orden flexible
                </p>
              </div>
              <CasaDeFe
                learnerId={expediente.id}
                temas={temasCasaDeFe}
                puedeEditar={acceso.puedeEscribir}
              />
            </section>

            <section className="tarjeta p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="etiqueta-seccion">LÍNEA DE TIEMPO</h2>
                <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
                  {linea.length} {linea.length === 1 ? "registro" : "registros"}
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
        </div>

        <aside className="min-w-0 max-w-full flex-[0_1_340px] border-l border-[rgba(19,28,36,.1)] bg-white px-[22px] pt-[26px] pb-8">
          {acceso.puedeEscribir ? (
            <div className="flex flex-col gap-[9px]">
              <RegistrarHito learnerId={expediente.id} />
            </div>
          ) : null}

          <section className="mt-[22px] rounded-[12px] bg-papel p-4">
            <h2 className="text-[9.5px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
              PRÓXIMO PASO
            </h2>
            <p className="mt-[9px] font-serif text-[18px] leading-[1.25] font-normal text-tinta">
              {paso.titulo}
            </p>
            <p className="mt-[7px] text-[12px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
              {paso.detalle}
            </p>
          </section>

          {alertas.length ? (
            <section className="mt-3 rounded-[12px] border border-[rgba(201,123,44,.3)] bg-ambar-fondo p-4">
              <h2 className="text-[9.5px] leading-none font-bold tracking-[.16em] text-ambar-texto">
                ALERTAS · {alertas.length}
              </h2>
              <ul className="mt-[10px] flex flex-col gap-[6px]">
                {alertas.map((alerta) => (
                  <li
                    key={alerta}
                    className="text-[12.5px] leading-[1.4] font-semibold text-tinta"
                  >
                    {alerta}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {acceso.puedeVerNotas ? (
            <div className="mt-3">
              <NotasPastorales
                learnerId={expediente.id}
                cantidad={cantidadDeNotas}
                puedeEscribir={acceso.puedeEscribir}
              />
            </div>
          ) : null}

          {requisitos ? (
            <CambioDeFase
              learnerId={expediente.id}
              destino={requisitos.destino}
              cumplidos={requisitos.cumplidos}
              faltantes={requisitos.faltantes}
              historial={historialDeFases}
              puedeAprobar={puedeAprobarFase}
            />
          ) : null}

          {acceso.puedeVerNotas ? (
            <Servicio
              learnerId={expediente.id}
              servicios={servicios}
              puedeEditar={acceso.puedeEscribir && ROLES_ENTRENAR.includes(usuario.role)}
            />
          ) : null}

          <section className="mt-3 rounded-[12px] bg-papel p-4">
            <h2 className="text-[9.5px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
              ORIGEN
            </h2>
            <dl className="mt-3 flex flex-col gap-[11px]">
              <div>
                <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                  Entrada
                </dt>
                <dd className="mt-1 text-[12.5px] leading-[1.3] font-semibold text-tinta">
                  {ETIQUETA_ENTRADA[expediente.entryPoint]}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                  Invitado por
                </dt>
                <dd className="mt-1 text-[12.5px] leading-[1.3] font-semibold text-tinta">
                  {expediente.invitedBy
                    ? nombreCompleto(expediente.invitedBy)
                    : "Sin invitador conocido"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                  Contacto
                </dt>
                <dd className="mt-1 text-[12.5px] leading-[1.3] font-semibold text-tinta">
                  {telefonoParcial(expediente.person.callPhone) ?? "Sin teléfono"}
                  {expediente.person.callSchedule
                    ? ` · ${expediente.person.callSchedule.toLowerCase()}`
                    : ""}
                </dd>
              </div>
              {expediente.consolidator ? (
                <div>
                  <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                    Consolidador
                  </dt>
                  <dd className="mt-1 text-[12.5px] leading-[1.3] font-semibold text-tinta">
                    {expediente.consolidator.fullName}
                  </dd>
                </div>
              ) : null}
              {expediente.person.prayerRequest && acceso.puedeVerNotas ? (
                <div>
                  <dt className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                    Petición de oración
                  </dt>
                  <dd className="mt-1 text-[12.5px] leading-[1.35] font-medium text-tinta">
                    {expediente.person.prayerRequest}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

        </aside>
      </div>
    </main>
  );
}
