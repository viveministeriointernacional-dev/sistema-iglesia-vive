"use client";

import { useState, useTransition } from "react";
import {
  LARGO_MAXIMO_PETICION,
  OPCIONES_DE_SERVICIO,
  type TipoDePeticion,
} from "@/lib/oracion-catalogo";
import { enviarAcompanamiento, reconocerCelular } from "./acciones";

/// En qué paso va el formulario. Se guarda aquí y no en la URL porque lleva
/// datos a medio escribir: una recarga tiene que empezar de cero, no revivir
/// media petición de otra persona en un celular prestado.
type Paso =
  | { en: "celular" }
  | { en: "confirmar"; personId: string; nombre: string }
  | { en: "datos" }
  | { en: "servicio"; personId: string | null; nombre: string | null }
  | { en: "listo"; nombre: string; abrioProceso: boolean };

export function FormularioDeOracion() {
  const [paso, setPaso] = useState<Paso>({ en: "celular" });
  const [celular, setCelular] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [tipos, setTipos] = useState<TipoDePeticion[]>(["ORACION"]);
  const [proceso, setProceso] = useState(false);
  const [texto, setTexto] = useState("");
  const [reservada, setReservada] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function alternarTipo(id: TipoDePeticion) {
    setTipos((previos) =>
      previos.includes(id) ? previos.filter((t) => t !== id) : [...previos, id],
    );
  }

  if (paso.en === "listo") {
    return (
      <div className="tarjeta mt-5 p-6">
        <h2 className="font-serif text-[23px] leading-[1.2] font-normal text-tinta">
          Gracias, {paso.nombre}
        </h2>
        {/* ⚠️ Lo que NO dice importa tanto como lo que dice: no promete que
            alguien va a llamar, salvo cuando pidió empezar un proceso — que es
            el único caso en que sí hay alguien asignado a buscarla. Una promesa
            que no se cumple hace más daño que no prometer nada. */}
        <p className="mt-3 text-[14px] leading-[1.6] font-medium text-[rgba(19,28,36,.7)]">
          {tipos.includes("CONSEJERIA")
            ? "Lo que escribiste le llegó al equipo de la iglesia. Vamos a orar por eso y alguien te va a buscar para hablar."
            : "Tu petición le llegó al equipo de intercesión de la iglesia. Vamos a orar por eso."}
        </p>
        {paso.abrioProceso ? (
          <p className="mt-3 rounded-r-[10px] border-l-[3px] border-verde-500 bg-[rgba(22,122,70,.06)] px-4 py-3 text-[13px] leading-[1.55] font-medium text-tinta">
            Y quedaste anotada para empezar tu proceso: alguien del equipo se va
            a comunicar contigo.
          </p>
        ) : null}
        <p className="mt-4 text-[13px] leading-[1.55] font-medium text-[rgba(19,28,36,.5)]">
          Si quieres pedir por algo más, vuelve a abrir este enlace cuando
          necesites.
        </p>
      </div>
    );
  }

  return (
    <div className="tarjeta mt-5 p-5">
      {paso.en === "celular" ? (
        <>
          <label className="etiqueta-campo" htmlFor="celular">
            Tu celular
          </label>
          <p className="mt-1 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Si ya estás con nosotros, no tienes que escribir nada más.
          </p>
          <input
            id="celular"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            placeholder="300 123 4567"
            className="campo mt-2 w-full"
          />
          <button
            type="button"
            disabled={enCurso}
            onClick={() => {
              setError(null);
              iniciar(async () => {
                const r = await reconocerCelular(celular);
                if (r.encontrada) {
                  setPaso({ en: "confirmar", personId: r.personId, nombre: r.nombre });
                  return;
                }
                if (r.motivo === "sin-numero") {
                  setError("Escribe tu número de celular completo.");
                  return;
                }
                // «varias» también cae aquí: dos fichas con el mismo número no
                // se adivinan, así que se le pide quién es y se crea la suya.
                setPaso({ en: "datos" });
              });
            }}
            className="boton-primario mt-4 w-full"
          >
            {enCurso ? "Buscando…" : "Continuar"}
          </button>
        </>
      ) : null}

      {paso.en === "confirmar" ? (
        <>
          {/* ⚠️ Esta pregunta existe porque hay celulares compartidos entre dos
              personas de la misma familia. Sin ella, la petición —y hasta una
              reservada— quedaría guardada en la ficha equivocada. */}
          <div className="rounded-r-[10px] border-l-[3px] border-verde-500 bg-[rgba(22,122,70,.06)] px-4 py-3">
            <p className="font-serif text-[19px] leading-[1.2] text-tinta">
              ¿Eres tú, {paso.nombre}?
            </p>
            <p className="mt-1.5 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.65)]">
              Encontramos tu ficha con ese número. Si eres otra persona de la
              casa, dínoslo y te registramos aparte.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setPaso({ en: "servicio", personId: paso.personId, nombre: paso.nombre })
            }
            className="boton-primario mt-4 w-full"
          >
            Sí, soy yo
          </button>
          <button
            type="button"
            onClick={() => setPaso({ en: "datos" })}
            className="boton-secundario mt-2 w-full"
          >
            No, soy otra persona
          </button>
        </>
      ) : null}

      {paso.en === "datos" ? (
        <>
          <h2 className="font-serif text-[20px] leading-[1.2] text-tinta">
            Cuéntanos quién eres
          </h2>
          <p className="mt-1 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Es la primera vez que te escribimos. Con esto queda tu ficha.
          </p>
          <label className="etiqueta-campo mt-4" htmlFor="nombres">
            Tus nombres
          </label>
          <input
            id="nombres"
            value={nombres}
            onChange={(e) => setNombres(e.target.value)}
            autoComplete="given-name"
            className="campo mt-1.5 w-full"
          />
          <label className="etiqueta-campo mt-3" htmlFor="apellidos">
            Tus apellidos
          </label>
          <input
            id="apellidos"
            value={apellidos}
            onChange={(e) => setApellidos(e.target.value)}
            autoComplete="family-name"
            className="campo mt-1.5 w-full"
          />
          <label className="etiqueta-campo mt-3" htmlFor="correo">
            Tu correo · opcional
          </label>
          <input
            id="correo"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            autoComplete="email"
            className="campo mt-1.5 w-full"
          />
          <button
            type="button"
            onClick={() => {
              if (!nombres.trim()) {
                setError("Escribe al menos tu nombre.");
                return;
              }
              setError(null);
              setPaso({ en: "servicio", personId: null, nombre: nombres.trim() });
            }}
            className="boton-primario mt-4 w-full"
          >
            Continuar
          </button>
        </>
      ) : null}

      {paso.en === "servicio" ? (
        <>
          <h2 className="font-serif text-[20px] leading-[1.2] text-tinta">
            ¿En qué te acompañamos?
          </h2>
          <p className="mt-1 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
            Puedes marcar más de uno.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {OPCIONES_DE_SERVICIO.map((opcion) => {
              const esProceso = opcion.id === "PROCESO";
              const marcada = esProceso
                ? proceso
                : tipos.includes(opcion.id as TipoDePeticion);
              return (
                <label
                  key={opcion.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3 ${
                    marcada
                      ? "border-2 border-azul-900 bg-[rgba(14,42,78,.04)] p-[11px]"
                      : "border-[rgba(19,28,36,.18)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() =>
                      esProceso
                        ? setProceso((v) => !v)
                        : alternarTipo(opcion.id as TipoDePeticion)
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] leading-none font-bold text-tinta">
                      {opcion.titulo}
                    </span>
                    <span className="mt-1 block text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.6)]">
                      {opcion.ayuda}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <label className="etiqueta-campo mt-5" htmlFor="peticion">
            Cuéntanos
          </label>
          <textarea
            id="peticion"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={LARGO_MAXIMO_PETICION}
            rows={5}
            placeholder="Escríbelo con tus palabras."
            className="campo mt-1.5 w-full"
          />

          <label className="mt-4 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={reservada}
              onChange={() => setReservada((v) => !v)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-[13px] leading-none font-bold text-tinta">
                Que sea reservada
              </span>
              <span className="mt-1 block text-[11.5px] leading-[1.4] font-medium text-[rgba(19,28,36,.6)]">
                No se muestra tu nombre en la lista.
              </span>
            </span>
          </label>

          <button
            type="button"
            disabled={enCurso}
            onClick={() => {
              setError(null);
              iniciar(async () => {
                const r = await enviarAcompanamiento({
                  personId: paso.personId,
                  celular,
                  nombres,
                  apellidos,
                  correo,
                  tipos,
                  quiereProceso: proceso,
                  texto,
                  reservada,
                });
                if (!r.ok) {
                  setError(r.mensaje);
                  return;
                }
                setPaso({ en: "listo", nombre: r.nombre, abrioProceso: r.abrioProceso });
              });
            }}
            className="boton-primario mt-5 w-full"
          >
            {enCurso ? "Enviando…" : "Enviar"}
          </button>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[12px] leading-[1.45] font-medium text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}
