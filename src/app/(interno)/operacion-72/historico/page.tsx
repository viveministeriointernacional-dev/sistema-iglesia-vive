import Link from "next/link";
import { notFound } from "next/navigation";
import { Role } from "@iglesia/prisma-client";
import { requerirVista } from "@/lib/auth";
import { atajosDelInforme, calcularRango } from "@/lib/informe";
import { type Grano } from "@/lib/informe-catalogo";
import { cargarHistorico, rangoPorDefectoDelHistorico } from "@/lib/historico-op72";
import type { Historico } from "@/lib/historico-op72-catalogo";
import { getPrisma } from "@/lib/prisma";
import { Graficas } from "./graficas";

export const metadata = { title: "Histórico de Operación 72 · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// **El histórico de Operación 72: cómo se movió el tablero en un periodo.**
///
/// Es una pestaña de la vista `operacion-72`, así que **hereda su permiso** y
/// no hay que crear nada en el configurador. Encima lleva su propia
/// comprobación de rol: el tablero lo usa el equipo para trabajar y esto es
/// para analizar. El guardia se repite en la página y en la acción, y la
/// pestaña solo se pinta a quien pasa las dos (§12.6).

const GRANOS: { clave: Grano; etiqueta: string }[] = [
  { clave: "dia", etiqueta: "Día" },
  { clave: "semana", etiqueta: "Semana" },
  { clave: "mes", etiqueta: "Mes" },
];

/// Cuántos tramos caben sin que la gráfica deje de leerse. Un año por días son
/// 365 puntos de 2 px: no es una línea, es una mancha. Si el grano pedido se
/// pasa, se sube al siguiente y **se dice en pantalla** en vez de dibujar algo
/// ilegible y callarlo.
const TOPE_DE_TRAMOS = 60;

function granoPedido(valor: string | undefined, dias: number): { grano: Grano; ajustado: boolean } {
  const pedido = GRANOS.find((g) => g.clave === valor)?.clave;
  const porDefecto: Grano = dias <= 31 ? "semana" : dias <= 200 ? "semana" : "mes";
  const elegido = pedido ?? porDefecto;

  if (elegido === "dia" && dias > TOPE_DE_TRAMOS) return { grano: "semana", ajustado: true };
  if (elegido === "semana" && dias / 7 > TOPE_DE_TRAMOS) return { grano: "mes", ajustado: true };
  return { grano: elegido, ajustado: false };
}

export default async function HistoricoOperacion72({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; grano?: string }>;
}) {
  const usuario = await requerirVista("operacion-72");
  // La vista la ven también los consolidadores: el histórico, no.
  if (usuario.role !== Role.ADMIN) notFound();

  const { desde, hasta, grano: granoCrudo } = await searchParams;
  // Sin periodo pedido, el histórico abre con las últimas ocho semanas: el
  // defecto del informe es «esta semana» y aquí dejaría la pantalla con un
  // solo tramo.
  const porDefecto = rangoPorDefectoDelHistorico();
  const rango = calcularRango(desde ?? porDefecto.inicio, hasta ?? porDefecto.fin);
  const { grano, ajustado } = granoPedido(granoCrudo, rango.dias);

  const prisma = await getPrisma();
  const historico = await cargarHistorico(prisma, { rango, grano });

  const atajos = atajosDelInforme().filter((atajo) =>
    ["semana", "semana-pasada", "mes", "mes-pasado", "anio"].includes(atajo.clave),
  );

  function enlace(parametros: { inicio?: string; fin?: string; grano?: Grano }) {
    const url = new URLSearchParams();
    url.set("desde", parametros.inicio ?? rango.inicio);
    url.set("hasta", parametros.fin ?? rango.fin);
    url.set("grano", parametros.grano ?? grano);
    return `/operacion-72/historico?${url.toString()}`;
  }

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
          Operación 72
        </h1>

        <div className="mt-[14px] flex items-end gap-[3px] border-b border-[rgba(19,28,36,.14)]">
          <Link
            href="/operacion-72"
            className="rounded-t-[9px] px-[17px] py-[11px] text-[13px] leading-none font-semibold text-[rgba(19,28,36,.62)]"
          >
            Tablero
          </Link>
          <span
            aria-current="page"
            className="-mb-px rounded-t-[9px] border border-[rgba(19,28,36,.14)] border-b-white bg-white px-[17px] py-[11px] text-[13px] leading-none font-extrabold text-tinta"
          >
            Histórico
          </span>
        </div>

        <header className="mt-[16px] flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-[560px] text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Cuántas personas pasaron de una lista a otra en el periodo, tramo a tramo. Cada punto
            se abre y dice quiénes fueron. Solo lo ven los administradores.
          </p>

          <div className="flex flex-wrap items-end gap-2">
            {/* Formulario GET: funciona sin JavaScript, como el resto. */}
            <form method="get" action="/operacion-72/historico" className="flex items-end gap-2">
              <input type="hidden" name="grano" value={grano} />
              <CampoFecha rotulo="DESDE" nombre="desde" valor={rango.inicio} />
              <CampoFecha rotulo="HASTA" nombre="hasta" valor={rango.fin} />
              <button type="submit" className="boton-primario">
                Ver
              </button>
            </form>

            <div className="flex items-center gap-[3px] rounded-[20px] border border-borde-control bg-white p-[3px]">
              {GRANOS.map((opcion) => (
                <Link
                  key={opcion.clave}
                  href={enlace({ grano: opcion.clave })}
                  aria-current={grano === opcion.clave ? "page" : undefined}
                  className={`rounded-[20px] px-[13px] py-2 text-[11.5px] leading-none ${
                    grano === opcion.clave
                      ? "bg-azul-900 font-bold text-white"
                      : "font-semibold text-[rgba(19,28,36,.62)]"
                  }`}
                >
                  {opcion.etiqueta}
                </Link>
              ))}
            </div>
          </div>
        </header>

        <div className="mt-[14px] flex flex-wrap items-center gap-2">
          {atajos.map((atajo) => {
            const puesto = atajo.inicio === rango.inicio && atajo.fin === rango.fin;
            return (
              <Link
                key={atajo.clave}
                href={enlace(atajo)}
                className={`rounded-[20px] px-[13px] py-2 text-[11.5px] leading-none font-semibold ${
                  puesto
                    ? "bg-azul-900 font-bold text-white"
                    : "border border-borde-control bg-white text-[rgba(19,28,36,.55)]"
                }`}
              >
                {atajo.etiqueta}
              </Link>
            );
          })}
          <span className="ml-1 text-[12px] leading-none font-bold text-tinta">
            {rango.etiqueta}
          </span>
        </div>

        <Avisos historico={historico} ajustado={ajustado} grano={grano} />

        <Graficas historico={historico} />
      </div>
    </main>
  );
}

