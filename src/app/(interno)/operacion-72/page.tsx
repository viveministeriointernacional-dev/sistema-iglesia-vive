import Link from "next/link";
import { Operation72Status, type Prisma, Role } from "@iglesia/prisma-client";
import { getPrisma } from "@/lib/prisma";
import { requerirRol, ROLES_CONSOLIDACION, veTodaLaConsolidacion } from "@/lib/auth";
import {
  momentoLegible,
  nombreCompleto,
  normalizarBusqueda,
  telefonoLegible,
  textoDeEntrada,
  textoDeHorario,
} from "@/lib/dominio";
import {
  COLUMNAS_OP72,
  ESTADOS_EN_TABLERO,
  edadDesde,
  porcentajeAvance,
  textoChip,
  tituloDelMovimiento,
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

/// Etiquetas de los chips «Ver solo». Van en minúscula porque se leen como
/// frase («ver solo · visita pendiente»), no como rótulo de columna.
const ETIQUETA_CHIP: Record<Operation72Status, string> = {
  [Operation72Status.INICIADA]: "Iniciada",
  [Operation72Status.SEGUIMIENTO]: "Seguimiento",
  [Operation72Status.CONTACTADA]: "Contactada",
  [Operation72Status.VISITA_PENDIENTE]: "Visita pendiente",
  [Operation72Status.LISTA_PARA_ENTREGA]: "Lista para entrega",
  [Operation72Status.ENTREGADA]: "Entregada",
  [Operation72Status.CERRADA]: "Cerrada",
};

/// Cuántas tarjetas se añaden con cada «Ver 60 más».
const BLOQUE = 60;

function estadoDesde(valor: string | undefined): Operation72Status | null {
  const encontrado = ESTADOS_EN_TABLERO.find((estado) => estado === valor);
  return encontrado ?? null;
}

/// Cuántas tarjetas mostrar en la columna enfocada. Crece de 60 en 60 con el
/// botón; se redondea al bloque para que la URL no pueda pedir un número
/// arbitrario y reventar la memoria del Worker.
function cuantasDesde(valor: string | undefined): number {
  const pedidas = Number.parseInt(valor ?? "", 10);
  if (!Number.isFinite(pedidas) || pedidas <= BLOQUE) return BLOQUE;
  return Math.min(Math.ceil(pedidas / BLOQUE) * BLOQUE, 600);
}

export default async function TableroOperacion72({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; orden?: string; estado?: string; n?: string }>;
}) {
  const usuario = await requerirRol(ROLES_CONSOLIDACION);
  const {
    q: consultaCruda,
    orden: ordenCrudo,
    estado: estadoCrudo,
    n: cuantasCrudas,
  } = await searchParams;
  const consulta = (consultaCruda ?? "").trim();
  const orden = ordenDesde(ordenCrudo);
  // Con un estado elegido el tablero muestra esa sola etapa a todo lo ancho.
  const estadoElegido = estadoDesde(estadoCrudo);
  const cuantas = estadoElegido ? cuantasDesde(cuantasCrudas) : BLOQUE;
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

  // Cuántas tarjetas carga y renderiza cada columna. Con cientos de personas,
  // construirlas todas de golpe agota la memoria del Worker (error 1102), así
  // que en la vista de las cinco columnas el tope se queda en 60 por columna.
  // Al elegir un estado solo se carga ESA columna, y ahí el botón «Ver 60 más»
  // puede subir el tope sin acercarse al límite: son cinco veces menos tarjetas
  // por página.
  const LIMITE_POR_COLUMNA = cuantas;

  // Qué columnas se dibujan: todas, o solo la del estado elegido.
  const columnasVisibles = estadoElegido
    ? COLUMNAS_OP72.filter((columna) => columna.estado === estadoElegido)
    : COLUMNAS_OP72;

  const seleccionDeTarjeta = {
    id: true,
    status: true,
    startedAt: true,
    deadlineAt: true,
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
        consolidator: { select: { fullName: true } },
        person: {
          select: {
            firstName: true,
            lastName: true,
            birthDate: true,
            gender: true,
            callPhone: true,
            whatsappPhone: true,
            callSchedules: true,
            callScheduleNote: true,
          },
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
    ...columnasVisibles.map(async (columna) => {
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

  // El último movimiento de cada tarjeta (qué pasó, quién y cuándo) y cuántas
  // llamadas lleva. Una sola consulta para todas las tarjetas visibles: es lo
  // que reemplaza al resumen libre `detail`, que mezclaba el hecho con la
  // observación y no decía quién ni cuándo.
  const intentos = operaciones.length
    ? await prisma.contactAttempt.findMany({
        where: { operation72Id: { in: operaciones.map((o) => o.id) } },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        select: {
          operation72Id: true,
          type: true,
          outcome: true,
          result: true,
          note: true,
          occurredAt: true,
          scheduledAt: true,
          place: true,
          isVirtual: true,
          byUser: { select: { fullName: true } },
        },
      })
    : [];
  const ultimoPorOperacion = new Map<string, (typeof intentos)[number]>();
  const llamadasPorOperacion = new Map<string, number>();
  const visitaPorOperacion = new Map<string, (typeof intentos)[number]>();
  for (const intento of intentos) {
    if (!ultimoPorOperacion.has(intento.operation72Id)) {
      ultimoPorOperacion.set(intento.operation72Id, intento);
    }
    if (intento.type === "LLAMADA" || intento.type === "INTENTO_LLAMADA") {
      llamadasPorOperacion.set(
        intento.operation72Id,
        (llamadasPorOperacion.get(intento.operation72Id) ?? 0) + 1,
      );
    }
    if (intento.type === "VISITA" && !visitaPorOperacion.has(intento.operation72Id)) {
      visitaPorOperacion.set(intento.operation72Id, intento);
    }
  }

  const tarjetas: TarjetaPersona[] = operaciones.map((operacion) => {
    const { learner } = operacion;
    const persona = learner.person;
    const edad = edadDesde(persona.birthDate, ahora);
    const transicion = TRANSICIONES[operacion.status];
    const celular = telefonoLegible(persona.callPhone ?? persona.whatsappPhone);
    const ultimo = ultimoPorOperacion.get(operacion.id) ?? null;
    const visita = visitaPorOperacion.get(operacion.id) ?? null;
    const llamadas = llamadasPorOperacion.get(operacion.id) ?? 0;

    const invito =
      persona.gender === "MUJER" ? "LA INVITÓ" : persona.gender === "HOMBRE" ? "LO INVITÓ" : "INVITÓ";

    // Cuándo dijo la persona que se le puede llamar: va pegado al celular
    // porque es lo segundo que se mira antes de marcar.
    const horario = textoDeHorario(persona.callSchedules, persona.callScheduleNote);

    const datos: TarjetaPersona["datos"] = [
      { rotulo: "CELULAR", valor: celular, ausente: !celular },
      { rotulo: "LLAMAR", valor: horario, ausente: !horario, faltante: "Sin horario preferido" },
      {
        rotulo: "CONSOLIDA",
        valor: learner.consolidator?.fullName ?? null,
        ausente: !learner.consolidator,
        faltante: "Sin consolidador asignado",
      },
      { rotulo: invito, valor: learner.lineOfOrigin?.trim() || null, ausente: !learner.lineOfOrigin?.trim() },
      {
        rotulo: "LLEGÓ POR",
        valor: learner.entryPoint ? textoDeEntrada(learner.entryPoint, learner.entryPointOther) : null,
        ausente: !learner.entryPoint,
      },
    ];
    // La edad solo cuando se conoce: un «0 años» por una fecha en blanco es un
    // dato inventado, y eso es peor que ninguno.
    if (edad !== null) datos.push({ rotulo: "EDAD", valor: `${edad} años`, ausente: false });

    // Mientras hay visita acordada, la tarjeta muestra la visita: es lo que el
    // consolidador necesita ver. En las demás columnas, el último movimiento.
    const visitaAcordada =
      operacion.status === "VISITA_PENDIENTE" && visita
        ? {
            cuando: visita.scheduledAt ? momentoLegible(visita.scheduledAt, ahora) : "fecha por confirmar",
            donde: visita.isVirtual ? "virtual" : visita.place?.trim() || null,
            // Las visitas que llegan del CRM no traen usuario: las agendó la línea.
            quien: visita.byUser?.fullName ?? null,
            desdeCrm: !visita.byUser,
            nota: visita.note?.trim() || null,
          }
        : null;

    const movimiento = ultimo
      ? {
          titulo: tituloDelMovimiento({
            type: ultimo.type,
            outcome: ultimo.outcome,
            result: ultimo.result,
            // El intento que se está describiendo es el último: los previos
            // son todos los demás.
            intentosPrevios: Math.max(llamadas - 1, 0),
          }),
          quien: ultimo.byUser?.fullName ?? (ultimo.type === "VISITA" ? "La línea, desde el CRM" : null),
          cuando: momentoLegible(ultimo.occurredAt, ahora),
          observacion: ultimo.note?.trim() || null,
        }
      : {
          titulo: learner.consolidator
            ? "Registrada · consolidador asignado"
            : "Registrada · sin consolidador disponible",
          quien: null,
          cuando: momentoLegible(operacion.startedAt, ahora),
          observacion: null,
        };

    return {
      operacionId: operacion.id,
      learnerId: learner.id,
      estado: operacion.status,
      nombre: nombreCompleto(persona),
      registrada: momentoLegible(operacion.startedAt, ahora),
      datos,
      movimiento,
      visitaAcordada,
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
  const hayFiltro = Boolean(consulta) || orden !== "urgencia" || Boolean(estadoElegido);

  // Vista enfocada: cuántas se ven, cuántas hay y cuántas faltan.
  const totalDelEstado = estadoElegido ? (totalPorEstado.get(estadoElegido) ?? 0) : 0;
  const mostradas = estadoElegido ? tarjetas.length : 0;
  const faltan = Math.max(totalDelEstado - mostradas, 0);

  // Enlaces de los chips y del botón: conservan la búsqueda y el orden, y
  // reinician el «cuántas» al cambiar de estado.
  function enlace(parametros: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    if (consulta) url.set("q", consulta);
    if (orden !== "urgencia") url.set("orden", orden);
    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor) url.set(clave, valor);
    }
    const cadena = url.toString();
    return cadena ? `/operacion-72?${cadena}` : "/operacion-72";
  }

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Operación 72
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              Las primeras 72 horas de cada persona nueva ·{" "}
              {estadoElegido
                ? `${totalPorEstado.get(estadoElegido) ?? 0} en ${ETIQUETA_CHIP[estadoElegido]}`
                : `${totalEnCurso} en curso`}
              {consulta ? ` que coinciden con «${consulta}»` : ""}
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
          {/* Al buscar se conserva el estado elegido con los chips. */}
          {estadoElegido ? (
            <input type="hidden" name="estado" value={estadoElegido} />
          ) : null}
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

        {/* Chips «Ver solo»: una etapa a la vez, a todo lo ancho. Es lo que
            permite llegar a las personas que no caben en la columna angosta.
            Son enlaces (no JavaScript) para que la vista quede compartible. */}
        <div className="mt-[18px] border-t border-[rgba(19,28,36,.09)] pt-[14px]">
          <p className="text-[9.5px] leading-none font-extrabold tracking-[.06em] text-[rgba(19,28,36,.42)]">
            VER SOLO
          </p>
          <div className="mt-[9px] flex flex-wrap gap-[7px]">
            <Link
              href={enlace({})}
              aria-current={estadoElegido ? undefined : "page"}
              className={`flex items-center gap-[7px] rounded-[20px] px-[13px] py-2 text-[12px] leading-none ${
                estadoElegido
                  ? "border border-borde-control bg-white font-semibold text-[rgba(19,28,36,.62)]"
                  : "border-[1.5px] border-azul-900 bg-azul-050 font-bold text-tinta"
              }`}
            >
              Todas
              <span className="font-extrabold text-[rgba(19,28,36,.42)]">{totalEnCurso}</span>
            </Link>
            {COLUMNAS_OP72.map((columna) => {
              const activo = estadoElegido === columna.estado;
              return (
                <Link
                  key={columna.estado}
                  href={enlace({ estado: columna.estado })}
                  aria-current={activo ? "page" : undefined}
                  className={`flex items-center gap-[7px] rounded-[20px] px-[13px] py-2 text-[12px] leading-none ${
                    activo
                      ? "border-[1.5px] border-azul-900 bg-azul-050 font-bold text-tinta"
                      : "border border-borde-control bg-white font-semibold text-[rgba(19,28,36,.62)]"
                  }`}
                >
                  {ETIQUETA_CHIP[columna.estado]}
                  <span className="font-extrabold text-[rgba(19,28,36,.42)]">
                    {totalPorEstado.get(columna.estado) ?? 0}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {estadoElegido ? (
          <div className="mt-5 flex items-baseline justify-between px-1">
            <h2 className="text-[10px] leading-none font-bold tracking-[.14em] text-[rgba(19,28,36,.5)]">
              {COLUMNAS_OP72.find((c) => c.estado === estadoElegido)?.titulo}
            </h2>
            <span className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.35)]">
              {faltan > 0 ? `mostrando ${mostradas} de ${totalDelEstado}` : `${totalDelEstado} en total`}
            </span>
          </div>
        ) : null}

        <div
          className={`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 ${
            estadoElegido ? "lg:grid-cols-3 xl:grid-cols-4" : "mt-5 lg:grid-cols-5"
          }`}
        >
          {columnasVisibles.map((columna) => {
            const personas = tarjetas.filter((t) => t.estado === columna.estado);
            const total = totalPorEstado.get(columna.estado) ?? personas.length;
            const ocultas = total - personas.length;
            return (
              <section
                key={columna.estado}
                className={estadoElegido ? "contents" : undefined}
              >
                {estadoElegido ? null : (
                  <>
                    <header className="flex items-center justify-between px-1 pb-[10px]">
                      <h2 className="text-[10px] leading-none font-bold tracking-[.14em] text-[rgba(19,28,36,.5)]">
                        {columna.titulo}
                      </h2>
                      <span className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.35)]">
                        {total}
                      </span>
                    </header>

                    {/* La barra de desplazamiento es de la COLUMNA: se desliza
                        la lista de personas, no la tarjeta. Así los cinco
                        encabezados quedan siempre a la vista. */}
                    <div className="flex max-h-[70vh] flex-col gap-[10px] overflow-y-auto pr-[6px]">
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
                    </div>

                    {ocultas > 0 ? (
                      <Link
                        href={enlace({ estado: columna.estado })}
                        className="mt-[10px] block rounded-[9px] border border-borde-control bg-white px-3 py-[10px] text-center text-[11.5px] leading-[1.3] font-bold text-azul-700"
                      >
                        Ver las {total}
                        <span className="block font-semibold text-[rgba(19,28,36,.45)]">
                          mostrando {personas.length} de {total}
                        </span>
                      </Link>
                    ) : null}
                  </>
                )}

                {/* Con un estado elegido las tarjetas ocupan la rejilla ancha
                    (`contents` disuelve la sección para que entren en la misma
                    cuadrícula). El encabezado y el botón viven fuera. */}
                {estadoElegido
                  ? personas.map((persona) => (
                      <TarjetaDePersona
                        key={persona.operacionId}
                        persona={persona}
                        mentores={mentores}
                      />
                    ))
                  : null}
              </section>
            );
          })}
        </div>

        {/* Vista enfocada: encabezado con el avance y el botón que suma otro
            bloque. Cada clic muestra 60 más de las que ya están, hasta llegar
            al total; cuando no queda ninguna, el botón desaparece. */}
        {estadoElegido && mostradas === 0 ? (
          <p className="mt-3 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.4)]">
            {consulta ? "Nadie coincide en esta etapa." : "Nadie en esta etapa."}
          </p>
        ) : null}

        {estadoElegido && faltan > 0 ? (
          <Link
            href={enlace({ estado: estadoElegido, n: String(cuantas + BLOQUE) })}
            className="mx-auto mt-3 block max-w-[280px] rounded-[9px] border border-borde-control bg-white px-5 py-3 text-center text-[12.5px] leading-[1.3] font-bold text-azul-700"
          >
            Ver {Math.min(BLOQUE, faltan)} más
            <span className="block font-semibold text-[rgba(19,28,36,.45)]">
              quedan {faltan} por mostrar
            </span>
          </Link>
        ) : null}
      </div>
    </main>
  );
}
