import Link from "next/link";
import { Phase } from "@iglesia/prisma-client";
import { requerirPermiso, tieneRed } from "@/lib/auth";
import { cargarArbol } from "@/lib/arbol";
import { cargarRed, DIAS_SIN_CONTACTO, type PersonaDeLaRed } from "@/lib/red";
import { cargarEquipo } from "@/lib/equipo";
import { BuscadorPersonas } from "@/components/buscador-personas";
import { EquipoLideres } from "./equipo-lideres";
import { VistaArbol } from "./arbol";

export const metadata = { title: "Mi red · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// **«Mi red» y «Árbol» eran dos pantallas y ahora son una** (7-sep-2026,
/// pedido del usuario). Enseñaban a la misma gente con el mismo buscador y unos
/// indicadores parecidos pero distintos; lo único que cambiaba de verdad era
/// cómo se ordenaban las personas. Así que el encabezado —buscador,
/// indicadores y barras de fase— es uno solo, y el interruptor cambia nada más
/// el cuerpo.
///
/// **Los indicadores salen SIEMPRE de `cargarRed`**, en las dos vistas: si cada
/// una calculara los suyos, las mismas cifras darían números distintos según
/// dónde estuvieras parado, que es justo lo que había antes. El árbol solo se
/// carga cuando se está mirando.

const VISTAS = ["lista", "arbol"] as const;
type Vista = (typeof VISTAS)[number];

const FASES: Phase[] = [
  Phase.GANAR,
  Phase.FORTALECER,
  Phase.ENTRENAR,
  Phase.MULTIPLICAR,
];

const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
});

const COLOR_FASE: Record<Phase, string> = {
  GANAR: "bg-azul-050 text-azul-700",
  FORTALECER: "bg-verde-100 text-verde-700",
  ENTRENAR: "bg-bosque-100 text-bosque-900",
  MULTIPLICAR: "bg-azul-900 text-white",
};

