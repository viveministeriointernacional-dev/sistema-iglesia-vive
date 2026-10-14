import Link from "next/link";
import { requerirVista } from "@/lib/auth";
import { momentoLargo } from "@/lib/dominio";
import { cargarPeticiones } from "@/lib/oracion";
import {
  FILTROS,
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
  // doscientas, se enfría. Solo se separan en «Pendientes»: en el historial
  // ya no hay nada que correr.
  const separar = filtro === "pendientes";
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
          />
          <Tile rotulo="ENTRARON ESTA SEMANA" valor={resumen.estaSemana} pie="últimos 7 días" />
          <Tile
            rotulo="ORARON ESTE MES"
            valor={resumen.atendidasEsteMes}
            pie="últimos 30 días"
            tono="verde"
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
              {busqueda
                ? "No hay peticiones de alguien con ese nombre."
                : filtro === "pendientes"
                  ? "No queda ninguna petición esperando. Ya oraron por todas."
                  : "Todavía no hay peticiones aquí."}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Tile({
  rotulo,
  valor,
  pie,
  tono,
}: {
  rotulo: string;
  valor: number;
  pie?: string;
  tono?: "verde" | "ambar";
}) {
  const ambar = tono === "ambar";
  return (
    <div
      className={
        ambar
          ? "rounded-[14px] border border-[rgba(201,123,44,.35)] bg-ambar-fondo p-4"
          : "tarjeta p-4"
      }
    >
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
    </div>
  );
}
