"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  candidatosDisponibles,
  LARGO_MINIMO_NOTA,
  type GrupoParaPermiso,
} from "@/lib/encargados-catalogo";
import { ETIQUETA_ROL } from "@/lib/roles-catalogo";
import { diaCorto } from "@/lib/dominio";
import type { Role } from "@iglesia/prisma-client";

export type CuentaQueLleva = {
  id: string;
  fullName: string;
  role: string;
};

export type EncargadoVista = CuentaQueLleva & {
  /// Desde cuándo lleva el grupo. Es lo que distingue a quien entró ayer de
  /// quien lleva la casa desde que se abrió.
  desde: Date;
};

type Resultado = { ok: true } | { ok: false; mensaje: string };

/// **Quiénes llevan el grupo**, en la ficha de un Alpha o de una Casa de Fe.
///
/// **Por qué existe.** Hasta el 21-sep-2026 un grupo tenía UN solo dueño, y el
/// equipo venía metiendo al segundo en el NOMBRE: «Casa de Fe Joiner & Maria
/// Isabel», «Oscar & Dana», «Jaime & Geraldine». Seis grupos nombrados en
/// pareja porque el modelo no daba para más. Y el líder registrado no siempre
/// era quien lleva el grupo: 7 de las 16 casas figuraban a nombre de quien las
/// abrió, sin forma de moverlo.
///
/// El componente es el MISMO en los dos tipos de grupo a propósito: lo único
/// que cambia son las acciones que recibe. Dos copias se habrían desviado a la
/// primera corrección.
export function EncargadosDelGrupo({
  clase,
  lider,
  encargados,
  puedeEditar,
  cuentasQuePuedenLlevar,
  cambiarLider,
  anadirEncargado,
  quitarEncargado,
}: {
  clase: "alpha" | "casa-de-fe";
  lider: CuentaQueLleva;
  encargados: EncargadoVista[];
  puedeEditar: boolean;
  cuentasQuePuedenLlevar: () => Promise<CuentaQueLleva[]>;
  cambiarLider: (nuevoLiderId: string, nota: string) => Promise<Resultado>;
  anadirEncargado: (userId: string) => Promise<Resultado>;
  quitarEncargado: (userId: string) => Promise<Resultado>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cuentas, setCuentas] = useState<CuentaQueLleva[] | null>(null);
  const [nuevoLiderId, setNuevoLiderId] = useState(lider.id);
  const [nota, setNota] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, iniciar] = useTransition();

  const elGrupo = clase === "alpha" ? "el Alpha" : "la Casa de Fe";
  const loLleva = clase === "alpha" ? "lo lleva" : "la lleva";

  const paraFiltrar: GrupoParaPermiso = {
    leaderId: lider.id,
    coLeaderIds: encargados.map((encargado) => encargado.id),
  };

  /// Las cuentas se piden al ABRIR el panel, no al cargar la ficha. Con
  /// `PrismaPg max:1` cada consulta de la página es una latencia que paga todo
  /// el mundo, y esta lista solo la necesita quien va a cambiar algo.
  function abrirPanel() {
    setAbierto(true);
    setError(null);
    if (cuentas) return;
    iniciar(async () => {
      try {
        setCuentas(await cuentasQuePuedenLlevar());
      } catch {
        setError("No se pudo cargar la lista de personas. Vuelve a intentarlo.");
      }
    });
  }

  function ejecutar(accion: () => Promise<Resultado>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      alTerminar?.();
      // `revalidatePath` limpia la caché del servidor pero NO repinta lo que el
      // navegador ya tiene: es la regla del 11-sep-2026.
      router.refresh();
    });
  }

  const disponibles = candidatosDisponibles(cuentas ?? [], paraFiltrar).filter(
    (cuenta) =>
      busqueda.trim().length < 2 ||
      cuenta.fullName.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  const notaCorta = nota.trim().length < LARGO_MINIMO_NOTA;
  const mismoLider = nuevoLiderId === lider.id;

  return (
    <section className="mb-[14px] rounded-[14px] border border-borde-tarjeta bg-papel p-[22px_24px]">
      <div className="flex items-start gap-4">
        <h2 className="flex-grow text-[11.5px] font-bold tracking-[.09em] text-tinta-55">
          QUIÉNES {clase === "alpha" ? "LO LLEVAN" : "LA LLEVAN"}
        </h2>
        {puedeEditar && !abierto && (
          <button
            type="button"
            onClick={abrirPanel}
            className="shrink-0 border-b border-azul-700/35 pb-px text-[13px] font-semibold text-azul-700"
          >
            Cambiar quién {loLleva}
          </button>
        )}
        {abierto && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="shrink-0 border-b border-tinta-42 pb-px text-[13px] font-semibold text-tinta-55"
          >
            Cancelar
          </button>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-[9px]">
        <Renglon cuenta={lider} etiqueta="LÍDER" tono="azul" />
        {encargados.map((encargado) => (
          <Renglon
            key={encargado.id}
            cuenta={encargado}
            etiqueta="ENCARGADO"
            tono="verde"
            desde={encargado.desde}
            alQuitar={
              puedeEditar && abierto
                ? () => ejecutar(() => quitarEncargado(encargado.id))
                : undefined
            }
            ocupado={trabajando}
          />
        ))}
      </ul>

      {encargados.length > 0 && (
        <p className="mt-[14px] text-[12.5px] leading-[1.5] text-tinta-55">
          {encargados.length === 1 ? "Los dos administran" : "Todos administran"}{" "}
          {elGrupo} por igual: inscriben y retiran gente, cambian el día, la hora
          y el lugar, y {elGrupo} les aparece en su propio calendario.
        </p>
      )}

      {abierto && (
        <div className="mt-5 flex flex-col gap-5 border-t border-borde-tarjeta pt-5">
          <div className="flex flex-col gap-[10px]">
            <label
              htmlFor="nuevo-lider"
              className="text-[13.5px] font-semibold"
            >
              Quién es el líder
            </label>
            <select
              id="nuevo-lider"
              value={nuevoLiderId}
              onChange={(e) => setNuevoLiderId(e.target.value)}
              disabled={trabajando || !cuentas}
              className="w-full rounded-[10px] border-[1.5px] border-borde-control bg-white px-[14px] py-[13px] text-[14.5px] font-semibold text-tinta"
            >
              {(cuentas ?? [lider]).map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.fullName} — {etiquetaDe(cuenta.role)}
                </option>
              ))}
            </select>
            <p className="text-[12.5px] leading-[1.5] text-tinta-55">
              Solo aparecen las cuentas que pueden llevar {elGrupo}. Si cambia el
              líder, <strong className="font-semibold text-tinta">el anterior
              pasa a la lista de encargados</strong> y no pierde el grupo — si
              hay que sacarlo, se le quita arriba.
            </p>

            {!mismoLider && (
              <>
                <label htmlFor="nota-lider" className="mt-1 text-[13.5px] font-semibold">
                  Por qué cambia
                </label>
                <textarea
                  id="nota-lider"
                  rows={3}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  disabled={trabajando}
                  placeholder="Joiner se muda y Maria Isabel sigue con la casa…"
                  className="w-full resize-y rounded-[10px] border-[1.5px] border-borde-control bg-white px-[14px] py-[13px] text-[14.5px] leading-[1.5] text-tinta"
                />
                <p className="text-[12.5px] leading-[1.5] text-tinta-55">
                  Queda en la bitácora con tu nombre y la fecha. Es lo único que
                  le explica el cambio a quien abra el grupo dentro de seis
                  meses.
                </p>
                <div>
                  <button
                    type="button"
                    disabled={trabajando || notaCorta}
                    onClick={() =>
                      ejecutar(
                        () => cambiarLider(nuevoLiderId, nota),
                        () => {
                          setNota("");
                          setCuentas(null);
                          setAbierto(false);
                        },
                      )
                    }
                    className="rounded-[10px] bg-azul-900 px-6 py-[14px] text-[14px] font-semibold text-white disabled:opacity-45"
                  >
                    {trabajando ? "Guardando…" : "Cambiar el líder"}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-borde-tarjeta pt-5">
            <div className="flex flex-col gap-1">
              <span className="text-[13.5px] font-semibold">
                Quién más {loLleva}
              </span>
              <span className="text-[12.5px] leading-[1.45] text-tinta-55">
                Pueden ser dos o más. Cada encargado administra {elGrupo} igual
                que el líder.
              </span>
            </div>

            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar a quién añadir como encargado"
              placeholder="Buscar por nombre…"
              className="w-full rounded-[10px] border-[1.5px] border-borde-control bg-white px-[14px] py-[13px] text-[14.5px] text-tinta"
            />

            {!cuentas && trabajando && (
              <p className="text-[13px] text-tinta-55">Cargando la lista…</p>
            )}
            {cuentas && disponibles.length === 0 && (
              <p className="text-[13px] leading-[1.5] text-tinta-55">
                {busqueda.trim().length >= 2
                  ? "Nadie con ese nombre puede llevar este grupo."
                  : `Ya están todas las cuentas que pueden llevar ${elGrupo}. Para que alguien más salga aquí, hay que darle el permiso en Administración.`}
              </p>
            )}
            {disponibles.length > 0 && (
              <ul className="flex flex-col rounded-[11px] border border-borde-tarjeta bg-white p-[9px]">
                {disponibles.slice(0, 8).map((cuenta, indice) => (
                  <li
                    key={cuenta.id}
                    className={`flex items-center gap-3 px-2 py-2 ${indice > 0 ? "border-t border-borde-tarjeta" : ""}`}
                  >
                    <div className="flex flex-grow flex-col gap-0.5">
                      <span className="text-[14.5px] leading-[1.2] font-semibold">
                        {cuenta.fullName}
                      </span>
                      <span className="text-[12.5px] leading-[1.2] text-tinta-55">
                        {etiquetaDe(cuenta.role)}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={trabajando}
                      onClick={() => ejecutar(() => anadirEncargado(cuenta.id))}
                      className="shrink-0 rounded-lg bg-verde-700 px-[15px] py-2 text-[12.5px] font-semibold text-white disabled:opacity-45"
                    >
                      Añadir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-[10px] bg-rojo-fondo px-[14px] py-3 text-[13px] leading-[1.5] text-rojo">
          {error}
        </p>
      )}
    </section>
  );
}

function Renglon({
  cuenta,
  etiqueta,
  tono,
  desde,
  alQuitar,
  ocupado,
}: {
  cuenta: CuentaQueLleva;
  etiqueta: string;
  tono: "azul" | "verde";
  /// Desde cuándo lleva el grupo, solo en los encargados: el líder lo lleva
  /// desde que se abrió, y eso ya lo dice el encabezado de la ficha.
  desde?: Date;
  alQuitar?: () => void;
  ocupado?: boolean;
}) {
  const colores =
    tono === "azul"
      ? "bg-azul-100 text-azul-900"
      : "bg-verde-100 text-bosque-900";

  return (
    <li className="flex items-center gap-[14px] rounded-[11px] border border-borde-tarjeta bg-white px-4 py-[13px]">
      <span
        aria-hidden="true"
        className={`flex size-[38px] shrink-0 items-center justify-center rounded-full text-[13.5px] font-bold ${colores}`}
      >
        {iniciales(cuenta.fullName)}
      </span>
      <div className="flex flex-grow flex-col gap-[3px]">
        <span className="text-[15px] leading-[1.2] font-semibold">
          {cuenta.fullName}
        </span>
        <span className="text-[12.5px] leading-[1.2] text-tinta-55">
          {etiquetaDe(cuenta.role)}
          {desde ? ` · encargado desde el ${diaCorto(desde)}` : ""}
        </span>
      </div>
      {alQuitar ? (
        <button
          type="button"
          onClick={alQuitar}
          disabled={ocupado}
          className="shrink-0 rounded-lg border border-rojo/35 px-[13px] py-[7px] text-[12.5px] font-semibold text-rojo disabled:opacity-45"
        >
          Quitar
        </button>
      ) : (
        <span
          className={`shrink-0 rounded-full px-[11px] py-[5px] text-[10.5px] font-bold tracking-[.07em] ${colores}`}
        >
          {etiqueta}
        </span>
      )}
    </li>
  );
}

/// Las iniciales para el círculo. Con un solo nombre basta la primera letra;
/// nunca se pinta vacío, que dejaría un círculo de color sin sentido.
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "·";
  if (partes.length === 1) return partes[0].slice(0, 1).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function etiquetaDe(role: string): string {
  return ETIQUETA_ROL[role as Role] ?? role;
}
