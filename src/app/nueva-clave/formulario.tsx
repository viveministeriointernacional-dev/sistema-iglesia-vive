"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { GeneradorDeClave } from "@/components/generador-de-clave";
import { generarContrasena, LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
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
  // Controladas para que «Generar una» pueda llenar las dos de un golpe.
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

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
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
        />
      </label>

      <GeneradorDeClave
        valor={password}
        generar={generarContrasena}
        alGenerar={(nueva) => {
          setPassword(nueva);
          setConfirmacion(nueva);
        }}
        nota="Anótala antes de guardar: al entrar, las casillas quedan ocultas."
      />

      <label className="mt-4 block">
        <span className="etiqueta-campo">Confirmar contraseña</span>
        <input
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          required
          minLength={LARGO_MINIMO_CONTRASENA}
          className="campo"
          value={confirmacion}
          onChange={(evento) => setConfirmacion(evento.target.value)}
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
