import { headers } from "next/headers";
import { hoyEnColombia } from "@/lib/dominio";
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
import { enLaLinea, opcionesDeLinea, repartirPorLinea } from "@/lib/lineas-catalogo";
import { BloqueDeGrupos, ListaDeAlpha, ListaDeCasas } from "./listas-de-grupos";
import {
  fraseDelAlcance,
  fraseDelHueco,
  fraseSoloLaLinea,
  fraseSoloLasQueLleva,
  ROTULOS,
  TIPOS_DE_GRUPO,
  tipoDeLaUrl,
  type ClaveDeSeccion,
  type RotulosDeGrupo,
  type TipoDeGrupo,
} from "@/lib/tipo-de-grupo";
import {
  FiltroDeDirectas,
  quienLaLlevaDeLaUrl,
} from "./filtro-de-directas";
import { FiltroDeLinea } from "./filtro-de-linea";
import { MiCalendario } from "./mi-calendario";
import { NuevoGrupo } from "./nuevo-grupo";
import { NuevaCasaDeFe } from "../casa-de-fe/nuevo-grupo";

export const metadata = { title: "Grupos · Iglesia Vive" };
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
    lleva?: string;
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
  // `null` quiere decir «todos». Un valor inventado en la URL cae en `null` en
  // vez de dejar el calendario en blanco, igual que el filtro de línea.
  const tipo = tipoDeLaUrl(parametros.tipo);
  const tipoEnLaUrl = tipo ? ROTULOS[tipo].enLaUrl : null;
  // En el celular se mira un día: hoy si la semana que se ve lo contiene, y si
  // no el lunes — nunca un día suelto de otra semana.
  const diaElegido =
    parametros.dia && semana.dias.includes(parametros.dia)
      ? parametros.dia
      : semana.dias.includes(hoy)
        ? hoy
        : semana.inicio;

  const mentorPedido = (parametros.mentor ?? "").trim();
  const quienLaLleva = quienLaLlevaDeLaUrl(parametros.lleva);

  const conVista = (cambios: Record<string, string>) => {
    const p = new URLSearchParams({ vista: "calendario", ...cambios });
    // El filtro de línea se conserva al moverse: sin esto, pasar a la semana
    // siguiente devolvería a toda la iglesia sin que nadie lo pidiera.
    if (mentorElegido) p.set("mentor", mentorElegido);
    // Y lo mismo con «directas»: cambiar de semana no puede devolver en
    // silencio a la línea entera.
    if (quienLaLleva !== "todas") p.set("lleva", quienLaLleva);
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
      tipo: "ALPHA" as const,
      liderId: g.leaderId,
    })),
    // Las tres clases de `faith_house_group` viajan juntas y cada una dice
    // cuál es: así el desplegable cuenta «52 casas · 2 mentorías» en vez de
    // meterlas todas en el saco de las casas.
    ...casas.filter((c) => !c.closedAt).map((c) => ({
      tipo: c.kind,
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

  // ------------------------------- las que lleva él y las de los suyos
  // ⚠️ **El filtro de línea no contestaba «cuáles lleva ÉL»**, que es lo que
  // se pidió el 27-oct-2026: con la línea de Alejandro Facundo puesta salían
  // **60 Casas de Fe y 15 son suyas**; en la de Juan Felipe, 17 y 8. El
  // nombre del líder iba en cada renglón, pero buscar 15 entre 60 renglones
  // no es distinguir.
  //
  // Se reparte **solo con una línea elegida**: sin filtro no hay nadie
  // respecto a quien «directa» signifique algo, y partir «lo tuyo / lo de los
  // demás» en la vista de toda la iglesia sería otra pregunta.
  const nombreDeLaLinea = mentorElegido ? (nombres[mentorElegido] ?? "—") : "";

  // El botón de arriba (Todas · Las que lleva él · Las de su línea). **Manda
  // sobre las dos pestañas**, que es lo que se pidió: el calendario también
  // tenía el mismo problema de mezclar, y un filtro que solo valiera para la
  // lista obligaría a elegir dos veces lo mismo.
  const elegir = <T,>(reparto: { directas: T[]; deSuLinea: T[] } | null, todos: T[]) =>
    !reparto || quienLaLleva === "todas"
      ? todos
      : quienLaLleva === "directas"
        ? reparto.directas
        : reparto.deSuLinea;

  /// **Todo lo que un bloque de la pantalla necesita saber de sí mismo.**
  ///
  /// Se calcula igual para los cuatro. Antes esto estaba escrito dos veces,
  /// una por sección, y con cuatro tipos habrían sido cuatro copias del mismo
  /// filtro y de las mismas seis frases — que es donde se cuela la falta que
  /// nadie ve (§12.6).
  function prepararBloque<T extends { leaderId: string; closedAt: Date | null }>(
    clave: ClaveDeSeccion,
    todos: T[],
    vistaCompleta: boolean,
  ) {
    const rotulos: RotulosDeGrupo = ROTULOS[clave];
    const visibles = todos.filter((g) => deLaLinea(g.leaderId));
    const reparto = mentorElegido
      ? repartirPorLinea(visibles, (g) => g.leaderId, mentorElegido)
      : null;
    const elegidos = elegir(reparto, visibles);

    const alcance = !mentorElegido
      ? fraseDelAlcance(rotulos, vistaCompleta)
      : quienLaLleva === "directas"
        ? fraseSoloLasQueLleva(rotulos, nombreDeLaLinea)
        : quienLaLleva === "linea"
          ? fraseSoloLaLinea(rotulos, nombreDeLaLinea)
          : `Solo la línea de ${nombreDeLaLinea}`;

    const hueco = !mentorElegido
      ? fraseDelHueco(rotulos, {
          filtro: "sin-linea",
          puedeCrear: clave === "ALPHA" ? puedeCrearAlpha(usuario) : puedeCrearCasaDeFe(usuario),
        })
      : quienLaLleva === "directas"
        ? fraseDelHueco(rotulos, { filtro: "directas", nombre: nombreDeLaLinea })
        : quienLaLleva === "linea"
          ? fraseDelHueco(rotulos, { filtro: "linea" })
          : fraseDelHueco(rotulos, { filtro: "todas", nombre: nombreDeLaLinea });

    return {
      rotulos,
      visibles,
      elegidos,
      // ⚠️ El reparto se devuelve **aparte de `partida`**: los contadores del
      // botón de arriba («Las que lleva él · 17») tienen que seguir diciendo
      // la verdad con el filtro puesto, y `partida` se apaga justo entonces.
      reparto,
      coletilla: `${alcance} · ${rotulos.referencia}`,
      hueco,
      // La lista se parte en dos bloques **solo cuando se están viendo las dos
      // mitades**: con «directas» puesto ya no hay nada que separar, y el
      // botón de arriba, encendido, dice qué se está mirando mejor que un
      // rótulo.
      partida:
        quienLaLleva === "todas" && reparto
          ? {
              directas: reparto.directas,
              deSuLinea: reparto.deSuLinea,
              rotulos: {
                directas: `${rotulos.articuloPlural === "las" ? "Las" : "Los"} que lleva ${nombreDeLaLinea}`,
                deSuLinea: `${rotulos.articuloPlural === "las" ? "Las" : "Los"} que llevan los de su línea`,
              },
            }
          : null,
      conLider: quienLaLleva !== "directas",
    };
  }

  const bloqueDeAlpha = prepararBloque(
    "ALPHA",
    grupos,
    esVistaCompletaDeAlpha(usuario),
  );
  const bloquesDeCasas = TIPOS_DE_GRUPO.map((t) =>
    prepararBloque(
      t,
      casas.filter((c) => c.kind === t),
      esVistaCompletaDeCasaDeFe(usuario),
    ),
  );

  // Los contadores del botón de arriba suman **los cuatro**: es un filtro de
  // toda la pantalla, no de un bloque.
  const todosLosBloques = [bloqueDeAlpha, ...bloquesDeCasas];
  const cuantasDirectas = todosLosBloques.reduce(
    (n, b) => n + (b.reparto?.directas.length ?? 0),
    0,
  );
  const cuantasDeSuLinea = todosLosBloques.reduce(
    (n, b) => n + (b.reparto?.deSuLinea.length ?? 0),
    0,
  );

  const enlaceDeDirectas = (quien: "todas" | "directas" | "linea") => {
    const p = new URLSearchParams();
    if (enCalendario) {
      p.set("vista", "calendario");
      p.set("semana", semana.inicio);
      p.set("dia", diaElegido);
    }
    if (tipoEnLaUrl) p.set("tipo", tipoEnLaUrl);
    if (mentorElegido) p.set("mentor", mentorElegido);
    if (quien !== "todas") p.set("lleva", quien);
    return `/alpha?${p.toString()}`;
  };

  // ⚠️ El calendario NO hace ni una consulta nueva: se arma con lo que la
  // página ya trajo para las listas, que además ya viene con el alcance
  // aplicado —cada líder los suyos y los de su rama, administración todos—.
  // Con `PrismaPg max:1` cada viaje de más es una latencia de más (§7).
  //
  // Los cerrados se quedan fuera: un calendario es lo que va a pasar, y un
  // grupo cerrado ya no se reúne.
  const gruposDelCalendario: GrupoDelCalendario[] = [
    ...bloqueDeAlpha.elegidos
      .filter((g) => !g.closedAt)
      .map((g) => ({
        id: g.id,
        tipo: "ALPHA" as const,
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
    // Los tres tipos de `faith_house_group`, cada uno con el suyo: es lo que
    // le da al calendario sus cuatro colores y sus cuatro chips.
    ...bloquesDeCasas
      .flatMap((b) => b.elegidos)
      .filter((c) => !c.closedAt)
      .map((c) => ({
        id: c.id,
        tipo: c.kind,
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
            {/* ⚠️ Dejó de llamarse «Alpha y Casa de Fe» el 27-oct-2026, al
                aparecer Restaurados y Mentorías: con cuatro bloques dentro,
                ese título nombraba la mitad de lo que hay en la pantalla. */}
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Grupos
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              {enCalendario
                ? "Cuántos grupos hay cada día de la semana"
                : "Alpha, Casas de Fe, Restaurados y Mentorías · elige quién lleva cada uno"}
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
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <FiltroDeLinea
            opciones={opciones}
            elegido={mentorElegido}
            ocultos={{
              ...(enCalendario ? { vista: "calendario" } : {}),
              ...(enCalendario ? { semana: semana.inicio, dia: diaElegido } : {}),
              ...(tipoEnLaUrl ? { tipo: tipoEnLaUrl } : {}),
              // Sin esto, cambiar de línea apagaría «directas» sin decirlo.
              ...(quienLaLleva === "todas" ? {} : { lleva: quienLaLleva }),
            }}
          />

          {/* Va aquí, fuera de las dos pestañas, porque manda en las dos.
              Y cuenta los CUATRO tipos: es el filtro de la pantalla entera. */}
          {mentorElegido ? (
            <FiltroDeDirectas
              elegido={quienLaLleva}
              nombre={nombreDeLaLinea}
              directas={cuantasDirectas}
              deSuLinea={cuantasDeSuLinea}
              enlace={enlaceDeDirectas}
            />
          ) : null}
        </div>

        {enCalendario ? (
          <CalendarioSemanal
            grupos={gruposDelCalendario}
            semana={semana}
            hoy={hoy}
            diaElegido={diaElegido}
            tipo={tipo}
            enlaceDeSemana={(inicio) =>
              conVista({ semana: inicio, ...(tipoEnLaUrl ? { tipo: tipoEnLaUrl } : {}) })
            }
            enlaceDeDia={(dia) =>
              conVista({
                semana: semana.inicio,
                dia,
                ...(tipoEnLaUrl ? { tipo: tipoEnLaUrl } : {}),
              })
            }
            enlaceDeTipo={(t) =>
              conVista({
                semana: semana.inicio,
                ...(t ? { tipo: ROTULOS[t].enLaUrl } : {}),
              })
            }
          />
        ) : (
          <>
            {/* **Los cuatro bloques salen del mismo molde.** Hasta el
                27-oct-2026 eran dos `<section>` escritas a mano, casi iguales
                salvo el género de las palabras; con cuatro, copiar otras dos
                era la forma segura de que a la cuarta se le olvidara algo. Lo
                que cambia entre ellos —cómo se llaman, qué botón abren y qué
                lista pintan— viene del catálogo. */}
            <BloqueDeGrupos
              className="mt-8"
              rotulos={bloqueDeAlpha.rotulos}
              coletilla={bloqueDeAlpha.coletilla}
              crear={
                puedeCrearAlpha(usuario) ? (
                  <NuevoGrupo lideres={lideresAlpha} hoy={hoy} />
                ) : null
              }
              hueco={bloqueDeAlpha.hueco}
              items={bloqueDeAlpha.elegidos}
              partida={bloqueDeAlpha.partida}
              conLider={bloqueDeAlpha.conLider}
              pintar={(items, conLider) => (
                <ListaDeAlpha grupos={items} conLider={conLider} />
              )}
            />

            {bloquesDeCasas.map((bloque) => (
              <BloqueDeGrupos
                key={bloque.rotulos.clave}
                rotulos={bloque.rotulos}
                coletilla={bloque.coletilla}
                crear={
                  puedeCrearCasaDeFe(usuario) ? (
                    <NuevaCasaDeFe
                      tipo={bloque.rotulos.clave as TipoDeGrupo}
                      lideres={lideresCasa}
                      hoy={hoy}
                    />
                  ) : null
                }
                hueco={bloque.hueco}
                items={bloque.elegidos}
                partida={bloque.partida}
                conLider={bloque.conLider}
                pintar={(items, conLider) => (
                  <ListaDeCasas
                    casas={items}
                    rotulos={bloque.rotulos}
                    conLider={conLider}
                  />
                )}
              />
            ))}
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
