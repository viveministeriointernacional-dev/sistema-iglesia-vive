"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarExcepcionDeVista } from "../vistas/acciones";
import {
  OPCIONES_DE_EXCEPCION,
  type OpcionDeExcepcion,
  type VistaId,
} from "@/lib/vistas-catalogo";

export type VistaDeLaCuenta = {
  id: VistaId;
  nombre: string;
  /// Lo que le daría su rol, sin excepción de por medio.
  porSuRol: boolean;
  /// La excepción guardada: `null` = sigue a su rol.
  excepcion: boolean | null;
};

export function VistasDeLaCuenta({
  userId,
  vistas,
}: {
  userId: string;
  vistas: VistaDeLaCuenta[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(vistas);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function elegir(vista: VistaId, opcion: OpcionDeExcepcion) {
    const valor = opcion === "rol" ? null : opcion === "si";
    const antes = estado;
    setEstado((v) =>
      v.map((f) => (f.id === vista ? { ...f, excepcion: valor } : f)),
    );
    setError(null);
    iniciar(async () => {
      const r = await guardarExcepcionDeVista(userId, vista, valor);
      if (!r.ok) {
        setEstado(antes);
        setError(r.mensaje);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="tarjeta p-5">
      <h2 className="etiqueta-seccion">QUÉ PANTALLAS VE ESTA CUENTA</h2>
      <p className="mt-2 text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
        Lo normal es que siga a su rol. Aquí se le enciende o se le apaga algo
        suelto, sin moverles nada a los demás de su mismo perfil.
      </p>

      {error ? (
        <p className="mt-3 rounded-[10px] bg-rojo-fondo px-4 py-3 text-[12.5px] leading-[1.5] font-semibold text-rojo">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col">
        {estado.map((v) => {
          const actual: OpcionDeExcepcion =
            v.excepcion === null ? "rol" : v.excepcion ? "si" : "no";
          return (
            <div
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(19,28,36,.09)] py-3 first:border-t-0"
            >
              <div>
                <div className="text-[13.5px] leading-[1.25] font-semibold text-tinta">
                  {v.nombre}
                </div>
                <div className="mt-[5px] text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
                  {textoDeEstado(actual, v.porSuRol)}
                </div>
              </div>

              <div
                role="group"
                aria-label={v.nombre}
                className="inline-flex overflow-hidden rounded-[9px] border border-[rgba(19,28,36,.18)]"
              >
                {OPCIONES_DE_EXCEPCION.map((o) => {
                  const activo = actual === o.valor;
                  const color =
                    o.valor === "si"
                      ? "bg-verde-600 text-white"
                      : o.valor === "no"
                        ? "bg-rojo text-white"
                        : "bg-azul-900 text-white";
                  return (
                    <button
                      key={o.valor}
                      type="button"
                      disabled={guardando}
                      onClick={() => elegir(v.id, o.valor)}
                      aria-pressed={activo}
                      className={`cursor-pointer border-0 border-l border-[rgba(19,28,36,.18)] px-3 py-[7px] text-[11.5px] leading-none font-semibold first:border-l-0 disabled:opacity-50 ${
                        activo ? color : "bg-white text-[rgba(19,28,36,.55)]"
                      }`}
                    >
                      {o.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/// Dice en qué queda la cuenta, **cruzando la excepción con lo que da su rol**.
/// Sin este cruce, «Como su rol» no diría si la ve o no, que es justo lo que
/// hay que saber para decidir.
function textoDeEstado(actual: OpcionDeExcepcion, porSuRol: boolean): string {
  if (actual === "rol") {
    return porSuRol ? "Sigue a su rol · la ve" : "Sigue a su rol · no la ve";
  }
  if (actual === "si") {
    return porSuRol
      ? "Encendida a mano · su rol ya se la daba"
      : "Encendida solo para esta cuenta";
  }
  return porSuRol
    ? "Apagada solo para esta cuenta"
    : "Apagada a mano · su rol tampoco se la daba";
}

