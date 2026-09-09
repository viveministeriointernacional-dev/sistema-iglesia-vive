import Link from "next/link";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import {
  DIAS_SIN_CONTACTO,
  listarAsistentes,
  type FilaAsistente,
} from "@/lib/administracion";
import { momentoLargo, normalizarBusqueda, telefonoLegible } from "@/lib/dominio";
import { VolverAProceso } from "./volver";

export const metadata = { title: "Asistentes · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// Los cuatro cortes del listado. Van por URL, sin JS, como el resto de las
/// pantallas de administración.
const FILTROS = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "sin-nada", etiqueta: "Sin nada hecho" },
  { valor: "con-logros", etiqueta: "Algo alcanzaron" },
  { valor: "sin-contacto", etiqueta: "Sin contacto hace 3 meses" },
] as const;

type Filtro = (typeof FILTROS)[number]["valor"];

/// «Sin nada hecho» = solo el registro. El registro lo pone el sistema al dar
/// de alta a la persona, así que tenerlo no significa que se haya avanzado.
function sinNadaHecho(fila: FilaAsistente) {
  return fila.conseguidos <= 1;
}

function cumple(fila: FilaAsistente, filtro: Filtro) {
  if (filtro === "sin-nada") return sinNadaHecho(fila);
  if (filtro === "con-logros") return !sinNadaHecho(fila);
  if (filtro === "sin-contacto") return fila.sinContacto;
  return true;
}

