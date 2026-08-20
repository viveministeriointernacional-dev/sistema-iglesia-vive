"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CallSchedule,
  EntryPoint,
  Gender,
  InvitationKind,
} from "@iglesia/prisma-client";
import {
  GENEROS,
  HORARIOS,
  PUNTOS_DE_ENTRADA,
  TIPOS_DE_INVITACION,
} from "@/lib/dominio";
import {
  buscarInvitador,
  guardarRegistro,
  type InvitadorEncontrado,
  type PosibleDuplicado,
} from "./acciones";

type Formulario = {
  firstName: string;
  lastName: string;
  gender: Gender | "";
  birthDate: string;
  callPhone: string;
  whatsappPhone: string;
  callSchedules: CallSchedule[];
  callScheduleNote: string;
  address: string;
  prayerRequest: string;
  entryPoint: EntryPoint | "";
  entryPointOther: string;
  invitationKind: InvitationKind | "";
  invitedByPersonId: string | null;
  invitedByName: string;
};

const INICIAL: Formulario = {
  firstName: "",
  lastName: "",
  gender: "",
  birthDate: "",
  callPhone: "",
  whatsappPhone: "",
  callSchedules: [],
  callScheduleNote: "",
  address: "",
  prayerRequest: "",
  entryPoint: "",
  entryPointOther: "",
  invitationKind: "",
  invitedByPersonId: null,
  invitedByName: "",
};

const PASOS = [
  { numero: 1, etiqueta: "IDENTIDAD" },
  { numero: 2, etiqueta: "CONTACTO" },
  { numero: 3, etiqueta: "ORIGEN" },
];

const TITULOS: Record<number, { titulo: string; subtitulo: string }> = {
  1: {
    titulo: "¿A quién acabas de conocer?",
    subtitulo:
      "Con el nombre basta para empezar. Lo demás se completa después, cuando se sepa.",
  },
  2: {
    titulo: "¿Cómo la contactamos?",
    subtitulo:
      "Lo que tengas. El horario y el número son lo que hace posible Operación 72.",
  },
  3: {
    titulo: "¿Cómo llegó?",
    subtitulo: "El origen define la línea y, con ella, el mentor que la acompaña.",
  },
};

