import Link from "next/link";
import type { Phase } from "@iglesia/prisma-client";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { momentoLegible, telefonoLegible, ZONA_HORARIA } from "@/lib/dominio";
import {
  calcularRango,
  cargarDetallePersonas,
  filtroValido,
  type FiltroDetalle,
  type PersonaDelInforme,
} from "@/lib/informe";
import { getPrisma } from "@/lib/prisma";

export const metadata = { title: "Persona por persona · Iglesia Vive" };
export const dynamic = "force-dynamic";

const HORA = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: ZONA_HORARIA,
});

const ETIQUETA_FASE: Record<Phase, string> = {
  GANAR: "Ganar",
  FORTALECER: "Fortalecer",
  ENTRENAR: "Entrenar",
  MULTIPLICAR: "Multiplicar",
};

const FILTROS: { valor: FiltroDetalle; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "con-movimiento", etiqueta: "Con movimiento" },
  { valor: "sin-tocar", etiqueta: "Sin tocar" },
  { valor: "cambio-fase", etiqueta: "Cambiaron de fase" },
  { valor: "baja", etiqueta: "Dadas de baja" },
];

export default async function PaginaDetalle({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; filtro?: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { desde, hasta, filtro: filtroCrudo } = await searchParams;
  const rango = calcularRango(desde, hasta);
  const filtro = filtroValido(filtroCrudo);

  const prisma = await getPrisma();
  const { personas, total } = await cargarDetallePersonas(prisma, rango, filtro);
  const ahora = new Date();

  // El periodo viaja siempre como sus dos extremos; si no, al volver al informe
  // se perdería lo que se estaba mirando.
  const parametros = `desde=${rango.inicio}&hasta=${rango.fin}`;

  const enlaceFiltro = (valor: FiltroDetalle) =>
    `/administracion/informe/personas?${parametros}&filtro=${valor}`;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1120px]">
        <Link
          href={`/administracion/informe?${parametros}`}
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver al informe
        </Link>

        <header className="mt-3">
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Persona por persona
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Qué se le hizo a cada quien en {rango.etiqueta.toLowerCase()}. Una
            ficha por persona; los movimientos, en orden.
          </p>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTROS.map((opcion) => (
            <Link
              key={opcion.valor}
              href={enlaceFiltro(opcion.valor)}
              className={`rounded-[20px] px-[13px] py-[9px] text-[11.5px] leading-none font-semibold ${
                opcion.valor === filtro
                  ? "bg-azul-900 font-bold text-white"
                  : "border border-borde-control bg-white text-[rgba(19,28,36,.55)]"
              }`}
            >
              {opcion.etiqueta}
            </Link>
          ))}
        </div>

        <div className="tarjeta mt-3 px-5 py-1">
          {personas.map((persona) => (
            <FichaDePersona key={persona.learnerId} persona={persona} ahora={ahora} />
          ))}

          {personas.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
              Nadie cumple ese filtro en este periodo.
            </p>
          ) : null}
        </div>

        {total > personas.length ? (
          <p className="mt-[14px] text-center text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Mostrando {personas.length} de {total} personas.
          </p>
        ) : personas.length > 0 ? (
          <p className="mt-[14px] text-center text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            {total} {total === 1 ? "persona" : "personas"}.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function FichaDePersona({
  persona,
  ahora,
}: {
  persona: PersonaDelInforme;
  ahora: Date;
}) {
  const sinTocar = persona.movimientos.length === 0;
  const cambioFase = persona.movimientos.some((m) => m.titulo.startsWith("Cambio de fase"));
  const baja = persona.movimientos.some((m) => m.titulo === "Dado de baja");

  const chip = baja
    ? { texto: "DADA DE BAJA", clase: "bg-rojo-fondo text-rojo" }
    : cambioFase
      ? { texto: "CAMBIÓ DE FASE", clase: "bg-azul-100 text-azul-700" }
      : sinTocar
        ? { texto: "SIN TOCAR", clase: "bg-ambar-chip text-ambar-texto" }
        : {
            texto: `${persona.movimientos.length} ${persona.movimientos.length === 1 ? "MOVIMIENTO" : "MOVIMIENTOS"}`,
            clase: "bg-verde-100 text-verde-700",
          };

  return (
    <article className="border-b border-[rgba(19,28,36,.08)] py-4 last:border-b-0">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[200px] flex-[1_1_230px]">
          <Link
            href={`/expediente/${persona.learnerId}`}
            className="text-[14px] leading-[1.2] font-semibold text-tinta hover:text-azul-700 hover:underline"
          >
            {persona.nombre}
          </Link>
          <p className="mt-[5px] text-[11.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
            {[
              telefonoLegible(persona.telefono),
              ETIQUETA_FASE[persona.fase],
              persona.consolidador
                ? `consolida ${persona.consolidador}`
                : "sin consolidador",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <span
            className={`mt-2 inline-block rounded-[20px] px-[10px] py-[5px] text-[10px] leading-none font-bold ${chip.clase}`}
          >
            {chip.texto}
          </span>
        </div>

        <div className="flex-[2_1_520px]">
          {sinTocar ? (
            <>
              <p className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
                Nadie le registró nada en este periodo.
                {persona.ultimoContacto
                  ? " Su último registro fue "
                  : " No tiene ningún registro de contacto."}
                {persona.ultimoContacto ? (
                  <strong className="font-bold text-tinta">
                    {momentoLegible(persona.ultimoContacto, ahora)}
                  </strong>
                ) : null}
                {persona.ultimoContacto ? "." : ""}
              </p>
              <p className="mt-2 text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
                Las marcaciones del discador no cuentan: si no se llena el
                formulario, la tarjeta no se mueve.
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              {persona.movimientos.map((movimiento, indice) => (
                <div
                  key={`${movimiento.cuando.toISOString()}-${indice}`}
                  className="flex items-baseline gap-[10px]"
                >
                  <span className="w-[86px] shrink-0 text-[11px] leading-[1.4] font-bold text-[rgba(19,28,36,.45)]">
                    {HORA.format(movimiento.cuando).replace(",", "")}
                  </span>
                  <span className="text-[12.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.75)]">
                    <strong className="font-bold text-tinta">{movimiento.titulo}</strong>
                    {movimiento.quien ? ` — ${movimiento.quien}.` : ""}
                    {movimiento.observacion ? ` «${movimiento.observacion}»` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
