"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CallOutcome, Operation72Status } from "@iglesia/prisma-client";
import { RESULTADOS_DE_LLAMADA } from "@/lib/op72";
import {
  agendarVisita,
  cerrarVisita,
  entregarAMentor,
  registrarLlamada,
} from "./acciones";

export type MentorOpcion = { id: string; nombre: string; role: string };

export type TarjetaPersona = {
  operacionId: string;
  learnerId: string;
  estado: Operation72Status;
  nombre: string;
  origen: string;
  detalle: string;
  chip: string;
  urgencia: "vencida" | "urgente" | "normal";
  avance: number;
  accion: string;
  /// Mentor propuesto por el sistema, si lo hay (para dejarlo preseleccionado).
  mentorPropuestoId: string | null;
  entrega: {
    titulo: string;
    mentor: string;
    detalle: string;
  } | null;
};

const ESTILO_CHIP: Record<TarjetaPersona["urgencia"], string> = {
  vencida: "bg-rojo-fondo text-rojo",
  urgente: "bg-ambar-chip text-ambar-texto",
  normal: "bg-verde-100 text-verde-700",
};

const ESTILO_BORDE: Record<TarjetaPersona["urgencia"], string> = {
  vencida: "border-[rgba(180,70,47,.45)]",
  urgente: "border-[rgba(201,123,44,.45)]",
  normal: "border-[rgba(19,28,36,.1)]",
};

const ESTILO_BARRA: Record<TarjetaPersona["urgencia"], string> = {
  vencida: "bg-rojo",
  urgente: "bg-ambar-barra",
  normal: "bg-verde-500",
};

export function TarjetaDePersona({
  persona,
  mentores,
}: {
  persona: TarjetaPersona;
  mentores: MentorOpcion[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [enCurso, iniciar] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) setError(resultado.mensaje ?? "No se pudo guardar.");
      else setAbierto(false);
    });
  }

  return (
    <article
      className={`rounded-[13px] border bg-white p-4 ${ESTILO_BORDE[persona.urgencia]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] leading-[1.2] font-semibold text-tinta">
            <Link
              href={`/expediente/${persona.learnerId}`}
              className="text-tinta hover:text-azul-700 hover:underline"
            >
              {persona.nombre}
            </Link>
          </h3>
          <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.5)]">
            {persona.origen}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-[20px] px-2 py-1 text-[9.5px] leading-none font-bold whitespace-nowrap ${ESTILO_CHIP[persona.urgencia]}`}
        >
          {persona.chip}
        </span>
      </div>

      <div className="mt-[14px] h-[6px] overflow-hidden rounded-[4px] bg-[rgba(19,28,36,.1)]">
        <div
          className={`h-full ${ESTILO_BARRA[persona.urgencia]}`}
          style={{ width: `${persona.avance}%` }}
        />
      </div>

      <p className="mt-[11px] text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
        {persona.detalle}
      </p>

      {abierto ? (
        <div className="mt-3 rounded-[10px] bg-papel p-3">
          {persona.estado === Operation72Status.INICIADA ? (
            <FormularioDeLlamada
              enCurso={enCurso}
              alGuardar={(datos) =>
                ejecutar(() => registrarLlamada(persona.operacionId, datos))
              }
              alCancelar={() => setAbierto(false)}
            />
          ) : persona.estado === Operation72Status.CONTACTADA ? (
            <FormularioDeVisita
              enCurso={enCurso}
              alGuardar={(datos) =>
                ejecutar(() => agendarVisita(persona.operacionId, datos))
              }
              alCancelar={() => setAbierto(false)}
            />
          ) : persona.estado === Operation72Status.LISTA_PARA_ENTREGA ? (
            <FormularioDeEntrega
              enCurso={enCurso}
              mentores={mentores}
              mentorPropuestoId={persona.mentorPropuestoId}
              alGuardar={(mentorId) =>
                ejecutar(() => entregarAMentor(persona.operacionId, mentorId))
              }
              alCancelar={() => setAbierto(false)}
            />
          ) : (
            <FormularioDeCierre
              enCurso={enCurso}
              alGuardar={(resumen) =>
                ejecutar(() => cerrarVisita(persona.operacionId, resumen))
              }
              alCancelar={() => setAbierto(false)}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={enCurso}
          className="mt-3 w-full cursor-pointer rounded-[8px] border-0 bg-azul-900 p-[10px] text-[11.5px] leading-none font-semibold text-white disabled:opacity-60"
        >
          {enCurso ? "Guardando…" : persona.accion}
        </button>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-2 text-[11.5px] leading-[1.4] font-medium text-rojo"
        >
          {error}
        </p>
      ) : null}

      {persona.entrega ? (
        <div className="mt-3 rounded-[10px] border border-[rgba(110,154,85,.4)] bg-verde-050 p-3">
          <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-verde-700">
            {persona.entrega.titulo}
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.35] font-semibold text-tinta">
            {persona.entrega.mentor}
          </p>
          <p className="mt-1 text-[11.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
            {persona.entrega.detalle}
          </p>
        </div>
      ) : null}
    </article>
  );
}

