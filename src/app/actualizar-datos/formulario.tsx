"use client";

import { useActionState, useState } from "react";
import {
  ETAPAS_DECLARABLES,
  HITOS_DECLARABLES,
  NOMBRES_DE_MES,
  ROLES_DECLARABLES,
} from "@/lib/liderazgo";
import { guardarDatosDeLiderazgo, type EstadoLiderazgo } from "./acciones";

const INICIAL: EstadoLiderazgo = { fase: "vacio" };

const ANO_ACTUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 46 }, (_, i) => ANO_ACTUAL - i);

function Palomita() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/// Una casilla grande: en el celular una casilla nativa es imposible de pegarle,
/// así que toda la fila es el área de toque.
function Casilla({
  nombre,
  valor,
  etiqueta,
  marcada,
  alCambiar,
  tono = "azul",
}: {
  nombre: string;
  valor?: string;
  etiqueta: string;
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
  tono?: "azul" | "verde";
}) {
  const activo =
    tono === "verde"
      ? "border-[1.5px] border-verde-500 bg-verde-050"
      : "border-[1.5px] border-azul-900 bg-azul-050";
  const cajaActiva = tono === "verde" ? "bg-verde-700" : "bg-azul-900";

  return (
    <label
      className={`flex cursor-pointer items-center gap-[11px] rounded-[11px] p-[14px] ${
        marcada
          ? activo
          : "border border-[rgba(19,28,36,.18)] bg-white"
      }`}
    >
      <input
        type="checkbox"
        name={nombre}
        value={valor}
        checked={marcada}
        onChange={(evento) => alCambiar(evento.target.checked)}
        className="sr-only"
      />
      <span
        className={`grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[5px] ${
          marcada
            ? cajaActiva
            : "border border-[rgba(19,28,36,.24)]"
        }`}
      >
        {marcada ? <Palomita /> : null}
      </span>
      <span
        className={`text-[13px] leading-[1.25] font-semibold ${
          marcada ? "text-tinta" : "text-[rgba(19,28,36,.55)]"
        }`}
      >
        {etiqueta}
      </span>
    </label>
  );
}

