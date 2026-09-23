import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirVista } from "@/lib/auth";
import { hoyEnColombia } from "@/lib/dominio";
import { accesoAGi, cargarMesDeGi } from "@/lib/gi";
import {
  correrMes,
  diaCivilLargo,
  mesDe,
  mesLegible,
} from "@/lib/gi-catalogo";
import { MesDeGi } from "./mes";

export const metadata = { title: "GI · el mes de un joven" };
export const dynamic = "force-dynamic";

const MES = /^\d{4}-\d{2}$/;

export default async function PaginaMesDeGi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const usuario = await requerirVista("gi");
  const { id } = await params;

  // ⚠️ El permiso se comprueba en la página y no solo en el enlace: esconder
  // el enlace y dejar la dirección abierta sería cosmético (la lección del
  // 11-sep-2026 con el tablero de Operación 72).
  const acceso = await accesoAGi(usuario, id);
  if (!acceso.puedeVer) notFound();

  const hoy = hoyEnColombia();
  const parametros = await searchParams;
  const mes = parametros.mes && MES.test(parametros.mes) ? parametros.mes : mesDe(hoy);

  const datos = await cargarMesDeGi(id, mes, hoy);
  if (!datos) notFound();

  const enlaceMes = (pasos: number) => `/gi/${id}?mes=${correrMes(mes, pasos)}`;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <p className="text-[10px] leading-none font-bold tracking-[.1em] text-ambar-texto">
            GI · DEVOCIONAL DIARIO
          </p>
          <h1 className="mt-2 font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {datos.nombre}
          </h1>
          <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            {datos.edad !== null ? `${datos.edad} años · ` : ""}
            {datos.liderDeGi ? `líder de GI: ${datos.liderDeGi}` : "sin líder de GI"}
            {" · "}
            {datos.mentor
              ? `línea de mentoría: ${datos.mentor}`
              : "sin mentor asignado"}
          </p>
          <p className="mt-3 flex flex-wrap gap-4">
            <Link
              href="/gi"
              className="text-[12.5px] leading-none font-semibold text-azul-700"
            >
              ← Volver a la semana
            </Link>
            <Link
              href={`/expediente/${id}`}
              className="text-[12.5px] leading-none font-semibold text-azul-700"
            >
              Ver su expediente
            </Link>
          </p>
        </header>

        <div className="mt-[14px] flex flex-col gap-[14px] lg:flex-row lg:items-start">
          <section className="tarjeta min-w-0 flex-1 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={enlaceMes(-1)}
                aria-label="Mes anterior"
                className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[rgba(19,28,36,.2)] bg-white text-[16px] leading-none font-bold text-tinta"
              >
                ‹
              </Link>
              <p className="font-serif text-[18px] leading-none font-normal text-tinta">
                {mesLegible(mes)}
              </p>
              <Link
                href={enlaceMes(1)}
                aria-label="Mes siguiente"
                className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[rgba(19,28,36,.2)] bg-white text-[16px] leading-none font-bold text-tinta"
              >
                ›
              </Link>
              {acceso.puedeMarcar ? null : (
                <p className="ml-auto text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
                  Solo su líder de GI marca
                </p>
              )}
            </div>

            <MesDeGi
              mes={mes}
              hoy={hoy}
              marcados={datos.marcados}
              learnerId={id}
              puedeMarcar={acceso.puedeMarcar}
            />

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Indicador
                titulo="ESTE MES"
                valor={`${datos.esteMes.hechos} de ${datos.esteMes.posibles}`}
                pie="días marcados"
              />
              <Indicador
                titulo="DÍAS CORRIDOS"
                valor={String(datos.racha)}
                pie={
                  datos.racha === 0
                    ? "sin racha en curso"
                    : "hasta hoy, sin cortarse"
                }
              />
              <Indicador
                titulo="EL MES PASADO"
                valor={`${datos.mesAnterior.hechos} de ${datos.mesAnterior.posibles}`}
                pie={mesLegible(correrMes(mes, -1)).toLowerCase()}
              />
            </div>
          </section>

          <section className="tarjeta w-full p-5 lg:w-[380px]">
            <h2 className="etiqueta-seccion">LO QUE ESCRIBIÓ SU LÍDER DE GI</h2>

            {datos.observaciones.length === 0 ? (
              <p className="mt-3 rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[12px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
                Todavía no hay ninguna observación. Se escriben desde la semana,
                en el renglón de esta persona.
              </p>
            ) : null}

            <div className="mt-3 flex flex-col gap-2">
              {datos.observaciones.map((nota, i) => (
                <div
                  key={`${nota.dia}-${i}`}
                  className="border-l-[3px] border-ambar-texto bg-papel p-3"
                >
                  <p className="text-[11px] leading-none font-bold text-[rgba(19,28,36,.45)]">
                    {diaCivilLargo(nota.dia)}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-[1.55] font-medium text-tinta">
                    {nota.texto}
                  </p>
                  <p className="mt-2 text-[11px] leading-none font-medium text-[rgba(19,28,36,.45)]">
                    {nota.autor}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 rounded-[10px] bg-papel p-4 text-[11.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.55)]">
              Esta página la ven los pastores de GI y el mentor de la línea. No
              es una nota pastoral privada: es el acompañamiento de GI.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function Indicador({
  titulo,
  valor,
  pie,
}: {
  titulo: string;
  valor: string;
  pie: string;
}) {
  return (
    <div className="rounded-[10px] bg-papel p-4">
      <p className="text-[9.5px] leading-none font-bold tracking-[.08em] text-[rgba(19,28,36,.45)]">
        {titulo}
      </p>
      <p className="mt-2 font-serif text-[22px] leading-none font-normal text-tinta">
        {valor}
      </p>
      <p className="mt-2 text-[11px] leading-none font-medium text-[rgba(19,28,36,.45)]">
        {pie}
      </p>
    </div>
  );
}
