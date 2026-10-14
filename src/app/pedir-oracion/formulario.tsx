"use client";

import { useActionState, useState } from "react";
import { LARGO_MAXIMO_PETICION } from "@/lib/oracion-catalogo";
import {
  enviarPeticionDeOracion,
  type EstadoDePeticion,
} from "./acciones";

const INICIAL: EstadoDePeticion = { fase: "vacio" };

export function FormularioDeOracion() {
  const [estado, enviar, enCurso] = useActionState(
    enviarPeticionDeOracion,
    INICIAL,
  );
  // Los otros datos solo se piden cuando el celular no la encontró. Pedirlos
  // de entrada haría el formulario el doble de largo para todo el mundo.
  const [masDatos, setMasDatos] = useState(false);

  if (estado.fase === "listo") {
    return (
      <div className="tarjeta mt-5 p-6">
        <h2 className="font-serif text-[23px] leading-[1.2] font-normal text-tinta">
          Gracias, {estado.nombre}
        </h2>
        {/* ⚠️ Lo que NO dice es tan importante como lo que dice: no promete que
            alguien va a llamar. El equipo de intercesión ora; quien acompaña a
            la persona es otro, y una promesa que no se cumple hace más daño
            que no prometer nada. */}
        <p className="mt-3 text-[14px] leading-[1.6] font-medium text-[rgba(19,28,36,.7)]">
          Tu petición le llegó al equipo de intercesión de la iglesia. Vamos a
          orar por eso.
        </p>
        <p className="mt-3 text-[13px] leading-[1.55] font-medium text-[rgba(19,28,36,.5)]">
          Si quieres pedir por algo más, vuelve a abrir este enlace cuando
          necesites.
        </p>
      </div>
    );
  }

  const noEncontrada = estado.fase === "error" && estado.noEncontrada === true;

  return (
    <form action={enviar} className="tarjeta mt-5 p-5">
      <label className="etiqueta-campo" htmlFor="callPhone">
        Tu celular
      </label>
      <input
        id="callPhone"
        name="callPhone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="300 123 4567"
        className="campo"
      />
      <p className="mt-1.5 text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
        Es para saber por quién orar. No lo publicamos en ninguna parte.
      </p>

      {noEncontrada || masDatos ? (
        <div className="mt-4 rounded-[10px] bg-papel p-3">
          <p className="text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.6)]">
            Si el celular que tenemos tuyo es otro, escribe tu correo y tu fecha
            de nacimiento y te reconocemos igual.
          </p>
          <label className="etiqueta-campo mt-3" htmlFor="email">
            Tu correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="campo"
          />
          <label className="etiqueta-campo mt-3" htmlFor="birthDate">
            Tu fecha de nacimiento
          </label>
          <input id="birthDate" name="birthDate" type="date" className="campo" />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMasDatos(true)}
          className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12px] leading-none font-semibold text-azul-700 underline"
        >
          No uso ese celular
        </button>
      )}

      <label className="etiqueta-campo mt-5" htmlFor="peticion">
        ¿Por qué quieres que oremos?
      </label>
      <textarea
        id="peticion"
        name="peticion"
        rows={6}
        maxLength={LARGO_MAXIMO_PETICION}
        placeholder="Escríbelo con tus palabras."
        className="campo"
      />

      <label className="mt-4 flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          name="reservada"
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1b4a7a]"
        />
        <span className="text-[13px] leading-[1.5] font-medium text-tinta">
          Prefiero que no se sepa quién la pidió
          <span className="mt-0.5 block text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.5)]">
            El equipo ora igual, pero tu nombre no aparece en la lista.
          </span>
        </span>
      </label>

      {estado.fase === "error" ? (
        <p
          role="alert"
          className="mt-4 rounded-[10px] border border-[rgba(180,70,47,.3)] bg-rojo-fondo p-3 text-[12.5px] leading-[1.5] font-medium text-rojo"
        >
          {estado.mensaje}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enCurso}
        className="boton-primario mt-5 w-full"
      >
        {enCurso ? "Enviando…" : "Enviar mi petición"}
      </button>
    </form>
  );
}