/// Los avisos salen **solo cuando hay algo que saber**. Uno que aparece
/// siempre se deja de leer (§12.6).
function Avisos({
  historico,
  ajustado,
  grano,
}: {
  historico: Historico;
  ajustado: boolean;
  grano: Grano;
}) {
  const hay = historico.antesDeLaAuditoria || historico.sinOrigen > 0 || ajustado;
  if (!hay) return null;

  return (
    <div className="aviso-ambar mt-[14px]">
      {historico.antesDeLaAuditoria ? (
        <p className="text-[12px] leading-[1.5] font-semibold text-tinta">
          El histórico arranca el <strong className="font-extrabold">15 de agosto de 2026</strong>,
          cuando empezó a quedar registro de los movimientos. Lo de antes de esa fecha no está
          vacío: no se sabe.
        </p>
      ) : null}
      {historico.sinOrigen > 0 ? (
        <p className="mt-[6px] text-[12px] leading-[1.5] font-semibold text-tinta">
          De <strong className="font-extrabold">{historico.sinOrigen}</strong> movimientos no se
          sabe de qué lista venía la persona: su tarjeta ya existía cuando empezó la auditoría.
        </p>
      ) : null}
      {ajustado ? (
        <p className="mt-[6px] text-[12px] leading-[1.5] font-semibold text-tinta">
          El periodo es muy largo para ese detalle, así que se está agrupando{" "}
          <strong className="font-extrabold">por {grano === "mes" ? "mes" : "semana"}</strong>.
        </p>
      ) : null}
    </div>
  );
}

function CampoFecha({
  rotulo,
  nombre,
  valor,
}: {
  rotulo: string;
  nombre: string;
  valor: string;
}) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="etiqueta-seccion" style={{ letterSpacing: ".14em" }}>
        {rotulo}
      </span>
      <input
        type="date"
        name={nombre}
        defaultValue={valor}
        className="rounded-[9px] border border-borde-control bg-white px-[11px] py-[9px] text-[12.5px] leading-none font-semibold text-tinta"
      />
    </label>
  );
}