function Hito({
  kind,
  etiqueta,
}: {
  kind: string;
  etiqueta: string;
}) {
  const [hecho, setHecho] = useState(false);
  const [sinFecha, setSinFecha] = useState(false);

  return (
    <div
      className={`rounded-[11px] p-[14px] ${
        hecho
          ? "border-[1.5px] border-verde-500 bg-verde-050"
          : "border border-[rgba(19,28,36,.18)] bg-white"
      }`}
    >
      <label className="flex cursor-pointer items-center gap-[11px]">
        <input
          type="checkbox"
          name={`hito-${kind}`}
          checked={hecho}
          onChange={(evento) => setHecho(evento.target.checked)}
          className="sr-only"
        />
        <span
          className={`grid h-[19px] w-[19px] shrink-0 place-items-center rounded-[5px] ${
            hecho ? "bg-verde-700" : "border border-[rgba(19,28,36,.24)]"
          }`}
        >
          {hecho ? <Palomita /> : null}
        </span>
        <span
          className={`text-[13.5px] leading-[1.2] font-bold ${
            hecho ? "text-tinta" : "font-semibold text-[rgba(19,28,36,.55)]"
          }`}
        >
          {etiqueta}
        </span>
      </label>

      {hecho ? (
        <div className="mt-3">
          <span className="etiqueta-campo">¿CUÁNDO?</span>
          <div className="mt-[7px] flex flex-wrap items-center gap-2">
            <select
              name={`mes-${kind}`}
              disabled={sinFecha}
              defaultValue=""
              className="min-w-[128px] flex-1 rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-3 py-[11px] text-[13.5px] leading-[1.2] font-semibold text-tinta outline-none disabled:opacity-45 focus:border-azul-900"
            >
              <option value="">Mes</option>
              {NOMBRES_DE_MES.map((mes, indice) => (
                <option key={mes} value={String(indice + 1)}>
                  {mes.charAt(0).toUpperCase() + mes.slice(1)}
                </option>
              ))}
            </select>
            <select
              name={`ano-${kind}`}
              disabled={sinFecha}
              defaultValue=""
              className="min-w-[96px] flex-1 rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-3 py-[11px] text-[13.5px] leading-[1.2] font-semibold text-tinta outline-none disabled:opacity-45 focus:border-azul-900"
            >
              <option value="">Año</option>
              {ANOS.map((ano) => (
                <option key={ano} value={String(ano)}>
                  {ano}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSinFecha((antes) => !antes)}
              aria-pressed={sinFecha}
              className="opcion shrink-0 px-3 py-[11px] text-[12px]"
            >
              No recuerdo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FormularioLiderazgo() {
  const [estado, enviar, enCurso] = useActionState(
    guardarDatosDeLiderazgo,
    INICIAL,
  );
  const [genero, setGenero] = useState<"MUJER" | "HOMBRE" | "">("");
  const [etapa, setEtapa] = useState("");
  const [roles, setRoles] = useState<string[]>([]);

  if (estado.fase === "listo") {
    return <Confirmacion resultado={estado.resultado} />;
  }

  return (
    <form action={enviar} className="mt-6 flex flex-col gap-[14px]">
      {/* 1 · QUIÉN ERES */}
      <section className="tarjeta p-[18px] sm:p-5">
        <Rotulo numero={1}>QUIÉN ERES</Rotulo>

        <label className="mt-[18px] block">
          <span className="etiqueta-campo">TU CELULAR</span>
          <input
            name="callPhone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="313 452 1673"
            className="campo"
          />
        </label>
        <p className="mt-2 text-[11.5px] leading-[1.45] font-medium text-tinta-55">
          Con este número te encontramos. Si ya tienes ficha, la actualizamos; si
          no, te creamos una.
        </p>

        <div className="mt-4 grid gap-[11px] sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">NOMBRES</span>
            <input
              name="firstName"
              required
              autoComplete="given-name"
              className="campo"
            />
          </label>
          <label className="block">
            <span className="etiqueta-campo">APELLIDOS</span>
            <input name="lastName" autoComplete="family-name" className="campo" />
          </label>
        </div>

        <div className="mt-4">
          <span className="etiqueta-campo">GÉNERO</span>
          <input type="hidden" name="gender" value={genero} />
          <div className="mt-[7px] flex gap-[9px]">
            {(["MUJER", "HOMBRE"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setGenero(valor)}
                aria-pressed={genero === valor}
                className="opcion grow p-3"
              >
                {valor === "MUJER" ? "Mujer" : "Hombre"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-[11px] sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta-campo">FECHA DE NACIMIENTO</span>
            <input name="birthDate" type="date" className="campo" />
          </label>
          <label className="block">
            <span className="etiqueta-campo">WHATSAPP</span>
            <input
              name="whatsappPhone"
              type="tel"
              inputMode="tel"
              placeholder="Si es otro número"
              className="campo campo-opcional"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="etiqueta-campo">CORREO</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            className="campo"
          />
        </label>

        <label className="mt-4 block">
          <span className="etiqueta-campo">DIRECCIÓN O BARRIO</span>
          <input
            name="address"
            placeholder="Opcional"
            className="campo campo-opcional"
          />
        </label>
      </section>

      {/* 2 · DÓNDE SIRVES */}
      <section className="tarjeta p-[18px] sm:p-5">
        <Rotulo numero={2}>DÓNDE SIRVES HOY</Rotulo>
        <p className="mt-3 text-[12.5px] leading-[1.55] font-medium text-tinta-55">
          Marca todo lo que haces. Puede ser más de uno.
        </p>
        <div className="mt-[13px] flex flex-col gap-[9px]">
          {ROLES_DECLARABLES.map((rol) => (
            <Casilla
              key={rol.valor}
              nombre="roles"
              valor={rol.valor}
              etiqueta={rol.etiqueta}
              marcada={roles.includes(rol.valor)}
              alCambiar={(marcada) =>
                setRoles((antes) =>
                  marcada
                    ? [...antes, rol.valor]
                    : antes.filter((v) => v !== rol.valor),
                )
              }
            />
          ))}
        </div>
        <div className="aviso-ambar mt-[13px]">
          <p className="text-[11.5px] leading-[1.5] font-medium text-ambar-texto">
            Esto queda anotado como lo que tú declaras. Los permisos dentro de la
            plataforma los sigue activando un administrador — el formulario no
            los otorga.
          </p>
        </div>
      </section>

      {/* 3 · ETAPA */}
      <section className="tarjeta p-[18px] sm:p-5">
        <Rotulo numero={3}>EN QUÉ ETAPA ESTÁS</Rotulo>
        <input type="hidden" name="phase" value={etapa} />
        <div className="mt-[15px] flex flex-col gap-[9px]">
          {ETAPAS_DECLARABLES.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => setEtapa(opcion.valor)}
              aria-pressed={etapa === opcion.valor}
              className="opcion opcion-amplia"
            >
              <span className="block text-[13px] leading-none font-bold">
                {opcion.etiqueta}
              </span>
              <span className="mt-[6px] block text-[11.5px] leading-[1.45] font-medium">
                {opcion.descripcion}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 4 · HITOS */}
      <section className="tarjeta p-[18px] sm:p-5">
        <Rotulo numero={4}>TU RECORRIDO</Rotulo>
        <p className="mt-3 text-[12.5px] leading-[1.55] font-medium text-tinta-55">
          Marca lo que ya viviste y cuándo fue.{" "}
          <strong className="font-bold text-tinta">
            Si no recuerdas el día exacto, el mes y el año bastan
          </strong>{" "}
          — es mejor un dato aproximado que ninguno.
        </p>
        <div className="mt-[14px] flex flex-col gap-[9px]">
          {HITOS_DECLARABLES.map((hito) => (
            <Hito key={hito.kind} kind={hito.kind} etiqueta={hito.etiqueta} />
          ))}
        </div>
      </section>

      {/* 5 · ALGO MÁS */}
      <section className="tarjeta p-[18px] sm:p-5">
        <Rotulo numero={5}>ALGO MÁS</Rotulo>
        <label className="mt-4 block">
          <span className="etiqueta-campo">¿QUIERES CONTARNOS ALGO?</span>
          <textarea
            name="prayerRequest"
            rows={3}
            placeholder="Una petición de oración, un cambio en tu vida, algo que debamos saber. Opcional."
            className="campo campo-opcional resize-y leading-[1.5]"
          />
        </label>
      </section>

      {/* ENVIAR */}
      <section className="tarjeta p-[18px] sm:p-5">
        {estado.fase === "error" ? (
          <p
            role="alert"
            className="mb-[14px] rounded-[10px] bg-rojo-fondo px-[15px] py-[13px] text-[12.5px] leading-[1.5] font-semibold text-rojo"
          >
            {estado.mensaje}
          </p>
        ) : null}
        <button type="submit" disabled={enCurso} className="boton-primario w-full py-4">
          {enCurso ? "Guardando…" : "Guardar mis datos"}
        </button>
        <p className="mt-3 text-center text-[11.5px] leading-[1.5] font-medium text-tinta-42">
          Nada de lo que ya está registrado se borra.
        </p>
      </section>
    </form>
  );
}

function Rotulo({
  numero,
  children,
}: {
  numero: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[9px]">
      <span className="grid h-[21px] w-[21px] place-items-center rounded-full bg-azul-900 text-[11px] font-extrabold text-white">
        {numero}
      </span>
      <span className="etiqueta-seccion">{children}</span>
    </div>
  );
}

function Confirmacion({
  resultado,
}: {
  resultado: Extract<
    Awaited<ReturnType<typeof guardarDatosDeLiderazgo>>,
    { fase: "listo" }
  >["resultado"];
}) {
  const nombreCorto = resultado.nombre.split(" ")[0];

  return (
    <div className="tarjeta mt-6 p-6">
      <span
        className={`grid h-[42px] w-[42px] place-items-center rounded-full ${
          resultado.creada ? "bg-azul-100" : "bg-verde-100"
        }`}
      >
        {resultado.creada ? (
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
            <path
              d="M12 6v12M6 12h12"
              fill="none"
              stroke="#0e2a4e"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              fill="none"
              stroke="#4f7038"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <h2 className="mt-4 font-serif text-[25px] leading-[1.2] font-normal">
        {resultado.creada
          ? `Bienvenido, ${nombreCorto}. Ya tienes ficha.`
          : `Listo, ${nombreCorto}. Quedó guardado.`}
      </h2>
      <p className="mt-[9px] text-[13px] leading-[1.55] font-medium text-tinta-55">
        {resultado.creada
          ? "No te encontramos con ese celular, así que te creamos tu expediente con todo lo que nos contaste."
          : "Actualizamos tu ficha con lo que nos contaste."}
      </p>

      {resultado.cambios.length ? (
        <div className="mt-[18px] overflow-hidden rounded-[11px] bg-[rgba(19,28,36,.09)]">
          <div className="flex flex-col gap-px">
            {resultado.cambios.map((cambio) => (
              <div key={cambio.rotulo} className="bg-white px-[14px] py-[13px]">
                <p className="text-[11px] leading-none font-bold tracking-[.1em] text-tinta-42">
                  {cambio.rotulo}
                </p>
                <p className="mt-[7px] text-[13px] leading-[1.35] font-semibold break-words">
                  {cambio.valor}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {resultado.hitos.length ? (
        <div className="mt-[14px] rounded-[11px] bg-papel px-[15px] py-[14px]">
          <p className="text-[11px] leading-none font-bold tracking-[.1em] text-tinta-42">
            TU RECORRIDO
          </p>
          <ul className="mt-[10px] flex flex-col gap-[7px]">
            {resultado.hitos.map((hito) => (
              <li key={hito.etiqueta} className="flex items-center gap-2">
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-verde-500" />
                <span className="text-[13px] leading-[1.3] font-semibold">
                  {hito.etiqueta}
                  {hito.cuando ? ` · ${hito.cuando}` : " · fecha sin precisar"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {resultado.rolesDeclarados.length || resultado.etapaPendiente ? (
        <div className="aviso-ambar mt-4">
          <p className="text-[11.5px] leading-[1.5] font-medium text-ambar-texto">
            {resultado.rolesDeclarados.length ? (
              <>
                Anotamos que sirves en{" "}
                <strong className="font-bold">
                  {resultado.rolesDeclarados.join(", ")}
                </strong>
                .{" "}
              </>
            ) : null}
            {resultado.etapaPendiente ? (
              <>
                Y que estás en la etapa{" "}
                <strong className="font-bold">{resultado.etapaPendiente}</strong>
                .{" "}
              </>
            ) : null}
            Un administrador lo revisa y lo confirma.
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-[12px] leading-[1.5] font-medium text-tinta-55">
        ¿Algo quedó mal? Vuelve a abrir el enlace y llénalo otra vez — se queda
        lo último que envíes.
      </p>
    </div>
  );
}
