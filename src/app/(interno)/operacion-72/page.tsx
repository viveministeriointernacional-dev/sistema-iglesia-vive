import Link from "next/link";
import { type Prisma, Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { requerirRol, ROLES_CONSOLIDACION, veTodaLaConsolidacion } from "@/lib/auth";
import { nombreCompleto, normalizarBusqueda, textoDeEntrada } from "@/lib/dominio";
import {
  COLUMNAS_OP72,
  ESTADOS_EN_TABLERO,
  edadDesde,
  porcentajeAvance,
  textoChip,
  tituloLinea,
  TRANSICIONES,
  urgenciaDe,
} from "@/lib/op72";
import { mentoresElegibles } from "@/lib/equipo";
import { BuscadorPersonas } from "@/components/buscador-personas";
import { TarjetaDePersona, type TarjetaPersona } from "./tarjeta";

export const metadata = { title: "Operación 72 · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// Orden de las tarjetas dentro de cada columna.
/// - `urgencia` (por defecto): primero quienes siguen dentro de sus 72 horas,
///   luego las vencidas de la más reciente a la más antigua.
/// - `reciente` / `antiguo`: por fecha de registro en Operación 72.
type Orden = "urgencia" | "reciente" | "antiguo";

const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: "urgencia", etiqueta: "Por urgencia" },
  { valor: "reciente", etiqueta: "Más reciente primero" },
  { valor: "antiguo", etiqueta: "Más antiguo primero" },
];

function ordenDesde(valor: string | undefined): Orden {
  return valor === "reciente" || valor === "antiguo" ? valor : "urgencia";
}

