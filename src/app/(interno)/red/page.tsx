import Link from "next/link";
import { Phase, Role } from "@iglesia/prisma-client";
import { ETIQUETA_ROL, requerirRol, ROLES_CON_RED } from "@/lib/auth";
import { cargarArbol, type IndicadoresDeRed, type NodoDeRed } from "@/lib/arbol";

export const metadata = { title: "Árbol de la red · Iglesia Vive" };
export const dynamic = "force-dynamic";

const FASES: Phase[] = [
  Phase.GANAR,
  Phase.FORTALECER,
  Phase.ENTRENAR,
  Phase.MULTIPLICAR,
];

export default async function PaginaRed() {
  const usuario = await requerirRol(ROLES_CON_RED);
  const arbol = await cargarArbol(usuario);

  // Los indicadores cuentan también a quien no cuelga de nadie: si no, el
  // total de la iglesia no cuadra con la cantidad de personas registradas.
  const total = [...arbol.raices, ...(arbol.sinMentor ?? [])].reduce(
    (suma, nodo) => sumarVista(suma, nodo.indicadores),
    vacio(),
  );

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            Árbol de la red
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {arbol.esVistaCompleta
              ? "Toda la estructura de discipulado"
              : "Tu rama: a quién acompañas y a quién acompañan ellos"}
          </p>
        </header>

        <Indicadores datos={total} />

        <section className="mt-[14px] tarjeta p-5">
          <h2 className="etiqueta-seccion">ESTRUCTURA</h2>
          <div className="mt-4 flex flex-col gap-2">
            {arbol.raices.map((raiz) => (
              <Nodo key={raiz.userId ?? raiz.learnerId} nodo={raiz} nivel={0} />
            ))}
          </div>
        </section>

        {arbol.sinMentor?.length ? (
          <section className="mt-[14px] tarjeta p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="etiqueta-seccion">TODAVÍA SIN MENTOR</h2>
              <p className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.4)]">
                {arbol.sinMentor.length}
              </p>
            </div>
            <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              No cuelgan de nadie en el árbol. Aparecen aquí para que no se
              pierdan de vista.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {arbol.sinMentor.map((nodo) => (
                <Nodo key={nodo.learnerId} nodo={nodo} nivel={0} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Nodo({ nodo, nivel }: { nodo: NodoDeRed; nivel: number }) {
  const tarjeta = <Tarjeta nodo={nodo} />;

  if (!nodo.hijos.length) {
    return <div style={{ paddingLeft: nivel * 18 }}>{tarjeta}</div>;
  }

  return (
    <details open={nivel < 2} style={{ paddingLeft: nivel * 18 }}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {tarjeta}
      </summary>
      <div className="mt-2 flex flex-col gap-2 border-l border-[rgba(19,28,36,.12)] pl-2">
        {nodo.hijos.map((hijo) => (
          <Nodo key={hijo.userId ?? hijo.learnerId} nodo={hijo} nivel={nivel + 1} />
        ))}
      </div>
    </details>
  );
}

function Tarjeta({ nodo }: { nodo: NodoDeRed }) {
  const nombre = nodo.learnerId ? (
    <Link
      href={`/expediente/${nodo.learnerId}`}
      className="text-[13.5px] leading-none font-semibold text-tinta hover:text-azul-700 hover:underline"
    >
      {nodo.nombre}
    </Link>
  ) : (
    <span className="text-[13.5px] leading-none font-semibold text-tinta">
      {nodo.nombre}
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-papel p-3">
      <span className="min-w-0 flex-1">
        {nombre}
        <span className="mt-[5px] flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-none font-semibold text-[rgba(19,28,36,.45)]">
          {nodo.rol && nodo.rol !== Role.APRENDIZ ? (
            <span className="rounded-[5px] bg-azul-100 px-[6px] py-[3px] text-[9.5px] font-bold tracking-[.06em] text-azul-700">
              {ETIQUETA_ROL[nodo.rol].toUpperCase()}
            </span>
          ) : null}
          {nodo.fase ? <span>{nodo.fase}</span> : null}
          {nodo.estado && nodo.estado !== "ACTIVO" ? (
            <span>· {nodo.estado.toLowerCase()}</span>
          ) : null}
          {nodo.aCargo ? (
            <span>
              · acompaña a {nodo.aCargo}
              {nodo.enLaRed > nodo.aCargo ? ` · ${nodo.enLaRed} en su red` : ""}
            </span>
          ) : null}
        </span>
      </span>

      {nodo.alertas.length ? (
        <span className="flex flex-wrap gap-1">
          {nodo.alertas.map((alerta) => (
            <span
              key={alerta}
              className="rounded-[20px] bg-ambar-fondo px-2 py-1 text-[10px] leading-none font-bold text-ambar-texto"
            >
              {alerta}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function vacio(): IndicadoresDeRed {
  return {
    personas: 0,
    porFase: { GANAR: 0, FORTALECER: 0, ENTRENAR: 0, MULTIPLICAR: 0 },
    activas: 0,
    estancadas: 0,
    operacion72Vencida: 0,
    bautismos: 0,
    encuentros: 0,
    graduaciones: 0,
    multiplicadores: 0,
    nuevas: 0,
  };
}

function sumarVista(a: IndicadoresDeRed, b: IndicadoresDeRed): IndicadoresDeRed {
  const suma = vacio();
  suma.personas = a.personas + b.personas;
  for (const fase of FASES) suma.porFase[fase] = a.porFase[fase] + b.porFase[fase];
  suma.activas = a.activas + b.activas;
  suma.estancadas = a.estancadas + b.estancadas;
  suma.operacion72Vencida = a.operacion72Vencida + b.operacion72Vencida;
  suma.bautismos = a.bautismos + b.bautismos;
  suma.encuentros = a.encuentros + b.encuentros;
  suma.graduaciones = a.graduaciones + b.graduaciones;
  suma.multiplicadores = a.multiplicadores + b.multiplicadores;
  suma.nuevas = a.nuevas + b.nuevas;
  return suma;
}

function Indicadores({ datos }: { datos: IndicadoresDeRed }) {
  const celdas: { etiqueta: string; valor: number; tono?: "ambar" }[] = [
    { etiqueta: "Personas", valor: datos.personas },
    { etiqueta: "Activas", valor: datos.activas },
    { etiqueta: "Estancadas", valor: datos.estancadas, tono: "ambar" },
    { etiqueta: "Op. 72 vencida", valor: datos.operacion72Vencida, tono: "ambar" },
    { etiqueta: "Nuevas (30 d)", valor: datos.nuevas },
    { etiqueta: "Encuentros", valor: datos.encuentros },
    { etiqueta: "Bautismos", valor: datos.bautismos },
    { etiqueta: "Multiplicadores", valor: datos.multiplicadores },
    { etiqueta: "Graduaciones", valor: datos.graduaciones },
  ];

  return (
    <>
      <section className="mt-6 grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-5">
        {celdas.map((celda) => (
          <div
            key={celda.etiqueta}
            className={`rounded-[12px] p-4 ${
              celda.tono === "ambar" && celda.valor > 0
                ? "border border-[rgba(201,123,44,.3)] bg-ambar-fondo"
                : "tarjeta"
            }`}
          >
            <p
              className={`text-[9.5px] leading-none font-bold tracking-[.14em] ${
                celda.tono === "ambar" && celda.valor > 0
                  ? "text-ambar-texto"
                  : "text-[rgba(19,28,36,.42)]"
              }`}
            >
              {celda.etiqueta.toUpperCase()}
            </p>
            <p className="mt-[10px] font-serif text-[26px] leading-none font-normal text-tinta">
              {celda.valor}
            </p>
          </div>
        ))}
      </section>

      <section className="tarjeta mt-[10px] p-5">
        <h2 className="etiqueta-seccion">PERSONAS POR FASE</h2>
        <div className="mt-4 flex flex-wrap gap-[10px]">
          {FASES.map((fase) => {
            const valor = datos.porFase[fase];
            const porcentaje = datos.personas
              ? Math.round((valor / datos.personas) * 100)
              : 0;
            return (
              <div key={fase} className="min-w-[150px] flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[10px] leading-none font-bold tracking-[.1em] text-[rgba(19,28,36,.5)]">
                    {fase}
                  </span>
                  <span className="text-[13px] leading-none font-semibold text-tinta">
                    {valor}
                  </span>
                </div>
                <div className="mt-2 h-[8px] rounded-[3px] bg-[rgba(19,28,36,.09)]">
                  <div
                    className="h-full rounded-[3px] bg-azul-900"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
