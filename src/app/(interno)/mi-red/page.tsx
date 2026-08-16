import Link from "next/link";
import { Phase } from "@iglesia/prisma-client";
import { requerirRol, ROLES_CON_RED } from "@/lib/auth";
import { cargarRed, DIAS_SIN_CONTACTO, type PersonaDeLaRed } from "@/lib/red";

export const metadata = { title: "Mi red · Iglesia Vive" };
export const dynamic = "force-dynamic";

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

export default async function PaginaMiRed() {
  const usuario = await requerirRol(ROLES_CON_RED);
  const red = await cargarRed(usuario);

  const indicadores = [
    { etiqueta: "PERSONAS", valor: red.acompanadas },
    { etiqueta: "CON ALERTAS", valor: red.conAlertas },
    { etiqueta: "OPERACIÓN 72", valor: red.operacion72 },
    { etiqueta: `SIN CONTACTO +${DIAS_SIN_CONTACTO}D`, valor: red.sinContacto },
    { etiqueta: "PARA REVISIÓN", valor: red.paraRevision },
  ];

  const conAlertas = red.personas.filter((p) => p.alertas.length > 0);
  const resto = red.personas.filter((p) => p.alertas.length === 0);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {red.esVistaCompleta ? "Toda la iglesia" : "Mi red"}
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {red.esVistaCompleta
              ? "Cada persona en proceso, con su fase y su estado"
              : "Las personas que acompañas y cómo van"}
          </p>
        </header>

        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {indicadores.map((indicador) => (
            <li key={indicador.etiqueta} className="tarjeta p-4">
              <p className="text-[9.5px] leading-none font-bold tracking-[.14em] text-[rgba(19,28,36,.42)]">
                {indicador.etiqueta}
              </p>
              <p className="mt-2 font-serif text-[28px] leading-none font-normal text-tinta">
                {indicador.valor}
              </p>
            </li>
          ))}
        </ul>

        {red.personas.length === 0 ? (
          <p className="mt-6 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
            Todavía no acompañas a nadie. Cuando una persona te sea entregada
            desde Operación 72, aparecerá aquí con su expediente.
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

        <p className="mt-7 text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.45)]">
          «Sin contacto» cuenta los días desde el último registro en el
          expediente: una llamada, una visita, una nota pastoral, un hito o un
          tema de Casa de Fe. El árbol de la red y las evaluaciones pendientes
          llegan en la siguiente entrega.
        </p>
      </div>
    </main>
  );
}
