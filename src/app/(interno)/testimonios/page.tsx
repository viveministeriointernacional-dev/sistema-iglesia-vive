import Link from "next/link";
import { requerirVista } from "@/lib/auth";
import { momentoLargo } from "@/lib/dominio";
import { cargarTestimonios } from "@/lib/testimonios";
import { FILTROS, filtroValido, VACIO, type FiltroDeTestimonios } from "@/lib/testimonios-catalogo";
import { Testimonio } from "./testimonio";

export const metadata = { title: "Testimonios · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// **Los milagros que la gente cuenta desde `/milagros`.** Sustituye a la vista
/// «Equipo» de la página que hizo el usuario en su cuenta personal: allí se
/// entraba con una clave que solo protegía la pantalla, no los datos. Aquí se
/// entra con sesión y con la vista «Testimonios» encendida.
export default async function PaginaDeTestimonios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  await requerirVista("testimonios");
  const parametros = await searchParams;
  const busqueda = (parametros.q ?? "").trim();
  const filtro = filtroValido(parametros.filtro);

  const { testimonios, resumen, recortado } = await cargarTestimonios({
    filtro,
    busqueda,
  });

  const enlace = (f: FiltroDeTestimonios) => {
    const destino = new URLSearchParams();
    if (busqueda) destino.set("q", busqueda);
    if (f !== "pendientes") destino.set("filtro", f);
    const consulta = destino.toString();
    return consulta ? `/testimonios?${consulta}` : "/testimonios";
  };

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[900px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Testimonios
          </h1>
          <p className="mt-2 max-w-[680px] text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Los milagros que la gente cuenta desde el enlace público. El equipo
            se pone en contacto con cada persona; al marcarla como contactada
            pasa al historial, pero no se borra.
          </p>
        </header>

        {/* Los recuadros se pulsan y la lista pasa a enseñar justo lo que ese
            número cuenta: los dos salen de `pasaElFiltro` (§12.6). */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Tile
            rotulo="SIN CONTACTAR"
            valor={resumen.pendientes}
            pie="esperan que alguien les hable"
            tono={resumen.pendientes > 0 ? "ambar" : undefined}
            href={enlace("pendientes")}
            puesto={filtro === "pendientes"}
          />
          <Tile
            rotulo="ESTA SEMANA"
            valor={resumen.estaSemana}
            pie="últimos 7 días"
            href={enlace("semana")}
            puesto={filtro === "semana"}
          />
          <Tile
            rotulo="RECIBIDOS"
            valor={resumen.recibidos}
            pie="desde el inicio"
            tono="verde"
            href={enlace("todos")}
            puesto={filtro === "todos"}
          />
        </section>

        <form className="mt-6" action="/testimonios">
          {filtro !== "pendientes" ? <input type="hidden" name="filtro" value={filtro} /> : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              name="q"
              defaultValue={busqueda}
              placeholder="Buscar por nombre o celular"
              className="campo mt-0 min-w-[180px] flex-1"
            />
            <button type="submit" className="boton-primario">
              Buscar
            </button>
            {/* Un enlace y no un botón con script: el archivo lo arma el
                servidor, que es el único que puede leer los testimonios. */}
            <a
              href="/testimonios/descargar"
              className="rounded-[10px] border border-[rgba(19,28,36,.18)] px-3.5 py-[10px] text-[13px] leading-none font-bold text-tinta hover:border-azul-700"
            >
              ⭳ Descargar Excel
            </a>
          </div>
        </form>

        <p className="mt-4">
          <Link
            href="/testimonios/qr"
            className="text-[11.5px] leading-none font-semibold text-azul-700 underline"
          >
            Ver el enlace y el QR para compartir →
          </Link>
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTROS.map(({ id, etiqueta }) => {
            const activo = id === filtro;
            return (
              <Link
                key={id}
                href={enlace(id)}
                aria-current={activo ? "page" : undefined}
                className={
                  activo
                    ? "rounded-full bg-tinta px-3 py-1.5 text-[12px] leading-none font-semibold text-white"
                    : "rounded-full border border-[rgba(19,28,36,.16)] px-3 py-1.5 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.6)] hover:text-tinta"
                }
              >
                {etiqueta}
              </Link>
            );
          })}
        </div>

        {recortado ? (
          <p className="mt-4 rounded-[10px] border border-[rgba(201,123,44,.35)] bg-ambar-fondo p-3 text-[12px] leading-[1.5] font-medium text-ambar-texto">
            Hay más de mil testimonios y aquí solo caben los mil más nuevos. Las
            cifras de arriba cuentan esos mil.
          </p>
        ) : null}

        <section className="mt-6">
          {testimonios.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {testimonios.map((t) => (
                <Testimonio
                  key={t.id}
                  t={{
                    id: t.id,
                    nombre: t.nombre,
                    celular: t.celular,
                    edad: t.edad,
                    milagro: t.milagro,
                    recibido: momentoLargo(t.recibidoEl),
                    contactado: t.contactadoEl ? momentoLargo(t.contactadoEl) : null,
                    contactadoPor: t.contactadoPor,
                  }}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-[10px] bg-papel p-4 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              {busqueda ? "No hay testimonios de alguien con ese nombre o celular." : VACIO[filtro]}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/// Uno de los tres recuadros. En cero no es enlace: un botón que lleva a una
/// lista vacía es peor que no enseñarlo (§12.6).
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
  pie: string;
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
      <p className="mt-1.5 text-[11.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
        {pie}
      </p>
    </>
  );

  if (valor === 0) return <div className={fondo + marca}>{cuerpo}</div>;

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
