"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MilestoneKind, Phase, Role } from "@iglesia/prisma-client";
import {
  alternarHito,
  asignarMentor,
  cambiarFase,
  crearAcceso,
  guardarDatosPersona,
  guardarRolYPermisos,
} from "../acciones";

const ROLES: { v: Role; l: string }[] = [
  { v: "APRENDIZ" as Role, l: "Aprendiz" },
  { v: "CONSOLIDADOR" as Role, l: "Consolidador" },
  { v: "LIDER_ALPHA" as Role, l: "Líder Alpha" },
  { v: "MENTOR" as Role, l: "Mentor" },
  { v: "PASTOR" as Role, l: "Pastor" },
  { v: "ADMIN" as Role, l: "Administrador" },
];
const FASES: Phase[] = [
  "GANAR" as Phase,
  "FORTALECER" as Phase,
  "ENTRENAR" as Phase,
  "MULTIPLICAR" as Phase,
];
const HITOS: { v: MilestoneKind; l: string }[] = [
  { v: "ALPHA" as MilestoneKind, l: "Alpha" },
  { v: "FOCUS_DAY" as MilestoneKind, l: "Focus Day" },
  { v: "CASA_DE_FE" as MilestoneKind, l: "Casa de Fe" },
  { v: "ENCUENTRO" as MilestoneKind, l: "Encuentro" },
  { v: "BAUTISMO" as MilestoneKind, l: "Bautismo" },
  { v: "EVALUACION_CIERRE" as MilestoneKind, l: "Evaluación de cierre" },
  { v: "ENTRADA_ESCUELA" as MilestoneKind, l: "Entró a la Escuela" },
  { v: "SERVICIO" as MilestoneKind, l: "Está sirviendo" },
  { v: "GRADUACION" as MilestoneKind, l: "Graduación" },
  { v: "VALIDACION_PASTORAL" as MilestoneKind, l: "Validación pastoral" },
  { v: "MULTIPLICACION" as MilestoneKind, l: "Multiplicación" },
];

type DatosForm = {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  callPhone: string;
  whatsappPhone: string;
  email: string;
  address: string;
  prayerRequest: string;
};

type Cuenta = {
  id: string;
  email: string;
  role: Role;
  capacity: number;
  active: boolean;
  canLeadAlpha: boolean;
  canLeadFaithHouse: boolean;
  coordinatesConsolidation: boolean;
};

export function EditorPersona({
  personId,
  learnerId,
  datos,
  cuenta,
  fase,
  hitosCompletados,
  mentores,
  mentorActualId,
}: {
  personId: string;
  learnerId: string | null;
  datos: DatosForm;
  cuenta: Cuenta | null;
  fase: Phase | null;
  hitosCompletados: MilestoneKind[];
  mentores: { id: string; nombre: string }[];
  mentorActualId: string | null;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <SeccionDatos personId={personId} inicial={datos} />
      {cuenta ? (
        <SeccionRol cuenta={cuenta} />
      ) : (
        <SeccionCrearAcceso personId={personId} />
      )}
      {learnerId ? (
        <SeccionMentor
          learnerId={learnerId}
          mentores={mentores}
          actual={mentorActualId}
        />
      ) : null}
      {learnerId ? (
        <SeccionProceso
          learnerId={learnerId}
          faseInicial={fase}
          completados={hitosCompletados}
        />
      ) : null}
    </div>
  );
}

