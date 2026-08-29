import Link from "next/link";
import { ETIQUETA_ROL, requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { buscarPersonasAdmin, TAMANOS_PAGINA } from "@/lib/administracion";

export const metadata = { title: "Administración · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// Enmascara el teléfono en la lista (se define aquí para no arrastrar el
/// módulo del expediente, más pesado, al arrancar esta ruta).
function telefonoParcial(telefono: string | null) {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 7) return telefono;
  return `${telefono.slice(0, telefono.length - 4).trimEnd()} ••• ${digitos.slice(-4)}`;
}

function urlPagina(consulta: string, size: number, page: number) {
  const params = new URLSearchParams();
  if (consulta) params.set("q", consulta);
  params.set("size", String(size));
  if (page > 1) params.set("page", String(page));
  const cadena = params.toString();
  return cadena ? `/administracion?${cadena}` : "/administracion";
}

export default async function PaginaAdministracion({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; size?: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { q, page, size } = await searchParams;
  const consulta = (q ?? "").trim();
  const tam = Number(size) || 20;
  const pag = Number(page) || 1;
  const resultado = await buscarPersonasAdmin(consulta, pag, tam);
  const personas = resultado.filas;
  const desde = resultado.total === 0 ? 0 : (resultado.page - 1) * resultado.size + 1;
  const hasta = Math.min(resultado.page * resultado.size, resultado.total);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Administración de personas
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              Roles, permisos, proceso y datos de cada persona · se sincroniza
              con HighLevel
            </p>
          </div>
          <Link
            href="/administracion/dados-de-baja"
            className="shrink-0 rounded-[9px] border border-[rgba(19,28,36,.16)] px-[14px] py-[10px] text-[12px] leading-none font-semibold text-tinta hover:border-azul-700 hover:text-azul-700"
          >
            Dados de baja
          </Link>
        </header>

        <form className="mt-5 max-w-[460px]" action="/administracion">
          <input type="hidden" name="size" value={resultado.size} />
          <div className="flex items-center gap-2 rounded-[10px] border border-[rgba(19,28,36,.16)] bg-white px-[14px] py-[10px]">
            <input
              name="q"
              defaultValue={consulta}
              placeholder="Buscar por nombre, celular o correo…"
              aria-label="Buscar persona"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] leading-none font-semibold text-tinta outline-none placeholder:text-[rgba(19,28,36,.45)]"
            />
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-[7px] bg-azul-900 px-[12px] py-[7px] text-[11.5px] leading-none font-semibold text-white"
            >
              Buscar
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
            {resultado.total === 0
              ? "Sin resultados"
              : `${desde}–${hasta} de ${resultado.total}`}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
              Por página
            </span>
            {TAMANOS_PAGINA.map((n) => {
              const activo = n === resultado.size;
              return (
                <Link
                  key={n}
                  href={urlPagina(consulta, n, 1)}
                  className={`rounded-[7px] px-[10px] py-[6px] text-[11.5px] leading-none font-semibold ${
                    activo
                      ? "bg-azul-900 text-white"
                      : "border border-[rgba(19,28,36,.16)] text-tinta"
                  }`}
                >
                  {n}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {personas.map((persona) => (
            <Link
              key={persona.personId}
              href={`/administracion/${persona.personId}`}
              className="tarjeta flex flex-wrap items-center gap-x-4 gap-y-2 p-4 hover:border-azul-700"
            >
              <span className="min-w-[180px] flex-[2_1_220px]">
                <span className="block text-[14px] leading-[1.2] font-semibold text-tinta">
                  {persona.nombre}
                </span>
                <span className="mt-1 block text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
                  {telefonoParcial(persona.telefono) ?? persona.email ?? "Sin contacto"}
                </span>
              </span>

              {persona.rol ? (
                <span className="rounded-[6px] bg-azul-100 px-[10px] py-[5px] text-[10px] leading-none font-bold tracking-[.06em] text-azul-700">
                  {ETIQUETA_ROL[persona.rol].toUpperCase()}
                </span>
              ) : (
                <span className="rounded-[6px] bg-[rgba(19,28,36,.06)] px-[10px] py-[5px] text-[10px] leading-none font-bold tracking-[.06em] text-[rgba(19,28,36,.45)]">
                  SIN ACCESO
                </span>
              )}

              {persona.fase ? (
                <span className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
                  {persona.fase}
                </span>
              ) : null}

              {persona.retirado ? (
                <span className="rounded-[20px] bg-rojo-fondo px-2 py-1 text-[10px] leading-none font-bold text-rojo">
                  Dado de baja
                </span>
              ) : null}

              {!persona.activo ? (
                <span className="rounded-[20px] bg-ambar-fondo px-2 py-1 text-[10px] leading-none font-bold text-ambar-texto">
                  Inactivo
                </span>
              ) : null}
            </Link>
          ))}

          {personas.length === 0 ? (
            <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
              {consulta
                ? "Nadie coincide con esa búsqueda."
                : "Todavía no hay personas registradas."}
            </p>
          ) : null}
        </div>

        {resultado.paginas > 1 ? (
          <nav className="mt-5 flex items-center justify-center gap-3">
            {resultado.page > 1 ? (
              <Link
                href={urlPagina(consulta, resultado.size, resultado.page - 1)}
                className="rounded-[8px] border border-[rgba(19,28,36,.16)] px-[14px] py-[9px] text-[12px] leading-none font-semibold text-tinta"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="rounded-[8px] border border-[rgba(19,28,36,.08)] px-[14px] py-[9px] text-[12px] leading-none font-semibold text-[rgba(19,28,36,.3)]">
                ← Anterior
              </span>
            )}
            <span className="text-[12px] leading-none font-semibold text-[rgba(19,28,36,.5)]">
              Página {resultado.page} de {resultado.paginas}
            </span>
            {resultado.page < resultado.paginas ? (
              <Link
                href={urlPagina(consulta, resultado.size, resultado.page + 1)}
                className="rounded-[8px] border border-[rgba(19,28,36,.16)] px-[14px] py-[9px] text-[12px] leading-none font-semibold text-tinta"
              >
                Siguiente →
              </Link>
            ) : (
              <span className="rounded-[8px] border border-[rgba(19,28,36,.08)] px-[14px] py-[9px] text-[12px] leading-none font-semibold text-[rgba(19,28,36,.3)]">
                Siguiente →
              </span>
            )}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