/// Asistentes de la iglesia: vienen, pero hoy no quieren proceso.
///
/// La pantalla existe para que esta gente no se archive y se olvide. Por eso
/// el indicador que manda es el ámbar: cuántos llevan tres meses sin que nadie
/// les hable.
export default async function PaginaDeAsistentes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const parametros = await searchParams;
  const busqueda = (parametros.q ?? "").trim();
  const filtro: Filtro =
    FILTROS.find((f) => f.valor === parametros.filtro)?.valor ?? "todos";

  const todos = await listarAsistentes();

  const buscado = normalizarBusqueda(busqueda);
  const soloDigitos = busqueda.replace(/\D/g, "");
  const encontrados = buscado
    ? todos.filter(
        (fila) =>
          normalizarBusqueda(fila.nombre).includes(buscado) ||
          (soloDigitos.length >= 4 &&
            (fila.telefono ?? "").replace(/\D/g, "").includes(soloDigitos)),
      )
    : todos;

  const filas = encontrados.filter((fila) => cumple(fila, filtro));
  const cuenta = (valor: Filtro) =>
    encontrados.filter((fila) => cumple(fila, valor)).length;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1048px]">
        <Link
          href="/administracion"
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver a administración
        </Link>

        <header className="mt-3">
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Asistentes de la iglesia
          </h1>
          <p className="mt-2 max-w-[680px] text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Vienen a la iglesia pero hoy no quieren entrar a ningún proceso. No
            están de baja: siguen en la casa, con su expediente vivo y lo que ya
            alcanzaron. Aquí se ve hasta dónde llegó cada uno y quién lo conoce.
          </p>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile rotulo="ASISTENTES" valor={todos.length} />
          <Tile
            rotulo="SIN NADA HECHO"
            valor={todos.filter(sinNadaHecho).length}
            pie="solo el registro"
          />
          <Tile
            rotulo="ALGO ALCANZARON"
            valor={todos.filter((fila) => !sinNadaHecho(fila)).length}
            pie="Alpha, bautismo o encuentro"
            tono="verde"
          />
          <Tile
            rotulo={`NADIE LES HABLA HACE ${DIAS_SIN_CONTACTO} DÍAS`}
            valor={todos.filter((fila) => fila.sinContacto).length}
            tono="ambar"
          />
        </section>

        <form className="mt-6" action="/administracion/asistentes">
          <input type="hidden" name="filtro" value={filtro} />
          <div className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={busqueda}
              placeholder="Buscar por nombre o celular"
              className="campo mt-0 flex-1"
            />
            <button type="submit" className="boton-primario">
              Buscar
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTROS.map((opcion) => {
            const activo = opcion.valor === filtro;
            const destino = new URLSearchParams();
            if (busqueda) destino.set("q", busqueda);
            if (opcion.valor !== "todos") destino.set("filtro", opcion.valor);
            const consulta = destino.toString();
            return (
              <Link
                key={opcion.valor}
                href={`/administracion/asistentes${consulta ? `?${consulta}` : ""}`}
                aria-pressed={activo}
                className="opcion px-[13px] py-[9px]"
              >
                {opcion.etiqueta} · {cuenta(opcion.valor)}
              </Link>
            );
          })}
        </div>

        <section className="mt-5 flex flex-col gap-3">
          {filas.map((fila) => (
            <Renglon key={fila.learnerId} fila={fila} />
          ))}

          {filas.length === 0 ? (
            <p className="rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-6 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
              {todos.length === 0
                ? "Todavía no hay nadie marcado como asistente. Se marca desde la tarjeta del tablero de Operación 72 o desde el expediente, con «Asiste, no quiere proceso»."
                : "Ninguna persona coincide con lo que buscaste."}
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
          ambar ? "text-ambar-texto" : tono === "verde" ? "text-verde-700" : "text-tinta"
        }`}
      >
        {valor}
      </p>
      {pie ? (
        <p className="mt-[6px] text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
          {pie}
        </p>
      ) : null}
    </div>
  );
}

function Renglon({ fila }: { fila: FilaAsistente }) {
  const identidad = [
    fila.telefono ? telefonoLegible(fila.telefono) : null,
    fila.edad === null ? null : `${fila.edad} años`,
    fila.consolidador ? `Lo consolidó ${fila.consolidador}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="tarjeta p-[17px]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-[9px]">
            <p className="text-[15px] leading-[1.2] font-bold text-tinta">
              {fila.nombre}
            </p>
            {fila.desde ? (
              <span className="rounded-[20px] bg-verde-100 px-[10px] py-[5px] text-[10px] leading-none font-bold tracking-[.06em] text-verde-700">
                ASISTENTE DESDE {momentoLargo(fila.desde).toUpperCase()}
              </span>
            ) : null}
            {fila.sinContacto ? (
              <span className="rounded-[20px] bg-ambar-chip px-[10px] py-[5px] text-[10px] leading-none font-bold tracking-[.06em] text-ambar-texto">
                SIN CONTACTO HACE MÁS DE {DIAS_SIN_CONTACTO} DÍAS
              </span>
            ) : null}
          </div>
          {identidad ? (
            <p className="mt-[6px] text-[11.5px] leading-[1.3] font-semibold text-[rgba(19,28,36,.5)]">
              {identidad}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <p className="etiqueta-seccion">ÚLTIMO CONTACTO</p>
          <p
            className={`mt-[5px] text-[12.5px] leading-none font-bold ${
              fila.sinContacto ? "text-ambar-texto" : "text-tinta"
            }`}
          >
            {fila.ultimoContacto
              ? momentoLargo(fila.ultimoContacto)
              : "No quedó registrado"}
          </p>
        </div>
      </div>

      <div className="mt-[14px]">
        <p className="etiqueta-seccion">LO QUE LLEVA HECHO</p>
        <div className="mt-[9px] flex flex-wrap gap-[7px]">
          {fila.hitos.map((hito) => (
            <span
              key={hito.etiqueta}
              className={
                hito.conseguido
                  ? "rounded-[20px] bg-verde-100 px-3 py-[7px] text-[11.5px] leading-none font-bold text-verde-700"
                  : "rounded-[20px] border border-dashed border-[rgba(19,28,36,.22)] px-3 py-[7px] text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.38)]"
              }
            >
              {hito.etiqueta}
              {hito.conseguido && hito.fecha
                ? ` · ${momentoLargo(hito.fecha)}`
                : ""}
            </span>
          ))}
        </div>
      </div>

      {fila.motivo ? (
        <div className="mt-[14px] rounded-[10px] bg-papel px-[14px] py-3">
          <p className="etiqueta-seccion">POR QUÉ NO SIGUE PROCESO</p>
          <p className="mt-[5px] text-[12.5px] leading-[1.45] font-bold text-tinta">
            {fila.motivo}
          </p>
          {fila.nota ? (
            <p className="mt-[5px] text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.72)]">
              «{fila.nota}»
            </p>
          ) : null}
          {fila.anotadaPor && fila.desde ? (
            <p className="mt-[7px] text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
              Lo anotó {fila.anotadaPor} · {momentoLargo(fila.desde)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-[14px] flex flex-wrap items-center gap-3">
        <VolverAProceso learnerId={fila.learnerId} nombre={fila.nombre} />
        <Link
          href={`/expediente/${fila.learnerId}`}
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          Ver expediente
        </Link>
      </div>
    </article>
  );
}
