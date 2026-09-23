import Link from "next/link";
import { Phase, Role } from "@iglesia/prisma-client";
import { ETIQUETA_ROL } from "@/lib/auth";
import type { ArbolDeRed, NodoDeRed } from "@/lib/arbol";

/// El árbol de la red, tal como se veía en la pantalla `/red` antes de que las
/// dos vistas se fundieran en «Mi red» (7-sep-2026). Es la misma gente que la
/// vista de lista, ordenada por de quién cuelga cada una.

function Nodo({
  nodo,
  nivel,
  mentorId,
}: {
  nodo: NodoDeRed;
  nivel: number;
  /// La cuenta de quien lo acompaña: el nodo del que cuelga. Sirve para decir
  /// si el grupo al que va lo lleva su propio mentor o alguien de otra línea.
  mentorId?: string | null;
}) {
  const tarjeta = <Tarjeta nodo={nodo} mentorId={mentorId} />;

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
          <Nodo
            key={hijo.userId ?? hijo.learnerId}
            nodo={hijo}
            nivel={nivel + 1}
            mentorId={nodo.userId}
          />
        ))}
      </div>
    </details>
  );
}

function Tarjeta({
  nodo,
  mentorId,
}: {
  nodo: NodoDeRed;
  mentorId?: string | null;
}) {
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

      {nodo.reune.length || nodo.giACargo || nodo.enElGrupoDe.length ? (
        <span className="flex w-full flex-wrap gap-1">
          {nodo.reune.map((grupo) => (
            <Link
              key={`${grupo.tipo}-${grupo.id}`}
              href={`/${grupo.tipo}/${grupo.id}`}
              className="rounded-[20px] bg-azul-100 px-2 py-1 text-[10px] leading-none font-bold text-azul-700"
            >
              Lleva {grupo.nombre} · reúne a {grupo.personas}
            </Link>
          ))}

          {/* Sin enlace a propósito: quien mira la red puede no tener
              encendida la pantalla de GI, y un enlace que lleva a «no tienes
              permiso» es peor que ningún enlace. */}
          {nodo.giACargo ? (
            <span className="rounded-[20px] bg-ambar-fondo px-2 py-1 text-[10px] leading-none font-bold text-ambar-texto">
              Líder de GI · acompaña a {nodo.giACargo}
            </span>
          ) : null}

          {/* ⚠️ El grupo al que VA solo se dice cuando NO lo lleva su propio
              mentor. Si lo llevara él, el renglón ya cuelga de esa persona y
              repetirlo sería ruido; cuando es otro —hoy, 9 de los 20 miembros
              de Casa de Fe— es justo el dato que faltaba. */}
          {nodo.enElGrupoDe
            .filter(
              (grupo) =>
                grupo.liderId !== mentorId && grupo.liderId !== nodo.userId,
            )
            .map((grupo) => (
              /* Tampoco lleva enlace: el grupo lo lleva alguien de otra línea,
                 y la ficha de ese grupo puede estar fuera del alcance de quien
                 mira. Si se enseña, tiene que abrir (la regla del 16-sep-2026)
                 — así que lo que no abre, no se enseña como enlace. */
              <span
                key={`va-${grupo.tipo}-${grupo.id}`}
                className="rounded-[20px] bg-papel px-2 py-1 text-[10px] leading-none font-bold text-[rgba(19,28,36,.5)]"
              >
                Va a {grupo.nombre} · la lleva {grupo.lider}
              </span>
            ))}
        </span>
      ) : null}

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
      <QuienReune arbol={arbol} />

      <section className="tarjeta mt-[14px] p-5">
        <h2 className="etiqueta-seccion">ESTRUCTURA</h2>
        <div className="mt-4 flex flex-col gap-2">
          {arbol.raices.map((raiz) => (
            <Nodo
              key={raiz.userId ?? raiz.learnerId}
              nodo={raiz}
              nivel={0}
              mentorId={null}
            />
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

/// **Quién reúne, en esta línea.**
///
/// Es el resumen que contesta de un golpe lo que el árbol solo insinuaba: en
/// una red no solo hay mentores; hay gente que además reúne a otros cada
/// semana —una Casa de Fe, un Alpha, un grupo de GI— y eso no se veía en
/// ninguna parte.
function QuienReune({ arbol }: { arbol: ArbolDeRed }) {
  const nodos = aplanar([...arbol.raices, ...(arbol.sinMentor ?? [])]);

  const llevanGrupo = nodos.filter((n) => n.reune.length).length;
  const lideresDeGi = nodos.filter((n) => n.giACargo).length;

  // ⚠️ «De otra línea» se calcula con el mentor REAL de cada quien, que en el
  // árbol es el nodo del que cuelga. Es el caso que motivó todo: Dana Pere va
  // a la Casa de Fe de Hárold y su mentora es Paola Viveros.
  let deOtraLinea = 0;
  const contar = (nodo: NodoDeRed, mentorId: string | null) => {
    if (
      nodo.enElGrupoDe.some(
        (g) => g.liderId !== mentorId && g.liderId !== nodo.userId,
      )
    ) {
      deOtraLinea += 1;
    }
    for (const hijo of nodo.hijos) contar(hijo, nodo.userId);
  };
  for (const raiz of arbol.raices) contar(raiz, null);

  if (!llevanGrupo && !lideresDeGi && !deOtraLinea) return null;

  return (
    <section className="tarjeta mt-[14px] p-5">
      <h2 className="etiqueta-seccion">EN ESTA LÍNEA, QUIÉN REÚNE</h2>
      <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
        Nadie cambia de sitio en el árbol: cada persona sigue colgando de su
        mentor, y quién reúne a quién se ve en su renglón.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Cuenta titulo="LLEVAN UN ALPHA O UNA CASA DE FE" valor={llevanGrupo} />
        <Cuenta titulo="SON LÍDERES DE GI" valor={lideresDeGi} />
        <Cuenta
          titulo="SU GRUPO LO LLEVA ALGUIEN DE OTRA LÍNEA"
          valor={deOtraLinea}
          ambar
        />
      </div>
    </section>
  );
}

function Cuenta({
  titulo,
  valor,
  ambar,
}: {
  titulo: string;
  valor: number;
  ambar?: boolean;
}) {
  return (
    <div className="rounded-[10px] bg-papel p-4">
      <p className="text-[9.5px] leading-none font-bold tracking-[.08em] text-[rgba(19,28,36,.45)]">
        {titulo}
      </p>
      <p
        className={`mt-2 font-serif text-[24px] leading-none font-normal ${
          ambar ? "text-ambar-texto" : "text-tinta"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
