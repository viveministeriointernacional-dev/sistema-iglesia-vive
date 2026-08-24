"use client";

import { useActionState, useState } from "react";
import {
  ChurchAttendance,
  EntryPoint,
  InvitationKind,
} from "@iglesia/prisma-client";
import {
  ASISTENCIAS_IGLESIA,
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
  const [puntoDeEntrada, setPuntoDeEntrada] = useState("");
  const [asistenciaIglesia, setAsistenciaIglesia] = useState("");
  const [tipoDeInvitacion, setTipoDeInvitacion] = useState("");
  const asisteAUnaIglesia =
    asistenciaIglesia === ChurchAttendance.IGLESIA_VIVE ||
    asistenciaIglesia === ChurchAttendance.OTRA_IGLESIA;

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
            <span className="etiqueta-campo">Apellidos *</span>
            <input
              className="campo"
              name="lastName"
              autoComplete="family-name"
              maxLength={120}
              required
            />
            <ErrorCampo texto={estado.errores.lastName} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">Género *</span>
            <select className="campo" name="gender" defaultValue="" required>
              <option value="">Selecciona una opción</option>
              {GENEROS.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
            <ErrorCampo texto={estado.errores.gender} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">Fecha de nacimiento *</span>
            <input
              className="campo"
              type="date"
              name="birthDate"
              autoComplete="bday"
              required
            />
            <ErrorCampo texto={estado.errores.birthDate} />
          </label>
        </div>
      </section>

      <section className="tarjeta p-5 sm:p-6">
        <h2 className="font-serif text-[23px] font-normal">Cómo contactarte</h2>
        <p className="mt-1 text-[12.5px] text-tinta-55">
          Completa tus datos de contacto. WhatsApp es opcional.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">Teléfono *</span>
            <input
              className="campo"
              name="callPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={40}
              placeholder="+57 300 123 4567"
              required
            />
            <ErrorCampo texto={estado.errores.callPhone} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">WhatsApp (opcional)</span>
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
            <span className="etiqueta-campo">Correo electrónico (opcional)</span>
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
          <legend className="etiqueta-campo">
            ¿En qué horario podemos llamarte? *
          </legend>
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
          <ErrorCampo texto={estado.errores.callSchedules} />
        </fieldset>

        <label className="mt-4 block">
          <span className="etiqueta-campo">Dirección o barrio *</span>
          <input
            className="campo"
            name="address"
            autoComplete="street-address"
            maxLength={280}
            required
          />
          <ErrorCampo texto={estado.errores.address} />
        </label>
      </section>

      <section className="tarjeta p-5 sm:p-6">
        <h2 className="font-serif text-[23px] font-normal">Cómo llegaste</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">Punto de encuentro *</span>
            <select
              className="campo"
              name="entryPoint"
              value={puntoDeEntrada}
              onChange={(evento) => setPuntoDeEntrada(evento.target.value)}
              required
            >
              <option value="">Selecciona una opción</option>
              {PUNTOS_DE_ENTRADA.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
            <ErrorCampo texto={estado.errores.entryPoint} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">
              Si elegiste “Otro”{puntoDeEntrada === EntryPoint.OTRO ? " *" : ""}
            </span>
            <input
              className="campo"
              name="entryPointOther"
              maxLength={280}
              required={puntoDeEntrada === EntryPoint.OTRO}
            />
            <ErrorCampo texto={estado.errores.entryPointOther} />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="etiqueta-campo">¿Asistes a alguna iglesia? *</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ASISTENCIAS_IGLESIA.map(({ valor, etiqueta }) => (
              <label
                key={valor}
                className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-linea px-3 py-3 text-[13px] font-medium leading-snug text-tinta"
              >
                <input
                  className="mt-0.5 size-4 shrink-0"
                  type="radio"
                  name="churchAttendance"
                  value={valor}
                  onChange={(evento) =>
                    setAsistenciaIglesia(evento.target.value)
                  }
                  required
                />
                {etiqueta}
              </label>
            ))}
          </div>
          <ErrorCampo texto={estado.errores.churchAttendance} />
        </fieldset>

        {asisteAUnaIglesia ? (
          <label className="mt-4 block">
            <span className="etiqueta-campo">Iglesia a la que asiste *</span>
            <input
              className="campo"
              name="churchName"
              maxLength={280}
              placeholder="Escribe el nombre de la iglesia"
              required
            />
            <ErrorCampo texto={estado.errores.churchName} />
          </label>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">¿Alguien te invitó? *</span>
            <select
              className="campo"
              name="invitationKind"
              value={tipoDeInvitacion}
              onChange={(evento) => setTipoDeInvitacion(evento.target.value)}
              required
            >
              <option value="">Selecciona una opción</option>
              {TIPOS_DE_INVITACION.map(({ valor, etiqueta }) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
            <ErrorCampo texto={estado.errores.invitationKind} />
          </label>
          <label className="block">
            <span className="etiqueta-campo">
              Nombre de quien te invitó
              {tipoDeInvitacion === InvitationKind.PERSONA ? " *" : ""}
            </span>
            <input
              className="campo"
              name="invitedByName"
              maxLength={160}
              required={tipoDeInvitacion === InvitationKind.PERSONA}
            />
            <ErrorCampo texto={estado.errores.invitedByName} />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="etiqueta-campo">Petición de oración *</span>
          <textarea
            className="campo min-h-24 resize-y"
            name="prayerRequest"
            maxLength={280}
            placeholder="Cuéntanos cómo podemos orar por ti"
            required
          />
          <ErrorCampo texto={estado.errores.prayerRequest} />
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