/// La fecha local, no la UTC: en Colombia, después de las 7 p. m. `toISOString`
/// ya devuelve el día siguiente.
const HOY = () => {
  const ahora = new Date();
  const mes = `${ahora.getMonth() + 1}`.padStart(2, "0");
  const dia = `${ahora.getDate()}`.padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
};

function Etiqueta({ children }: { children: React.ReactNode }) {
  return <span className="etiqueta-campo">{children}</span>;
}

function Botones({
  enCurso,
  texto,
  alGuardar,
  alCancelar,
}: {
  enCurso: boolean;
  texto: string;
  alGuardar: () => void;
  alCancelar: () => void;
}) {
  return (
    <div className="mt-3 flex gap-2">
      <button
        type="button"
        disabled={enCurso}
        onClick={alGuardar}
        className="boton-primario flex-1 justify-center py-[9px] text-[11.5px]"
      >
        {enCurso ? "Guardando…" : texto}
      </button>
      <button
        type="button"
        onClick={alCancelar}
        className="boton-secundario py-[9px] text-[11.5px]"
      >
        Cancelar
      </button>
    </div>
  );
}

function FormularioDeLlamada({
  enCurso,
  alGuardar,
  alCancelar,
}: {
  enCurso: boolean;
  alGuardar: (datos: {
    fecha: string;
    resultado: CallOutcome;
    observacion: string;
    peticionDeOracion: string;
  }) => void;
  alCancelar: () => void;
}) {
  const [fecha, setFecha] = useState(HOY);
  const [resultado, setResultado] = useState<CallOutcome | null>(null);
  const [observacion, setObservacion] = useState("");
  const [peticion, setPeticion] = useState("");

  return (
    <div>
      <label className="block">
        <Etiqueta>Fecha de la llamada</Etiqueta>
        <input
          type="date"
          value={fecha}
          onChange={(evento) => setFecha(evento.target.value)}
          className="campo"
        />
      </label>

      <div className="mt-3">
        <Etiqueta>¿Cómo salió?</Etiqueta>
        <div className="mt-2 flex flex-col gap-[6px]">
          {RESULTADOS_DE_LLAMADA.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={resultado === valor}
              onClick={() => setResultado(valor)}
              className="opcion px-3 py-[9px] text-left text-[12px]"
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-3 block">
        <Etiqueta>Observación</Etiqueta>
        <textarea
          value={observacion}
          onChange={(evento) => setObservacion(evento.target.value)}
          rows={2}
          placeholder="Qué se conversó"
          className="campo font-medium"
        />
      </label>

      <label className="mt-3 block">
        <Etiqueta>
          Petición de oración{" "}
          <span className="font-medium text-[rgba(19,28,36,.4)]">si contó alguna</span>
        </Etiqueta>
        <textarea
          value={peticion}
          onChange={(evento) => setPeticion(evento.target.value)}
          rows={2}
          placeholder="Por su mamá, está enferma"
          className="campo font-medium"
        />
      </label>

      <Botones
        enCurso={enCurso}
        texto="Guardar llamada"
        alCancelar={alCancelar}
        alGuardar={() =>
          resultado &&
          alGuardar({ fecha, resultado, observacion, peticionDeOracion: peticion })
        }
      />
      {!resultado ? (
        <p className="mt-2 text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
          Elige cómo salió la llamada para guardar.
        </p>
      ) : null}
    </div>
  );
}

function FormularioDeVisita({
  enCurso,
  alGuardar,
  alCancelar,
}: {
  enCurso: boolean;
  alGuardar: (datos: {
    cuando: string;
    lugar: string;
    virtual: boolean;
    nota: string;
  }) => void;
  alCancelar: () => void;
}) {
  const [cuando, setCuando] = useState("");
  const [lugar, setLugar] = useState("");
  const [virtual, setVirtual] = useState(false);
  const [nota, setNota] = useState("");

  return (
    <div>
      <label className="block">
        <Etiqueta>Fecha y hora de la visita</Etiqueta>
        <input
          type="datetime-local"
          value={cuando}
          onChange={(evento) => setCuando(evento.target.value)}
          className="campo"
        />
      </label>

      <div className="mt-3">
        <Etiqueta>Lugar</Etiqueta>
        <input
          value={lugar}
          onChange={(evento) => setLugar(evento.target.value)}
          disabled={virtual}
          placeholder="Su casa · la cafetería de la esquina"
          className="campo font-medium disabled:opacity-50"
        />
        <button
          type="button"
          aria-pressed={virtual}
          onClick={() => setVirtual(!virtual)}
          className="opcion mt-2 px-3 py-[9px] text-[12px]"
        >
          Es virtual
        </button>
      </div>

      <label className="mt-3 block">
        <Etiqueta>Nota</Etiqueta>
        <textarea
          value={nota}
          onChange={(evento) => setNota(evento.target.value)}
          rows={2}
          placeholder="Va acompañada · pidió que fuéramos dos"
          className="campo font-medium"
        />
      </label>

      <Botones
        enCurso={enCurso}
        texto="Agendar visita"
        alCancelar={alCancelar}
        alGuardar={() => alGuardar({ cuando, lugar, virtual, nota })}
      />
    </div>
  );
}

const ETIQUETA_ROL: Record<string, string> = {
  MENTOR: "Mentor",
  PASTOR: "Pastor",
};

function FormularioDeEntrega({
  enCurso,
  mentores,
  mentorPropuestoId,
  alGuardar,
  alCancelar,
}: {
  enCurso: boolean;
  mentores: MentorOpcion[];
  mentorPropuestoId: string | null;
  /// `undefined` = usar el mentor propuesto por el sistema (conserva la línea).
  alGuardar: (mentorId: string | undefined) => void;
  alCancelar: () => void;
}) {
  // Arranca con el mentor propuesto si sigue siendo elegible; si no, vacío.
  const propuestoElegible = mentores.some((m) => m.id === mentorPropuestoId);
  const [mentorId, setMentorId] = useState(
    propuestoElegible ? (mentorPropuestoId ?? "") : "",
  );

  return (
    <div>
      <label className="block">
        <Etiqueta>Entregar a</Etiqueta>
        <select
          value={mentorId}
          onChange={(evento) => setMentorId(evento.target.value)}
          className="campo font-medium"
        >
          <option value="">Elige un mentor…</option>
          {mentores.map((mentor) => (
            <option key={mentor.id} value={mentor.id}>
              {mentor.nombre}
              {ETIQUETA_ROL[mentor.role] ? ` · ${ETIQUETA_ROL[mentor.role]}` : ""}
              {mentor.id === mentorPropuestoId ? " (propuesto)" : ""}
            </option>
          ))}
        </select>
      </label>

      {mentores.length === 0 ? (
        <p className="mt-2 text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
          No hay mentores disponibles. Un administrador debe marcar a alguien con
          rol de mentor o pastor.
        </p>
      ) : null}

      <Botones
        enCurso={enCurso}
        texto="Entregar a mentor"
        alCancelar={alCancelar}
        alGuardar={() =>
          mentorId &&
          alGuardar(mentorId === mentorPropuestoId ? undefined : mentorId)
        }
      />
      {!mentorId ? (
        <p className="mt-2 text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
          Escoge a quién se entrega para confirmar.
        </p>
      ) : null}
    </div>
  );
}

function FormularioDeCierre({
  enCurso,
  alGuardar,
  alCancelar,
}: {
  enCurso: boolean;
  alGuardar: (resumen: string) => void;
  alCancelar: () => void;
}) {
  const [resumen, setResumen] = useState("");

  return (
    <div>
      <label className="block">
        <Etiqueta>Resumen de la visita</Etiqueta>
        <textarea
          value={resumen}
          onChange={(evento) => setResumen(evento.target.value)}
          rows={4}
          placeholder="Cómo la encontramos, qué se conversó, con qué quedó"
          className="campo font-medium"
        />
      </label>

      <Botones
        enCurso={enCurso}
        texto="Cerrar visita"
        alCancelar={alCancelar}
        alGuardar={() => alGuardar(resumen)}
      />
    </div>
  );
}
