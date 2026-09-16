"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@iglesia/prisma-client";
import { ETIQUETA_ROL } from "@/lib/roles-catalogo";
import { VISTAS, type VistaId } from "@/lib/vistas-catalogo";
import { guardarVistaDeRol } from "./acciones";

export type EstadoInicial = Record<string, Record<string, boolean>>;

export function MatrizDeVistas({
  roles,
  inicial,
}: {
  roles: { id: Role; cuentas: number }[];
  inicial: EstadoInicial;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(inicial);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rolPrevia, setRolPrevia] = useState<Role>(roles[0]?.id ?? Role.PASTOR);

  function alternar(vista: VistaId, rol: Role) {
    const nuevo = !estado[vista]?.[rol];
    // Se pinta ya y se guarda después: si falla, se devuelve al valor anterior.
    setEstado((v) => ({ ...v, [vista]: { ...v[vista], [rol]: nuevo } }));
    setError(null);
    iniciar(async () => {
      const r = await guardarVistaDeRol(vista, rol, nuevo);
      if (!r.ok) {
        setEstado((v) => ({ ...v, [vista]: { ...v[vista], [rol]: !nuevo } }));
        setError(r.mensaje);
        return;
      }
      // `revalidatePath` limpia la caché del servidor pero NO repinta lo que el
      // navegador ya tiene (regla del 11-sep-2026).
      router.refresh();
    });
  }

  const encendidasDe = (rol: Role) =>
    VISTAS.filter((v) => estado[v.id]?.[rol]);

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="rounded-[10px] bg-rojo-fondo px-4 py-3 text-[12.5px] leading-[1.5] font-semibold text-rojo">
          {error}
        </p>
      ) : null}

      <section className="tarjeta p-5">
        <h2 className="etiqueta-seccion">ASÍ LE QUEDA LA BARRA SUPERIOR</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRolPrevia(r.id)}
              aria-pressed={rolPrevia === r.id}
              className={`cursor-pointer rounded-[20px] px-[13px] py-[7px] text-[12px] leading-none font-semibold ${
                rolPrevia === r.id
                  ? "border-[1.5px] border-azul-900 bg-azul-050 text-tinta"
                  : "border border-[rgba(19,28,36,.18)] bg-white text-tinta"
              }`}
            >
              {ETIQUETA_ROL[r.id]}{" "}
              <span className="font-semibold text-[rgba(19,28,36,.42)]">
                {r.cuentas}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-[5px] rounded-[10px] bg-azul-900 px-[13px] py-[11px]">
          <span className="mr-2 font-serif text-[13px] font-semibold text-white">
            Iglesia Vive
          </span>
          {encendidasDe(rolPrevia).length === 0 ? (
            <span className="text-[12px] leading-none font-semibold text-white/50 italic">
              sin ninguna pestaña — entra y no tiene a dónde ir
            </span>
          ) : (
            encendidasDe(rolPrevia).map((v) => (
              <span
                key={v.id}
                className="rounded-[7px] bg-white/10 px-[10px] py-[6px] text-[12px] leading-none font-semibold text-white/75"
              >
                {v.nombre}
              </span>
            ))
          )}
          {rolPrevia === Role.ADMIN ? (
            <span className="rounded-[7px] bg-white/10 px-[10px] py-[6px] text-[12px] leading-none font-semibold text-white/75">
              Administración
            </span>
          ) : null}
        </div>
      </section>

      <section className="tarjeta p-5">
        <h2 className="etiqueta-seccion">CADA VISTA, CADA PERFIL</h2>
        <div className="-mx-5 mt-4 overflow-x-auto px-5">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className="pb-3 text-left text-[10px] leading-none font-bold tracking-[.07em] text-[rgba(19,28,36,.42)]">
                  VISTA
                </th>
                {roles.map((r) => (
                  <th
                    key={r.id}
                    className="px-[6px] pb-3 text-center text-[10px] leading-none font-bold tracking-[.07em] whitespace-nowrap text-[rgba(19,28,36,.42)]"
                  >
                    {ETIQUETA_ROL[r.id].toUpperCase()}
                    <span className="mt-[3px] block text-[10px] font-semibold tracking-normal">
                      {r.cuentas}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VISTAS.map((v, i) => {
                const abreGrupo =
                  i === 0 || VISTAS[i - 1].grupo !== v.grupo;
                return (
                  <FilaDeVista
                    key={v.id}
                    vista={v}
                    roles={roles}
                    estado={estado}
                    guardando={guardando}
                    alternar={alternar}
                    cabecera={
                      abreGrupo
                        ? v.grupo === "menu"
                          ? "EN LA BARRA SUPERIOR"
                          : "HOY VIVEN DENTRO DE ADMINISTRACIÓN"
                        : null
                    }
                    columnas={roles.length + 1}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FilaDeVista({
  vista,
  roles,
  estado,
  guardando,
  alternar,
  cabecera,
  columnas,
}: {
  vista: (typeof VISTAS)[number];
  roles: { id: Role; cuentas: number }[];
  estado: EstadoInicial;
  guardando: boolean;
  alternar: (vista: VistaId, rol: Role) => void;
  cabecera: string | null;
  columnas: number;
}) {
  const tonoAlcance =
    vista.alcance === "todo"
      ? "bg-ambar-fondo text-ambar-texto"
      : vista.alcance === "rama"
        ? "bg-azul-050 text-azul-700"
        : "bg-verde-050 text-verde-600";

  return (
    <>
      {cabecera ? (
        <tr>
          <td colSpan={columnas} className="px-[6px] pt-5 pb-1">
            <span className="rounded-[20px] bg-azul-050 px-[9px] py-[4px] text-[10px] leading-none font-bold tracking-[.09em] text-azul-700">
              {cabecera}
            </span>
          </td>
        </tr>
      ) : null}
      <tr className="border-t border-[rgba(19,28,36,.09)]">
        <td className="min-w-[230px] px-[6px] py-[11px]">
          <div className="text-[13.5px] leading-[1.25] font-semibold text-tinta">
            {vista.nombre}
          </div>
          <div className="mt-[3px] font-mono text-[11px] text-[rgba(19,28,36,.42)]">
            {vista.ruta}
          </div>
          <span
            className={`mt-[6px] inline-block rounded-[20px] px-[7px] py-[3px] text-[10px] leading-none font-bold tracking-[.04em] ${tonoAlcance}`}
          >
            {vista.alcanceDetalle.toUpperCase()}
          </span>
        </td>
        {roles.map((r) => {
          const on = estado[vista.id]?.[r.id] ?? false;
          return (
            <td key={r.id} className="px-[6px] py-[11px] text-center">
              <button
                type="button"
                disabled={guardando}
                onClick={() => alternar(vista.id, r.id)}
                aria-pressed={on}
                aria-label={`${vista.nombre} para ${ETIQUETA_ROL[r.id]}`}
                className={`relative inline-block h-[23px] w-[40px] cursor-pointer rounded-[20px] align-middle disabled:opacity-50 ${
                  on
                    ? "border border-azul-900 bg-azul-900"
                    : "border border-[rgba(19,28,36,.18)] bg-white"
                }`}
              >
                <span
                  className={`absolute top-[2px] h-[17px] w-[17px] rounded-full transition-transform ${
                    on
                      ? "left-[2px] translate-x-[17px] bg-white"
                      : "left-[2px] bg-[rgba(19,28,36,.3)]"
                  }`}
                />
              </button>
            </td>
          );
        })}
      </tr>
    </>
  );
}
