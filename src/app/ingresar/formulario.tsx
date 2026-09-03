"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ingresar, type EstadoIngreso } from "./acciones";

function BotonEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="boton-primario mt-5 w-full" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormularioIngreso({ siguiente }: { siguiente: string }) {
  const [estado, accion] = useActionState<EstadoIngreso, FormData>(ingresar, {
    error: null,
  });

  return (
    <form action={accion}>
      <input type="hidden" name="siguiente" value={siguiente} />

      <label className="block">
        <span className="etiqueta-campo">Correo</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nombre@iglesiavive.co"
          className="campo"
        />
      </label>

      <label className="mt-4 block">
        <span className="etiqueta-campo">Contraseña</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
        />
      </label>

      {estado.error ? (
        <p
          role="alert"
          className="aviso-ambar mt-4 text-[12.5px] leading-[1.5] font-medium text-ambar-texto"
        >
          {estado.error}
        </p>
      ) : null}

      <BotonEntrar />

      <p className="mt-4 text-center">
        <Link
          href="/recuperar"
          className="text-[12.5px] leading-none font-semibold text-azul-700"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </form>
  );
}
