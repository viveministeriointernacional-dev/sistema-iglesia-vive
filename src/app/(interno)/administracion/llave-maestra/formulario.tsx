"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LARGO_MINIMO_LLAVE } from "@/lib/llave-maestra-catalogo";
import { cambiarLlaveMaestra, quitarLlaveMaestra } from "../acciones";

/// Poner, cambiar o quitar la llave maestra. El valor se escribe dos veces
/// porque después nadie lo puede volver a ver: si quedó con un dedazo, la única
/// manera de saberlo sería quedarse fuera de todos los perfiles.
export function FormularioLlaveMaestra({ configurada }: { configurada: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const [enCurso, iniciar] = useTransition();

  const corta = valor.trim().length < LARGO_MINIMO_LLAVE;
  const noCoinciden = valor !== repetida;

  function guardar() {
    setError(null);
    setListo(null);
    if (noCoinciden) {
      setError("Las dos casillas no dicen lo mismo.");
      return;
    }
    iniciar(async () => {
      const resultado = await cambiarLlaveMaestra(valor);
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setValor("");
      setRepetida("");
      setListo(
        configurada
          ? "Llave maestra cambiada. La anterior ya no sirve."
          : "Llave maestra configurada.",
      );
      router.refresh();
    });
  }

  function quitar() {
    setError(null);
    setListo(null);
    iniciar(async () => {
      const resultado = await quitarLlaveMaestra();
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      setConfirmandoQuitar(false);
      setListo("Ya no hay llave maestra. A cada perfil se entra solo con su contraseña.");
      router.refresh();
    });
  }

  return (
    <div>
      <label className="block">
        <span className="etiqueta-campo">
          {configurada ? "Nueva llave maestra" : "Llave maestra"}
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
          className="campo"
          placeholder={`Al menos ${LARGO_MINIMO_LLAVE} caracteres`}
        />
      </label>

      <label className="mt-3 block">
        <span className="etiqueta-campo">Escríbela otra vez</span>
        <input
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(evento) => setRepetida(evento.target.value)}
          className="campo"
          placeholder="Para descartar un dedazo"
        />
      </label>

      <button
        type="button"
        onClick={guardar}
        disabled={enCurso || corta || noCoinciden}
        className="boton-primario mt-4"
      >
        {enCurso
          ? "Guardando…"
          : configurada
            ? "Cambiar la llave maestra"
            : "Guardar la llave maestra"}
      </button>

      {configurada ? (
        <div className="mt-5 border-t border-[rgba(19,28,36,.09)] pt-4">
          {confirmandoQuitar ? (
            <>
              <p className="text-[12.5px] leading-[1.5] font-medium text-tinta">
                Si la quitas, a cada perfil se entrará solo con su propia
                contraseña. Puedes volver a poner una cuando quieras.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={quitar}
                  disabled={enCurso}
                  className="cursor-pointer rounded-[10px] border-0 bg-rojo px-[18px] py-[13px] text-[13px] leading-none font-bold text-white disabled:opacity-60"
                >
                  {enCurso ? "Quitando…" : "Sí, quitar la llave maestra"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoQuitar(false)}
                  className="boton-secundario"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmandoQuitar(true)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] leading-none font-semibold text-rojo"
            >
              Quitar la llave maestra
            </button>
          )}
        </div>
      ) : null}

      {listo ? (
        <p className="mt-4 rounded-[10px] border border-[rgba(110,154,85,.4)] bg-verde-050 px-[15px] py-[14px] text-[12.5px] leading-[1.5] font-semibold text-verde-700">
          {listo}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-[12.5px] leading-[1.5] font-semibold text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}
