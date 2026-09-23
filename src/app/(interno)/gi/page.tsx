import Link from "next/link";
import { puedeAsignarGi, requerirVista, veTodoGi } from "@/lib/auth";
import { hoyEnColombia } from "@/lib/dominio";
import { correrSemana, semanaDe } from "@/lib/reunion-catalogo";
import { cargarGi } from "@/lib/gi";
import { DIAS_SIN_MARCAR_AVISA, diaCivilCorto } from "@/lib/gi-catalogo";
import { cuentasQueLlevanGi } from "./acciones";
import { AsignarAGi } from "./asignar";
import { SemanaDeGi } from "./semana";

export const metadata = { title: "GI · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function PaginaGi({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const usuario = await requerirVista("gi");
  const hoy = hoyEnColombia();

  // La semana viaja por la URL, como el resto de los filtros de la
  // plataforma: así las flechas funcionan sin una línea de JavaScript.
  const parametros = await searchParams;
  const semana = semanaDe(
    parametros.semana && FECHA.test(parametros.semana) ? parametros.semana : hoy,
  );

  const tablero = await cargarGi(
    usuario,
    semana.dias,
    hoy,
    DIAS_SIN_MARCAR_AVISA,
  );

  const veMovimiento = veTodoGi(usuario);
  const puedeRepartir = puedeAsignarGi(usuario);
  const lideres = puedeRepartir ? await cuentasQueLlevanGi() : [];

  const enlaceSemana = (pasos: number) =>
    `/gi?semana=${correrSemana(semana.inicio, pasos)}`;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <p className="text-[10px] leading-none font-bold tracking-[.1em] text-ambar-texto">
            GI · GENERACIÓN IMPARABLE
          </p>
          <h1 className="mt-2 font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {tablero.puedeMarcar
              ? "Los jóvenes que acompañas"
              : "Los jóvenes de tu línea en GI"}
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            {tablero.puedeMarcar
              ? "Marca el devocional de cada día. Los días que todavía no han llegado no se pueden marcar."
              : "Los marca su líder de GI. Aquí los ves para acompañarlos desde tu línea."}
          </p>
        </header>

        <section className="tarjeta mt-[14px] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={enlaceSemana(-1)}
              aria-label="Semana anterior"
              className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[rgba(19,28,36,.2)] bg-white text-[16px] leading-none font-bold text-tinta"
            >
              ‹
            </Link>
            <p className="text-[15px] leading-none font-bold text-tinta">
              Del {diaCivilCorto(semana.inicio)} al {diaCivilCorto(semana.fin)}
            </p>
            <Link
              href={enlaceSemana(1)}
              aria-label="Semana siguiente"
              className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[rgba(19,28,36,.2)] bg-white text-[16px] leading-none font-bold text-tinta"
            >
              ›
            </Link>
            {semana.dias.includes(hoy) ? null : (
              <Link
                href="/gi"
                className="text-[12px] leading-none font-semibold text-azul-700"
              >
                Volver a esta semana
              </Link>
            )}
            <p className="ml-auto text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.5)]">
              {tablero.hechosMios} de {tablero.posiblesMios} devocionales
            </p>
          </div>

          <SemanaDeGi
            dias={semana.dias}
            hoy={hoy}
            jovenes={tablero.mios}
            puedeMarcar={tablero.puedeMarcar}
          />

          {puedeRepartir ? <AsignarAGi lideres={lideres} /> : null}
        </section>

        {veMovimiento ? (
          <Movimiento tablero={tablero} />
        ) : null}
      </div>
    </main>
  );
}

function Movimiento({
  tablero,
}: {
  tablero: Awaited<ReturnType<typeof cargarGi>>;
}) {
  const { movimiento } = tablero;

  return (
    <>
      <section className="tarjeta mt-[14px] p-5">
        <h2 className="etiqueta-seccion">CÓMO VA EL MOVIMIENTO</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Indicador titulo="LÍDERES DE GI" valor={String(movimiento.lideres.length)} />
          <Indicador titulo="JÓVENES ACOMPAÑADOS" valor={String(movimiento.jovenes)} />
          <Indicador
            titulo="DEVOCIONALES ESTA SEMANA"
            valor={`${movimiento.hechos} de ${movimiento.posibles}`}
          />
          <Indicador
            titulo={`SIN MARCAR HACE +${DIAS_SIN_MARCAR_AVISA} DÍAS`}
            valor={String(movimiento.enSilencio)}
            ambar={movimiento.enSilencio > 0}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {movimiento.lideres.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[12px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
              Todavía no hay ningún joven repartido en GI. Se empieza encendiendo
              el permiso «Lleva GI» en Administración y repartiendo desde arriba.
            </p>
          ) : null}

          {movimiento.lideres.map((lider) => (
            <div
              key={lider.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] bg-papel p-3"
            >
              <span className="w-[200px] text-[13.5px] leading-none font-semibold text-tinta">
                {lider.nombre}
              </span>
              <span className="w-[80px] text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.5)]">
                {lider.jovenes} joven{lider.jovenes === 1 ? "" : "es"}
              </span>
              <span className="w-[160px]">
                <span className="block h-[10px] overflow-hidden rounded-[5px] bg-[rgba(19,28,36,.1)]">
                  <span
                    className="block h-[10px] bg-verde-700"
                    style={{
                      width: `${
                        lider.posibles
                          ? Math.round((lider.hechos / lider.posibles) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </span>
                <span className="mt-[5px] block text-[11px] leading-none font-medium text-[rgba(19,28,36,.45)]">
                  {lider.hechos} de {lider.posibles} devocionales
                </span>
              </span>
              <span className="min-w-0 flex-1 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
                {lider.ultimaObservacion
                  ? `«${lider.ultimaObservacion.texto}»`
                  : "Sin observaciones esta semana"}
              </span>
              {lider.enSilencio ? (
                <span className="rounded-[20px] bg-ambar-fondo px-2 py-1 text-[10px] leading-none font-bold text-ambar-texto">
                  {lider.enSilencio} en silencio
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="tarjeta mt-[14px] p-5">
        <h2 className="etiqueta-seccion">
          LOS MISMOS JÓVENES, REPARTIDOS POR LÍNEA DE MENTORÍA
        </h2>
        <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
          GI no le cambia la línea a nadie: un líder de GI sigue siendo discípulo
          de su mentor, y acompaña a jóvenes de otras líneas.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {movimiento.porLinea.map((linea) => (
            <div key={linea.mentor} className="flex items-center gap-3">
              <span className="w-[220px] text-[13px] leading-none font-semibold text-tinta">
                {linea.mentor}
              </span>
              <span className="h-[12px] flex-1 overflow-hidden rounded-[6px] bg-[rgba(19,28,36,.1)]">
                <span
                  className="block h-[12px] bg-azul-700"
                  style={{
                    width: `${
                      movimiento.jovenes
                        ? Math.round((linea.jovenes / movimiento.jovenes) * 100)
                        : 0
                    }%`,
                  }}
                />
              </span>
              <span className="w-[90px] text-right text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.5)]">
                {linea.jovenes} joven{linea.jovenes === 1 ? "" : "es"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Indicador({
  titulo,
  valor,
  ambar,
}: {
  titulo: string;
  valor: string;
  ambar?: boolean;
}) {
  return (
    <div className="rounded-[10px] bg-papel p-4">
      <p className="text-[9.5px] leading-none font-bold tracking-[.08em] text-[rgba(19,28,36,.45)]">
        {titulo}
      </p>
      <p
        className={`mt-2 font-serif text-[24px] leading-none font-normal ${
          ambar ? "text-ambar-texto" : "text-tinta"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
