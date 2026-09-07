import Link from "next/link";
import { Phase, Role } from "@iglesia/prisma-client";
import { ETIQUETA_ROL } from "@/lib/auth";
import type { ArbolDeRed, NodoDeRed } from "@/lib/arbol";

/// El árbol de la red, tal como se veía en la pantalla `/red` antes de que las
/// dos vistas se fundieran en «Mi red» (7-sep-2026). Es la misma gente que la
/// vista de lista, ordenada por de quién cuelga cada una.

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

/// Todo el árbol: la estructura, y aparte quienes no cuelgan de nadie.
export function VistaArbol({
  arbol,
  faseFiltro,
  enlaceFase,
}: {
  arbol: ArbolDeRed;
  faseFiltro: Phase | null;
  enlaceFase: (fase: Phase | null) => string;
}) {
  if (faseFiltro) {
    const personas = aplanar([...arbol.raices, ...(arbol.sinMentor ?? [])])
      .filter((nodo) => nodo.fase === faseFiltro)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return (
      <section className="tarjeta mt-[14px] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="etiqueta-seccion">EN FASE {faseFiltro}</h2>
          <Link
            href={enlaceFase(null)}
            className="text-[11.5px] leading-none font-semibold text-azul-700"
          >
            ← Ver todo el árbol
          </Link>
        </div>
        <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
          {personas.length} persona{personas.length === 1 ? "" : "s"} en {faseFiltro}.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {personas.slice(0, 80).map((nodo) => (
            <Tarjeta key={nodo.userId ?? nodo.learnerId} nodo={nodo} />
          ))}
          {personas.length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              Nadie en esta fase por ahora.
            </p>
          ) : null}
          {personas.length > 80 ? (
            <p className="rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              Se muestran las primeras 80 de {personas.length}. Usa el buscador
              de arriba para encontrar a alguien puntual.
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="tarjeta mt-[14px] p-5">
        <h2 className="etiqueta-seccion">ESTRUCTURA</h2>
        <div className="mt-4 flex flex-col gap-2">
          {arbol.raices.map((raiz) => (
            <Nodo key={raiz.userId ?? raiz.learnerId} nodo={raiz} nivel={0} />
          ))}
        </div>
      </section>

      {arbol.sinMentor?.length ? (
        <section className="tarjeta mt-[14px] p-5">
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
    </>
  );
}

/// Recorre el árbol y devuelve todos los nodos en una sola lista.
function aplanar(nodos: NodoDeRed[]): NodoDeRed[] {
  const salida: NodoDeRed[] = [];
  for (const nodo of nodos) {
    salida.push(nodo);
    if (nodo.hijos.length) salida.push(...aplanar(nodo.hijos));
  }
  return salida;
}
