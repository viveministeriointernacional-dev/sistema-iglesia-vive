"use client";

import { useActionState } from "react";
import {
  GENEROS,
  HORARIOS,
  PUNTOS_DE_ENTRADA,
  TIPOS_DE_INVITACION,
} from "@/lib/dominio";
import { guardarRegistroPublico } from "./acciones";

function ErrorCampo({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p className="mt-1.5 text-[11px] font-medium text-rojo" role="alert">
      {texto}
    </p>
  );
}

export function FormularioRegistroPublico() {
  const [estado, accion, enviando] = useActionState(
    guardarRegistroPublico,
    { errores: {} },
  );

  return (
    <form action={accion} className="mt-7 space-y-5">
      <div className="absolute -left-[10000px]" aria-hidden="true">
        <label>
          Sitio web
          <input name="sitioWeb" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <section className="tarjeta p-5 sm:p-6">
        <h2 className="font-serif text-[23px] font-normal">Cuéntanos de ti</h2>
        <p className="mt-1 text-[12.5px] text-tinta-55">
          Los campos marcados con * son obligatorios.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">Nombres *</span>
            <input
              className="campo"
              name="firstName"
              autoComplete="given-name"
              maxLength={120}
              required
            />
            <ErrorCampo texto={estado.errores.firstName} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">Apellidos</span>
            <input
              className="campo"
              name="lastName"
              autoComplete="family-name"
              maxLength={120}
            />
            <ErrorCampo texto={estado.errores.lastName} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">Género</span>
            <select className="campo" name="gender" defaultValue="">
              <option value="">Prefiero no indicarlo</option>
              {GENEROS.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="etiqueta-campo">Fecha de nacimiento</span>
            <input
              className="campo"
              type="date"
              name="birthDate"
              autoComplete="bday"
            />
            <ErrorCampo texto={estado.errores.birthDate} />
          </label>
        </div>
      </section>

      <section className="tarjeta p-5 sm:p-6">
        <h2 className="font-serif text-[23px] font-normal">Cómo contactarte</h2>
        <p className="mt-1 text-[12.5px] text-tinta-55">
          Escribe al menos un teléfono, WhatsApp o correo.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">Teléfono</span>
            <input
              className="campo"
              name="callPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={40}
              placeholder="+57 300 123 4567"
            />
            <ErrorCampo texto={estado.errores.callPhone} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">WhatsApp</span>
            <input
              className="campo"
              name="whatsappPhone"
              type="tel"
              inputMode="tel"
              maxLength={40}
              placeholder="Si es diferente"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="etiqueta-campo">Correo electrónico</span>
            <input
              className="campo"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
            />
            <ErrorCampo texto={estado.errores.email} />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="etiqueta-campo">¿En qué horario podemos llamarte?</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {HORARIOS.map(({ valor, etiqueta }) => (
              <label
                key={valor}
                className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-tinta-55"
              >
                <input type="checkbox" name="callSchedules" value={valor} />
                {etiqueta}
              </label>
            ))}
          </div>
          <input
            className="campo campo-opcional"
            name="callScheduleNote"
            maxLength={280}
            placeholder="También puedes escribir un horario específico"
          />
        </fieldset>

        <label className="mt-4 block">
          <span className="etiqueta-campo">Dirección o barrio</span>
          <input
            className="campo"
            name="address"
            autoComplete="street-address"
            maxLength={280}
          />
        </label>
      </section>

      <section className="tarjeta p-5 sm:p-6">
        <h2 className="font-serif text-[23px] font-normal">Cómo llegaste</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">Punto de encuentro</span>
            <select className="campo" name="entryPoint" defaultValue="">
              <option value="">Selecciona una opción</option>
              {PUNTOS_DE_ENTRADA.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="etiqueta-campo">Si elegiste “Otro”</span>
            <input className="campo" name="entryPointOther" maxLength={280} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">¿Alguien te invitó?</span>
            <select className="campo" name="invitationKind" defaultValue="">
              <option value="">Selecciona una opción</option>
              {TIPOS_DE_INVITACION.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="etiqueta-campo">Nombre de quien te invitó</span>
            <input className="campo" name="invitedByName" maxLength={160} />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="etiqueta-campo">Petición de oración</span>
          <textarea
            className="campo min-h-24 resize-y"
            name="prayerRequest"
            maxLength={280}
            placeholder="Si quieres, cuéntanos cómo podemos orar por ti"
          />
        </label>
      </section>

      <label className="flex items-start gap-3 rounded-[12px] bg-verde-050 p-4 text-[12.5px] leading-relaxed text-tinta-55">
        <input
          className="mt-1"
          type="checkbox"
          name="aceptaPrivacidad"
          value="si"
          required
        />
        <span>
          Autorizo a Vive Ministerio Internacional a usar estos datos para
          contactarme y acompañar mi proceso dentro de la iglesia.
          <ErrorCampo texto={estado.errores.aceptaPrivacidad} />
        </span>
      </label>

      {estado.mensaje ? (
        <p className="aviso-ambar text-[12.5px] font-medium text-ambar-texto" role="alert">
          {estado.mensaje}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="boton-primario w-full py-4 text-[14px]"
      >
        {enviando ? "Enviando…" : "Enviar mi registro"}
      </button>
    </form>
  );
}
