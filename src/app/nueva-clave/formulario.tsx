"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
import { guardarContrasena, type EstadoNuevaClave } from "./acciones";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="boton-primario mt-5 w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar y entrar"}
    </button>
  );
}

export function FormularioNuevaClave({ token }: { token: string }) {
  const [estado, accion] = useActionState<EstadoNuevaClave, FormData>(
    guardarContrasena,
    { error: null },
  );

  return (
    <form action={accion}>
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="etiqueta-campo">Contraseña nueva</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={LARGO_MINIMO_CONTRASENA}
          className="campo"
        />
      </label>

      <label className="mt-4 block">
        <span className="etiqueta-campo">Confirmar contraseña</span>
        <input
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          required
          minLength={LARGO_MINIMO_CONTRASENA}
          className="campo"
        />
      </label>

      <p className="mt-3 text-[12px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
        Mínimo {LARGO_MINIMO_CONTRASENA} caracteres.
      </p>

      {estado.error ? (
        <p
          role="alert"
          className="aviso-ambar mt-4 text-[12.5px] leading-[1.5] font-medium text-ambar-texto"
        >
          {estado.error}
        </p>
      ) : null}

      <BotonGuardar />

      <p className="mt-4 text-center">
        <Link
          href="/ingresar"
          className="text-[12.5px] leading-none font-semibold text-azul-700"
        >
          Volver a entrar
        </Link>
      </p>
    </form>
  );
}
