import Link from "next/link";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { ZONA_HORARIA } from "@/lib/dominio";
import { listarDadosDeBaja, listarSolicitudesDeBaja } from "@/lib/administracion";

export const metadata = { title: "Bajas · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONA_HORARIA,
});

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

/// Las bajas, en un solo sitio: primero lo que hay que responder, después lo
/// que ya salió. Nadie se retira del sistema sin pasar por aquí.
export default async function PaginaDeBajas() {
  await requerirRol(ROLES_ADMIN);
  const [pendientes, salidas] = await Promise.all([
    listarSolicitudesDeBaja(),
    listarDadosDeBaja(),
  ]);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1000px]">
        <Link
          href="/administracion"
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver a administración
        </Link>

        <header className="mt-3">
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Bajas
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Nadie sale del sistema sin que un administrador lo autorice. Aquí se
            responden las solicitudes que envía el equipo de consolidación y
            queda la lista de quienes ya salieron.
          </p>
        </header>

        <section className="mt-7">
          <div className="flex items-center gap-[10px]">
            <h2 className="text-[10px] leading-none font-bold tracking-[.16em] text-ambar-texto">
              PENDIENTES DE AUTORIZAR
            </h2>
            <span className="rounded-[20px] bg-ambar-chip px-[9px] py-1 text-[10px] leading-none font-bold text-ambar-texto">
              {pendientes.length}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-[10px]">
            {pendientes.map((solicitud) => (
              <article
                key={solicitud.solicitudId}
                className="rounded-[14px] border border-[rgba(201,123,44,.35)] bg-white p-4"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-[180px] flex-[2_1_220px]">
                    <p className="text-[14px] leading-[1.2] font-semibold text-tinta">
                      {solicitud.nombre}
                    </p>
                    <p className="mt-[5px] text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                      {[
                        solicitud.telefono,
                        solicitud.estadoOp72
                          ? `Operación 72 · ${ETIQUETA_OP72[solicitud.estadoOp72] ?? solicitud.estadoOp72}`
                          : "Sin Operación 72",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="flex-[3_1_340px]">
                    <p className="text-[12.5px] leading-[1.45] font-bold text-tinta">
                      {solicitud.motivo}
                    </p>
                    {solicitud.nota ? (
                      <p className="mt-[5px] text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.72)]">
                        «{solicitud.nota}»
                      </p>
                    ) : null}
                    <p className="mt-[7px] text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
                      La pidió {solicitud.pedidaPor} · {FECHA_Y_HORA.format(solicitud.fecha)}
                    </p>
                  </div>
                </div>

                <div className="mt-[14px] flex flex-wrap items-center gap-2">
                  <Link
                    href={`/administracion/bajas/${solicitud.solicitudId}`}
                    className="boton-primario"
                  >
                    Revisar
                  </Link>
                  <Link
                    href={`/administracion/${solicitud.personId}`}
                    className="px-1 py-[13px] text-[12px] leading-none font-semibold text-azul-700"
                  >
                    Ver expediente
                  </Link>
                  <span className="ml-auto text-[11px] leading-[1.3] font-semibold text-[rgba(19,28,36,.45)]">
                    {solicitud.llamadas === 1
                      ? "1 llamada registrada"
                      : `${solicitud.llamadas} llamadas registradas`}
                  </span>
                </div>
              </article>
            ))}

            {pendientes.length === 0 ? (
              <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                No hay solicitudes esperando respuesta.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-9">
          <h2 className="text-[10px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
            YA ESTÁN DE BAJA
          </h2>
          <p className="mt-2 text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            No se borran: entra a cada una para ver su expediente o reactivarla
            si regresa.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {salidas.map((fila) => (
              <Link
                key={fila.learnerId}
                href={`/administracion/${fila.personId}`}
                className="tarjeta flex flex-wrap items-start gap-x-4 gap-y-2 p-4 hover:border-azul-700"
              >
                <span className="min-w-[180px] flex-[2_1_220px]">
                  <span className="block text-[14px] leading-[1.2] font-semibold text-tinta">
                    {fila.nombre}
                  </span>
                  {fila.telefono ? (
                    <span className="mt-1 block text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                      {fila.telefono}
                    </span>
                  ) : null}
                </span>

                <span className="flex-[3_1_320px]">
                  <span className="block text-[12.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.72)]">
                    {fila.motivo ?? "Sin motivo registrado"}
                  </span>
                  <span className="mt-1 block text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
                    {[
                      fila.fecha ? FECHA.format(fila.fecha) : "—",
                      fila.pedidaPor ? `pidió ${fila.pedidaPor}` : null,
                      fila.por ? `autorizó ${fila.por}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            ))}

            {salidas.length === 0 ? (
              <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Nadie está dado de baja.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
