"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  crearAccesoLider,
  marcarLider,
  type TipoLider,
} from "./acciones";

export type MiembroEquipo = {
  personId: string;
  learnerId: string;
  nombre: string;
  tieneAcceso: boolean;
  esLiderAlpha: boolean;
  esLiderCasaFe: boolean;
};

export function EquipoLideres({ miembros }: { miembros: MiembroEquipo[] }) {
  if (miembros.length === 0) return null;

  return (
    <section className="mt-[14px] tarjeta p-5">
      <h2 className="etiqueta-seccion">LÍDERES DE MI EQUIPO</h2>
      <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
        Marca a quién de tu equipo habilitas como líder de Alpha o de Casa de Fe.
        Si la persona no tiene acceso, se le crea al marcarla.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {miembros.map((miembro) => (
          <Fila key={miembro.personId} miembro={miembro} />
        ))}
      </div>
    </section>
  );
}

function Fila({ miembro }: { miembro: MiembroEquipo }) {
  const router = useRouter();
  const [alpha, setAlpha] = useState(miembro.esLiderAlpha);
  const [casa, setCasa] = useState(miembro.esLiderCasaFe);
  const [pendiente, setPendiente] = useState<TipoLider | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState<null | { ok: boolean; texto: string }>(null);
  const [ocupado, iniciar] = useTransition();

  function alternar(tipo: TipoLider, valor: boolean) {
    // Refleja el cambio de una vez; si hace falta cuenta, se revierte.
    if (tipo === "alpha") setAlpha(valor);
    else setCasa(valor);
    setMensaje(null);
    iniciar(async () => {
      const r = await marcarLider(miembro.personId, tipo, valor);
      if (r.ok) {
        setMensaje({ ok: true, texto: "Listo." });
        return;
      }
      if ("necesitaCuenta" in r) {
        // Revierte el toggle y pide crear la cuenta.
        if (tipo === "alpha") setAlpha(false);
        else setCasa(false);
        setPendiente(tipo);
        return;
      }
      if (tipo === "alpha") setAlpha(!valor);
      else setCasa(!valor);
      setMensaje({ ok: false, texto: r.mensaje });
    });
  }

  function crear() {
    if (!pendiente) return;
    const tipo = pendiente;
    iniciar(async () => {
      const r = await crearAccesoLider(miembro.personId, { email, password, tipo });
      if (r.ok) {
        if (tipo === "alpha") setAlpha(true);
        else setCasa(true);
        setPendiente(null);
        setEmail("");
        setPassword("");
        setMensaje({ ok: true, texto: "Acceso creado y marcado como líder." });
        router.refresh();
      } else {
        setMensaje({
          ok: false,
          texto: "mensaje" in r ? r.mensaje : "No se pudo crear el acceso.",
        });
      }
    });
  }

  return (
    <div className="rounded-[10px] border border-[rgba(19,28,36,.12)] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13.5px] leading-none font-semibold text-tinta">
          {miembro.nombre}
          {!miembro.tieneAcceso ? (
            <span className="ml-2 rounded-[5px] bg-[rgba(19,28,36,.06)] px-[6px] py-[3px] text-[9.5px] font-bold tracking-[.06em] text-[rgba(19,28,36,.45)]">
              SIN ACCESO
            </span>
          ) : null}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-[rgba(19,28,36,.14)] px-[10px] py-[7px]">
            <input
              type="checkbox"
              checked={alpha}
              disabled={ocupado}
              onChange={(e) => alternar("alpha", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-[11.5px] leading-none font-semibold text-tinta">
              Líder Alpha
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-[rgba(19,28,36,.14)] px-[10px] py-[7px]">
            <input
              type="checkbox"
              checked={casa}
              disabled={ocupado}
              onChange={(e) => alternar("casa", e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-[11.5px] leading-none font-semibold text-tinta">
              Líder Casa de Fe
            </span>
          </label>
        </div>
      </div>

      {pendiente ? (
        <div className="mt-3 rounded-[9px] bg-papel p-3">
          <p className="text-[11.5px] leading-[1.4] font-semibold text-tinta">
            {miembro.nombre} no tiene acceso. Créale uno para dejarlo como líder
            de {pendiente === "alpha" ? "Alpha" : "Casa de Fe"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="campo max-w-[220px]"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="campo max-w-[180px]"
              placeholder="contraseña (mín. 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={crear}
              disabled={ocupado}
              className="cursor-pointer rounded-[8px] bg-azul-900 px-[14px] py-[9px] text-[11.5px] leading-none font-semibold text-white disabled:opacity-60"
            >
              {ocupado ? "Creando…" : "Crear acceso y marcar"}
            </button>
            <button
              type="button"
              onClick={() => setPendiente(null)}
              className="cursor-pointer rounded-[8px] border border-[rgba(19,28,36,.16)] px-[14px] py-[9px] text-[11.5px] leading-none font-semibold text-tinta"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {mensaje ? (
        <p
          className={`mt-2 text-[11.5px] leading-[1.4] font-semibold ${
            mensaje.ok ? "text-verde-700" : "text-[rgb(180,40,40)]"
          }`}
        >
          {mensaje.texto}
        </p>
      ) : null}
    </div>
  );
}
