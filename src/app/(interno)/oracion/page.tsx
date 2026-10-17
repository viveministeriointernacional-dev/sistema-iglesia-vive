import Link from "next/link";
import { requerirVista } from "@/lib/auth";
import { momentoLargo } from "@/lib/dominio";
import { cargarPeticiones } from "@/lib/oracion";
import {
  FILTRO_DEL_RECUADRO,
  FILTROS,
  type FiltroDeOracion,
  esDePersonaNueva,
  filtroValido,
} from "@/lib/oracion-catalogo";
import { Peticion } from "./peticion";

export const metadata = { title: "Oración · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// Las peticiones de oración de toda la iglesia, para quien lleva la
/// intercesión.
///
/// ⚠️ **La pantalla existe porque estas peticiones estaban enterradas.** Hasta
/// hoy vivían una en la ficha de cada persona: para verlas todas había que
/// abrir 488 expedientes, así que en la práctica no las veía nadie. Medido el
/// 13-oct-2026: 217 personas con petición y ~1,5 nuevas al día.
export default async function PaginaDeOracion({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  await requerirVista("oracion");
  const parametros = await searchParams;
  const busqueda = (parametros.q ?? "").trim();
  const filtro = filtroValido(parametros.filtro);

  const { peticiones, resumen, recortado } = await cargarPeticiones({
    filtro,
    busqueda,
  });

  // ⚠️ **Las de personas NUEVAS se sacan a su propio bloque, arriba del todo.**
  // Quien acaba de registrarse está dentro de las 72 horas de la Operación 72,
  // y su petición es la mejor excusa para esa primera llamada. Mezclada entre
  // doscientas, se enfría.
  //
  // Se separan en las dos vistas donde queda algo por hacer: «Pendientes» y
  // «Entraron esta semana». En las de historial no — ahí ya se oró por todas,
  // y `esDePersonaNueva` solo cuenta las pendientes, así que el bloque saldría
  // vacío de todos modos.
  const separar = filtro === "pendientes" || filtro === "semana";
  const nuevas = separar ? peticiones.filter(esDePersonaNueva) : [];
  const resto = separar
    ? peticiones.filter((p) => !esDePersonaNueva(p))
    : peticiones;

  const enlace = (f: string) => {
    const destino = new URLSearchParams();
    if (busqueda) destino.set("q", busqueda);
    if (f !== "pendientes") destino.set("filtro", f);
    const consulta = destino.toString();
    return consulta ? `/oracion?${consulta}` : "/oracion";
  };

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[900px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Oración
          </h1>
          <p className="mt-2 max-w-[680px] text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Todo lo que la iglesia ha pedido en oración, en un solo sitio: lo
            que escribió cada persona, quién lo registró y cuándo. Al marcar una
            como orada pasa al historial, pero no se borra — queda en el
            expediente de esa persona.
          </p>
        </header>

        {/* Los tres recuadros **se pulsan** y la lista de abajo pasa a
            enseñar justo lo que ese número cuenta. El que está puesto se
            marca, para que nunca haya duda de qué se está mirando. */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Tile
            rotulo="ESPERAN ORACIÓN"
            valor={resumen.pendientes}
            pie={
              resumen.dePersonasNuevas > 0
                ? `${resumen.dePersonasNuevas} de alguien que acaba de llegar`
                : undefined
            }
            tono={resumen.pendientes > 0 ? "ambar" : undefined}
            href={enlace(FILTRO_DEL_RECUADRO.pendientes)}
            puesto={filtro === FILTRO_DEL_RECUADRO.pendientes}
          />
          <Tile
            rotulo="ENTRARON ESTA SEMANA"
            valor={resumen.estaSemana}
            pie="últimos 7 días"
            href={enlace(FILTRO_DEL_RECUADRO.estaSemana)}
            puesto={filtro === FILTRO_DEL_RECUADRO.estaSemana}
          />
          <Tile
            rotulo="ORARON ESTE MES"
            valor={resumen.atendidasEsteMes}
            pie="últimos 30 días"
            tono="verde"
            href={enlace(FILTRO_DEL_RECUADRO.atendidasEsteMes)}
            puesto={filtro === FILTRO_DEL_RECUADRO.atendidasEsteMes}
          />
        </section>

        <form className="mt-6" action="/oracion">
          <input type="hidden" name="filtro" value={filtro} />
          <div className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={busqueda}
              placeholder="Buscar por nombre"
              className="campo mt-0 flex-1"
            />
            <button type="submit" className="boton-primario">
              Buscar
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTROS.map((opcion) => {
            const activo = opcion.id === filtro;
            return (
              <Link
                key={opcion.id}
                href={enlace(opcion.id)}
                className={
                  activo
                    ? "rounded-full bg-tinta px-3 py-1.5 text-[12px] leading-none font-semibold text-white"
                    : "rounded-full border border-[rgba(19,28,36,.16)] px-3 py-1.5 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)] hover:text-tinta"
                }
              >
                {opcion.etiqueta}
              </Link>
            );
          })}
        </div>

        {recortado ? (
          <p className="mt-4 rounded-[10px] border border-[rgba(201,123,44,.35)] bg-ambar-fondo p-3 text-[12px] leading-[1.5] font-medium text-ambar-texto">
            Hay más peticiones de las que caben en la lista. Las tres cifras de
            arriba sí son exactas — se cuentan en la base, no sobre lo que se ve
            aquí. Busca por nombre o filtra para acotar.
          </p>
        ) : null}

        {nuevas.length > 0 ? (
          <section className="mt-6">
            <h2 className="etiqueta-seccion text-ambar-texto">
              ACABAN DE LLEGAR A LA IGLESIA · {nuevas.length}
            </h2>
            <p className="mt-1 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
              Lo escribieron al registrarse. Están en sus primeras 72 horas, así
              que esta petición es la mejor razón para llamarlos hoy.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {nuevas.map((peticion) => (
                <Peticion
                  key={peticion.id}
                  peticion={peticion}
                  fechaPedida={momentoLargo(peticion.pedidaEl)}
                  fechaOrada={peticion.oradaEl ? momentoLargo(peticion.oradaEl) : null}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6">
          {nuevas.length > 0 ? (
            <h2 className="etiqueta-seccion">EL RESTO · {resto.length}</h2>
          ) : null}
          <ul className={`flex flex-col gap-3 ${nuevas.length > 0 ? "mt-3" : ""}`}>
            {resto.map((peticion) => (
              <Peticion
                key={peticion.id}
                peticion={peticion}
                fechaPedida={momentoLargo(peticion.pedidaEl)}
                fechaOrada={peticion.oradaEl ? momentoLargo(peticion.oradaEl) : null}
              />
            ))}
          </ul>

          {peticiones.length === 0 ? (
            <p className="rounded-[10px] bg-papel p-4 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              {busqueda ? "No hay peticiones de alguien con ese nombre." : VACIO[filtro]}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

/// Lo que se lee cuando la lista sale vacía. Cada filtro dice lo suyo: un
/// «todavía no hay peticiones aquí» después de pulsar «oraron este mes» haría
/// pensar que el módulo está vacío, cuando lo que pasa es que nadie ha marcado
/// ninguna en treinta días.
const VACIO: Record<FiltroDeOracion, string> = {
  pendientes: "No queda ninguna petición esperando. Ya oraron por todas.",
  semana: "No entró ninguna petición nueva en los últimos 7 días.",
  "oradas-mes": "Nadie ha marcado una petición como orada en los últimos 30 días.",
  atendidas: "Todavía no se ha marcado ninguna petición como orada.",
  todas: "Todavía no hay peticiones aquí.",
};

/// Uno de los tres recuadros de la cabecera.
///
/// **Se pulsa y filtra la lista.** En cero no es un enlace: no hay nada que
/// enseñar, y un botón que lleva a una lista vacía es peor que no enseñarlo
/// (§12.6). El recuadro puesto lleva el borde marcado y `aria-current`, que es
/// lo que dice —a la vista y al lector de pantalla— qué se está mirando.
function Tile({
  rotulo,
  valor,
  pie,
  tono,
  href,
  puesto,
}: {
  rotulo: string;
  valor: number;
  pie?: string;
  tono?: "verde" | "ambar";
  href: string;
  puesto: boolean;
}) {
  const ambar = tono === "ambar";
  const fondo = ambar
    ? "rounded-[14px] border border-[rgba(201,123,44,.35)] bg-ambar-fondo p-4"
    : "tarjeta p-4";
  const marca = puesto
    ? ambar
      ? " !border-[1.5px] !border-ambar-texto"
      : " !border-[1.5px] !border-azul-900"
    : "";

  const cuerpo = (
    <>
      <p
        className={
          ambar
            ? "text-[10px] leading-[1.3] font-bold tracking-[.16em] text-ambar-texto"
            : "etiqueta-seccion leading-[1.3]"
        }
      >
        {rotulo}
      </p>
      <p
        className={`mt-[7px] text-[27px] leading-none font-extrabold ${
          ambar ? "text-ambar-texto" : tono === "verde" ? "text-[#2f7a5c]" : "text-tinta"
        }`}
      >
        {valor}
      </p>
      {pie ? (
        <p className="mt-1.5 text-[11.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
          {pie}
        </p>
      ) : null}
    </>
  );

  if (valor === 0) {
    return <div className={fondo + marca}>{cuerpo}</div>;
  }

  return (
    <Link
      href={href}
      aria-current={puesto ? "page" : undefined}
      className={`${fondo}${marca} block transition-colors hover:border-azul-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul-900`}
    >
      {cuerpo}
    </Link>
  );
}