export default async function TableroOperacion72({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; orden?: string }>;
}) {
  const usuario = await requerirRol(ROLES_CONSOLIDACION);
  const { q: consultaCruda, orden: ordenCrudo } = await searchParams;
  const consulta = (consultaCruda ?? "").trim();
  const orden = ordenDesde(ordenCrudo);
  const ahora = new Date();
  const prisma = await getPrisma();

  // Alcance por red: el consolidador ve solo sus personas asignadas; pastor,
  // administrador y coordinadoras de consolidación ven toda la iglesia.
  const alcance =
    usuario.role === Role.CONSOLIDADOR && !veTodaLaConsolidacion(usuario)
      ? { learner: { consolidatorId: usuario.id } }
      : {};

  // Búsqueda por nombre o celular dentro del tablero. El nombre (y el correo)
  // salen de `person.search_text`, que ya está sin tildes ni mayúsculas. El
  // celular se compara solo por dígitos, porque el mismo número aparece como
  // «323 7448212», «+573237448212» o «3237448212» según quién lo escribió.
  const digitos = consulta.replace(/\D/g, "");
  const condicionesDeBusqueda: Prisma.Operation72WhereInput[] = [];
  if (consulta) {
    condicionesDeBusqueda.push({
      learner: { person: { searchText: { contains: normalizarBusqueda(consulta) } } },
    });
    if (digitos.length >= 4) {
      const patron = `%${digitos}%`;
      const porTelefono = await prisma.$queryRaw<{ id: string }[]>`
        SELECT lp.id
        FROM learner_profile lp
        JOIN person p ON p.id = lp.person_id
        WHERE regexp_replace(coalesce(p.call_phone, ''), '\\D', '', 'g') LIKE ${patron}
           OR regexp_replace(coalesce(p.whatsapp_phone, ''), '\\D', '', 'g') LIKE ${patron}
      `;
      if (porTelefono.length) {
        condicionesDeBusqueda.push({ learnerId: { in: porTelefono.map((f) => f.id) } });
      }
    }
  }
  const busqueda = condicionesDeBusqueda.length ? { OR: condicionesDeBusqueda } : {};

  // Cada columna carga y muestra como máximo esta cantidad de tarjetas. Con
  // cientos de personas en el tablero, cargarlas y renderizarlas todas de golpe
  // agota la memoria del Worker (error 1102): el encabezado conserva el total
  // real y lo que sobra se encuentra con la búsqueda.
  const LIMITE_POR_COLUMNA = 60;

  const seleccionDeTarjeta = {
    id: true,
    status: true,
    deadlineAt: true,
    detail: true,
    lineKnown: true,
    proposedMentorId: true,
    proposedMentorNote: true,
    proposedMentor: {
      select: { fullName: true, team: { select: { name: true } } },
    },
    learner: {
      select: {
        id: true,
        entryPoint: true,
        entryPointOther: true,
        lineOfOrigin: true,
        person: {
          select: { firstName: true, lastName: true, birthDate: true },
        },
      },
    },
  } as const;

  const [conteos, mentores, ...gruposPorColumna] = await Promise.all([
    prisma.operation72.groupBy({
      by: ["status"],
      where: { status: { in: [...ESTADOS_EN_TABLERO] }, ...alcance, ...busqueda },
      _count: { _all: true },
    }),
    mentoresElegibles(prisma),
    ...COLUMNAS_OP72.map(async (columna) => {
      const base = { status: columna.estado, ...alcance, ...busqueda };

      if (orden !== "urgencia") {
        return prisma.operation72.findMany({
          where: base,
          orderBy: { startedAt: orden === "reciente" ? "desc" : "asc" },
          take: LIMITE_POR_COLUMNA,
          select: seleccionDeTarjeta,
        });
      }

      // Primero quienes SIGUEN dentro de sus 72 horas (los que todavía se
      // pueden atender a tiempo), del que menos margen tiene al que más. Con
      // cientos de tarjetas vencidas acumuladas, ordenar solo por plazo dejaba
      // a los registros nuevos al final y el límite por columna los cortaba:
      // justo las personas que hay que llamar hoy quedaban invisibles.
      const dentroDePlazo = await prisma.operation72.findMany({
        where: { ...base, deadlineAt: { gte: ahora } },
        orderBy: { deadlineAt: "asc" },
        take: LIMITE_POR_COLUMNA,
        select: seleccionDeTarjeta,
      });

      const resto = LIMITE_POR_COLUMNA - dentroDePlazo.length;
      if (resto <= 0) return dentroDePlazo;

      // Y después las vencidas, de la más reciente a la más antigua: una deuda
      // de esta semana se recupera; una de hace meses ya no es lo urgente.
      const vencidas = await prisma.operation72.findMany({
        where: { ...base, deadlineAt: { lt: ahora } },
        orderBy: { deadlineAt: "desc" },
        take: resto,
        select: seleccionDeTarjeta,
      });

      return [...dentroDePlazo, ...vencidas];
    }),
  ]);

  const totalPorEstado = new Map(
    conteos.map((fila) => [fila.status, fila._count._all]),
  );
  const operaciones = gruposPorColumna.flat();

  const tarjetas: TarjetaPersona[] = operaciones.map((operacion) => {
    const { learner } = operacion;
    const edad = edadDesde(learner.person.birthDate, ahora);
    const transicion = TRANSICIONES[operacion.status];

    return {
      operacionId: operacion.id,
      learnerId: learner.id,
      estado: operacion.status,
      nombre: nombreCompleto(learner.person),
      origen: [
        textoDeEntrada(learner.entryPoint, learner.entryPointOther),
        learner.lineOfOrigin ? `invitada por ${learner.lineOfOrigin}` : null,
        edad !== null ? `${edad} años` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      detalle: operacion.detail,
      chip: textoChip(operacion.deadlineAt, ahora),
      urgencia: urgenciaDe(operacion.deadlineAt, ahora),
      avance: porcentajeAvance(operacion.deadlineAt, ahora),
      accion: transicion?.etiqueta ?? "Sin acción",
      mentorPropuestoId: operacion.proposedMentorId,
      entrega:
        operacion.status === "LISTA_PARA_ENTREGA"
          ? {
              titulo: tituloLinea(operacion.lineKnown),
              mentor: operacion.proposedMentor
                ? `${operacion.lineKnown ? "Mentor propuesto" : "Sugerido"}: ${operacion.proposedMentor.fullName}`
                : "Sin mentor con cupo · escalar a un líder",
              detalle: [
                operacion.proposedMentor?.team?.name,
                operacion.proposedMentorNote,
              ]
                .filter(Boolean)
                .join(" · "),
            }
          : null,
    };
  });

  const totalEnCurso = [...totalPorEstado.values()].reduce((a, b) => a + b, 0);
  const hayFiltro = Boolean(consulta) || orden !== "urgencia";

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Operación 72
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              Las primeras 72 horas de cada persona nueva · {totalEnCurso} en
              curso{consulta ? ` que coinciden con «${consulta}»` : ""}
            </p>
          </div>
          <Link
            href="/registro-interno"
            className="rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white"
          >
            + Registrar persona
          </Link>
        </div>

        <div className="mt-5 max-w-[460px]">
          <BuscadorPersonas />
        </div>

        {/* Filtros del tablero: orden y búsqueda dentro de las columnas. Es un
            formulario normal (GET) a propósito: la URL queda compartible y no
            hace falta JavaScript para que funcione. */}
        <form
          method="get"
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <input
            type="search"
            name="q"
            defaultValue={consulta}
            placeholder="Filtrar por nombre o celular…"
            className="campo min-w-[220px] flex-1 sm:max-w-[320px]"
            aria-label="Filtrar el tablero por nombre o celular"
          />
          <select
            name="orden"
            defaultValue={orden}
            className="campo sm:max-w-[220px]"
            aria-label="Orden de las tarjetas"
          >
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white"
          >
            Aplicar
          </button>
          {hayFiltro ? (
            <Link
              href="/operacion-72"
              className="px-2 text-[12.5px] leading-none font-semibold text-azul-700"
            >
              Limpiar
            </Link>
          ) : null}
        </form>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {COLUMNAS_OP72.map((columna) => {
            const personas = tarjetas.filter((t) => t.estado === columna.estado);
            const total = totalPorEstado.get(columna.estado) ?? personas.length;
            const ocultas = total - personas.length;
            return (
              <section key={columna.estado}>
                <header className="flex items-center justify-between px-1 pb-[10px]">
                  <h2 className="text-[10px] leading-none font-bold tracking-[.14em] text-[rgba(19,28,36,.5)]">
                    {columna.titulo}
                  </h2>
                  <span className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.35)]">
                    {total}
                  </span>
                </header>

                <div className="flex flex-col gap-[10px]">
                  {personas.map((persona) => (
                    <TarjetaDePersona
                      key={persona.operacionId}
                      persona={persona}
                      mentores={mentores}
                    />
                  ))}
                  {personas.length === 0 ? (
                    <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.4)]">
                      {consulta ? "Nadie coincide en esta columna." : "Nadie en esta columna."}
                    </p>
                  ) : null}
                  {ocultas > 0 ? (
                    <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.4)]">
                      +{ocultas} más. Se muestran las {personas.length} primeras
                      según el orden elegido; afina con el filtro para
                      encontrar a alguien puntual.
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
