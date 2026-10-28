"use client";

/// **La rejilla de encuentros y la ventana de registrarlos.**
///
/// Una sola para los cuatro procesos: lo único que cambia entre una Casa de Fe
/// y una mentoría son los rótulos, que llegan de `tipo-de-grupo.ts`, y si el
/// grupo es de una persona o de varias, que lo decide cuánta gente hay.
///
/// El dibujo es el del usuario (27-oct-2026): una fila de casillas por persona,
/// con el globito donde hay observación.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { diaLargo, diaCorto } from "@/lib/dominio";
import {
  CASILLAS_A_LA_VISTA,
  esIndividual,
  nombreDelTema,
  pieDelEncuentro,
  rotuloDeLaRejilla,
  rotuloDelTema,
  temaQueSigue,
  textoDelBotonDeRegistrar,
  ultimaVezQueTocaba,
} from "@/lib/encuentros-catalogo";
import type { RotulosDeGrupo } from "@/lib/tipo-de-grupo";
import type {
  EncuentroDelFormulario,
  ResultadoDeEncuentro,
} from "@/app/(interno)/encuentros/acciones";

export type PersonaDeLaRejilla = {
  learnerId: string;
  nombre: string;
  fase: string;
  /// Si sigue inscrita. Quien se retiró se queda en la rejilla con sus marcas
  /// viejas, porque lo que pasó pasó.
  sigue: boolean;
};

export type EncuentroVista = {
  id: string;
  numero: number;
  dia: string;
  seDio: boolean;
  topic: string | null;
  topicNumber: number | null;
  nota: string | null;
  marcas: { learnerId: string; vino: boolean; nota: string | null }[];
};

type Props = {
  rotulos: RotulosDeGrupo;
  personas: PersonaDeLaRejilla[];
  encuentros: EncuentroVista[];
  temas: { numero: number; nombre: string }[];
  /// Cuándo se reúne, para proponer la fecha.
  reunion: { weekday: number | null; everyNWeeks: number; inicio: string };
  hoy: string;
  puedeEditar: boolean;
  cerrado: boolean;
  registrar: (
    encuentroId: string | null,
    formulario: EncuentroDelFormulario,
  ) => Promise<ResultadoDeEncuentro>;
  quitar: (encuentroId: string) => Promise<ResultadoDeEncuentro>;
};

