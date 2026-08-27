import Link from "next/link";
import { Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { requerirRol, ROLES_CONSOLIDACION, veTodaLaConsolidacion } from "@/lib/auth";
import { nombreCompleto, textoDeEntrada } from "@/lib/dominio";
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

export default async function TableroOperacion72() {
  const usuario = await requerirRol(ROLES_CONSOLIDACION);
  const ahora = new Date();
  const prisma = await getPrisma();

  // Alcance por red: el consolidador ve solo sus personas asignadas; pastor,
  // administrador y coordinadoras de consolidación ven toda la iglesia.
  const alcance =
    usuario.role === Role.CONSOLIDADOR && !veTodaLaConsolidacion(usuario)
      ? { learner: { consolidatorId: usuario.id } }
      : {};

  // Cada columna carga y muestra como máximo esta cantidad de tarjetas, las más
  // urgentes primero. Con cientos de personas en el tablero, cargarlas y
  // renderizarlas todas de golpe agota la memoria del Worker (error 1102): el
  // encabezado conserva el total real y lo que sobra se busca por nombre.
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
      where: { status: { in: [...ESTADOS_EN_TABLERO] }, ...alcance },
      _count: { _all: true },
    }),
    mentoresElegibles(prisma),
    ...COLUMNAS_OP72.map((columna) =>
      prisma.operation72.findMany({
        where: { status: columna.estado, ...alcance },
        orderBy: { deadlineAt: "asc" },
        take: LIMITE_POR_COLUMNA,
        select: seleccionDeTarjeta,
      }),
    ),
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
              curso
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

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      Nadie en esta columna.
                    </p>
                  ) : null}
                  {ocultas > 0 ? (
                    <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.4)]">
                      +{ocultas} más. Se muestran las {personas.length} más
                      urgentes; usa el buscador para encontrar a alguien
                      puntual.
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
