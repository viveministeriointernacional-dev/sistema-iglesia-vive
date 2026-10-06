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
import { PestanasDeGrupos } from "./pestanas";
import { cargarPorRevisar } from "@/lib/taller";
import { mentoresDeCadaLider } from "@/lib/red";
import { enLaLinea, opcionesDeLinea } from "@/lib/lineas-catalogo";
import { FiltroDeLinea } from "./filtro-de-linea";
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
    mentor?: string;
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

  const mentorPedido = (parametros.mentor ?? "").trim();

  const conVista = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ vista: "calendario", ...cambios });
    // El filtro de línea se conserva al moverse: sin esto, pasar a la semana
    // siguiente devolvería a toda la iglesia sin que nadie lo pidiera.
    if (mentorElegido) p.set("mentor", mentorElegido);
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

  // ------------------------------------------------ el filtro por línea
  // ⚠️ **Las opciones salen de los grupos QUE YA SE CARGARON, y eso es lo que
  // hace que el filtro respete el alcance de cada cuenta sin una sola
  // comprobación de permiso.** `cargarGrupos` y `cargarCasasDeFe` ya traen lo
  // que esta cuenta puede ver (la regla del 12-sep-2026); derivar de ahí
  // significa que a un líder solo se le ofrecen las líneas de su propia rama.
  // Pedir «todos los mentores» habría enseñado nombres de media iglesia en el
  // desplegable de alguien que lleva una casa.
  const abiertos = [
    ...grupos.filter((g) => !g.closedAt).map((g) => ({
      tipo: "alpha" as const,
      liderId: g.leaderId,
    })),
    ...casas.filter((c) => !c.closedAt).map((c) => ({
      tipo: "casa-de-fe" as const,
      liderId: c.leaderId,
    })),
  ];

  // Los cerrados entran en el mapa de líneas aunque no cuenten para el
  // desplegable: si no, al filtrar se escaparían de la lista por no tener
  // línea conocida, en vez de quedarse con su mentor.
  const idsDeLideres = [
    ...new Set([
      ...grupos.map((g) => g.leaderId),
      ...casas.map((c) => c.leaderId),
    ]),
  ];
  const cadenas = await mentoresDeCadaLider(idsDeLideres);

  const lineas: Record<string, string[]> = {};
  const nombres: Record<string, string> = {};
  for (const [lider, arriba] of Object.entries(cadenas)) {
    lineas[lider] = arriba.map((m) => m.id);
    for (const m of arriba) nombres[m.id] = m.nombre;
  }
  for (const g of grupos) nombres[g.leaderId] ??= g.leader.fullName;
  for (const c of casas) nombres[c.leaderId] ??= c.leader.fullName;

  const opciones = opcionesDeLinea(abiertos, lineas, nombres);
  // Una línea que no está en la lista se descarta en vez de dejar la pantalla
  // vacía: un id inventado en la URL no puede hacer creer que no hay grupos.
  const mentorElegido = opciones.some((o) => o.id === mentorPedido)
    ? mentorPedido
    : null;

  const deLaLinea = (liderId: string) =>
    !mentorElegido || enLaLinea(mentorElegido, liderId, lineas);

  const gruposVisibles = grupos.filter((g) => deLaLinea(g.leaderId));
  const casasVisibles = casas.filter((c) => deLaLinea(c.leaderId));

  // ⚠️ El calendario NO hace ni una consulta nueva: se arma con lo que la
  // página ya trajo para las listas, que además ya viene con el alcance
  // aplicado —cada líder los suyos y los de su rama, administración todos—.
  // Con `PrismaPg max:1` cada viaje de más es una latencia de más (§7).
  //
  // Los cerrados se quedan fuera: un calendario es lo que va a pasar, y un
  // grupo cerrado ya no se reúne.
  const gruposDelCalendario: GrupoDelCalendario[] = [
    ...gruposVisibles
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
    ...casasVisibles
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

  // El contador de la pestaña. Sin él, un taller enviado se queda esperando
  // sin que nadie sepa que llegó — y el equipo no vive dentro de la
  // plataforma. Para quien administra o pastorea no cuesta ninguna consulta
  // extra (ver el atajo de `puedeRevisarTaller`).
  const porRevisar = (await cargarPorRevisar(usuario)).length;

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

          <PestanasDeGrupos
            activa={enCalendario ? "calendario" : "listas"}
            porRevisar={porRevisar}
          />
        </header>

        {/* El filtro vale para las dos pestañas, por eso vive aquí y no dentro
            del calendario: la pregunta «¿qué hay en mi línea?» es la misma se
            mire como rejilla o como lista. */}
        <div className="mt-5">
          <FiltroDeLinea
            opciones={opciones}
            elegido={mentorElegido}
            ocultos={{
              ...(enCalendario ? { vista: "calendario" } : {}),
              ...(enCalendario ? { semana: semana.inicio, dia: diaElegido } : {}),
              ...(tipo === "todos" ? {} : { tipo }),
            }}
          />
        </div>

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
                {mentorElegido
                  ? `Solo la línea de ${nombres[mentorElegido]}`
                  : esVistaCompletaDeAlpha(usuario)
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

            {gruposVisibles.length === 0 ? (
              <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                {mentorElegido
                  ? "En esta línea no hay ningún Alpha. Cambia de línea o elige «Toda la iglesia»."
                  : "Todavía no hay grupos de Alpha."}{" "}
                {!mentorElegido && puedeCrearAlpha(usuario)
                  ? "Crea el primero y elige quién lo lleva."
                  : "Cuando te asignen uno, aparecerá aquí."}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-[10px]">
                {gruposVisibles.map((grupo) => (
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
                {mentorElegido
                  ? `Solo la línea de ${nombres[mentorElegido]}`
                  : esVistaCompletaDeCasaDeFe(usuario)
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

            {casasVisibles.length === 0 ? (
              <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                {mentorElegido
                  ? "En esta línea no hay ninguna Casa de Fe. Cambia de línea o elige «Toda la iglesia»."
                  : "Todavía no hay Casas de Fe."}{" "}
                {!mentorElegido && puedeCrearCasaDeFe(usuario)
                  ? "Abre la primera y elige quién la lleva."
                  : "Cuando te asignen una, aparecerá aquí."}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-[10px]">
                {casasVisibles.map((casa) => (
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
              // Sin filtrar a propósito: es SU enlace de calendario, y lo que
              // cuenta es cuántas de sus reuniones tienen día y hora, no
              // cuántas quedan tras el filtro de la pantalla.
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
