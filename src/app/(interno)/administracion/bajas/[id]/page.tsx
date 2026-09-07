import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { ESTADO_SOLICITUD } from "@/lib/baja";
import { cargarSolicitudDeBaja } from "@/lib/administracion";
import { textoDeHorario, ZONA_HORARIA } from "@/lib/dominio";
import { ResolverSolicitud } from "./resolver";

export const metadata = { title: "Solicitud de baja · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA_Y_HORA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

const ETIQUETA_OP72: Record<string, string> = {
  INICIADA: "Iniciada",
  SEGUIMIENTO: "Seguimiento",
  CONTACTADA: "Contactada",
  VISITA_PENDIENTE: "Visita pendiente",
  LISTA_PARA_ENTREGA: "Lista para entrega",
  ENTREGADA: "Entregada",
  CERRADA: "Cerrada",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  AUTORIZADA: "Baja autorizada",
  RECHAZADA: "Devuelta a consolidación",
  RETIRADA: "El consolidador retiró la solicitud",
};

export default async function PaginaSolicitudDeBaja({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { id } = await params;
  const solicitud = await cargarSolicitudDeBaja(id);
  if (!solicitud) notFound();

  const pendiente = solicitud.estado === ESTADO_SOLICITUD.pendiente;
  const horario = textoDeHorario(solicitud.horarios, solicitud.horarioNota);
  const sinContestar = solicitud.marcaciones.filter((marca) => !marca.answered).length;
  const contestadas = solicitud.marcaciones.length - sinContestar;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[760px]">
        <Link
          href="/administracion/bajas"
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver a bajas
        </Link>

        <article className="tarjeta mt-3 p-[22px]">
          <p
            className={`text-[10px] leading-none font-bold tracking-[.16em] ${
              pendiente ? "text-ambar-texto" : "text-[rgba(19,28,36,.42)]"
            }`}
          >
            {pendiente
              ? "SOLICITUD DE BAJA"
              : (ETIQUETA_ESTADO[solicitud.estado] ?? "SOLICITUD RESUELTA").toUpperCase()}
          </p>

          <h1 className="mt-[10px] font-serif text-[26px] leading-[1.15] font-normal text-tinta">
            {solicitud.nombre}
          </h1>
          <p className="mt-[7px] text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            {[
              solicitud.telefono,
              solicitud.estadoOp72
                ? `Operación 72 en ${ETIQUETA_OP72[solicitud.estadoOp72] ?? solicitud.estadoOp72}`
                : "Sin Operación 72",
              solicitud.consolidador
                ? `consolida ${solicitud.consolidador}`
                : "sin consolidador asignado",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <section className="mt-[18px] rounded-[10px] bg-papel p-[15px]">
            <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-[rgba(19,28,36,.42)]">
              MOTIVO QUE DIO {solicitud.pedidaPor.split(" ")[0].toUpperCase()}
            </p>
            <p className="mt-[9px] text-[14px] leading-[1.3] font-bold text-tinta">
              {solicitud.motivo}
            </p>
            {solicitud.nota ? (
              <p className="mt-[7px] text-[13px] leading-[1.55] font-medium text-[rgba(19,28,36,.72)]">
                «{solicitud.nota}»
              </p>
            ) : null}
            <p className="mt-[10px] text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
              Enviada {FECHA_Y_HORA.format(solicitud.fecha)}
            </p>
          </section>

          <section className="mt-[14px]">
            <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-[rgba(19,28,36,.42)]">
              LO QUE DICE EL SISTEMA
            </p>
            <ul className="mt-[10px] flex list-none flex-col gap-[7px] p-0">
              <Dato>
                <strong className="font-bold text-tinta">
                  {solicitud.intentos.length === 1
                    ? "1 registro de contacto"
                    : `${solicitud.intentos.length} registros de contacto`}
                </strong>{" "}
                en Operación 72
                {solicitud.intentos[0]
                  ? ` · el último ${FECHA_Y_HORA.format(solicitud.intentos[0].occurredAt)}`
                  : ""}
                .
              </Dato>
              <Dato>
                <strong className="font-bold text-tinta">
                  {solicitud.marcaciones.length === 1
                    ? "1 marcación del discador"
                    : `${solicitud.marcaciones.length} marcaciones del discador`}
                </strong>
                {solicitud.marcaciones.length
                  ? ` · ${contestadas} contestada${contestadas === 1 ? "" : "s"}, ${sinContestar} sin contestar`
                  : " · ninguna llamada real registrada en HighLevel"}
                .
              </Dato>
              <Dato>
                {horario ? (
                  <>
                    Pidió que la llamaran{" "}
                    <strong className="font-bold text-tinta">«{horario}»</strong>.
                  </>
                ) : (
                  "No dejó dicho a qué hora se le puede llamar."
                )}
              </Dato>
            </ul>

            {solicitud.intentos.length ? (
              <ul className="mt-[12px] flex list-none flex-col gap-[6px] p-0">
                {solicitud.intentos.map((intento, indice) => (
                  <li
                    key={`${intento.occurredAt.toISOString()}-${indice}`}
                    className="rounded-[9px] border border-[rgba(19,28,36,.09)] p-[10px]"
                  >
                    <p className="text-[12px] leading-[1.35] font-semibold text-tinta">
                      {intento.type === "VISITA" ? "Visita" : "Llamada"}
                      {intento.outcome ? ` · ${intento.outcome.replace(/_/g, " ").toLowerCase()}` : ""}
                    </p>
                    <p className="mt-[3px] text-[11px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
                      {[
                        intento.byUser?.fullName ?? "La línea, desde el CRM",
                        FECHA_Y_HORA.format(intento.occurredAt),
                      ].join(" · ")}
                    </p>
                    {intento.note?.trim() ? (
                      <p className="mt-[5px] text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.6)]">
                        «{intento.note.trim()}»
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="mt-[22px] h-px bg-[rgba(19,28,36,.09)]" />

          <div className="mt-5">
            {pendiente ? (
              <ResolverSolicitud
                solicitudId={solicitud.id}
                nombre={solicitud.nombre}
                consolidador={solicitud.consolidador}
              />
            ) : (
              <div className="aviso-ambar">
                <p className="text-[12.5px] leading-[1.5] font-semibold text-ambar-texto">
                  {ETIQUETA_ESTADO[solicitud.estado] ?? "Solicitud resuelta"}
                  {solicitud.resueltaPor ? ` por ${solicitud.resueltaPor}` : ""}
                  {solicitud.resueltaEn
                    ? ` · ${FECHA_Y_HORA.format(solicitud.resueltaEn)}`
                    : ""}
                  .
                </p>
                {solicitud.observacion ? (
                  <p className="mt-2 text-[12.5px] leading-[1.5] font-medium text-ambar-texto">
                    «{solicitud.observacion}»
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <Link
            href={`/administracion/${solicitud.personId}`}
            className="mt-5 inline-block text-[12px] leading-none font-semibold text-azul-700"
          >
            Ver el expediente completo →
          </Link>
        </article>
      </div>
    </main>
  );
}

function Dato({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-[10px]">
      <span className="h-[8px] w-[8px] shrink-0 rounded-full bg-ambar-barra" />
      <span className="text-[12.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.72)]">
        {children}
      </span>
    </li>
  );
}