export function AsistenteDeRegistro() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState<Formulario>(INICIAL);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [duplicados, setDuplicados] = useState<PosibleDuplicado[] | null>(null);
  const [invitadorSeleccionado, setInvitadorSeleccionado] =
    useState<InvitadorEncontrado | null>(null);
  const [guardando, iniciarGuardado] = useTransition();

  function actualizar<C extends keyof Formulario>(campo: C, valor: Formulario[C]) {
    setDatos((previo) => ({ ...previo, [campo]: valor }));
    setErrores((previos) => {
      if (!(campo in previos)) return previos;
      const resto = { ...previos };
      delete resto[campo];
      return resto;
    });
    setDuplicados(null);
  }

  /// El formulario es libre: lo único que se exige es el nombre, porque sin él
  /// no hay a quién buscar después. Todo lo demás se completa desde el
  /// expediente cuando se sepa.
  function validarPaso(numero: number) {
    const faltantes: Record<string, string> = {};
    if (numero === 1 && !datos.firstName.trim()) {
      faltantes.firstName = "Escribe al menos el nombre.";
    }
    setErrores(faltantes);
    return Object.keys(faltantes).length === 0;
  }

  function guardar(confirmadoNoDuplicado = false) {
    if (!validarPaso(3)) return;
    setMensaje(null);
    iniciarGuardado(async () => {
      const resultado = await guardarRegistro(
        {
          ...datos,
          gender: datos.gender || null,
          entryPoint: datos.entryPoint || null,
          invitationKind: datos.invitationKind || null,
          birthDate: datos.birthDate || undefined,
          email: "",
        },
        { confirmadoNoDuplicado },
      );

      if (resultado.ok) return;
      if ("duplicados" in resultado) {
        setDuplicados(resultado.duplicados);
        return;
      }
      setErrores(resultado.errores);
      setMensaje(resultado.mensaje ?? null);
      const campoDePaso1 = ["firstName", "lastName", "gender", "birthDate"].some(
        (campo) => campo in resultado.errores,
      );
      const campoDePaso2 = ["callPhone", "email"].some(
        (campo) => campo in resultado.errores,
      );
      if (campoDePaso1) setPaso(1);
      else if (campoDePaso2) setPaso(2);
    });
  }

  function siguiente() {
    if (!validarPaso(paso)) return;
    if (paso < 3) {
      setPaso(paso + 1);
      return;
    }
    guardar();
  }

  function atras() {
    if (paso === 1) {
      router.push("/operacion-72");
      return;
    }
    setPaso(paso - 1);
  }

  const conInvitador = datos.invitationKind === InvitationKind.PERSONA;

  return (
    <div className="w-full max-w-[740px] overflow-hidden rounded-[18px] bg-papel shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)]">
      <div className="px-5 pt-[26px] pb-8 sm:px-7">
        <ol className="flex gap-2">
          {PASOS.map(({ numero, etiqueta }) => (
            <li key={numero} className="flex-1">
              <div
                className={`h-[6px] rounded-[3px] ${
                  paso >= numero
                    ? numero === 3
                      ? "bg-verde-500"
                      : "bg-azul-900"
                    : "bg-[rgba(19,28,36,.14)]"
                }`}
              />
              <div className="mt-[9px] text-[10px] leading-none font-bold tracking-[.1em] text-[rgba(19,28,36,.5)]">
                {etiqueta}
              </div>
            </li>
          ))}
        </ol>

        <h1 className="mt-6 font-serif text-[29px] leading-[1.15] font-normal">
          {TITULOS[paso].titulo}
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          {TITULOS[paso].subtitulo}
        </p>

        {paso === 1 ? (
          <PasoIdentidad datos={datos} errores={errores} actualizar={actualizar} />
        ) : null}
        {paso === 2 ? (
          <PasoContacto datos={datos} errores={errores} actualizar={actualizar} />
        ) : null}
        {paso === 3 ? (
          <PasoOrigen
            datos={datos}
            errores={errores}
            actualizar={actualizar}
            conInvitador={conInvitador}
            invitadorSeleccionado={invitadorSeleccionado}
            alSeleccionarInvitador={(invitador) => {
              setInvitadorSeleccionado(invitador);
              actualizar("invitedByPersonId", invitador?.id ?? null);
            }}
          />
        ) : null}

        {duplicados ? (
          <AvisoDeDuplicados
            duplicados={duplicados}
            guardando={guardando}
            alConfirmar={() => guardar(true)}
            alCancelar={() => setDuplicados(null)}
          />
        ) : null}

        {mensaje ? (
          <p role="alert" className="aviso-ambar mt-4 text-[12.5px] leading-[1.5] font-medium text-ambar-texto">
            {mensaje}
          </p>
        ) : null}

        <div className="mt-[18px] flex items-center justify-between gap-3">
          <button type="button" onClick={atras} className="boton-secundario">
            {paso === 1 ? "Cancelar" : "Atrás"}
          </button>
          <button
            type="button"
            onClick={siguiente}
            disabled={guardando}
            className="boton-primario"
          >
            {paso === 3
              ? guardando
                ? "Guardando…"
                : "Guardar e iniciar Operación 72"
              : "Continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

type PropsPaso = {
  datos: Formulario;
  errores: Record<string, string>;
  actualizar: <C extends keyof Formulario>(campo: C, valor: Formulario[C]) => void;
};

function MensajeDeError({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p className="mt-[6px] text-[11px] leading-[1.4] font-medium text-rojo">{texto}</p>
  );
}

function PasoIdentidad({ datos, errores, actualizar }: PropsPaso) {
  return (
    <div className="tarjeta mt-5 p-[22px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">Nombres</span>
          <input
            className="campo"
            value={datos.firstName}
            onChange={(evento) => actualizar("firstName", evento.target.value)}
            placeholder="Natalia Andrea"
            autoComplete="given-name"
          />
          <MensajeDeError texto={errores.firstName} />
        </label>

        <label className="block">
          <span className="etiqueta-campo">
            Apellidos {" "}<span className="font-medium text-[rgba(19,28,36,.4)]">si se sabe</span>
          </span>
          <input
            className="campo"
            value={datos.lastName}
            onChange={(evento) => actualizar("lastName", evento.target.value)}
            placeholder="Gómez Ríos"
            autoComplete="family-name"
          />
          <MensajeDeError texto={errores.lastName} />
        </label>

        <div>
          <span className="etiqueta-campo">
            Género {" "}<span className="font-medium text-[rgba(19,28,36,.4)]">si se sabe</span>
          </span>
          <div className="mt-[7px] flex gap-2">
            {GENEROS.map(({ valor, etiqueta }) => (
              <button
                key={valor}
                type="button"
                aria-pressed={datos.gender === valor}
                onClick={() =>
                  actualizar("gender", datos.gender === valor ? "" : valor)
                }
                className="opcion flex-1 p-3"
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <p className="mt-[7px] text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.45)]">
            Define la asignación de consolidador. Sin él, se asigna por carga.
          </p>
          <MensajeDeError texto={errores.gender} />
        </div>

        <label className="block">
          <span className="etiqueta-campo">Fecha de nacimiento</span>
          <input
            className="campo"
            type="date"
            value={datos.birthDate}
            onChange={(evento) => actualizar("birthDate", evento.target.value)}
          />
          <MensajeDeError texto={errores.birthDate} />
        </label>
      </div>
    </div>
  );
}

function PasoContacto({ datos, errores, actualizar }: PropsPaso) {
  return (
    <div className="tarjeta mt-5 p-[22px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">
            Teléfono para llamadas {" "}<span className="font-medium text-[rgba(19,28,36,.4)]">si se sabe</span>
          </span>
          <input
            className="campo"
            inputMode="tel"
            value={datos.callPhone}
            onChange={(evento) => actualizar("callPhone", evento.target.value)}
            placeholder="+57 300 412 4412"
            autoComplete="tel"
          />
          <MensajeDeError texto={errores.callPhone} />
        </label>

        <label className="block">
          <span className="etiqueta-campo">
            WhatsApp{" "}
            <span className="font-medium text-[rgba(19,28,36,.4)]">si es otro</span>
          </span>
          <input
            className="campo campo-opcional"
            inputMode="tel"
            value={datos.whatsappPhone}
            onChange={(evento) => actualizar("whatsappPhone", evento.target.value)}
            placeholder="Mismo número"
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="etiqueta-campo">
          Horario para llamarla{" "}
          <span className="font-medium text-[rgba(19,28,36,.4)]">
            los que sirvan
          </span>
        </span>
        <div className="mt-2 flex gap-2">
          {HORARIOS.map(({ valor, etiqueta }) => {
            const elegido = datos.callSchedules.includes(valor);
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={elegido}
                onClick={() =>
                  actualizar(
                    "callSchedules",
                    elegido
                      ? datos.callSchedules.filter((franja) => franja !== valor)
                      : [...datos.callSchedules, valor],
                  )
                }
                className="opcion flex-1 p-3 text-[12.5px]"
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
        <input
          className="campo campo-opcional"
          value={datos.callScheduleNote}
          onChange={(evento) => actualizar("callScheduleNote", evento.target.value)}
          placeholder="O escríbelo: «después de las 7», «solo sábados»…"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta-campo">Dirección / barrio</span>
          <input
            className="campo"
            value={datos.address}
            onChange={(evento) => actualizar("address", evento.target.value)}
            placeholder="Cra 45 #12-30 · Laureles"
          />
        </label>

        <label className="block">
          <span className="etiqueta-campo">Petición de oración</span>
          <input
            className="campo font-medium"
            value={datos.prayerRequest}
            onChange={(evento) => actualizar("prayerRequest", evento.target.value)}
            placeholder="Por su mamá, está enferma"
          />
        </label>
      </div>
    </div>
  );
}

function PasoOrigen({
  datos,
  errores,
  actualizar,
  conInvitador,
  invitadorSeleccionado,
  alSeleccionarInvitador,
}: PropsPaso & {
  conInvitador: boolean;
  invitadorSeleccionado: InvitadorEncontrado | null;
  alSeleccionarInvitador: (invitador: InvitadorEncontrado | null) => void;
}) {
  return (
    <div className="tarjeta mt-5 p-[22px]">
      <span className="etiqueta-campo">
        ¿Cómo llegó?{" "}
        <span className="font-medium text-[rgba(19,28,36,.4)]">si se sabe</span>
      </span>
      <div className="mt-[11px] grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PUNTOS_DE_ENTRADA.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            type="button"
            aria-pressed={datos.entryPoint === valor}
            onClick={() =>
              actualizar("entryPoint", datos.entryPoint === valor ? "" : valor)
            }
            className="opcion opcion-amplia"
          >
            {etiqueta}
          </button>
        ))}
      </div>
      {datos.entryPoint === EntryPoint.OTRO ? (
        <input
          className="campo"
          value={datos.entryPointOther}
          onChange={(evento) => actualizar("entryPointOther", evento.target.value)}
          placeholder="¿Cómo llegó? Escríbelo"
          autoFocus
        />
      ) : null}
      <MensajeDeError texto={errores.entryPoint} />

      <div className="mt-6">
        <span className="etiqueta-campo">¿Alguien la invitó?</span>
        <div className="mt-[11px] grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TIPOS_DE_INVITACION.map(({ valor, etiqueta }) => (
            <button
              key={valor}
              type="button"
              aria-pressed={datos.invitationKind === valor}
              onClick={() => {
                const quitando = datos.invitationKind === valor;
                actualizar("invitationKind", quitando ? "" : valor);
                if (quitando || valor !== InvitationKind.PERSONA) {
                  alSeleccionarInvitador(null);
                }
              }}
              className="opcion opcion-amplia"
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <MensajeDeError texto={errores.invitationKind} />
      </div>

      {conInvitador ? (
        <BuscadorDeInvitador
          seleccionado={invitadorSeleccionado}
          alSeleccionar={alSeleccionarInvitador}
          nombreEscrito={datos.invitedByName}
          alEscribirNombre={(nombre) => actualizar("invitedByName", nombre)}
          error={errores.invitedByPersonId}
        />
      ) : datos.invitationKind ? (
        <div className="aviso-ambar mt-3">
          <p className="text-[10px] leading-none font-bold tracking-[.14em] text-ambar-texto">
            SIN LÍNEA CONOCIDA
          </p>
          <p className="mt-[9px] text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.7)]">
            El mentor se asignará por perfil: género, edad, tipo de población,
            disponibilidad y carga. La decisión final la confirma un líder.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/// Buscar es una ayuda, no un requisito. Quien invitó puede no estar en la
/// base todavía —o llamarse distinto a como lo escriben—, y eso no debe
/// impedir registrar a la persona nueva: se guarda el nombre y un líder lo
/// revisa cuando entregue a mentor.
function BuscadorDeInvitador({
  seleccionado,
  alSeleccionar,
  nombreEscrito,
  alEscribirNombre,
  error,
}: {
  seleccionado: InvitadorEncontrado | null;
  alSeleccionar: (invitador: InvitadorEncontrado | null) => void;
  nombreEscrito: string;
  alEscribirNombre: (nombre: string) => void;
  error?: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<InvitadorEncontrado[] | null>(null);
  const [buscando, iniciarBusqueda] = useTransition();

  function buscar() {
    iniciarBusqueda(async () => {
      setResultados(await buscarInvitador(consulta));
    });
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 rounded-[10px] border border-[rgba(19,28,36,.16)] px-[14px] py-[10px]">
        <input
          value={consulta}
          onChange={(evento) => setConsulta(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") {
              evento.preventDefault();
              buscar();
            }
          }}
          placeholder="Buscar por nombre o teléfono…"
          aria-label="Buscar a la persona que invitó"
          className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] leading-none font-semibold text-tinta outline-none placeholder:text-[rgba(19,28,36,.45)]"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          className="cursor-pointer border-0 bg-transparent text-[12px] leading-none font-semibold text-azul-700"
        >
          {buscando ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {seleccionado ? (
        <div className="mt-[10px] flex items-center justify-between gap-3 rounded-[10px] border-[1.5px] border-verde-500 bg-verde-050 px-[14px] py-[13px]">
          <div>
            <p className="text-[13.5px] leading-none font-semibold">
              {seleccionado.nombre}
            </p>
            <p className="mt-1 text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.55)]">
              {seleccionado.linea ?? "Sin línea registrada todavía"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => alSeleccionar(null)}
            className="cursor-pointer border-0 bg-transparent text-[11.5px] leading-none font-semibold text-verde-700"
          >
            Seleccionada
          </button>
        </div>
      ) : null}

      {resultados && !seleccionado ? (
        resultados.length ? (
          <ul className="mt-[10px] flex flex-col gap-2">
            {resultados.map((invitador) => (
              <li key={invitador.id}>
                <button
                  type="button"
                  onClick={() => alSeleccionar(invitador)}
                  className="w-full cursor-pointer rounded-[10px] border border-[rgba(19,28,36,.16)] bg-white px-[14px] py-[13px] text-left"
                >
                  <span className="block text-[13.5px] leading-none font-semibold">
                    {invitador.nombre}
                  </span>
                  <span className="mt-1 block text-[11.5px] leading-[1.3] font-medium text-[rgba(19,28,36,.55)]">
                    {invitador.linea ?? invitador.telefono ?? "Sin línea registrada"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-[10px] text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            No está en la base todavía. Escribe su nombre abajo y sigue: un líder
            lo revisa al entregar a mentor.
          </p>
        )
      ) : null}

      {!seleccionado ? (
        <label className="mt-3 block">
          <span className="etiqueta-campo">
            ¿Quién la invitó?{" "}
            <span className="font-medium text-[rgba(19,28,36,.4)]">
              aunque no esté en la base
            </span>
          </span>
          <input
            className="campo"
            value={nombreEscrito}
            onChange={(evento) => alEscribirNombre(evento.target.value)}
            placeholder="Nombre de quien la invitó"
          />
        </label>
      ) : null}

      <MensajeDeError texto={error} />
    </div>
  );
}

function AvisoDeDuplicados({
  duplicados,
  guardando,
  alConfirmar,
  alCancelar,
}: {
  duplicados: PosibleDuplicado[];
  guardando: boolean;
  alConfirmar: () => void;
  alCancelar: () => void;
}) {
  return (
    <div className="aviso-ambar mt-4" role="alert">
      <p className="text-[10px] leading-none font-bold tracking-[.14em] text-ambar-texto">
        REQUIERE DECISIÓN HUMANA · POSIBLE DUPLICADO
      </p>
      <p className="mt-[9px] text-[12.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.7)]">
        Ya hay un expediente con estos datos de contacto. No se crea un segundo
        expediente en silencio: revisa y decide.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {duplicados.map((duplicado) => (
          <li
            key={duplicado.id}
            className="rounded-[9px] bg-white px-3 py-[10px] text-[12.5px] leading-[1.4] font-semibold"
          >
            {duplicado.nombre}
            <span className="ml-2 font-medium text-[rgba(19,28,36,.55)]">
              {duplicado.telefono ? `${duplicado.telefono} · ` : ""}
              {duplicado.motivo}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={alConfirmar}
          disabled={guardando}
          className="boton-primario"
        >
          Es otra persona · crear expediente
        </button>
        <button type="button" onClick={alCancelar} className="boton-secundario">
          Revisar los datos
        </button>
      </div>
    </div>
  );
}
