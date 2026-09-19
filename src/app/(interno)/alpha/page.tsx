import Link from "next/link";
import { headers } from "next/headers";
import { diaLargo, hoyEnColombia } from "@/lib/dominio";
import { requerirVista } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  cargarGrupos,
  esVistaCompletaDeAlpha,
  lideresPosibles,
  puedeCrearAlpha,
  SESIONES_DE_ALPHA,
} from "@/lib/alpha";
import {
  cargarCasasDeFe,
  esVistaCompletaDeCasaDeFe,
  lideresPosiblesCasaDeFe,
  puedeCrearCasaDeFe,
} from "@/lib/casa-de-fe";
import { diaISO, semanaDe } from "@/lib/reunion-catalogo";
import { CalendarioSemanal, type GrupoDelCalendario } from "./calendario-semanal";
import { MiCalendario } from "./mi-calendario";
import { NuevoGrupo } from "./nuevo-grupo";
import { NuevaCasaDeFe } from "../casa-de-fe/nuevo-grupo";

export const metadata = { title: "Alpha y Casa de Fe · Iglesia Vive" };
export const dynamic = "force-dynamic";


export default async function PaginaAlpha({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    semana?: string;
    dia?: string;
    tipo?: string;
  }>;
}) {
  const usuario = await requerirVista("grupos");
  const hoy = hoyEnColombia();

  // Todo lo del calendario viaja por la URL —la semana, el día del celular y
  // el filtro— para que funcione sin JavaScript, como el resto de los filtros
  // de la plataforma.
  const parametros = await searchParams;
  const enCalendario = parametros.vista === "calendario";
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;
  const semana = semanaDe(
    parametros.semana && FECHA.test(parametros.semana) ? parametros.semana : hoy,
  );
  const tipo =
    parametros.tipo === "alpha" || parametros.tipo === "casa-de-fe"
      ? parametros.tipo
      : "todos";
  // En el celular se mira un día: hoy si la semana que se ve lo contiene, y si
  // no el lunes — nunca un día suelto de otra semana.
  const diaElegido =
    parametros.dia && semana.dias.includes(parametros.dia)
      ? parametros.dia
      : semana.dias.includes(hoy)
        ? hoy
        : semana.inicio;

  const conVista = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ vista: "calendario", ...cambios });
    return `/alpha?${p.toString()}`;
  };

  // El enlace de calendario de quien está mirando, y cuántas de sus reuniones
  // tienen ya día y hora (sin eso no salen en ningún calendario).
  const prisma = await getPrisma();
  const cuenta = await prisma.appUser.findUnique({
    where: { id: usuario.id },
    select: { calendarToken: true },
  });

  // La URL se arma en el servidor para que el bloque funcione sin JavaScript
  // y para no depender de lo que el navegador crea que es su propio origen.
  const base = (await headers()).get("host");
  const enlaceDeCalendario = cuenta?.calendarToken
    ? `https://${base}/calendario/${cuenta.calendarToken}.ics`
    : null;

  // ⚠️ Las dos secciones van juntas desde el 16-sep-2026. Antes cada una tenía
  // su propio permiso (`canLeadAlpha` / `canLeadFaithHouse`), así que quien
  // llevaba solo Alpha veía media pantalla. Ahora la vista «Alpha y Casa de
  // Fe» abre las dos, y las casillas de líder se quedan con su otro oficio:
  // ser elegible para que te asignen un grupo. Es lo que se le explicó al
  // usuario al aprobar el mockup del configurador.
  const veAlpha = true;
  const veCasaDeFe = true;

  const [grupos, lideresAlpha, casas, lideresCasa] = await Promise.all([
    veAlpha ? cargarGrupos(usuario) : Promise.resolve([]),
    veAlpha && puedeCrearAlpha(usuario)
      ? lideresPosibles()
      : Promise.resolve([]),
    veCasaDeFe ? cargarCasasDeFe(usuario) : Promise.resolve([]),
    veCasaDeFe && puedeCrearCasaDeFe(usuario)
      ? lideresPosiblesCasaDeFe()
      : Promise.resolve([]),
  ]);

  // ⚠️ El calendario NO hace ni una consulta nueva: se arma con lo que la
  // página ya trajo para las listas, que además ya viene con el alcance
  // aplicado —cada líder los suyos y los de su rama, administración todos—.
  // Con `PrismaPg max:1` cada viaje de más es una latencia de más (§7).
  //
  // Los cerrados se quedan fuera: un calendario es lo que va a pasar, y un
  // grupo cerrado ya no se reúne.
  const gruposDelCalendario: GrupoDelCalendario[] = [
    ...grupos
      .filter((g) => !g.closedAt)
      .map((g) => ({
        id: g.id,
        tipo: "alpha" as const,
        nombre: g.name,
        lider: g.leader.fullName,
        personas: g._count.enrollments,
        weekday: g.weekday,
        meetingTime: g.meetingTime,
        everyNWeeks: g.everyNWeeks,
        durationMinutes: g.durationMinutes,
        inicio: diaISO(g.startDate),
        tienePunto: g.latitude !== null && g.longitude !== null,
      })),
    ...casas
      .filter((c) => !c.closedAt)
      .map((c) => ({
        id: c.id,
        tipo: "casa-de-fe" as const,
        nombre: c.name,
        lider: c.leader.fullName,
        personas: c._count.members,
        weekday: c.weekday,
        meetingTime: c.meetingTime,
        everyNWeeks: c.everyNWeeks,
        durationMinutes: c.durationMinutes,
        inicio: diaISO(c.startDate),
        tienePunto: c.latitude !== null && c.longitude !== null,
      })),
  ];

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Alpha y Casa de Fe
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              {enCalendario
                ? "Cuántos grupos hay cada día de la semana"
                : "Los grupos de Alpha y las Casas de Fe · elige quién lleva cada uno"}
            </p>
          </div>

          {/* Mismo interruptor que «Mi red»: la vista viaja por la URL. */}
          <div className="flex overflow-hidden rounded-[10px] border border-[rgba(19,28,36,.18)]">
            <Link
              href="/alpha"
              aria-current={enCalendario ? undefined : "page"}
              className={`px-4 py-[10px] text-[12.5px] leading-none ${
                enCalendario
                  ? "bg-white font-semibold text-[rgba(19,28,36,.55)]"
                  : "bg-azul-900 font-bold text-white"
              }`}
            >
              Listas
            </Link>
            <Link
              href={conVista({})}
              aria-current={enCalendario ? "page" : undefined}
              className={`px-4 py-[10px] text-[12.5px] leading-none ${
                enCalendario
                  ? "bg-azul-900 font-bold text-white"
                  : "bg-white font-semibold text-[rgba(19,28,36,.55)]"
              }`}
            >
              Calendario
            </Link>
          </div>
        </header>

        {enCalendario ? (
          <CalendarioSemanal
            grupos={gruposDelCalendario}
            semana={semana}
            hoy={hoy}
            diaElegido={diaElegido}
            tipo={tipo}
            enlaceDeSemana={(inicio) =>
              conVista({ semana: inicio, ...(tipo === "todos" ? {} : { tipo }) })
            }
            enlaceDeDia={(dia) =>
              conVista({
                semana: semana.inicio,
                dia,
                ...(tipo === "todos" ? {} : { tipo }),
              })
            }
            enlaceDeTipo={(t) =>
              conVista({
                semana: semana.inicio,
                ...(t === "todos" ? {} : { tipo: t }),
              })
            }
          />
        ) : (
          <>
        {veAlpha ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="etiqueta-seccion">ALPHA</h2>
              <p className="text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
                {esVistaCompletaDeAlpha(usuario)
                  ? "Todos los grupos de la iglesia"
                  : "Los que llevas y los de tu red"}{" "}
                · {SESIONES_DE_ALPHA} sesiones de referencia
              </p>
            </div>

            {puedeCrearAlpha(usuario) ? (
              <div className="mt-4">
                <NuevoGrupo lideres={lideresAlpha} hoy={hoy} />
              </div>
            ) : null}

            {grupos.length === 0 ? (
              <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Todavía no hay grupos de Alpha.{" "}
                {puedeCrearAlpha(usuario)
                  ? "Crea el primero y elige quién lo lleva."
                  : "Cuando te asignen uno, aparecerá aquí."}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-[10px]">
                {grupos.map((grupo) => (
                  <li key={grupo.id} className="tarjeta p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/alpha/${grupo.id}`}
                          className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
                        >
                          {grupo.name}
                        </Link>
                        <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                          Desde {diaLargo(grupo.startDate)} ·{" "}
                          {grupo.leader.fullName}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
                        <span>
                          {grupo._count.enrollments}{" "}
                          {grupo._count.enrollments === 1 ? "persona" : "personas"}
                        </span>
                        <span>
                          {grupo._count.sessions} / {SESIONES_DE_ALPHA} sesiones
                        </span>
                        {grupo.closedAt ? (
                          <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[9.5px] font-bold text-[rgba(19,28,36,.5)]">
                            CERRADO
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {veCasaDeFe ? (
          <section className="mt-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="etiqueta-seccion">CASA DE FE</h2>
              <p className="text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
                {esVistaCompletaDeCasaDeFe(usuario)
                  ? "Todas las Casas de Fe de la iglesia"
                  : "Las que llevas y las de tu red"}{" "}
                · 12 temas de referencia
              </p>
            </div>

            {puedeCrearCasaDeFe(usuario) ? (
              <div className="mt-4">
                <NuevaCasaDeFe lideres={lideresCasa} hoy={hoy} />
              </div>
            ) : null}

            {casas.length === 0 ? (
              <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Todavía no hay Casas de Fe.{" "}
                {puedeCrearCasaDeFe(usuario)
                  ? "Abre la primera y elige quién la lleva."
                  : "Cuando te asignen una, aparecerá aquí."}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-[10px]">
                {casas.map((casa) => (
                  <li key={casa.id} className="tarjeta p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link
                          href={`/casa-de-fe/${casa.id}`}
                          className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
                        >
                          {casa.name}
                        </Link>
                        <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                          Desde {diaLargo(casa.startDate)} ·{" "}
                          {casa.leader.fullName}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
                        <span>
                          {casa._count.members}{" "}
                          {casa._count.members === 1 ? "persona" : "personas"}
                        </span>
                        {casa.closedAt ? (
                          <span className="rounded-[20px] bg-[rgba(19,28,36,.06)] px-2 py-1 text-[9.5px] font-bold text-[rgba(19,28,36,.5)]">
                            CERRADA
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
          </>
        )}

        <section className="mt-9">
          <MiCalendario
            enlaceInicial={enlaceDeCalendario}
            cuantasReuniones={
              [...grupos, ...casas].filter(
                (g) => g.weekday !== null && g.meetingTime !== null,
              ).length
            }
          />
        </section>
      </div>
    </main>
  );
}