export default async function PaginaMiRed({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fase?: string }>;
}) {
  const usuario = await requerirPermiso(tieneRed);
  const { vista: vistaCruda, fase: faseCruda } = await searchParams;

  const vista: Vista = (VISTAS as readonly string[]).includes(vistaCruda ?? "")
    ? (vistaCruda as Vista)
    : "lista";
  const faseFiltro = FASES.includes(faseCruda as Phase)
    ? (faseCruda as Phase)
    : null;

  const red = await cargarRed(usuario);
  // El árbol solo se consulta cuando se está mirando: es la parte cara.
  const arbol = vista === "arbol" ? await cargarArbol(usuario) : null;
  const equipo = vista === "lista" ? await cargarEquipo(usuario) : [];

  const enlace = (cambios: { vista?: Vista; fase?: Phase | null }) => {
    const params = new URLSearchParams();
    const destino = cambios.vista ?? vista;
    if (destino !== "lista") params.set("vista", destino);
    const fase = cambios.fase === undefined ? faseFiltro : cambios.fase;
    if (fase) params.set("fase", fase);
    const cola = params.toString();
    return cola ? `/mi-red?${cola}` : "/mi-red";
  };

  const indicadores = [
    { etiqueta: "PERSONAS", valor: red.acompanadas },
    { etiqueta: "CON ALERTAS", valor: red.conAlertas, alerta: true },
    {
      etiqueta: `SIN CONTACTO +${DIAS_SIN_CONTACTO}D`,
      valor: red.sinContacto,
      alerta: true,
    },
    { etiqueta: "OP. 72 VENCIDA", valor: red.operacion72Vencida, alerta: true },
    { etiqueta: "PARA REVISIÓN", valor: red.paraRevision },
  ];

  const visibles = faseFiltro
    ? red.personas.filter((persona) => persona.fase === faseFiltro)
    : red.personas;
  const conAlertas = visibles.filter((p) => p.alertas.length > 0);
  const resto = visibles.filter((p) => p.alertas.length === 0);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {red.esVistaCompleta ? "Toda la iglesia" : "Mi red"}
          </h1>
          <p className="mt-2 max-w-[620px] text-[13px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
            {red.esVistaCompleta
              ? "Cada persona en proceso, con su fase y su estado."
              : "Las personas que acompañas y cómo van."}{" "}
            En <strong className="font-bold text-tinta">Lista</strong> ves quién
            pide atención; en <strong className="font-bold text-tinta">Árbol</strong>,
            de quién cuelga cada una.
          </p>
        </header>

        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-[460px] flex-[1_1_300px]">
            <BuscadorPersonas />
          </div>
          <div className="flex overflow-hidden rounded-[10px] border border-borde-control bg-white">
            {VISTAS.map((opcion) => (
              <Link
                key={opcion}
                href={enlace({ vista: opcion })}
                className={`px-4 py-[10px] text-[12.5px] leading-none font-semibold ${
                  opcion === vista
                    ? "bg-azul-900 font-bold text-white"
                    : "text-[rgba(19,28,36,.55)]"
                }`}
              >
                {opcion === "lista" ? "Lista" : "Árbol"}
              </Link>
            ))}
          </div>
        </div>

        <ul className="mt-[18px] grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-5">
          {indicadores.map((indicador) => {
            const encendido = indicador.alerta && indicador.valor > 0;
            return (
              <li
                key={indicador.etiqueta}
                className={`rounded-[12px] p-4 ${
                  encendido
                    ? "border border-[rgba(201,123,44,.3)] bg-ambar-fondo"
                    : "tarjeta"
                }`}
              >
                <p
                  className={`text-[9.5px] leading-none font-bold tracking-[.14em] ${
                    encendido ? "text-ambar-texto" : "text-[rgba(19,28,36,.42)]"
                  }`}
                >
                  {indicador.etiqueta}
                </p>
                <p className="mt-[10px] font-serif text-[26px] leading-none font-normal text-tinta">
                  {indicador.valor}
                </p>
              </li>
            );
          })}
        </ul>

        <PersonasPorFase
          porFase={red.porFase}
          total={red.acompanadas}
          faseActiva={faseFiltro}
          enlace={enlace}
        />

        {vista === "arbol" && arbol ? (
          <VistaArbol
            arbol={arbol}
            faseFiltro={faseFiltro}
            enlaceFase={(fase) => enlace({ fase })}
          />
        ) : (
          <>
            <EquipoLideres miembros={equipo} />

            {red.personas.length === 0 ? (
              <p className="mt-6 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Todavía no acompañas a nadie. Cuando una persona te sea entregada
                desde Operación 72, aparecerá aquí con su expediente.
              </p>
            ) : visibles.length === 0 ? (
              <p className="mt-6 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Nadie en fase {faseFiltro} por ahora.{" "}
                <Link href={enlace({ fase: null })} className="font-bold text-azul-700">
                  Ver a todos
                </Link>
                .
              </p>
            ) : (
              <>
                {conAlertas.length ? (
                  <section className="mt-7">
                    <h2 className="etiqueta-seccion">PIDEN ATENCIÓN</h2>
                    <ul className="mt-3 flex flex-col gap-[10px]">
                      {conAlertas.map((persona) => (
                        <FilaDePersona key={persona.learnerId} persona={persona} />
                      ))}
                    </ul>
                  </section>
                ) : null}

                {resto.length ? (
                  <section className="mt-7">
                    <h2 className="etiqueta-seccion">EN ACOMPAÑAMIENTO</h2>
                    <ul className="mt-3 flex flex-col gap-[10px]">
                      {resto.map((persona) => (
                        <FilaDePersona key={persona.learnerId} persona={persona} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </>
        )}

        <p className="mt-7 text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
          «Sin contacto» cuenta los días desde el último registro en el
          expediente: una llamada, una visita, una nota pastoral, un hito o un
          tema de Casa de Fe.
        </p>
      </div>
    </main>
  );
}

/// Las barras de fase valen por dos: dicen cómo está repartida la gente y son
/// el filtro. Sirven igual en las dos vistas.
function PersonasPorFase({
  porFase,
  total,
  faseActiva,
  enlace,
}: {
  porFase: Record<Phase, number>;
  total: number;
  faseActiva: Phase | null;
  enlace: (cambios: { fase?: Phase | null }) => string;
}) {
  return (
    <section className="tarjeta mt-[10px] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="etiqueta-seccion">PERSONAS POR FASE</h2>
        <span className="text-[10.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
          {faseActiva
            ? "Filtrando · toca otra o «ver todo»"
            : "Toca una fase para filtrar"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-[10px]">
        {FASES.map((fase) => {
          const valor = porFase[fase];
          const porcentaje = total ? Math.round((valor / total) * 100) : 0;
          const activa = faseActiva === fase;
          return (
            <Link
              key={fase}
              href={enlace({ fase: activa ? null : fase })}
              className={`min-w-[150px] flex-1 rounded-[10px] p-3 transition-colors ${
                activa
                  ? "bg-azul-050 ring-1 ring-azul-700"
                  : "hover:bg-[rgba(19,28,36,.04)]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] leading-none font-bold tracking-[.1em] text-[rgba(19,28,36,.5)]">
                  {fase}
                </span>
                <span className="text-[13px] leading-none font-semibold text-tinta">
                  {valor}
                </span>
              </div>
              <div className="mt-2 h-[8px] rounded-[3px] bg-[rgba(19,28,36,.09)]">
                <div
                  className="h-full rounded-[3px] bg-azul-900"
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function FilaDePersona({ persona }: { persona: PersonaDeLaRed }) {
  return (
    <li className="tarjeta flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-[180px] flex-[2_1_200px]">
        <Link
          href={`/expediente/${persona.learnerId}`}
          className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
        >
          {persona.nombre}
        </Link>
        <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
          {persona.ultimoContacto
            ? `Último registro: ${FECHA_CORTA.format(persona.ultimoContacto)}`
            : "Sin registros todavía"}
        </p>
      </div>

      <span
        className={`rounded-[6px] px-[10px] py-[5px] text-[10px] leading-none font-bold tracking-[.08em] ${COLOR_FASE[persona.fase]}`}
      >
        {persona.fase}
      </span>

      <span className="flex-[1_1_150px] text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
        {persona.avance}
      </span>

      <div className="flex flex-[1_1_180px] flex-wrap justify-end gap-2">
        {persona.listaParaRevision ? (
          <span className="rounded-[20px] bg-verde-100 px-2 py-1 text-[9.5px] leading-none font-bold text-verde-700">
            LISTA PARA REVISIÓN
          </span>
        ) : null}
        {persona.alertas.map((alerta) => (
          <span
            key={alerta}
            className="rounded-[20px] bg-ambar-chip px-2 py-1 text-[9.5px] leading-none font-bold whitespace-nowrap text-ambar-texto"
          >
            {alerta.toUpperCase()}
          </span>
        ))}
      </div>
    </li>
  );
}
