"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type ClaseDeGrupo,
  type LoQueTieneElGrupo,
  loQueSeBorra,
  loQueSeQueda,
  nombreCoincide,
} from "@/lib/borrar-grupo-catalogo";

/// **Cambiarle el nombre al grupo y borrarlo.**
///
/// Las dos cosas que pidió el usuario el 22-oct con una frase: «si por error se
/// crea una casa de fe o un alfa, no se puede ni modificar ni editar». Van
/// juntas y al final de la ficha, debajo de las personas, porque las dos son
/// sobre el grupo y no sobre quién está dentro.
///
/// Una sola para Alpha y para Casa de Fe, como `ReunionDelGrupo` y
/// `EncargadosDelGrupo`: es la misma tarjeta con otro sustantivo.
export function AdministrarElGrupo({
  clase,
  rotulos,
  nombre,
  puedeAdministrar,
  renombrar,
  queSePierde,
  borrar,
}: {
  clase: ClaseDeGrupo;
  /// Cómo se llama este grupo en concreto. Sin esto, la ventana de borrar una
  /// mentoría diría «esta Casa de Fe».
  rotulos: { singular: string; articulo: "la" | "el"; seccionSingular: string };
  nombre: string;
  /// Falso para quien solo puede mirar, y también para quien lleva el grupo sin
  /// ser de dirección: la tarjeta entera no se pinta. Lo que no abre no se
  /// enseña (§12.6).
  puedeAdministrar: boolean;
  renombrar: (nombre: string) => Promise<{ ok: boolean; mensaje?: string }>;
  queSePierde: () => Promise<
    { ok: true; nombre: string; tiene: LoQueTieneElGrupo } | { ok: false; mensaje: string }
  >;
  borrar: (nombreEscrito: string) => Promise<{ ok: boolean; mensaje?: string }>;
}) {
  const router = useRouter();

  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(nombre);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  const [ventana, setVentana] = useState<
    | { estado: "cerrada" }
    | { estado: "cargando" }
    | { estado: "abierta"; tiene: LoQueTieneElGrupo }
  >({ estado: "cerrada" });

  if (!puedeAdministrar) return null;

  return (
    <section className="tarjeta mb-[14px] p-5">
      <h2 className="etiqueta-seccion">
        {rotulos.articulo === "la" ? "ESTA" : "ESTE"} {rotulos.seccionSingular}
      </h2>

      {editando ? (
        <div className="mt-4">
          <label
            htmlFor="nombre-del-grupo"
            className="text-[10px] leading-none font-bold tracking-[.07em] text-[rgba(19,28,36,.42)]"
          >
            CÓMO SE LLAMA
          </label>
          <input
            id="nombre-del-grupo"
            type="text"
            value={borrador}
            maxLength={120}
            autoFocus
            onChange={(e) => setBorrador(e.target.value)}
            className="mt-2 w-full rounded-[8px] border border-[rgba(19,28,36,.2)] px-3 py-2 text-[14px] leading-[1.35] font-semibold text-tinta"
          />
          {error ? (
            <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={guardando}
              onClick={() => {
                setError(null);
                iniciar(async () => {
                  const r = await renombrar(borrador);
                  if (!r.ok) {
                    setError(r.mensaje ?? "No se pudo guardar.");
                    return;
                  }
                  setEditando(false);
                  // `revalidatePath` limpia la caché del servidor pero no
                  // repinta lo que el navegador ya tiene (§12.4).
                  router.refresh();
                });
              }}
              className="boton-primario"
            >
              {guardando ? "Guardando…" : "Guardar el nombre"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBorrador(nombre);
                setError(null);
                setEditando(false);
              }}
              className="boton-secundario"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] leading-none font-bold tracking-[.07em] text-[rgba(19,28,36,.42)]">
                CÓMO SE LLAMA
              </span>
              <p className="mt-1.5 text-[14px] leading-[1.35] font-semibold text-tinta">
                {nombre}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setBorrador(nombre);
                setEditando(true);
              }}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.5)] underline hover:text-tinta"
            >
              Cambiar el nombre
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(19,28,36,.09)] pt-[13px]">
            <p className="min-w-0 flex-1 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
              {clase === "alpha"
                ? "Si este Alpha se creó por error, se puede borrar. No se borra el expediente de nadie."
                : "Si esta Casa de Fe se creó por error, se puede borrar. No se borra el expediente de nadie."}
            </p>
            <button
              type="button"
              disabled={ventana.estado === "cargando"}
              onClick={() => {
                setError(null);
                setVentana({ estado: "cargando" });
                iniciar(async () => {
                  const r = await queSePierde();
                  if (!r.ok) {
                    setError(r.mensaje);
                    setVentana({ estado: "cerrada" });
                    return;
                  }
                  setVentana({ estado: "abierta", tiene: r.tiene });
                });
              }}
              className="cursor-pointer rounded-[8px] border border-rojo bg-transparent px-[13px] py-[9px] text-[12px] leading-none font-bold text-rojo hover:bg-[rgba(190,40,40,.06)]"
            >
              {ventana.estado === "cargando"
                ? "Un momento…"
                : `Borrar ${rotulos.articulo === "la" ? "esta" : "este"} ${rotulos.singular}`}
            </button>
          </div>

          {error ? (
            <p role="alert" className="text-[11.5px] leading-[1.4] font-medium text-rojo">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <VentanaDeBorrado
        // ⚠️ La `key` cambia al abrir y al cerrar **a propósito**: es lo que
        // deja el nombre escrito en blanco cada vez. Hacerlo con un `setEstado`
        // dentro del `useEffect` provoca renders en cascada y lo caza el lint;
        // remontar es la forma de React de reiniciar un estado.
        key={ventana.estado === "abierta" ? "abierta" : "cerrada"}
        abierta={ventana.estado === "abierta"}
        clase={clase}
        rotulos={rotulos}
        nombre={nombre}
        tiene={ventana.estado === "abierta" ? ventana.tiene : null}
        alCerrar={() => setVentana({ estado: "cerrada" })}
        borrar={borrar}
        alBorrar={() => {
          setVentana({ estado: "cerrada" });
          // Se vuelve a la lista: la ficha que se estaba mirando ya no existe,
          // y quedarse en ella daría un 404 (§12.6).
          router.push("/alpha");
        }}
      />
    </section>
  );
}

