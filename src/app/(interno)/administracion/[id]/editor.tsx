"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MilestoneKind, Phase, Role } from "@iglesia/prisma-client";
import { FormularioDatosPersona } from "@/components/formulario-datos-persona";
import type { DatosPersona } from "@/lib/persona";
import { generarContrasena, LARGO_MINIMO_CONTRASENA } from "@/lib/contrasena";
import {
  alternarHito,
  asignarMentor,
  cambiarFase,
  crearAcceso,
  darDeBaja,
  guardarDatosPersona,
  guardarRolYPermisos,
  reactivar,
  restablecerContrasena,
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
  canMentor: boolean;
  coordinatesConsolidation: boolean;
};

export type BajaInfo = { motivo: string | null; fecha: string; por: string };

export function EditorPersona({
  personId,
  learnerId,
  datos,
  cuenta,
  fase,
  hitosCompletados,
  mentores,
  mentorActualId,
  estado,
  baja,
}: {
  personId: string;
  learnerId: string | null;
  datos: DatosForm;
  cuenta: Cuenta | null;
  fase: Phase | null;
  hitosCompletados: MilestoneKind[];
  mentores: { id: string; nombre: string }[];
  mentorActualId: string | null;
  estado: string | null;
  baja: BajaInfo | null;
}) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <SeccionDatos personId={personId} inicial={datos} />
      {cuenta ? (
        <>
          <SeccionRol cuenta={cuenta} />
          <SeccionContrasena personId={personId} email={cuenta.email} />
        </>
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
      {learnerId ? (
        <SeccionBaja
          learnerId={learnerId}
          retirada={estado === "RETIRADO"}
          baja={baja}
        />
      ) : null}
    </div>
  );
}

