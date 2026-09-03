"use client";

import { useState, useTransition } from "react";
import type { DatosPersona, ResultadoGuardado } from "@/lib/persona";

/// Formulario de los datos básicos de una persona. Lo usan administración y el
/// expediente con el mismo aspecto; cada uno pasa su propia acción de guardado
/// (con su propia regla de permiso).
export function FormularioDatosPersona({
  inicial,
  guardar,
  textoExito = "Datos guardados y enviados a HighLevel.",
}: {
  inicial: DatosPersona;
  guardar: (datos: DatosPersona) => Promise<ResultadoGuardado>;
  textoExito?: string;
}) {
  const [form, setForm] = useState<DatosPersona>(inicial);
  const [estado, setEstado] = useState<null | { ok: boolean; texto: string }>(null);
  const [guardando, iniciar] = useTransition();
  const set = (campo: keyof DatosPersona, valor: string) =>
    setForm((previo) => ({ ...previo, [campo]: valor }));

  function enviar() {
    iniciar(async () => {
      const r = await guardar(form);
      setEstado(r.ok ? { ok: true, texto: textoExito } : { ok: false, texto: r.mensaje });
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombres">
          <input className="campo" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Campo>
        <Campo etiqueta="Apellidos">
          <input className="campo" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Campo>
        <Campo etiqueta="Género">
          <select
            className="campo"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value as DatosPersona["gender"])}
          >
            <option value="">Sin registrar</option>
            <option value="MUJER">Mujer</option>
            <option value="HOMBRE">Hombre</option>
          </select>
        </Campo>
        <Campo etiqueta="Fecha de nacimiento">
          <input type="date" className="campo" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </Campo>
        <Campo etiqueta="Celular (llamadas)">
          <input className="campo" value={form.callPhone} onChange={(e) => set("callPhone", e.target.value)} />
        </Campo>
        <Campo etiqueta="WhatsApp">
          <input className="campo" value={form.whatsappPhone} onChange={(e) => set("whatsappPhone", e.target.value)} />
        </Campo>
        <Campo etiqueta="Correo">
          <input className="campo" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Campo>
        <Campo etiqueta="Dirección">
          <input className="campo" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Campo>
      </div>
      <label className="mt-3 block">
        <span className="etiqueta-campo">Petición de oración</span>
        <textarea className="campo" rows={2} value={form.prayerRequest} onChange={(e) => set("prayerRequest", e.target.value)} />
      </label>
      {estado ? (
        <p
          className={`mt-3 text-[12px] leading-[1.4] font-semibold ${
            estado.ok ? "text-verde-700" : "text-[rgb(180,40,40)]"
          }`}
        >
          {estado.texto}
        </p>
      ) : null}
      <button
        type="button"
        onClick={enviar}
        disabled={guardando}
        className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar datos"}
      </button>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="etiqueta-campo">{etiqueta}</span>
      {children}
    </label>
  );
}
