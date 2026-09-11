"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CallOutcome, Operation72Status } from "@iglesia/prisma-client";
import {
  MOTIVOS_DE_ASISTENTE,
  MOTIVOS_DE_BAJA,
  RESULTADOS_DE_LLAMADA,
} from "@/lib/op72";
import {
  agendarVisita,
  cerrarVisita,
  darDeBajaDesdeTablero,
  entregarAMentor,
  marcarAsistenteDesdeTablero,
  registrarLlamada,
  deshacerVisitaAgendada,
  reprogramarVisita,
  retirarSolicitudDesdeTablero,
} from "./acciones";

export type MentorOpcion = { id: string; nombre: string; role: string };

/// Un dato de la tarjeta con su rótulo. Si falta, se dice que falta: la
/// tarjeta nunca muestra un «Sin registrar» suelto sin decir de qué.
export type DatoDeTarjeta = {
  rotulo: string;
  valor: string | null;
  ausente: boolean;
  /// Qué decir cuando falta (por defecto «No quedó registrado»).
  faltante?: string;
};

export type TarjetaPersona = {
  operacionId: string;
  learnerId: string;
  estado: Operation72Status;
  nombre: string;
  /// Cuándo empezaron a correr sus 72 horas.
  registrada: string;
  datos: DatoDeTarjeta[];
  /// Qué fue lo último que pasó, quién lo hizo y cuándo.
  movimiento: {
    titulo: string;
    quien: string | null;
    cuando: string;
    observacion: string | null;
  };
  /// Baja pedida y todavía sin respuesta. Mientras esté, la persona sigue en
  /// el tablero y en la carga de su consolidador.
  bajaEnEspera: {
    solicitudId: string;
    motivo: string;
    nota: string | null;
    quien: string;
    cuando: string;
  } | null;
  /// Un administrador NO autorizó la baja y dejó dicho qué hacer con la
  /// persona. Se queda a la vista hasta que se vuelva a pedir la baja.
  devolucion: {
    observacion: string;
    quien: string | null;
    cuando: string | null;
  } | null;
  /// Solo en VISITA PENDIENTE: la visita que está acordada.
  visitaAcordada: {
    cuando: string;
    donde: string | null;
    quien: string | null;
    desdeCrm: boolean;
    nota: string | null;
    /// Lo pactado, tal como lo pide el campo del formulario, para poder
    /// reprogramar sin volver a escribirlo todo.
    valorFecha: string | null;
    lugar: string | null;
    virtual: boolean;
  } | null;
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

type Panel = "accion" | "baja" | "asistente" | "reprogramar" | "deshacer" | null;

export function TarjetaDePersona({
  persona,
  mentores,
  bajaRequiereAutorizacion,
}: {
  persona: TarjetaPersona;
  mentores: MentorOpcion[];
  /// Quien puede autorizar bajas las aplica directo; los demás las piden.
  bajaRequiereAutorizacion: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [enCurso, iniciar] = useTransition();
  const router = useRouter();

  /// ⚠️ **`router.refresh()` no es opcional.** La acción del servidor invalida
  /// su caché con `revalidatePath`, pero la página que el navegador ya pintó se
  /// queda igual: el panel se cierra, el dato quedó guardado, y en pantalla
  /// sigue el valor viejo.
  ///
  /// Se veía poco porque casi todas las acciones **mueven la tarjeta de
  /// columna**, y eso tapaba el problema. Lo destapó reprogramar una visita,
  /// donde la tarjeta se queda en su sitio y lo único que cambia es la hora:
  /// el usuario cambió la hora de Ana López, no vio el cambio, y lo volvió a
  /// hacer — quedaron dos reprogramaciones con un minuto de diferencia.
  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        setError(resultado.mensaje ?? "No se pudo guardar.");
        return;
      }
      setPanel(null);
      router.refresh();
    });
  }

  return (
    <article
      className={`rounded-[13px] border bg-white p-4 ${ESTILO_BORDE[persona.urgencia]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-[14px] leading-[1.2] font-semibold text-tinta">
          <Link
            href={`/expediente/${persona.learnerId}`}
            className="text-tinta hover:text-azul-700 hover:underline"
          >
            {persona.nombre}
          </Link>
        </h3>
        <span
          className={`shrink-0 rounded-[20px] px-2 py-1 text-[9.5px] leading-none font-bold whitespace-nowrap ${ESTILO_CHIP[persona.urgencia]}`}
        >
          {persona.chip}
        </span>
      </div>

      <div className="mt-[10px] h-[6px] overflow-hidden rounded-[4px] bg-[rgba(19,28,36,.1)]">
        <div
          className={`h-full ${ESTILO_BARRA[persona.urgencia]}`}
          style={{ width: `${persona.avance}%` }}
        />
      </div>
      <p className="mt-[6px] text-[10px] leading-none font-semibold text-[rgba(19,28,36,.42)]">
        Registrada {persona.registrada}
      </p>

      <dl className="mt-[13px] flex flex-col gap-[6px]">
        {persona.datos.map((dato) => (
          <div key={dato.rotulo} className="flex items-baseline gap-2">
            <dt className="w-[70px] shrink-0 text-[9.5px] leading-[1.35] font-extrabold tracking-[.06em] text-[rgba(19,28,36,.42)]">
              {dato.rotulo}
            </dt>
            {dato.ausente ? (
              <dd className="m-0 text-[11.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.38)] italic">
                {dato.faltante ?? "No quedó registrado"}
              </dd>
            ) : (
              <dd className="m-0 text-[11.5px] leading-[1.35] font-semibold text-tinta">
                {dato.valor}
              </dd>
            )}
          </div>
        ))}
      </dl>

      {persona.visitaAcordada ? (
        <div className="mt-[13px] border-t border-[rgba(19,28,36,.09)] pt-[10px]">
          <p className="text-[9.5px] leading-none font-extrabold tracking-[.06em] text-[rgba(19,28,36,.42)]">
            VISITA ACORDADA
          </p>
          <p className="mt-[6px] text-[11.5px] leading-[1.4] font-semibold text-tinta">
            {persona.visitaAcordada.cuando}
            {persona.visitaAcordada.donde ? ` · ${persona.visitaAcordada.donde}` : ""}
          </p>
          <p className="mt-[3px] text-[10.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
            {persona.visitaAcordada.desdeCrm
              ? "La agendó la línea desde el CRM"
              : persona.visitaAcordada.quien
                ? `La agendó ${persona.visitaAcordada.quien}`
                : "Agendada"}
          </p>
          {persona.visitaAcordada.nota ? (
            <p className="mt-[6px] text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.6)]">
              «{persona.visitaAcordada.nota}»
            </p>
          ) : null}
          {persona.visitaAcordada.desdeCrm ? (
            <span className="mt-2 inline-block rounded-[20px] bg-azul-100 px-2 py-1 text-[9px] leading-none font-bold text-azul-700">
              LLEGÓ DEL FORMULARIO DE VISITA
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-[13px] border-t border-[rgba(19,28,36,.09)] pt-[10px]">
          <p className="text-[9.5px] leading-none font-extrabold tracking-[.06em] text-[rgba(19,28,36,.42)]">
            ÚLTIMO MOVIMIENTO
          </p>
          <p className="mt-[6px] text-[11.5px] leading-[1.4] font-semibold text-tinta">
            {persona.movimiento.titulo}
          </p>
          <p className="mt-[3px] text-[10.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
            {[persona.movimiento.quien, persona.movimiento.cuando].filter(Boolean).join(" · ")}
          </p>
          {persona.movimiento.observacion ? (
            <p className="mt-[6px] text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.6)]">
              «{persona.movimiento.observacion}»
            </p>
          ) : null}
        </div>
      )}

      {persona.devolucion ? (
        <div className="mt-3 rounded-[10px] border border-[rgba(27,74,122,.28)] bg-azul-050 p-3">
          <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-azul-700">
            QUÉ HACER CON ESTA PERSONA
          </p>
          <p className="mt-2 text-[11.5px] leading-[1.5] font-medium text-tinta">
            «{persona.devolucion.observacion}»
          </p>
          <p className="mt-2 text-[10.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.5)]">
            {[
              persona.devolucion.quien
                ? `${persona.devolucion.quien} no autorizó la baja`
                : "No se autorizó la baja",
              persona.devolucion.cuando,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {persona.bajaEnEspera ? (
        <div className="mt-3 rounded-[10px] border border-[rgba(201,123,44,.3)] bg-ambar-fondo p-3">
          <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-ambar-texto">
            BAJA SOLICITADA · ESPERANDO AUTORIZACIÓN
          </p>
          <p className="mt-2 text-[12px] leading-[1.35] font-bold text-tinta">
            {persona.bajaEnEspera.motivo}
          </p>
          <p className="mt-[3px] text-[10.5px] leading-[1.35] font-medium text-[rgba(19,28,36,.5)]">
            La pidió {persona.bajaEnEspera.quien} · {persona.bajaEnEspera.cuando}
          </p>
          {persona.bajaEnEspera.nota ? (
            <p className="mt-[6px] text-[11.5px] leading-[1.45] font-medium text-[rgba(19,28,36,.6)]">
              «{persona.bajaEnEspera.nota}»
            </p>
          ) : null}
          <p className="mt-[9px] text-[10.5px] leading-[1.4] font-semibold text-ambar-texto">
            Sigue contando en tu carga hasta que un administrador responda.
          </p>
          <div className="mt-2 flex items-center justify-between">
            <Link
              href={`/expediente/${persona.learnerId}`}
              className="text-[11px] leading-none font-semibold text-azul-700"
            >
              Ver expediente
            </Link>
            <button
              type="button"
              onClick={() =>
                ejecutar(() =>
                  retirarSolicitudDesdeTablero(persona.bajaEnEspera!.solicitudId),
                )
              }
              disabled={enCurso}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11px] leading-none font-semibold text-[rgba(19,28,36,.5)] disabled:opacity-60"
            >
              {enCurso ? "Retirando…" : "Retirar solicitud"}
            </button>
          </div>
        </div>
      ) : panel === "accion" ? (
        <div className="mt-3 rounded-[10px] bg-papel p-3">
          {persona.estado === Operation72Status.INICIADA ||
          persona.estado === Operation72Status.SEGUIMIENTO ? (
            <FormularioDeLlamada
              enCurso={enCurso}
              alGuardar={(datos) =>
                ejecutar(() => registrarLlamada(persona.operacionId, datos))
              }
              alCancelar={() => setPanel(null)}
            />
          ) : persona.estado === Operation72Status.CONTACTADA ? (
            <FormularioDeVisita
              enCurso={enCurso}
              alGuardar={(datos) =>
                ejecutar(() => agendarVisita(persona.operacionId, datos))
              }
              alCancelar={() => setPanel(null)}
            />
          ) : persona.estado === Operation72Status.LISTA_PARA_ENTREGA ? (
            <FormularioDeEntrega
              enCurso={enCurso}
              mentores={mentores}
              mentorPropuestoId={persona.mentorPropuestoId}
              alGuardar={(mentorId) =>
                ejecutar(() => entregarAMentor(persona.operacionId, mentorId))
              }
              alCancelar={() => setPanel(null)}
            />
          ) : (
            <FormularioDeCierre
              enCurso={enCurso}
              alGuardar={(resumen) =>
                ejecutar(() => cerrarVisita(persona.operacionId, resumen))
              }
              alCancelar={() => setPanel(null)}
            />
          )}
        </div>
      ) : panel === "reprogramar" && persona.visitaAcordada ? (
        <div className="mt-3 rounded-[10px] bg-papel p-3">
          <FormularioDeCambioDeVisita
            nombre={persona.nombre}
            acordada={persona.visitaAcordada}
            enCurso={enCurso}
            alGuardar={(datos) =>
              ejecutar(() => reprogramarVisita(persona.operacionId, datos))
            }
            alCancelar={() => setPanel(null)}
          />
        </div>
      ) : panel === "deshacer" && persona.visitaAcordada ? (
        <div className="mt-3 rounded-[10px] bg-papel p-3">
          <FormularioDeVisitaPorError
            nombre={persona.nombre}
            acordada={persona.visitaAcordada}
            enCurso={enCurso}
            alGuardar={(datos) =>
              ejecutar(() => deshacerVisitaAgendada(persona.operacionId, datos))
            }
            alCancelar={() => setPanel(null)}
          />
        </div>
      ) : panel === "asistente" ? (
        <div className="mt-3 rounded-[10px] bg-papel p-3">
          <FormularioDeAsistente
            nombre={persona.nombre}
            enCurso={enCurso}
            alGuardar={(datos) =>
              ejecutar(() => marcarAsistenteDesdeTablero(persona.learnerId, datos))
            }
            alCancelar={() => setPanel(null)}
          />
        </div>
      ) : panel === "baja" ? (
        <div className="mt-3 rounded-[10px] bg-papel p-3">
          <FormularioDeBaja
            nombre={persona.nombre}
            requiereAutorizacion={bajaRequiereAutorizacion}
            enCurso={enCurso}
            alGuardar={(datos) =>
              ejecutar(() => darDeBajaDesdeTablero(persona.learnerId, datos))
            }
            alCancelar={() => setPanel(null)}
          />
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setPanel("accion")}
            disabled={enCurso}
            className="mt-3 w-full cursor-pointer rounded-[8px] border-0 bg-azul-900 p-[10px] text-[11.5px] leading-none font-semibold text-white disabled:opacity-60"
          >
            {enCurso ? "Guardando…" : persona.accion}
          </button>
          <div className="mt-2 flex items-center justify-between">
            <Link
              href={`/expediente/${persona.learnerId}`}
              className="text-[11px] leading-none font-semibold text-azul-700"
            >
              Ver expediente
            </Link>
            <button
              type="button"
              onClick={() => setPanel("baja")}
              disabled={enCurso}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11px] leading-none font-semibold text-rojo disabled:opacity-60"
            >
              {bajaRequiereAutorizacion ? "Pedir la baja" : "Dar de baja"}
            </button>
          </div>
          {persona.visitaAcordada ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
              <button
                type="button"
                onClick={() => setPanel("reprogramar")}
                disabled={enCurso}
                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] leading-none font-semibold text-azul-700 disabled:opacity-60"
              >
                Cambiar la fecha de la visita
              </button>
              <button
                type="button"
                onClick={() => setPanel("deshacer")}
                disabled={enCurso}
                className="cursor-pointer border-0 bg-transparent p-0 text-[11px] leading-none font-semibold text-[rgba(19,28,36,.5)] disabled:opacity-60"
              >
                No era esta persona
              </button>
            </div>
          ) : null}
          <div className="mt-[9px] border-t border-[rgba(19,28,36,.09)] pt-[9px] text-center">
            <button
              type="button"
              onClick={() => setPanel("asistente")}
              disabled={enCurso}
              className="cursor-pointer border-0 bg-transparent p-0 text-[11px] leading-none font-bold text-verde-700 disabled:opacity-60"
            >
              Asiste, no quiere proceso
            </button>
          </div>
        </>
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

/// Pedir la baja sin salir del tablero. El motivo es obligatorio: una persona
/// que desaparece del tablero sin explicación es un dato perdido.
///
/// Para quien NO autoriza bajas esto es una solicitud, y entonces la nota
/// también es obligatoria: es lo único que el administrador va a leer para
/// decidir. Quien sí autoriza la aplica en el acto y la nota sigue siendo
/// opcional, porque nadie más tiene que entenderla.
function FormularioDeBaja({
  nombre,
  requiereAutorizacion,
  enCurso,
  alGuardar,
  alCancelar,
}: {
  nombre: string;
  requiereAutorizacion: boolean;
  enCurso: boolean;
  alGuardar: (datos: { motivo: string; nota: string }) => void;
  alCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  return (
    <div>
      <p className="text-[12px] leading-[1.4] font-semibold text-tinta">
        Dar de baja a {nombre}
      </p>
      {requiereAutorizacion ? (
        <div className="mt-2 rounded-[8px] border border-[rgba(201,123,44,.3)] bg-ambar-fondo p-[10px]">
          <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-ambar-texto">
            ESTO NO ES DEFINITIVO
          </p>
          <p className="mt-[7px] text-[11px] leading-[1.45] font-medium text-ambar-texto">
            La solicitud va a un administrador para que la autorice. Mientras
            tanto la persona <strong className="font-bold">sigue en tu lista</strong>{" "}
            y no pierde su acceso.
          </p>
        </div>
      ) : (
        <p className="mt-1 text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
          Sale del tablero y de consolidación. Su expediente e historial se
          conservan y se puede reactivar desde Administración.
        </p>
      )}

      <div className="mt-3">
        <Etiqueta>¿Por qué se da de baja?</Etiqueta>
        <div className="mt-[7px] flex flex-col gap-[6px]">
          {MOTIVOS_DE_BAJA.map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={motivo === opcion}
              onClick={() => setMotivo(opcion)}
              className="opcion px-3 py-[9px] text-left text-[11.5px] leading-[1.25]"
            >
              {opcion}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-3 block">
        <Etiqueta>
          {requiereAutorizacion
            ? "Cuéntale al administrador qué pasó"
            : "Nota para el expediente (opcional)"}
        </Etiqueta>
        <textarea
          value={nota}
          onChange={(evento) => setNota(evento.target.value)}
          rows={requiereAutorizacion ? 3 : 2}
          className={requiereAutorizacion ? "campo" : "campo campo-opcional"}
          placeholder={
            requiereAutorizacion
              ? "Qué intentaste, cuántas veces y qué te respondieron."
              : "Qué pasó, para quien lea el expediente después."
          }
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={
            enCurso || !motivo || (requiereAutorizacion && nota.trim().length < 10)
          }
          onClick={() => motivo && alGuardar({ motivo, nota })}
          className={`flex-1 cursor-pointer rounded-[10px] border-0 px-4 py-[9px] text-[11.5px] leading-none font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${
            requiereAutorizacion ? "bg-azul-900" : "bg-rojo"
          }`}
        >
          {enCurso
            ? "Guardando…"
            : requiereAutorizacion
              ? "Enviar a autorización"
              : "Dar de baja"}
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="boton-secundario py-[9px] text-[11.5px]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/// El tercer desenlace de la Operación 72: la persona asiste, pero hoy no
/// quiere proceso.
///
/// La nota es obligatoria (mínimo 10 caracteres) a propósito. El motivo de la
/// lista sirve para contar; la nota es lo único que le explica el caso a quien
/// abra el listado dentro de un año.
/// Deshacer una visita que se le agendó a la persona equivocada.
///
/// Es el único panel del tablero que **retira** algo en vez de añadirlo, y por
/// eso dice con letra clara qué va a pasar: a dónde vuelve la tarjeta y qué
/// queda en el expediente. Quien deshace tiene que poder ver que no está
/// borrando el historial de nadie.
function FormularioDeVisitaPorError({
  nombre,
  acordada,
  enCurso,
  alGuardar,
  alCancelar,
}: {
  nombre: string;
  acordada: { cuando: string; donde: string | null };
  enCurso: boolean;
  alGuardar: (datos: { motivo: string }) => void;
  alCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <div>
      <p className="text-[12px] leading-[1.4] font-semibold text-tinta">
        Esta visita no era de {nombre}
      </p>
      <p className="mt-1 text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
        Se retira la visita del <strong className="font-bold">{acordada.cuando}</strong>
        {acordada.donde ? ` · ${acordada.donde}` : ""} y la tarjeta vuelve a{" "}
        <strong className="font-bold">CONTACTADA</strong>, lista para agendarle
        la suya cuando la haya.
      </p>
      <p className="mt-[6px] text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
        La llamada que recibió <strong className="font-bold">se conserva</strong>,
        y en su expediente la visita queda tachada con lo que escribas aquí. No
        se borra nada.
      </p>

      <label className="mt-3 block">
        <Etiqueta>¿Qué pasó?</Etiqueta>
        <textarea
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          rows={2}
          className="campo"
          placeholder="Era la visita de otra persona con el mismo nombre."
        />
        <span className="mt-[6px] block text-[10.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.45)]">
          Es lo que va a leer quien abra el expediente y vea que la tarjeta se
          movió y volvió.
        </span>
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={enCurso || motivo.trim().length < 10}
          onClick={() => alGuardar({ motivo })}
          className="flex-1 cursor-pointer rounded-[8px] border-0 bg-azul-900 p-[10px] text-[11.5px] leading-none font-semibold text-white disabled:opacity-60"
        >
          {enCurso ? "Guardando…" : "Deshacer la visita"}
        </button>
        <button
          type="button"
          disabled={enCurso}
          onClick={alCancelar}
          className="cursor-pointer rounded-[8px] border border-[rgba(19,28,36,.18)] bg-white px-3 py-[10px] text-[11.5px] leading-none font-semibold text-tinta disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function FormularioDeAsistente({
  nombre,
  enCurso,
  alGuardar,
  alCancelar,
}: {
  nombre: string;
  enCurso: boolean;
  alGuardar: (datos: { motivo: string; nota: string }) => void;
  alCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [nota, setNota] = useState("");

  return (
    <div>
      <p className="text-[12px] leading-[1.4] font-semibold text-tinta">
        {nombre} asiste, pero no quiere proceso
      </p>
      <p className="mt-1 text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
        Sale del tablero y deja de contarte carga.{" "}
        <strong className="font-bold">No se le da de baja</strong>: conserva su
        expediente, su acceso y lo que ya alcanzó.
      </p>

      <div className="mt-3">
        <Etiqueta>¿Por qué no quiere?</Etiqueta>
        <div className="mt-[7px] flex flex-col gap-[6px]">
          {MOTIVOS_DE_ASISTENTE.map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={motivo === opcion}
              onClick={() => setMotivo(opcion)}
              className="opcion px-3 py-[9px] text-left text-[11.5px] leading-[1.25]"
            >
              {opcion}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-3 block">
        <Etiqueta>Cuéntalo con tus palabras</Etiqueta>
        <textarea
          value={nota}
          onChange={(evento) => setNota(evento.target.value)}
          rows={3}
          className="campo"
          placeholder="Qué te dijo y en qué quedaron."
        />
        <span className="mt-[6px] block text-[10.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.45)]">
          Es lo que va a leer quien lo busque dentro de un año.
        </span>
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={enCurso || !motivo || nota.trim().length < 10}
          onClick={() => motivo && alGuardar({ motivo, nota })}
          className="flex-1 cursor-pointer rounded-[10px] border-0 bg-azul-900 px-4 py-[9px] text-[11.5px] leading-none font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enCurso ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="boton-secundario py-[9px] text-[11.5px]"
        >
          Cancelar
        </button>
      </div>
    </div>
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

/// Cambiar la fecha u hora de una visita ya acordada, por las **dos razones
/// por las que pasa de verdad** (dichas por el usuario, 11-sep): la visita se
/// movió, o la fecha se digitó mal.
///
/// **La diferencia no es cosmética, decide qué se guarda:**
/// - **Se movió** → sí hubo una visita pactada para ese día y se corrió, así
///   que se apila un registro nuevo y el historial muestra el movimiento.
/// - **Estaba mal escrita** → **nunca hubo** visita a esa hora. Apilar un «se
///   reprogramó» inventaría un movimiento que no pasó, así que se corrige el
///   registro en su sitio y el cambio queda en la auditoría.
function FormularioDeCambioDeVisita({
  nombre,
  acordada,
  enCurso,
  alGuardar,
  alCancelar,
}: {
  nombre: string;
  acordada: NonNullable<TarjetaPersona["visitaAcordada"]>;
  enCurso: boolean;
  alGuardar: (datos: {
    cuando: string;
    lugar: string;
    virtual: boolean;
    nota: string;
    motivo: "movida" | "correccion";
  }) => void;
  alCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState<"movida" | "correccion">("movida");
  const corrige = motivo === "correccion";

  return (
    <div>
      <p className="text-[12px] leading-[1.4] font-semibold text-tinta">
        La visita de {nombre}
      </p>
      <p className="mt-1 text-[11px] leading-[1.45] font-medium text-[rgba(19,28,36,.55)]">
        Ahora dice <strong className="font-bold">{acordada.cuando}</strong>.
      </p>

      <div className="mt-3">
        <Etiqueta>¿Qué pasó?</Etiqueta>
        <div className="mt-[7px] flex flex-col gap-[6px]">
          <button
            type="button"
            aria-pressed={!corrige}
            onClick={() => setMotivo("movida")}
            className="opcion px-3 py-[9px] text-left text-[11.5px] leading-[1.25]"
          >
            Se movió la visita
          </button>
          <button
            type="button"
            aria-pressed={corrige}
            onClick={() => setMotivo("correccion")}
            className="opcion px-3 py-[9px] text-left text-[11.5px] leading-[1.25]"
          >
            La fecha estaba mal escrita
          </button>
        </div>
        <p className="mt-2 text-[10.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
          {corrige
            ? "Se arregla la que hay: nunca hubo visita a esa hora, así que no queda como si se hubiera movido."
            : "La anterior no se borra: queda en el expediente que la visita se corrió."}
        </p>
      </div>

      <div className="mt-3">
        <FormularioDeVisita
          enCurso={enCurso}
          texto={corrige ? "Corregir la fecha" : "Mover la visita"}
          inicial={{
            cuando: acordada.valorFecha ?? "",
            lugar: acordada.lugar ?? "",
            virtual: acordada.virtual,
          }}
          notaPlaceholder={
            corrige
              ? "Lo que de verdad se acordó"
              : "No pudo · pidió que fuera otro día"
          }
          alGuardar={(datos) => alGuardar({ ...datos, motivo })}
          alCancelar={alCancelar}
        />
      </div>
    </div>
  );
}

/// El mismo formulario sirve para agendar y para mover una visita: lo que
/// cambia es con qué llega lleno y qué dice el botón.
function FormularioDeVisita({
  enCurso,
  alGuardar,
  alCancelar,
  texto = "Agendar visita",
  inicial,
  notaPlaceholder = "Va acompañada · pidió que fuéramos dos",
}: {
  enCurso: boolean;
  alGuardar: (datos: {
    cuando: string;
    lugar: string;
    virtual: boolean;
    nota: string;
  }) => void;
  alCancelar: () => void;
  texto?: string;
  inicial?: { cuando: string; lugar: string; virtual: boolean };
  notaPlaceholder?: string;
}) {
  const [cuando, setCuando] = useState(inicial?.cuando ?? "");
  const [lugar, setLugar] = useState(inicial?.lugar ?? "");
  const [virtual, setVirtual] = useState(inicial?.virtual ?? false);
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
          placeholder={notaPlaceholder}
          className="campo font-medium"
        />
      </label>

      <Botones
        enCurso={enCurso}
        texto={texto}
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
