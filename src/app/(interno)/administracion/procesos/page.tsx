import Link from "next/link";
import type { Phase } from "@iglesia/prisma-client";
import { requerirPermiso, puedeVerProcesos } from "@/lib/auth";
import {
  cargarProcesos,
  type GrupoDeProcesos,
  type MentorDeProcesos,
  type PersonaDeProcesos,
} from "@/lib/procesos";
import { agruparPorMentor } from "@/lib/procesos-arbol";
import {
  COLUMNAS_DE_OP72,
  ETIQUETA_FASE,
  ETIQUETA_OP72,
  FILTROS_DE_PROCESOS,
  type FiltroDeProcesos,
  cumpleFiltro,
} from "@/lib/procesos-catalogo";
import { diaCorto, momentoCorto, normalizarBusqueda, telefonoLegible } from "@/lib/dominio";

export const metadata = { title: "Procesos · Iglesia Vive" };
export const dynamic = "force-dynamic";

/// **Procesos**: en qué va cada persona, quién la acompaña y quién la invitó.
///
/// La pantalla que se revisa en la reunión de pastores de los miércoles. La ven
/// administradores y pastores, y los dos ven la iglesia completa — ver solo la
/// rama propia no sirve para la conversación que se tiene ahí, que es a quién
/// se le reparten las personas que esperan mentor.
///
/// **No hay ni un componente de cliente.** Las ramas se abren con `<details>`,
/// que el navegador ya sabe hacer, y el buscador viaja por la URL como en el
/// resto de administración. Así la pantalla funciona igual sin JavaScript y no
/// hay estado que sincronizar.
export default async function PaginaDeProcesos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  await requerirPermiso(puedeVerProcesos);

  const parametros = await searchParams;
  const busqueda = (parametros.q ?? "").trim();
  const filtro: FiltroDeProcesos =
    FILTROS_DE_PROCESOS.find((f) => f.valor === parametros.filtro)?.valor ??
    "todas";

  const procesos = await cargarProcesos();
  const porMentor = agruparPorMentor(procesos.personas);
  const porCasa = new Map<string, PersonaDeProcesos[]>();
  for (const persona of procesos.personas) {
    if (!persona.casaDeFe) continue;
    const lista = porCasa.get(persona.casaDeFe);
    if (lista) lista.push(persona);
    else porCasa.set(persona.casaDeFe, [persona]);
  }

  const aguja = normalizarBusqueda(busqueda);
  const listado = procesos.personas.filter((persona) => {
    if (!cumpleFiltro(persona, filtro)) return false;
    if (!aguja) return true;
    return [
      persona.nombre,
      persona.invito,
      persona.celular,
      persona.mentor,
      persona.consolidador,
      persona.casaDeFe,
    ].some((campo) => normalizarBusqueda(campo).includes(aguja));
  });

  const sinMentor = procesos.mentores.filter((m) => m.directos === 0);
  const cuposLibres = sinMentor.reduce((t, m) => t + m.capacidad, 0);

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Procesos
            </h1>
            <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
              {procesos.personas.length} personas activas · no incluye las dadas
              de baja
            </p>
          </div>
          <Link
            href="/administracion"
            className="shrink-0 rounded-[9px] border border-[rgba(19,28,36,.16)] px-[14px] py-[10px] text-[12px] leading-none font-semibold text-tinta hover:border-azul-700 hover:text-azul-700"
          >
            Volver a Administración
          </Link>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
          <Cifra rotulo="EN PROCESO" valor={procesos.activas} pie={`más ${procesos.asistentes} asistentes`} />
          <Cifra rotulo="CON MENTOR" valor={procesos.conMentor} pie="ya tienen quien las acompañe" verde />
          <Cifra rotulo="ESPERAN MENTOR" valor={procesos.esperanMentor} pie="con candidato propuesto" ambar />
          <Cifra rotulo="EN CASA DE FE" valor={procesos.enCasaDeFe} pie={`en ${procesos.grupos.filter((g) => g.tipo === "CASA_DE_FE").length} casas abiertas`} />
        </section>

        {/* ---------- MENTORES ---------- */}
        <h2 className="mt-9 font-serif text-[21px] leading-[1.2] font-normal text-tinta">
          Quién está mentoreando
        </h2>
        <p className="mt-1 max-w-[76ch] text-[13px] leading-[1.5] text-[rgba(19,28,36,.55)]">
          <strong className="font-semibold text-tinta">Directos</strong> son los
          que acompaña él mismo.{" "}
          <strong className="font-semibold text-tinta">Su red</strong> son esos
          más los que acompañan sus discípulos, hacia abajo en toda la cadena.
          Abre un nombre para verlos.
        </p>

        <div className="tarjeta mt-3 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b border-[rgba(19,28,36,.07)] bg-papel px-[14px] py-[10px] text-[10px] leading-none font-bold tracking-[.12em] text-[rgba(19,28,36,.42)]">
            <span>MENTOR</span>
            <span className="text-right">DIRECTOS</span>
            <span className="text-right">SU RED</span>
            <span className="text-right">CUPO</span>
          </div>
          {procesos.mentores.map((mentor) => (
            <RamaDeMentor key={mentor.id} mentor={mentor} porMentor={porMentor} />
          ))}
        </div>

        {sinMentor.length > 0 ? (
          <div className="aviso-ambar mt-3">
            <p className="etiqueta-seccion text-ambar-texto">
              {sinMentor.length === 1
                ? "UN MENTOR SIN NADIE ASIGNADO"
                : `${sinMentor.length} MENTORES SIN NADIE ASIGNADO`}
            </p>
            <p className="mt-[6px] text-[13.5px] leading-[1.5] text-tinta">
              {sinMentor.map((m) => m.nombre).join(", ")}{" "}
              {sinMentor.length === 1 ? "tiene" : "suman"}{" "}
              <strong className="font-bold">{cuposLibres} cupos libres</strong>, y hay{" "}
              {procesos.esperanMentor} personas esperando quien las reciba.
            </p>
          </div>
        ) : null}

        {/* ---------- GRUPOS ---------- */}
        <h2 className="mt-9 font-serif text-[21px] leading-[1.2] font-normal text-tinta">
          Casas de Fe y Alpha
        </h2>

        <div className="tarjeta mt-3 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-[rgba(19,28,36,.07)] bg-papel px-[14px] py-[10px] text-[10px] leading-none font-bold tracking-[.12em] text-[rgba(19,28,36,.42)]">
            <span>GRUPO</span>
            <span className="text-right">EMPEZÓ</span>
            <span className="text-right">PERSONAS</span>
          </div>
          {procesos.grupos.map((grupo) => (
            <GrupoAbrible key={grupo.id} grupo={grupo} miembros={porCasa.get(grupo.nombre) ?? []} />
          ))}
        </div>

        {/* ---------- RECORRIDO ---------- */}
        <h2 className="mt-9 font-serif text-[21px] leading-[1.2] font-normal text-tinta">
          El recorrido
        </h2>
        <section className="mt-3 grid grid-cols-2 gap-[10px] lg:grid-cols-4">
          <Cifra rotulo="GANAR" valor={procesos.porFase.GANAR} pie="recién llegadas, en consolidación" />
          <Cifra rotulo="FORTALECER" valor={procesos.porFase.FORTALECER} pie="ya tienen mentor" verde />
          <Cifra rotulo="ENTRENAR" valor={procesos.porFase.ENTRENAR} pie="se preparan para servir" verde />
          <Cifra rotulo="MULTIPLICAR" valor={procesos.porFase.MULTIPLICAR} pie="ya lideran a otros" verde />
        </section>

        {/* ---------- OPERACIÓN 72 ---------- */}
        <h2 className="mt-9 font-serif text-[21px] leading-[1.2] font-normal text-tinta">
          Operación 72, fase por fase
        </h2>
        <div className="mt-3 grid gap-[10px]">
          {COLUMNAS_DE_OP72.map((columna) => {
            const cuantas = procesos.personas.filter(
              (p) => p.op72 === columna.estado,
            ).length;
            return (
              <div key={columna.estado} className="tarjeta p-[15px] sm:flex sm:gap-5">
                <p className="w-[70px] shrink-0 font-serif text-[28px] leading-none font-normal text-tinta">
                  {cuantas}
                </p>
                <div className="mt-2 sm:mt-0">
                  <p className="etiqueta-seccion">{columna.titulo}</p>
                  <p className="mt-[6px] max-w-[64ch] text-[13.5px] leading-[1.5] text-[rgba(19,28,36,.62)]">
                    {columna.descripcion}
                  </p>
                  <p className="mt-[6px] text-[13px] leading-[1.5] text-[rgba(19,28,36,.55)]">
                    <strong className="font-semibold text-tinta">Qué sigue:</strong>{" "}
                    {columna.queSigue}
                  </p>
                  <Link
                    href={`/administracion/procesos?filtro=op-${columna.estado}`}
                    className="mt-[9px] inline-block rounded-[9px] border border-[rgba(19,28,36,.18)] px-[11px] py-[5px] text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.62)] hover:border-azul-700 hover:text-azul-700"
                  >
                    Ver las {cuantas} personas
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- BUSCADOR ---------- */}
        <h2 className="mt-9 font-serif text-[21px] leading-[1.2] font-normal text-tinta">
          Buscar a una persona
        </h2>

        <form className="mt-3 max-w-[460px]" action="/administracion/procesos">
          <input type="hidden" name="filtro" value={filtro} />
          <input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Nombre, celular o quién la invitó…"
            className="campo mt-0"
            aria-label="Buscar una persona"
          />
        </form>

        <div className="mt-[11px] flex flex-wrap gap-[7px]">
          {FILTROS_DE_PROCESOS.map((f) => {
            const activo = f.valor === filtro;
            const url = new URLSearchParams();
            if (f.valor !== "todas") url.set("filtro", f.valor);
            if (busqueda) url.set("q", busqueda);
            const cola = url.toString();
            return (
              <Link
                key={f.valor}
                href={`/administracion/procesos${cola ? `?${cola}` : ""}`}
                aria-current={activo ? "page" : undefined}
                className={
                  activo
                    ? "rounded-[9px] border-[1.5px] border-azul-900 bg-azul-050 px-[12px] py-[7px] text-[12px] leading-none font-bold text-tinta"
                    : "rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-[12.5px] py-[7.5px] text-[12px] leading-none font-semibold text-[rgba(19,28,36,.55)] hover:border-azul-700 hover:text-azul-700"
                }
              >
                {f.etiqueta}
              </Link>
            );
          })}
        </div>

        <p className="mt-3 text-[12px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
          {listado.length === procesos.personas.length
            ? `${listado.length} personas`
            : `${listado.length} de ${procesos.personas.length} personas`}
        </p>

        <div className="tarjeta mt-3 overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-[13.5px]">
            <thead>
              <tr className="bg-papel">
                {["PERSONA", "FASE", "OPERACIÓN 72", "QUIÉN LA INVITÓ", "QUIÉN LA ACOMPAÑA", "CASA DE FE", "ÚLTIMO CONTACTO"].map(
                  (rotulo) => (
                    <th
                      key={rotulo}
                      className="px-[14px] py-[10px] text-left text-[10px] leading-none font-bold tracking-[.12em] whitespace-nowrap text-[rgba(19,28,36,.42)]"
                    >
                      {rotulo}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {listado.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-[14px] py-8 text-center text-[13px] text-[rgba(19,28,36,.45)]"
                  >
                    Nadie coincide con esa búsqueda.
                  </td>
                </tr>
              ) : (
                listado.map((persona) => (
                  <tr
                    key={persona.learnerId}
                    className={`border-t border-[rgba(19,28,36,.07)] ${persona.op72 === "LISTA_PARA_ENTREGA" ? "bg-azul-050" : ""}`}
                  >
                    <td className="px-[14px] py-[8px] align-top">
                      <Link
                        href={`/expediente/${persona.learnerId}`}
                        className="font-bold text-tinta hover:text-azul-700"
                      >
                        {persona.nombre}
                      </Link>
                      {persona.estado === "ASISTENTE" ? (
                        <span className="ml-[6px] rounded-[5px] bg-ambar-chip px-[6px] py-[2px] text-[10px] leading-none font-bold tracking-[.06em] text-ambar-texto">
                          ASISTENTE
                        </span>
                      ) : null}
                      {persona.celular ? (
                        <span className="mt-[2px] block text-[11.5px] leading-none text-[rgba(19,28,36,.42)]">
                          {telefonoLegible(persona.celular)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-[14px] py-[8px] align-top">
                      <EtiquetaDeFase fase={persona.fase} />
                    </td>
                    <Celda texto={persona.op72 ? ETIQUETA_OP72[persona.op72] : ""} />
                    <Celda texto={persona.invito} />
                    <Celda texto={persona.mentor || persona.consolidador} />
                    <Celda texto={persona.casaDeFe} />
                    <Celda
                      texto={persona.ultimoContacto ? momentoCorto(persona.ultimoContacto) : ""}
                    />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Cifra({
  rotulo,
  valor,
  pie,
  verde = false,
  ambar = false,
}: {
  rotulo: string;
  valor: number;
  pie: string;
  verde?: boolean;
  ambar?: boolean;
}) {
  return (
    <div className={`tarjeta p-[15px] ${ambar ? "border-[rgba(201,123,44,.3)]" : ""}`}>
      <p className={`etiqueta-seccion ${ambar ? "text-ambar-texto" : ""}`}>{rotulo}</p>
      <p
        className={`mt-[10px] text-[30px] leading-none font-extrabold tracking-[-.02em] ${
          ambar ? "text-ambar-texto" : verde ? "text-verde-600" : "text-tinta"
        }`}
      >
        {valor}
      </p>
      <p className="mt-[3px] text-[10.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.45)]">
        {pie}
      </p>
    </div>
  );
}

function Celda({ texto }: { texto: string }) {
  return (
    <td className="px-[14px] py-[8px] align-top text-[rgba(19,28,36,.62)]">
      {texto || <span className="text-[rgba(19,28,36,.35)]">—</span>}
    </td>
  );
}

const COLOR_DE_FASE: Record<Phase, string> = {
  GANAR: "bg-papel text-[rgba(19,28,36,.5)]",
  FORTALECER: "bg-azul-050 text-azul-700",
  ENTRENAR: "bg-ambar-chip text-ambar-texto",
  MULTIPLICAR: "bg-verde-100 text-verde-700",
};

function EtiquetaDeFase({ fase }: { fase: Phase }) {
  return (
    <span
      className={`inline-block rounded-[5px] px-[6px] py-[3px] text-[10px] leading-none font-bold tracking-[.06em] ${COLOR_DE_FASE[fase]}`}
    >
      {ETIQUETA_FASE[fase].toUpperCase()}
    </span>
  );
}

/// Una fila de mentor que se abre y muestra a quién acompaña.
///
/// La recursión vive aquí: cada discípulo que a su vez acompaña gente se pinta
/// con su propio `<details>`, así que la cadena baja hasta donde llegue sin
/// que haya que saber de antemano cuántos niveles tiene.
function RamaDeMentor({
  mentor,
  porMentor,
}: {
  mentor: MentorDeProcesos;
  porMentor: Map<string, PersonaDeProcesos[]>;
}) {
  const libres = mentor.capacidad - mentor.directos;
  const cupo =
    mentor.directos === 0
      ? { texto: `${mentor.capacidad} · sin nadie`, clase: "bg-ambar-chip text-ambar-texto" }
      : libres <= 4
        ? { texto: String(libres), clase: "bg-rojo-fondo text-rojo" }
        : { texto: String(libres), clase: "bg-papel text-[rgba(19,28,36,.5)]" };

  const cifras = (
    <>
      <span className="text-right text-[13.5px] font-bold text-tinta">{mentor.directos}</span>
      <span className="text-right text-[13.5px] font-bold text-tinta">{mentor.red}</span>
      <span className="text-right">
        <span className={`inline-block rounded-[5px] px-[6px] py-[3px] text-[10px] leading-none font-bold tracking-[.06em] ${cupo.clase}`}>
          {cupo.texto}
        </span>
      </span>
    </>
  );

  if (mentor.directos === 0) {
    return (
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-t border-[rgba(19,28,36,.07)] px-[14px] py-[11px]">
        <span className="text-[13.5px] font-semibold text-[rgba(19,28,36,.55)]">
          {mentor.nombre}
          <span className="ml-[7px] text-[12px] font-medium text-[rgba(19,28,36,.42)]">
            sin discípulos
          </span>
        </span>
        {cifras}
      </div>
    );
  }

  return (
    <details className="group border-t border-[rgba(19,28,36,.07)]">
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-[14px] py-[11px] marker:hidden hover:bg-papel">
        <span className="text-[13.5px] font-bold text-tinta">
          <span className="mr-[7px] text-[10px] text-azul-700 group-open:hidden">▶</span>
          <span className="mr-[7px] hidden text-[10px] text-tinta group-open:inline">▼</span>
          {mentor.nombre}
        </span>
        {cifras}
      </summary>
      <div className="bg-papel px-[16px] py-[12px]">
        <p className="etiqueta-seccion">LOS {mentor.directos} QUE ACOMPAÑA</p>
        <ListaDeDiscipulos
          cuenta={mentor.id}
          porMentor={porMentor}
          cadena={[mentor.id]}
        />
      </div>
    </details>
  );
}

/// Los discípulos de una cuenta, cada uno abrible si a su vez acompaña gente.
///
/// `cadena` lleva las cuentas por las que ya se bajó. Sin ella, un error de
/// datos en el que dos personas se acompañen mutuamente haría que esto se
/// dibujara a sí mismo para siempre — y el servidor se quedaría sin pila
/// antes de pintar nada.
function ListaDeDiscipulos({
  cuenta,
  porMentor,
  cadena,
}: {
  cuenta: string;
  porMentor: Map<string, PersonaDeProcesos[]>;
  cadena: string[];
}) {
  const discipulos = [...(porMentor.get(cuenta) ?? [])].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );

  return (
    <div className="mt-[8px] ml-[3px] border-l-2 border-[rgba(19,28,36,.12)] pl-[13px]">
      {discipulos.map((persona) => {
        const hijos = persona.cuenta ? (porMentor.get(persona.cuenta) ?? []) : [];
        const repetido = persona.cuenta ? cadena.includes(persona.cuenta) : false;
        const datos = (
          <>
            <EtiquetaDeFase fase={persona.fase} />
            {persona.casaDeFe ? (
              <span className="text-[12px] text-[rgba(19,28,36,.55)]">
                Casa de Fe: {persona.casaDeFe}
              </span>
            ) : null}
            <span
              className={
                persona.invito
                  ? "text-[12px] text-[rgba(19,28,36,.55)]"
                  : "text-[12px] text-[rgba(19,28,36,.4)] italic"
              }
            >
              {persona.invito
                ? `La invitó ${persona.invito}`
                : "No quedó registrado quién la invitó"}
            </span>
          </>
        );

        if (hijos.length === 0 || repetido || !persona.cuenta) {
          return (
            <div
              key={persona.learnerId}
              className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px] border-b border-[rgba(19,28,36,.07)] py-[6px] last:border-b-0"
            >
              <Link
                href={`/expediente/${persona.learnerId}`}
                className="text-[13px] font-bold text-tinta hover:text-azul-700"
              >
                {persona.nombre}
              </Link>
              {datos}
              {repetido ? (
                <span className="text-[12px] text-[rgba(19,28,36,.4)] italic">
                  (ya aparece más arriba)
                </span>
              ) : null}
            </div>
          );
        }

        return (
          <details
            key={persona.learnerId}
            className="group/hijo border-b border-[rgba(19,28,36,.07)] last:border-b-0"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-[10px] gap-y-[4px] py-[6px] marker:hidden">
              <span className="text-[13px] font-bold text-tinta">
                <span className="mr-[6px] text-[10px] text-azul-700 group-open/hijo:hidden">▶</span>
                <span className="mr-[6px] hidden text-[10px] text-tinta group-open/hijo:inline">▼</span>
                {persona.nombre}
              </span>
              <span className="text-[12px] text-[rgba(19,28,36,.55)]">
                acompaña a {hijos.length}
              </span>
              {datos}
            </summary>
            <div className="pb-[8px]">
              <ListaDeDiscipulos
                cuenta={persona.cuenta}
                porMentor={porMentor}
                cadena={[...cadena, persona.cuenta]}
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function GrupoAbrible({
  grupo,
  miembros,
}: {
  grupo: GrupoDeProcesos;
  miembros: PersonaDeProcesos[];
}) {
  const etiqueta = (
    <span
      className={`ml-[8px] inline-block rounded-[5px] px-[6px] py-[3px] text-[10px] leading-none font-bold tracking-[.06em] ${
        grupo.tipo === "ALPHA"
          ? "bg-ambar-chip text-ambar-texto"
          : "bg-verde-100 text-verde-700"
      }`}
    >
      {grupo.tipo === "ALPHA" ? "ALPHA" : "CASA DE FE"}
    </span>
  );

  const cifras = (
    <>
      <span className="text-right text-[13px] text-[rgba(19,28,36,.55)]">
        {diaCorto(grupo.inicio)}
      </span>
      <span
        className={`text-right text-[13.5px] font-bold ${grupo.miembros === 0 ? "text-[rgba(19,28,36,.35)]" : "text-tinta"}`}
      >
        {grupo.miembros}
      </span>
    </>
  );

  if (grupo.miembros === 0) {
    return (
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-[rgba(19,28,36,.07)] px-[14px] py-[11px]">
        <span className="text-[13.5px] font-semibold text-[rgba(19,28,36,.55)]">
          {grupo.nombre}
          <span className="ml-[7px] text-[12px] font-medium text-[rgba(19,28,36,.42)]">
            nadie inscrito
          </span>
          {etiqueta}
        </span>
        {cifras}
      </div>
    );
  }

  return (
    <details className="group/grupo border-t border-[rgba(19,28,36,.07)]">
      <summary className="grid cursor-pointer list-none grid-cols-[1fr_auto_auto] items-center gap-x-4 px-[14px] py-[11px] marker:hidden hover:bg-papel">
        <span className="text-[13.5px] font-bold text-tinta">
          <span className="mr-[7px] text-[10px] text-azul-700 group-open/grupo:hidden">▶</span>
          <span className="mr-[7px] hidden text-[10px] text-tinta group-open/grupo:inline">▼</span>
          {grupo.nombre}
          {etiqueta}
        </span>
        {cifras}
      </summary>
      <div className="bg-papel px-[16px] py-[12px]">
        <p className="etiqueta-seccion">
          QUIÉNES ESTÁN · LO LLEVA {grupo.lider.toUpperCase()}
        </p>
        <div className="mt-[8px] ml-[3px] border-l-2 border-[rgba(19,28,36,.12)] pl-[13px]">
          {miembros
            .slice()
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
            .map((persona) => (
              <div
                key={persona.learnerId}
                className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[4px] border-b border-[rgba(19,28,36,.07)] py-[6px] last:border-b-0"
              >
                <Link
                  href={`/expediente/${persona.learnerId}`}
                  className="text-[13px] font-bold text-tinta hover:text-azul-700"
                >
                  {persona.nombre}
                </Link>
                <EtiquetaDeFase fase={persona.fase} />
                <span
                  className={
                    persona.mentor
                      ? "text-[12px] text-[rgba(19,28,36,.55)]"
                      : "text-[12px] text-[rgba(19,28,36,.4)] italic"
                  }
                >
                  {persona.mentor ? `Mentor: ${persona.mentor}` : "Sin mentor asignado"}
                </span>
                <span
                  className={
                    persona.invito
                      ? "text-[12px] text-[rgba(19,28,36,.55)]"
                      : "text-[12px] text-[rgba(19,28,36,.4)] italic"
                  }
                >
                  {persona.invito
                    ? `La invitó ${persona.invito}`
                    : "No quedó registrado quién la invitó"}
                </span>
              </div>
            ))}
        </div>
      </div>
    </details>
  );
}
