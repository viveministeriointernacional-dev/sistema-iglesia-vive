"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { pedirEnlace, type EstadoRecuperacion } from "./acciones";

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="boton-primario mt-5 w-full" disabled={pending}>
      {pending ? "Enviando…" : "Enviarme el enlace"}
    </button>
  );
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState<EstadoRecuperacion, FormData>(
    pedirEnlace,
    { enviado: false, error: null },
  );

  if (estado.enviado) {
    return (
      <div>
        <p className="rounded-[10px] border border-[rgba(79,112,56,.3)] bg-verde-100 px-[15px] py-[14px] text-[12.5px] leading-[1.5] font-semibold text-verde-700">
          Si ese correo tiene acceso, te enviamos un enlace para crear una
          contraseña nueva. Revisa tu bandeja.
        </p>
        <p className="mt-[14px] text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          El enlace vence en una hora. Si no llega, revisa el correo no deseado o
          pídele al administrador que te la restablezca.
        </p>
        <p className="mt-5 text-center">
          <Link
            href="/ingresar"
            className="text-[12.5px] leading-none font-semibold text-azul-700"
          >
            Volver a entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={accion}>
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

      {estado.error ? (
        <p
          role="alert"
          className="aviso-ambar mt-4 text-[12.5px] leading-[1.5] font-medium text-ambar-texto"
        >
          {estado.error}
        </p>
      ) : null}

      <BotonEnviar />

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