function SeccionMentor({
  learnerId,
  mentores,
  actual,
}: {
  learnerId: string;
  mentores: { id: string; nombre: string }[];
  actual: string | null;
}) {
  const [elegido, setElegido] = useState(actual ?? "");
  const [estado, setEstado] = useState<null | { ok: boolean; texto: string }>(null);
  const [guardando, iniciar] = useTransition();

  function guardar() {
    iniciar(async () => {
      const r = await asignarMentor(learnerId, elegido);
      setEstado(
        r.ok
          ? { ok: true, texto: "Mentor actualizado." }
          : { ok: false, texto: r.mensaje },
      );
    });
  }

  return (
    <Tarjeta titulo="MENTOR">
      {mentores.length === 0 ? (
        <p className="text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          No hay mentores disponibles todavía. Marca a alguien con rol de Mentor
          o Pastor para poder asignarlo.
        </p>
      ) : (
        <>
          <Campo etiqueta="Mentor asignado (rol de mentor o pastor)">
            <select
              className="campo max-w-[360px]"
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
            >
              <option value="">Sin mentor</option>
              {mentores.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Aviso estado={estado} />
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar mentor"}
          </button>
        </>
      )}
    </Tarjeta>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="tarjeta p-5">
      <h2 className="etiqueta-seccion">{titulo}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Aviso({ estado }: { estado: null | { ok: boolean; texto: string } }) {
  if (!estado) return null;
  return (
    <p
      className={`mt-3 text-[12px] leading-[1.4] font-semibold ${
        estado.ok ? "text-verde-700" : "text-[rgb(180,40,40)]"
      }`}
    >
      {estado.texto}
    </p>
  );
}

function SeccionDatos({
  personId,
  inicial,
}: {
  personId: string;
  inicial: DatosForm;
}) {
  const [form, setForm] = useState<DatosForm>(inicial);
  const [estado, setEstado] = useState<null | { ok: boolean; texto: string }>(null);
  const [guardando, iniciar] = useTransition();
  const set = (campo: keyof DatosForm, valor: string) =>
    setForm((previo) => ({ ...previo, [campo]: valor }));

  function guardar() {
    iniciar(async () => {
      const r = await guardarDatosPersona(personId, {
        ...form,
        gender: form.gender as "MUJER" | "HOMBRE" | "",
      });
      setEstado(
        r.ok
          ? { ok: true, texto: "Datos guardados y enviados a HighLevel." }
          : { ok: false, texto: r.mensaje },
      );
    });
  }

  return (
    <Tarjeta titulo="DATOS DE LA PERSONA">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombres">
          <input className="campo" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Campo>
        <Campo etiqueta="Apellidos">
          <input className="campo" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Campo>
        <Campo etiqueta="Género">
          <select className="campo" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
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
      <Aviso estado={estado} />
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar datos"}
      </button>
    </Tarjeta>
  );
}

function PermisosCampos({
  valores,
  onChange,
}: {
  valores: {
    role: Role;
    capacity: number;
    active: boolean;
    canLeadAlpha: boolean;
    canLeadFaithHouse: boolean;
    coordinatesConsolidation: boolean;
  };
  onChange: (parcial: Partial<typeof valores>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Rol">
          <select
            className="campo"
            value={valores.role}
            onChange={(e) => onChange({ role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Capacidad de acompañamiento">
          <input
            type="number"
            min={0}
            className="campo"
            value={valores.capacity}
            onChange={(e) => onChange({ capacity: Number(e.target.value) })}
          />
        </Campo>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <Interruptor
          etiqueta="Líder de Alpha"
          activo={valores.canLeadAlpha}
          onChange={(v) => onChange({ canLeadAlpha: v })}
        />
        <Interruptor
          etiqueta="Líder de Casa de Fe"
          activo={valores.canLeadFaithHouse}
          onChange={(v) => onChange({ canLeadFaithHouse: v })}
        />
        <Interruptor
          etiqueta="Coordina la consolidación (ve a todos los consolidadores)"
          activo={valores.coordinatesConsolidation}
          onChange={(v) => onChange({ coordinatesConsolidation: v })}
        />
        <Interruptor
          etiqueta="Cuenta activa"
          activo={valores.active}
          onChange={(v) => onChange({ active: v })}
        />
      </div>
    </>
  );
}

function SeccionRol({ cuenta }: { cuenta: Cuenta }) {
  const [v, setV] = useState({
    role: cuenta.role,
    capacity: cuenta.capacity,
    active: cuenta.active,
    canLeadAlpha: cuenta.canLeadAlpha,
    canLeadFaithHouse: cuenta.canLeadFaithHouse,
    coordinatesConsolidation: cuenta.coordinatesConsolidation,
  });
  const [estado, setEstado] = useState<null | { ok: boolean; texto: string }>(null);
  const [guardando, iniciar] = useTransition();

  function guardar() {
    iniciar(async () => {
      const r = await guardarRolYPermisos(cuenta.id, v);
      setEstado(
        r.ok
          ? { ok: true, texto: "Rol y permisos actualizados." }
          : { ok: false, texto: r.mensaje },
      );
    });
  }

  return (
    <Tarjeta titulo="ROL Y PERMISOS">
      <PermisosCampos valores={v} onChange={(p) => setV((prev) => ({ ...prev, ...p }))} />
      <Aviso estado={estado} />
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
      >
        {guardando ? "Guardando…" : "Guardar rol y permisos"}
      </button>
    </Tarjeta>
  );
}

function SeccionCrearAcceso({ personId }: { personId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [v, setV] = useState({
    role: "MENTOR" as Role,
    capacity: 12,
    active: true,
    canLeadAlpha: false,
    canLeadFaithHouse: false,
    coordinatesConsolidation: false,
  });
  const [estado, setEstado] = useState<null | { ok: boolean; texto: string }>(null);
  const [guardando, iniciar] = useTransition();

  function crear() {
    iniciar(async () => {
      const r = await crearAcceso(personId, { email, password, ...v });
      if (r.ok) {
        setEstado({ ok: true, texto: "Acceso creado." });
        router.refresh();
      } else {
        setEstado({ ok: false, texto: r.mensaje });
      }
    });
  }

  return (
    <Tarjeta titulo="CREAR ACCESO Y ASIGNAR ROL">
      <p className="mb-3 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
        Esta persona no tiene login. Crea su acceso para que pueda entrar con un
        rol (mentor, líder de Alpha, líder de Casa de Fe, etc.).
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Correo de acceso">
          <input className="campo" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        </Campo>
        <Campo etiqueta="Contraseña inicial">
          <input className="campo" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
        </Campo>
      </div>
      <div className="mt-3">
        <PermisosCampos valores={v} onChange={(p) => setV((prev) => ({ ...prev, ...p }))} />
      </div>
      <Aviso estado={estado} />
      <button
        type="button"
        onClick={crear}
        disabled={guardando}
        className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
      >
        {guardando ? "Creando…" : "Crear acceso"}
      </button>
    </Tarjeta>
  );
}

function SeccionProceso({
  learnerId,
  faseInicial,
  completados,
}: {
  learnerId: string;
  faseInicial: Phase | null;
  completados: MilestoneKind[];
}) {
  const [fase, setFase] = useState<Phase | "">(faseInicial ?? "");
  const [hechos, setHechos] = useState<Set<MilestoneKind>>(new Set(completados));
  const [estado, setEstado] = useState<null | { ok: boolean; texto: string }>(null);
  const [ocupado, iniciar] = useTransition();

  function ponerFase(nueva: Phase) {
    setFase(nueva);
    iniciar(async () => {
      const r = await cambiarFase(learnerId, nueva);
      setEstado(r.ok ? { ok: true, texto: "Fase actualizada." } : { ok: false, texto: r.mensaje });
    });
  }

  function alternar(kind: MilestoneKind, completado: boolean) {
    setHechos((prev) => {
      const copia = new Set(prev);
      if (completado) copia.add(kind);
      else copia.delete(kind);
      return copia;
    });
    iniciar(async () => {
      const r = await alternarHito(learnerId, kind, completado);
      setEstado(r.ok ? { ok: true, texto: "Proceso actualizado." } : { ok: false, texto: r.mensaje });
    });
  }

  return (
    <Tarjeta titulo="PROCESO Y RECORRIDO">
      <Campo etiqueta="Fase actual">
        <select
          className="campo max-w-[260px]"
          value={fase}
          disabled={ocupado}
          onChange={(e) => ponerFase(e.target.value as Phase)}
        >
          <option value="" disabled>
            Elegir fase
          </option>
          {FASES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Campo>

      <p className="etiqueta-campo mt-4">Hitos del recorrido</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {HITOS.map((hito) => (
          <Interruptor
            key={hito.v}
            etiqueta={hito.l}
            activo={hechos.has(hito.v)}
            onChange={(v) => alternar(hito.v, v)}
          />
        ))}
      </div>
      <Aviso estado={estado} />
    </Tarjeta>
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

function Interruptor({
  etiqueta,
  activo,
  onChange,
}: {
  etiqueta: string;
  activo: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-[12px] py-[9px]">
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      <span className="text-[12.5px] leading-[1.3] font-semibold text-tinta">
        {etiqueta}
      </span>
    </label>
  );
}