export function EncuentrosDelGrupo(props: Props) {
  const { rotulos, personas, encuentros, temas, reunion, hoy, puedeEditar } = props;
  const router = useRouter();
  const [abierto, setAbierto] = useState<EncuentroVista | "nuevo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const individual = esIndividual(personas.filter((p) => p.sigue).length);
  const diaQueTocaba = useMemo(
    () => ultimaVezQueTocaba(reunion, hoy),
    [reunion, hoy],
  );
  const yaRegistrado = diaQueTocaba !== null && encuentros.some((e) => e.dia === diaQueTocaba);
  const boton = textoDelBotonDeRegistrar(diaQueTocaba, yaRegistrado, (dia) =>
    diaLargo(new Date(`${dia}T12:00:00Z`)),
  );

  // Las últimas, que son las que se miran. Las viejas siguen en la lista de
  // abajo y en el historial.
  const aLaVista = encuentros.slice(-CASILLAS_A_LA_VISTA);
  const recortados = encuentros.length - aLaVista.length;

  function ejecutar(accion: () => Promise<ResultadoDeEncuentro>) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setAbierto(null);
      router.refresh();
    });
  }

  return (
    <section className="tarjeta mt-[14px] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="etiqueta-seccion">ENCUENTROS</h2>
        <Link
          href="/alpha/encuentros"
          className="text-[11.5px] leading-none font-semibold text-azul-700 underline"
        >
          Ver cómo va mi línea
        </Link>
      </div>

      {puedeEditar && !props.cerrado ? (
        <button
          type="button"
          disabled={enCurso}
          onClick={() => setAbierto("nuevo")}
          className="mt-4 flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-[12px] border-0 bg-verde-700 px-5 py-[15px] text-left"
        >
          <span className="flex flex-col gap-[3px]">
            <span className="text-[14.5px] leading-tight font-bold text-white">
              {boton.titulo}
            </span>
            {boton.pie ? (
              <span className="text-[11.5px] leading-tight font-medium text-[rgba(255,255,255,.82)]">
                {boton.pie}
              </span>
            ) : null}
          </span>
          <span aria-hidden="true" className="text-[17px] leading-none font-bold text-white">
            →
          </span>
        </button>
      ) : null}

      {encuentros.length === 0 ? (
        <p className="mt-4 rounded-[13px] border border-dashed border-[rgba(19,28,36,.16)] p-5 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
          Todavía no hay ningún encuentro apuntado.{" "}
          {puedeEditar
            ? "Al apuntar el primero aparece aquí la fila de casillas."
            : "Cuando quien lo lleva apunte el primero, aparecerá aquí."}
        </p>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto">
            <div className="min-w-max">
              <div className="flex items-end gap-3.5 pb-2">
                <div className="w-[200px] shrink-0 text-[10px] leading-none font-bold tracking-[.12em] text-[rgba(19,28,36,.42)]">
                  {rotuloDeLaRejilla(individual)}
                </div>
                <div className="flex gap-2.5">
                  {aLaVista.map((encuentro) => (
                    <div
                      key={encuentro.id}
                      className="flex w-11 flex-col items-center gap-[3px]"
                    >
                      <span className="text-[9.5px] leading-none font-bold whitespace-nowrap text-[rgba(19,28,36,.42)] uppercase">
                        {diaCorto(new Date(`${encuentro.dia}T12:00:00Z`))}
                      </span>
                      <span className="text-[12.5px] leading-none font-bold text-[rgba(19,28,36,.6)]">
                        {encuentro.numero}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {personas.map((persona) => (
                <div
                  key={persona.learnerId}
                  className="flex items-center gap-3.5 border-t border-[rgba(19,28,36,.07)] py-2"
                >
                  <div className="flex w-[200px] shrink-0 flex-col gap-[2px]">
                    <Link
                      href={`/expediente/${persona.learnerId}`}
                      className="truncate text-[13px] leading-tight font-semibold text-tinta hover:text-azul-700 hover:underline"
                    >
                      {persona.nombre}
                    </Link>
                    <span className="text-[10.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
                      {persona.fase}
                      {persona.sigue ? "" : " · ya no está en el grupo"}
                    </span>
                  </div>
                  <div className="flex gap-2.5">
                    {aLaVista.map((encuentro) => (
                      <Casilla
                        key={encuentro.id}
                        encuentro={encuentro}
                        persona={persona}
                        individual={individual}
                        puedeEditar={puedeEditar}
                        alPulsar={() => setAbierto(encuentro)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {recortados > 0 ? (
            <p className="mt-3 text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
              Se ven los {CASILLAS_A_LA_VISTA} últimos.{" "}
              {recortados === 1
                ? "Hay 1 anterior, en la lista de abajo."
                : `Hay ${recortados} anteriores, en la lista de abajo.`}
            </p>
          ) : null}

          <div className="mt-4 border-t border-[rgba(19,28,36,.07)] pt-4">
            <h3 className="text-[10px] leading-none font-bold tracking-[.12em] text-[rgba(19,28,36,.42)]">
              {rotuloDelTema(rotulos)}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {[...encuentros].reverse().map((encuentro) => {
                const vinieron = encuentro.marcas.filter((m) => m.vino).length;
                return (
                  <li key={encuentro.id}>
                    <button
                      type="button"
                      disabled={enCurso}
                      onClick={() => setAbierto(encuentro)}
                      className="flex cursor-pointer flex-wrap items-baseline gap-2 border-0 bg-transparent p-0 text-left"
                    >
                      <span className="inline-flex h-[21px] min-w-[21px] items-center justify-center rounded-[6px] bg-[rgba(19,28,36,.06)] px-1.5 text-[11.5px] leading-none font-bold text-[rgba(19,28,36,.6)]">
                        {encuentro.numero}
                      </span>
                      <span className="text-[13px] leading-tight font-semibold text-azul-700 underline">
                        {nombreDelTema(encuentro, temas)}
                      </span>
                      <span className="text-[11.5px] leading-tight font-medium text-[rgba(19,28,36,.5)]">
                        {diaLargo(new Date(`${encuentro.dia}T12:00:00Z`))} ·{" "}
                        {pieDelEncuentro(
                          {
                            seDio: encuentro.seDio,
                            vinieron,
                            deCuantos: encuentro.marcas.length,
                          },
                          individual,
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-[11.5px] leading-[1.4] font-medium text-rojo">
          {error}
        </p>
      ) : null}

      {abierto ? (
        <VentanaDelEncuentro
          rotulos={rotulos}
          personas={personas}
          temas={temas}
          individual={individual}
          encuentros={encuentros}
          encuentro={abierto === "nuevo" ? null : abierto}
          diaPropuesto={diaQueTocaba ?? hoy}
          puedeEditar={puedeEditar}
          enCurso={enCurso}
          cerrar={() => {
            setAbierto(null);
            setError(null);
          }}
          guardar={(formulario) =>
            ejecutar(() =>
              props.registrar(abierto === "nuevo" ? null : abierto.id, formulario),
            )
          }
          borrar={
            abierto === "nuevo" ? null : () => ejecutar(() => props.quitar(abierto.id))
          }
        />
      ) : null}
    </section>
  );
}

/// Una casilla: verde con chulo si vino, vacía si faltó, con equis si el
/// encuentro no se dio, y el globito naranja cuando hay observación.
function Casilla({
  encuentro,
  persona,
  individual,
  puedeEditar,
  alPulsar,
}: {
  encuentro: EncuentroVista;
  persona: PersonaDeLaRejilla;
  individual: boolean;
  puedeEditar: boolean;
  alPulsar: () => void;
}) {
  const marca = encuentro.marcas.find((m) => m.learnerId === persona.learnerId);
  const conNota =
    (marca?.nota ?? "").trim().length > 0 ||
    // En un grupo de una sola persona la observación del encuentro **es** la
    // suya: no hay otra fila donde colgarla.
    (individual && (encuentro.nota ?? "").trim().length > 0);

  const rotulo = `Encuentro ${encuentro.numero}, ${encuentro.dia}, ${persona.nombre}`;
  const base =
    "relative flex h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px] p-0";

  let dentro: React.ReactNode = null;
  let clases = "border-[rgba(19,28,36,.18)] bg-white";

  if (!encuentro.seDio) {
    clases = "border-[rgba(19,28,36,.18)] bg-[rgba(19,28,36,.03)]";
    dentro = (
      <span aria-hidden="true" className="text-[15px] leading-none font-bold text-[rgba(19,28,36,.35)]">
        ✕
      </span>
    );
  } else if (marca === undefined) {
    // Nunca se le registró nada: no estaba en el grupo ese día. Un borde
    // cortado dice «no hay dato», que es distinto de «faltó».
    clases = "border-dashed border-[rgba(19,28,36,.2)] bg-[rgba(19,28,36,.025)]";
  } else if (marca.vino) {
    clases = "border-verde-700 bg-verde-100";
    dentro = (
      <span aria-hidden="true" className="text-[17px] leading-none font-bold text-verde-700">
        ✓
      </span>
    );
  }

  const contenido = (
    <>
      {dentro}
      {conNota ? (
        <span
          aria-hidden="true"
          className="absolute -right-[5px] -bottom-[5px] flex h-[17px] w-[17px] items-center justify-center rounded-full border-2 border-white bg-ambar-barra text-[8px] leading-none font-bold text-white"
        >
          ●
        </span>
      ) : null}
    </>
  );

  if (!puedeEditar) {
    return (
      <span role="img" aria-label={rotulo} className={`${base} ${clases}`}>
        {contenido}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`${rotulo}. Abrir para corregir.`}
      onClick={alPulsar}
      className={`${base} ${clases} cursor-pointer`}
    >
      {contenido}
    </button>
  );
}

function VentanaDelEncuentro({
  rotulos,
  personas,
  temas,
  individual,
  encuentros,
  encuentro,
  diaPropuesto,
  puedeEditar,
  enCurso,
  cerrar,
  guardar,
  borrar,
}: {
  rotulos: RotulosDeGrupo;
  personas: PersonaDeLaRejilla[];
  temas: { numero: number; nombre: string }[];
  individual: boolean;
  encuentros: EncuentroVista[];
  encuentro: EncuentroVista | null;
  diaPropuesto: string;
  puedeEditar: boolean;
  enCurso: boolean;
  cerrar: () => void;
  guardar: (formulario: EncuentroDelFormulario) => void;
  borrar: (() => void) | null;
}) {
  const conCartilla = rotulos.conTaller && temas.length > 0;
  const sugerido = temaQueSigue(encuentros, temas.length);

  const [dia, setDia] = useState(encuentro?.dia ?? diaPropuesto);
  const [seDio, setSeDio] = useState(encuentro?.seDio ?? true);
  const [nota, setNota] = useState(encuentro?.nota ?? "");
  const [temaNumero, setTemaNumero] = useState<number | null>(
    encuentro ? encuentro.topicNumber : conCartilla ? sugerido : null,
  );
  const [temaEscrito, setTemaEscrito] = useState(encuentro?.topic ?? "");
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  // ⚠️ **Todas marcadas como que vinieron.** Es lo que convierte el registro en
  // un toque: lo normal es que vengan, así que lo que se marca es la falta.
  const [marcas, setMarcas] = useState<
    Record<string, { vino: boolean; nota: string }>
  >(() => {
    const inicial: Record<string, { vino: boolean; nota: string }> = {};
    for (const persona of personas) {
      const previa = encuentro?.marcas.find((m) => m.learnerId === persona.learnerId);
      // Quien ya no está en el grupo no se marca solo: si no estaba, no vino.
      inicial[persona.learnerId] = {
        vino: previa ? previa.vino : encuentro ? false : persona.sigue,
        nota: previa?.nota ?? "",
      };
    }
    return inicial;
  });
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null);

  const dentro = personas.filter((p) => p.sigue || encuentro?.marcas.some((m) => m.learnerId === p.learnerId));
  const vinieron = dentro.filter((p) => marcas[p.learnerId]?.vino).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(19,28,36,.45)] p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={encuentro ? `Encuentro ${encuentro.numero}` : "Registrar el encuentro"}
        className="my-6 w-full max-w-[620px] rounded-[18px] bg-white p-6 sm:p-7"
      >
        <p className="text-[10px] leading-none font-bold tracking-[.16em] text-[rgba(19,28,36,.42)]">
          {encuentro ? `ENCUENTRO ${encuentro.numero}` : "ENCUENTRO NUEVO"}
        </p>
        <h2 className="mt-1.5 text-[21px] leading-tight font-bold text-tinta">
          {encuentro ? "Corregir el encuentro" : "Registrar el encuentro"}
        </h2>

        <div className="mt-5 flex flex-col gap-1.5">
          <label htmlFor="encuentro-dia" className="etiqueta-campo">
            CUÁNDO SE DIO
          </label>
          <input
            id="encuentro-dia"
            type="date"
            value={dia}
            disabled={!puedeEditar}
            onChange={(evento) => setDia(evento.target.value)}
            className="campo mt-0"
          />
        </div>

        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor="encuentro-tema" className="etiqueta-campo">
            {rotuloDelTema(rotulos)}
          </label>
          {conCartilla ? (
            <select
              id="encuentro-tema"
              value={temaNumero === null ? "" : String(temaNumero)}
              disabled={!puedeEditar}
              onChange={(evento) =>
                setTemaNumero(evento.target.value === "" ? null : Number(evento.target.value))
              }
              className="campo mt-0"
            >
              <option value="">Otro tema, lo escribo abajo</option>
              {temas.map((tema) => (
                <option key={tema.numero} value={tema.numero}>
                  {tema.numero} · {tema.nombre}
                </option>
              ))}
            </select>
          ) : null}
          {!conCartilla || temaNumero === null ? (
            <input
              id={conCartilla ? "encuentro-tema-escrito" : "encuentro-tema"}
              value={temaEscrito}
              disabled={!puedeEditar}
              onChange={(evento) => setTemaEscrito(evento.target.value)}
              placeholder="De qué se habló"
              className="campo mt-0"
            />
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="etiqueta-campo">
              {individual ? "¿SE DIO?" : "QUIÉN VINO"}
            </span>
            {!individual && seDio ? (
              <span className="text-[11.5px] leading-none font-medium text-[rgba(19,28,36,.5)]">
                {vinieron} de {dentro.length}. Quita la marca a quien faltó.
              </span>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!puedeEditar}
              onClick={() => setSeDio(true)}
              className={`min-h-11 flex-1 cursor-pointer rounded-[11px] border-[1.5px] px-3 py-2.5 text-[13px] font-bold ${
                seDio
                  ? "border-verde-700 bg-verde-100 text-verde-700"
                  : "border-[rgba(19,28,36,.18)] bg-white text-[rgba(19,28,36,.55)]"
              }`}
            >
              Se dio
            </button>
            <button
              type="button"
              disabled={!puedeEditar}
              onClick={() => setSeDio(false)}
              className={`min-h-11 flex-1 cursor-pointer rounded-[11px] border-[1.5px] px-3 py-2.5 text-[13px] font-bold ${
                seDio
                  ? "border-[rgba(19,28,36,.18)] bg-white text-[rgba(19,28,36,.55)]"
                  : "border-rojo bg-rojo-fondo text-rojo"
              }`}
            >
              No se pudo
            </button>
          </div>

          {seDio && !individual ? (
            <ul className="mt-1 overflow-hidden rounded-[13px] border border-[rgba(19,28,36,.09)]">
              {dentro.map((persona) => {
                const marca = marcas[persona.learnerId] ?? { vino: false, nota: "" };
                return (
                  <li
                    key={persona.learnerId}
                    className="border-b border-[rgba(19,28,36,.07)] last:border-b-0"
                  >
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      <button
                        type="button"
                        disabled={!puedeEditar}
                        aria-label={
                          marca.vino
                            ? `Quitar la marca a ${persona.nombre}`
                            : `Marcar que vino ${persona.nombre}`
                        }
                        aria-pressed={marca.vino}
                        onClick={() =>
                          setMarcas((previo) => ({
                            ...previo,
                            [persona.learnerId]: { ...marca, vino: !marca.vino },
                          }))
                        }
                        className={`flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[9px] border-[1.5px] p-0 ${
                          marca.vino
                            ? "border-verde-700 bg-verde-100 text-verde-700"
                            : "border-[rgba(19,28,36,.18)] bg-white text-transparent"
                        }`}
                      >
                        <span aria-hidden="true" className="text-[14px] leading-none font-bold">
                          ✓
                        </span>
                      </button>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] leading-tight font-semibold text-tinta">
                          {persona.nombre}
                        </span>
                        <span className="block text-[11px] leading-tight font-medium text-[rgba(19,28,36,.5)]">
                          {persona.fase}
                          {persona.sigue ? "" : " · ya no está en el grupo"}
                          {marca.vino ? "" : " · no vino"}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={!puedeEditar}
                        aria-label={`Dejar una observación sobre ${persona.nombre}`}
                        onClick={() =>
                          setNotaAbierta(
                            notaAbierta === persona.learnerId ? null : persona.learnerId,
                          )
                        }
                        className={`flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border px-2.5 text-[11.5px] leading-none font-bold ${
                          marca.nota.trim()
                            ? "border-[rgba(201,123,44,.35)] bg-ambar-chip text-ambar-texto"
                            : "border-[rgba(19,28,36,.18)] bg-white text-[rgba(19,28,36,.5)]"
                        }`}
                      >
                        <span aria-hidden="true">✎</span>
                        {marca.nota.trim() ? "Tiene nota" : ""}
                      </button>
                    </div>
                    {notaAbierta === persona.learnerId ? (
                      <div className="px-3.5 pb-3">
                        <textarea
                          value={marca.nota}
                          disabled={!puedeEditar}
                          onChange={(evento) =>
                            setMarcas((previo) => ({
                              ...previo,
                              [persona.learnerId]: { ...marca, nota: evento.target.value },
                            }))
                          }
                          rows={2}
                          placeholder={`Observación sobre ${persona.nombre}`}
                          className="campo mt-0 w-full"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
              {dentro.length === 0 ? (
                <li className="px-3.5 py-3 text-[12.5px] leading-snug font-medium text-[rgba(19,28,36,.5)]">
                  Todavía no hay nadie inscrito, así que no hay a quién marcar. El
                  encuentro se guarda igual.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <label htmlFor="encuentro-nota" className="etiqueta-campo">
            OBSERVACIÓN DEL ENCUENTRO
          </label>
          <textarea
            id="encuentro-nota"
            value={nota}
            disabled={!puedeEditar}
            onChange={(evento) => setNota(evento.target.value)}
            rows={3}
            placeholder="Qué pasó, quién necesita seguimiento, lo que haya que contar."
            className="campo mt-0"
          />
          <span className="text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Es opcional, y la ve quien puede ver el grupo.
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[rgba(19,28,36,.09)] pt-5">
          {puedeEditar ? (
            <button
              type="button"
              disabled={enCurso}
              onClick={() =>
                guardar({
                  dia,
                  temaNumero: conCartilla ? temaNumero : null,
                  temaEscrito: conCartilla && temaNumero !== null ? "" : temaEscrito,
                  seDio,
                  nota,
                  marcas: dentro.map((persona) => ({
                    learnerId: persona.learnerId,
                    vino: marcas[persona.learnerId]?.vino ?? false,
                    nota: marcas[persona.learnerId]?.nota ?? "",
                  })),
                })
              }
              className="boton-primario"
            >
              {enCurso ? "Guardando…" : "Guardar el encuentro"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={cerrar}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] leading-none font-semibold text-[rgba(19,28,36,.5)] underline"
          >
            {puedeEditar ? "Cancelar" : "Cerrar"}
          </button>

          {borrar && puedeEditar ? (
            <span className="ml-auto">
              {confirmandoBorrado ? (
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={borrar}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] leading-none font-bold text-rojo underline"
                >
                  Sí, borrarlo
                </button>
              ) : (
                <button
                  type="button"
                  disabled={enCurso}
                  onClick={() => setConfirmandoBorrado(true)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.4)] underline hover:text-rojo"
                >
                  Borrar este encuentro
                </button>
              )}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