function SeccionBaja({
  learnerId,
  retirada,
  baja,
}: {
  learnerId: string;
  retirada: boolean;
  baja: BajaInfo | null;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState<null | EstadoAviso>(null);
  const [ocupado, iniciar] = useTransition();

  function ejecutarBaja() {
    if (!confirm("¿Dar de baja a esta persona? Saldrá de las listas y procesos, y se desactivará su acceso si tiene.")) {
      return;
    }
    iniciar(async () => {
      const r = await darDeBaja(learnerId, motivo);
      if (r.ok) {
        setMotivo("");
        router.refresh();
      } else {
        setEstado({ ok: false, texto: r.mensaje });
      }
    });
  }

  function ejecutarReactivar() {
    iniciar(async () => {
      const r = await reactivar(learnerId);
      if (r.ok) router.refresh();
      else setEstado({ ok: false, texto: r.mensaje });
    });
  }

  if (retirada) {
    return (
      <Tarjeta titulo="DADA DE BAJA">
        <p className="text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.7)]">
          Esta persona está dada de baja y no aparece en las listas activas.
        </p>
        {baja ? (
          <div className="mt-3 rounded-[10px] bg-papel p-3 text-[12px] leading-[1.5] text-[rgba(19,28,36,.7)]">
            {baja.motivo ? (
              <p>
                <strong>Motivo:</strong> {baja.motivo}
              </p>
            ) : null}
            <p className="mt-1 text-[11.5px] text-[rgba(19,28,36,.5)]">
              {baja.fecha} · por {baja.por}
            </p>
          </div>
        ) : null}
        <Aviso estado={estado} />
        <button
          type="button"
          onClick={ejecutarReactivar}
          disabled={ocupado}
          className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
        >
          {ocupado ? "Reactivando…" : "Reactivar"}
        </button>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="DAR DE BAJA">
      <p className="mb-3 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
        Para alguien que ya no quiere seguir ningún proceso en la iglesia. Queda
        registrado con su motivo en el listado de dados de baja, y se puede
        reactivar si regresa. Se desactiva su acceso al sistema si tiene.
      </p>
      <Campo etiqueta="Motivo de la baja">
        <textarea
          className="campo"
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por qué se le da de baja"
        />
      </Campo>
      <Aviso estado={estado} />
      <button
        type="button"
        onClick={ejecutarBaja}
        disabled={ocupado || motivo.trim().length < 3}
        className="mt-4 cursor-pointer rounded-[9px] bg-[rgb(180,60,47)] px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
      >
        {ocupado ? "Dando de baja…" : "Dar de baja"}
      </button>
    </Tarjeta>
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
  const [estado, setEstado] = useState<null | EstadoAviso>(null);
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

/// Resultado de una acción tal como se le muestra al usuario. `tono: "aviso"`
/// es el caso intermedio: la acción sí se hizo, pero algo secundario falló
/// (típicamente el correo) y hay que decirlo en vez de darlo por bueno.
type EstadoAviso = {
  ok: boolean;
  texto: string;
  tono?: "aviso";
};

function Aviso({ estado }: { estado: null | EstadoAviso }) {
  if (!estado) return null;
  return (
    <p
      className={`mt-3 text-[12px] leading-[1.4] font-semibold ${
        estado.tono === "aviso"
          ? "text-ambar-texto"
          : estado.ok
            ? "text-verde-700"
            : "text-[rgb(180,40,40)]"
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
  return (
    <Tarjeta titulo="DATOS DE LA PERSONA">
      <FormularioDatosPersona
        inicial={{ ...inicial, gender: inicial.gender as DatosPersona["gender"] }}
        guardar={(datos) => guardarDatosPersona(personId, datos)}
      />
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
  canMentor: boolean;
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
          etiqueta="Puede ser mentor (acompaña discípulos)"
          activo={valores.canMentor}
          onChange={(v) => onChange({ canMentor: v })}
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
    canMentor: cuenta.canMentor,
    coordinatesConsolidation: cuenta.coordinatesConsolidation,
  });
  const [estado, setEstado] = useState<null | EstadoAviso>(null);
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

function SeccionContrasena({
  personId,
  email,
}: {
  personId: string;
  email: string;
}) {
  const [automatica, setAutomatica] = useState(true);
  const [password, setPassword] = useState(() => generarContrasena());
  const [enviarPorCorreo, setEnviarPorCorreo] = useState(true);
  const [estado, setEstado] = useState<null | EstadoAviso>(null);
  const [guardando, iniciar] = useTransition();

  function elegirModo(auto: boolean) {
    setAutomatica(auto);
    setEstado(null);
    setPassword(auto ? generarContrasena() : "");
  }

  function restablecer() {
    setEstado(null);
    iniciar(async () => {
      const r = await restablecerContrasena(personId, { password, enviarPorCorreo });
      setEstado(
        r.ok
          ? r.aviso
            ? {
                ok: true,
                tono: "aviso",
                texto: `Contraseña restablecida, pero no se envió por correo. ${r.aviso} Entrégasela tú.`,
              }
            : {
                ok: true,
                texto: enviarPorCorreo
                  ? "Contraseña restablecida y enviada por correo."
                  : "Contraseña restablecida. Entrégasela tú.",
              }
          : { ok: false, texto: r.mensaje },
      );
    });
  }

  return (
    <Tarjeta titulo="ACCESO Y CONTRASEÑA">
      <div className="flex items-baseline gap-[10px] rounded-[10px] bg-azul-050 px-[14px] py-3">
        <span className="shrink-0 text-[11.5px] leading-[1.3] font-semibold text-[rgba(19,28,36,.5)]">
          Correo de ingreso
        </span>
        <span className="text-[13px] leading-[1.3] font-bold break-all text-tinta">
          {email}
        </span>
      </div>

      <p className="mt-4 text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
        Restablece su contraseña cuando la olvidó o no puede entrar.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <Opcion
          etiqueta="Generar una contraseña automática"
          activo={automatica}
          onChange={() => elegirModo(true)}
        />
        <Opcion
          etiqueta="Escribirla yo"
          activo={!automatica}
          onChange={() => elegirModo(false)}
        />
      </div>

      <label className="mt-3 block">
        <span className="etiqueta-campo">Contraseña nueva</span>
        {automatica ? (
          <div className="campo flex items-center justify-between gap-3">
            <span className="font-mono tracking-[.5px]">{password}</span>
            <button
              type="button"
              onClick={() => setPassword(generarContrasena())}
              className="shrink-0 cursor-pointer text-[11.5px] font-semibold text-azul-700"
            >
              Generar otra
            </button>
          </div>
        ) : (
          <input
            className="campo"
            value={password}
            minLength={LARGO_MINIMO_CONTRASENA}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`}
          />
        )}
      </label>

      <div className="mt-3">
        <Interruptor
          etiqueta="Enviarle la contraseña por correo"
          activo={enviarPorCorreo}
          onChange={setEnviarPorCorreo}
        />
      </div>

      <p className="aviso-ambar mt-[14px] text-[12px] leading-[1.45] font-semibold text-ambar-texto">
        La contraseña anterior deja de funcionar de inmediato.
      </p>

      <Aviso estado={estado} />
      <button
        type="button"
        onClick={restablecer}
        disabled={guardando || password.length < LARGO_MINIMO_CONTRASENA}
        className="mt-4 cursor-pointer rounded-[9px] bg-azul-900 px-[15px] py-[11px] text-[12.5px] leading-none font-semibold text-white disabled:opacity-60"
      >
        {guardando ? "Restableciendo…" : "Restablecer contraseña"}
      </button>
    </Tarjeta>
  );
}

/// Igual que `Interruptor` pero para elegir entre opciones excluyentes.
function Opcion({
  etiqueta,
  activo,
  onChange,
}: {
  etiqueta: string;
  activo: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-[rgba(19,28,36,.14)] bg-white px-[12px] py-[9px]">
      <input
        type="radio"
        checked={activo}
        onChange={onChange}
        className="h-4 w-4"
      />
      <span className="text-[12.5px] leading-[1.3] font-semibold text-tinta">
        {etiqueta}
      </span>
    </label>
  );
}

function SeccionCrearAcceso({ personId }: { personId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [v, setV] = useState({
    role: "MENTOR" as Role,
    capacity: 24,
    active: true,
    canLeadAlpha: false,
    canLeadFaithHouse: false,
    canMentor: false,
    coordinatesConsolidation: false,
  });
  const [estado, setEstado] = useState<null | EstadoAviso>(null);
  const [guardando, iniciar] = useTransition();

  function crear() {
    iniciar(async () => {
      const r = await crearAcceso(personId, { email, password, ...v });
      if (r.ok) {
        setEstado(
          r.aviso
            ? { ok: true, tono: "aviso", texto: `Acceso creado. ${r.aviso}` }
            : { ok: true, texto: "Acceso creado." },
        );
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
  const [estado, setEstado] = useState<null | EstadoAviso>(null);
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
