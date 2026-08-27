import Link from "next/link";
import { ETIQUETA_ROL, requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { buscarPersonasAdmin } from "@/lib/administracion";

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

export default async function PaginaAdministracion({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { q } = await searchParams;
  const consulta = (q ?? "").trim();
  const personas = await buscarPersonasAdmin(consulta);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Administración de personas
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            Roles, permisos, proceso y datos de cada persona · se sincroniza con
            HighLevel
          </p>
        </header>

        <form className="mt-5 max-w-[460px]" action="/administracion">
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

        <p className="mt-4 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
          {consulta
            ? `${personas.length} resultado${personas.length === 1 ? "" : "s"}`
            : "Personas registradas recientemente"}
        </p>

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
      </div>
    </main>
  );
}