/// **La confirmación.**
///
/// No pregunta «¿seguro?»: enseña **qué desaparece y qué se queda**, y pide
/// escribir el nombre. Las dos mitades están medidas (ver
/// `borrar-grupo-catalogo.ts`): sin la segunda, un líder no se atreve a borrar
/// la casa de prueba por miedo a perderle el taller a alguien; sin el nombre
/// escrito, el error de verdad —borrar la casa de al lado— se comete igual.
function VentanaDeBorrado({
  abierta,
  clase,
  rotulos,
  nombre,
  tiene,
  alCerrar,
  borrar,
  alBorrar,
}: {
  abierta: boolean;
  clase: ClaseDeGrupo;
  /// Cómo se llama este grupo en concreto. Sin esto, la ventana de borrar una
  /// mentoría diría «esta Casa de Fe».
  rotulos: { singular: string; articulo: "la" | "el"; seccionSingular: string };
  nombre: string;
  tiene: LoQueTieneElGrupo | null;
  alCerrar: () => void;
  borrar: (nombreEscrito: string) => Promise<{ ok: boolean; mensaje?: string }>;
  alBorrar: () => void;
}) {
  const referencia = useRef<HTMLDialogElement>(null);
  const [escrito, setEscrito] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [borrando, iniciar] = useTransition();

  // `<dialog>` nativo: el Escape, el fondo oscuro y el foco atrapado los da el
  // navegador. Mismo patrón que `VentanaDesglose`.
  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (abierta && !dialogo.open) dialogo.showModal();
    if (!abierta && dialogo.open) dialogo.close();
  }, [abierta]);

  const puedeBorrar = nombreCoincide(escrito, nombre);

  return (
    <dialog
      ref={referencia}
      onClose={alCerrar}
      aria-labelledby="titulo-borrar-grupo"
      // En el celular sube desde abajo; en pantalla grande vuelve al centro.
      // ⚠️ No puede ir en un `style` inline o el `sm:` no gana.
      className="mx-0 mt-auto mb-0 max-h-[88vh] w-full max-w-none rounded-t-[20px] border-0 bg-white p-0 shadow-[0_18px_48px_rgba(14,42,78,.3)] backdrop:bg-[rgba(14,42,78,.5)] sm:mx-auto sm:mt-auto sm:mb-auto sm:max-h-[86vh] sm:max-w-[560px] sm:rounded-[16px]"
    >
      <div className="flex max-h-[88vh] flex-col sm:max-h-[86vh]">
        <div className="flex justify-center pt-[9px] sm:hidden">
          <span aria-hidden="true" className="h-1 w-[42px] rounded-[4px] bg-[rgba(19,28,36,.18)]" />
        </div>

        <header className="border-b border-[rgba(19,28,36,.09)] px-[22px] pt-[15px] pb-[14px]">
          <p className="etiqueta-seccion" style={{ letterSpacing: ".16em" }}>
            ESTO NO SE PUEDE DESHACER
          </p>
          <h2
            id="titulo-borrar-grupo"
            className="mt-[9px] font-serif text-[23px] leading-[1.12] font-normal text-tinta"
          >
            Borrar «{nombre}»
          </h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[17px]">
          {tiene ? (
            <>
              <section>
                <h3 className="text-[10px] leading-none font-bold tracking-[.07em] text-rojo">
                  QUÉ DESAPARECE
                </h3>
                <ul className="mt-[9px] flex flex-col gap-[7px]">
                  {loQueSeBorra(clase, tiene, rotulos).map((linea) => (
                    <li
                      key={linea}
                      className="text-[12.5px] leading-[1.5] font-medium text-tinta"
                    >
                      · {linea}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-[17px] rounded-r-[10px] border-l-[3px] border-verde-500 bg-[rgba(22,122,70,.06)] px-4 py-3">
                <h3 className="text-[10px] leading-none font-bold tracking-[.07em] text-verde-700">
                  QUÉ NO SE TOCA
                </h3>
                <ul className="mt-[9px] flex flex-col gap-[7px]">
                  {loQueSeQueda(clase, tiene, rotulos).map((linea) => (
                    <li
                      key={linea}
                      className="text-[12.5px] leading-[1.5] font-medium text-tinta"
                    >
                      · {linea}
                    </li>
                  ))}
                </ul>
              </section>

              <div className="mt-[19px]">
                <label
                  htmlFor="confirmar-nombre"
                  className="text-[12.5px] leading-[1.5] font-semibold text-tinta"
                >
                  Para confirmar, escribe el nombre de{" "}
                  {rotulos.articulo === "la" ? "esta" : "este"} {rotulos.singular}:{" "}
                  <span className="font-mono text-[12px] font-semibold">{nombre}</span>
                </label>
                <input
                  id="confirmar-nombre"
                  type="text"
                  value={escrito}
                  autoComplete="off"
                  onChange={(e) => {
                    setEscrito(e.target.value);
                    setError(null);
                  }}
                  className="mt-2 w-full rounded-[8px] border border-[rgba(19,28,36,.2)] px-3 py-2 text-[14px] leading-[1.35] font-semibold text-tinta"
                />
              </div>

              {error ? (
                <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
                  {error}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-[rgba(19,28,36,.09)] px-[22px] py-[14px]">
          <button
            type="button"
            disabled={!puedeBorrar || borrando}
            onClick={() => {
              setError(null);
              iniciar(async () => {
                const r = await borrar(escrito);
                if (!r.ok) {
                  setError(r.mensaje ?? "No se pudo borrar.");
                  return;
                }
                alBorrar();
              });
            }}
            className="cursor-pointer rounded-[8px] border-0 bg-rojo px-[15px] py-[11px] text-[12.5px] leading-none font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {borrando
              ? "Borrando…"
              : `Sí, borrar ${rotulos.articulo} ${rotulos.singular}`}
          </button>
          <button type="button" onClick={alCerrar} className="boton-secundario">
            Mejor no
          </button>
          {clase === "casa-de-fe" ? (
            <p className="w-full text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
              Si la casa es real y solo quieres que deje de admitir gente, usa
              «Cerrar Casa de Fe» —ahí abajo, con las personas— en vez de
              borrarla.
            </p>
          ) : null}
        </footer>
      </div>
    </dialog>
  );
}
