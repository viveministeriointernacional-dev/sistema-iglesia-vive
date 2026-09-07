import Link from "next/link";
import { Operation72Status, Phase } from "@iglesia/prisma-client";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { ETIQUETA_HITO } from "@/lib/administracion";
import {
  atajosDelInforme,
  cargarInforme,
  type Comparacion,
  type Efectividad,
  type Informe,
  type Rango,
} from "@/lib/informe";
import { getPrisma } from "@/lib/prisma";

export const metadata = { title: "Informe · Iglesia Vive" };
export const dynamic = "force-dynamic";

const ETIQUETA_FASE: Record<Phase, string> = {
  GANAR: "Ganar",
  FORTALECER: "Fortalecer",
  ENTRENAR: "Entrenar",
  MULTIPLICAR: "Multiplicar",
};

/// Rampa de un solo tono, de claro a oscuro: las fases son un recorrido, no
/// cuatro categorías sueltas.
const COLOR_FASE: Record<Phase, string> = {
  GANAR: "#9ec87a",
  FORTALECER: "#6e9a55",
  ENTRENAR: "#4f7038",
  MULTIPLICAR: "#27401f",
};

const ETIQUETA_OP72: Partial<Record<Operation72Status, string>> = {
  INICIADA: "Iniciada",
  SEGUIMIENTO: "Seguimiento",
  CONTACTADA: "Contactada",
  VISITA_PENDIENTE: "Visita pendiente",
  LISTA_PARA_ENTREGA: "Lista para entrega",
};

const ORDEN_OP72: Operation72Status[] = [
  Operation72Status.INICIADA,
  Operation72Status.SEGUIMIENTO,
  Operation72Status.CONTACTADA,
  Operation72Status.VISITA_PENDIENTE,
  Operation72Status.LISTA_PARA_ENTREGA,
];

const COLOR_OP72 = ["#b7cde4", "#7fa6cd", "#4a7fb4", "#2a5a8c", "#14385e"];

/// Los tres colores de la gráfica de actividad. Pasaron las seis comprobaciones
/// de contraste y de daltonismo del validador; no cambiarlos a ojo.
const COLOR_LLAMADAS = "#2f76c4";
const COLOR_VISITAS = "#c97b2c";
const COLOR_REGISTROS = "#3f9f7a";

function porcentaje(parte: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 100);
}

function anchoDe(parte: number, total: number) {
  return `${total <= 0 ? 0 : Math.max((parte / total) * 100, parte > 0 ? 1.5 : 0)}%`;
}

/// La URL que reproduce este mismo periodo. Siempre son las dos fechas: el
/// informe no tiene «modos», solo un rango.
function parametrosDelRango(rango: Rango) {
  return `desde=${rango.inicio}&hasta=${rango.fin}`;
}

export default async function PaginaInforme({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { desde, hasta } = await searchParams;
  const prisma = await getPrisma();
  const informe = await cargarInforme(prisma, { desde, hasta });
  const { rango } = informe;
  const atajos = atajosDelInforme();

  const enlace = (tramo: { inicio: string; fin: string }) =>
    `/administracion/informe?desde=${tramo.inicio}&hasta=${tramo.fin}`;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1120px]">
        <Link
          href="/administracion"
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver a administración
        </Link>

        <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
              Informe
            </h1>
            <p className="mt-2 max-w-[560px] text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
              Todo lo que pasó en la plataforma en el periodo que elijas, del
              panorama global al detalle de cada persona. Solo lo ven los
              administradores.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={enlace(rango.anterior)}
              aria-label="Periodo anterior"
              className="rounded-[9px] border border-borde-control bg-white px-[13px] py-[11px] text-[12.5px] leading-none font-bold text-tinta"
            >
              ←
            </Link>
            {/* Formulario GET: funciona sin JavaScript, como el resto de la
                pantalla. Las dos casillas SON el control del informe. */}
            <form
              method="get"
              action="/administracion/informe"
              className="flex items-end gap-2"
            >
              <CampoFecha rotulo="DESDE" nombre="desde" valor={rango.inicio} />
              <CampoFecha rotulo="HASTA" nombre="hasta" valor={rango.fin} />
              <button type="submit" className="boton-primario">
                Ver
              </button>
            </form>
            <Link
              href={enlace(rango.siguiente)}
              aria-label="Periodo siguiente"
              className="rounded-[9px] border border-borde-control bg-white px-[13px] py-[11px] text-[12.5px] leading-none font-bold text-tinta"
            >
              →
            </Link>
          </div>
        </header>

        <div className="mt-[14px] flex flex-wrap items-center gap-2">
          {atajos.map((atajo) => {
            const puesto = atajo.inicio === rango.inicio && atajo.fin === rango.fin;
            return (
              <Link
                key={atajo.clave}
                href={enlace(atajo)}
                className={`rounded-[20px] px-[13px] py-[8px] text-[11.5px] leading-none font-semibold ${
                  puesto
                    ? "bg-azul-900 font-bold text-white"
                    : "border border-borde-control bg-white text-[rgba(19,28,36,.55)]"
                }`}
              >
                {atajo.etiqueta}
              </Link>
            );
          })}
        </div>

        <p className="mt-[14px] text-[14px] leading-[1.4] font-bold text-tinta">
          {rango.etiqueta}
          <span className="ml-2 text-[12px] font-semibold text-[rgba(19,28,36,.5)]">
            {rango.dias} {rango.dias === 1 ? "día" : "días"} · se compara con{" "}
            {rango.etiquetaPrevio}
          </span>
        </p>

        <Tiles informe={informe} />
        <BloqueEfectividad informe={informe} />
        <BloqueRecorrido informe={informe} />
        <BloqueActividad informe={informe} />

        <section className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
          <BloqueOp72 informe={informe} />
          <BloqueHitos informe={informe} />
        </section>

        <BloqueConsolidadores informe={informe} />
      </div>
    </main>
  );
}

function CampoFecha({
  rotulo,
  nombre,
  valor,
}: {
  rotulo: string;
  nombre: string;
  valor: string;
}) {
  return (
    <label className="flex flex-col gap-[5px]">
      <span className="etiqueta-seccion" style={{ letterSpacing: ".14em" }}>
        {rotulo}
      </span>
      <input
        type="date"
        name={nombre}
        defaultValue={valor}
        className="rounded-[9px] border border-borde-control bg-white px-[11px] py-[9px] text-[12.5px] leading-none font-semibold text-tinta"
      />
    </label>
  );
}

/// El porcentaje va SIEMPRE con la cifra contra la que compara: pasar de 1 a 3
/// también es «+200 %», y sin la base ese número engaña.
function Variacion({ dato, alRevés = false }: { dato: Comparacion; alRevés?: boolean }) {
  const sube = dato.ahora > dato.antes;
  const igual = dato.ahora === dato.antes;
  const bueno = alRevés ? !sube : sube;
  const color = igual
    ? "text-[rgba(19,28,36,.5)]"
    : bueno
      ? "text-verde-700"
      : "text-rojo";

  return (
    <>
      <p className={`mt-2 text-[12px] leading-[1.3] font-bold ${color}`}>
        {igual
          ? "igual"
          : dato.porcentaje === null
            ? `+${dato.ahora}`
            : `${dato.porcentaje > 0 ? "+" : "−"}${Math.abs(Math.round(dato.porcentaje))} %`}
      </p>
      <p className="mt-[3px] text-[10.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.45)]">
        antes: {dato.antes}
      </p>
    </>
  );
}

function Tile({
  rotulo,
  valor,
  dato,
  pie,
  alerta = false,
  alRevés = false,
}: {
  rotulo: string;
  valor: number;
  dato: Comparacion;
  pie?: string;
  alerta?: boolean;
  alRevés?: boolean;
}) {
  return (
    <div
      className={`tarjeta p-[15px] ${alerta ? "border-[rgba(180,70,47,.3)]" : ""}`}
    >
      <p
        className={`etiqueta-seccion ${alerta ? "text-rojo" : ""}`}
        style={{ letterSpacing: ".16em" }}
      >
        {rotulo}
      </p>
      <p
        className={`mt-[10px] text-[30px] leading-none font-extrabold tracking-[-.02em] ${alerta ? "text-rojo" : "text-tinta"}`}
      >
        {valor}
      </p>
      <Variacion dato={dato} alRevés={alRevés} />
      {pie ? (
        <p className="mt-[3px] text-[10.5px] leading-[1.35] font-semibold text-[rgba(19,28,36,.45)]">
          {pie}
        </p>
      ) : null}
    </div>
  );
}

function Tiles({ informe }: { informe: Informe }) {
  return (
    <section className="mt-4 grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-6">
      <Tile rotulo="PERSONAS NUEVAS" valor={informe.registros.ahora} dato={informe.registros} />
      <Tile rotulo="LLAMADAS" valor={informe.llamadas.ahora} dato={informe.llamadas} />
      <Tile rotulo="VISITAS" valor={informe.visitas.ahora} dato={informe.visitas} />
      <Tile rotulo="ENTREGADAS" valor={informe.entregas.ahora} dato={informe.entregas} />
      <Tile rotulo="HITOS" valor={informe.hitos.ahora} dato={informe.hitos} />
      <Tile
        rotulo="BAJAS"
        valor={informe.bajas.ahora}
        dato={informe.bajas}
        alerta
        alRevés
        pie={
          informe.bajasPendientes > 0
            ? `${informe.bajasPendientes} sin autorizar`
            : undefined
        }
      />
    </section>
  );
}

function EscalonEmbudo({
  titulo,
  cuantas,
  total,
  color,
  conversion,
}: {
  titulo: string;
  cuantas: number;
  total: number;
  color: string;
  conversion?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-[10px]">
        <span className="text-[12.5px] leading-none font-semibold text-tinta">
          {titulo}
        </span>
        <span className="text-[12.5px] leading-none font-bold text-tinta">
          {cuantas} ·{" "}
          <span className="text-[rgba(19,28,36,.5)]">
            {porcentaje(cuantas, total)} %
          </span>
        </span>
      </div>
      <div
        className="mt-[6px] h-[16px] rounded-[4px]"
        style={{ width: anchoDe(cuantas, total), background: color }}
      />
      {conversion ? (
        <p className="mt-[5px] text-[11px] leading-[1.4] font-semibold text-[rgba(19,28,36,.5)]">
          {conversion}
        </p>
      ) : null}
    </div>
  );
}

function tasaDeLlamada(efectividad: Efectividad) {
  return porcentaje(efectividad.seLlamo, efectividad.entraron);
}

function BloqueEfectividad({ informe }: { informe: Informe }) {
  const e = informe.efectividad;
  const previa = informe.efectividadPrevia;
  // Los que ya cumplieron su plazo dentro del periodo. A los que entraron sobre
  // el cierre no se les puede exigir todavía.
  const conPlazoCumplido = Math.max(e.entraron - e.enPlazo, 0);
  const sinLlamar = Math.max(conPlazoCumplido - e.seLlamo, 0);

  return (
    <section className="tarjeta mt-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
        <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">
          Efectividad con los que entraron
        </h2>
        <p className="text-[12px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
          De las{" "}
          <strong className="font-bold text-tinta">
            {e.entraron} personas que entraron
          </strong>{" "}
          en el periodo, hasta dónde llegó cada una.
        </p>
      </div>

      {e.entraron === 0 ? (
        <p className="mt-4 rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-5 text-[12.5px] leading-[1.6] font-medium text-[rgba(19,28,36,.5)]">
          No entró nadie en este periodo, así que no hay efectividad que medir.
        </p>
      ) : (
        <div className="mt-[18px] grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-3">
            <EscalonEmbudo
              titulo="Entraron a consolidación"
              cuantas={e.entraron}
              total={e.entraron}
              color={COLOR_OP72[0]}
            />
            <EscalonEmbudo
              titulo="Se les registró una llamada"
              cuantas={e.seLlamo}
              total={e.entraron}
              color={COLOR_OP72[1]}
            />
            <EscalonEmbudo
              titulo="Contestaron"
              cuantas={e.contestaron}
              total={e.entraron}
              color={COLOR_OP72[2]}
              conversion={
                e.seLlamo > 0
                  ? `${porcentaje(e.contestaron, e.seLlamo)} % de las que se llamaron`
                  : undefined
              }
            />
            <EscalonEmbudo
              titulo="Se les agendó visita"
              cuantas={e.visita}
              total={e.entraron}
              color={COLOR_OP72[3]}
              conversion={
                e.contestaron > 0
                  ? `${porcentaje(e.visita, e.contestaron)} % de las que contestaron`
                  : undefined
              }
            />

            {e.enPlazo > 0 ? (
              <div className="border-t border-borde-tarjeta pt-3">
                <div className="flex items-baseline justify-between gap-[10px]">
                  <span className="text-[12.5px] leading-none font-semibold text-[rgba(19,28,36,.6)]">
                    Aún en plazo{" "}
                    <span className="font-medium">(entraron sobre el cierre)</span>
                  </span>
                  <span className="text-[12.5px] leading-none font-bold text-[rgba(19,28,36,.6)]">
                    {e.enPlazo}
                  </span>
                </div>
                <div
                  className="mt-[6px] box-border h-[16px] rounded-[4px] border-[1.5px] border-dashed border-[rgba(19,28,36,.25)]"
                  style={{ width: anchoDe(e.enPlazo, e.entraron) }}
                />
                <p className="mt-[5px] text-[11px] leading-[1.4] font-medium text-[rgba(19,28,36,.5)]">
                  No cuentan como perdidas: todavía les queda periodo.
                </p>
              </div>
            ) : null}

            <EscalonEmbudo
              titulo="Entregadas a un mentor"
              cuantas={e.entregadas}
              total={e.entraron}
              color={COLOR_OP72[4]}
            />
          </div>

          <div>
            {sinLlamar > 0 ? (
              <div className="aviso-ambar">
                <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-ambar-texto">
                  DÓNDE SE PIERDE LA GENTE
                </p>
                <p className="mt-3 text-[34px] leading-none font-extrabold tracking-[-.02em] text-ambar-texto">
                  {porcentaje(sinLlamar, conPlazoCumplido)} %
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.5] font-semibold text-tinta">
                  de los que <strong className="font-extrabold">ya cumplieron su plazo</strong>{" "}
                  nunca recibieron una llamada registrada. Son {sinLlamar} de{" "}
                  {conPlazoCumplido} personas
                  {e.enPlazo > 0 ? `; las otras ${e.enPlazo} siguen en plazo` : ""}.
                </p>
                {e.seLlamo > 0 && porcentaje(e.contestaron, e.seLlamo) >= 50 ? (
                  <p className="mt-[10px] text-[11.5px] leading-[1.5] font-medium text-ambar-texto">
                    La pérdida no está en que no contesten — cuando se llama,
                    contesta el {porcentaje(e.contestaron, e.seLlamo)} %. Está en
                    que no se llama.
                  </p>
                ) : null}
                <Link
                  href={`/administracion/informe/personas?${parametrosDelRango(informe.rango)}&filtro=sin-tocar`}
                  className="mt-[10px] inline-block text-[11.5px] leading-none font-bold text-ambar-texto"
                >
                  Ver a esas {sinLlamar} personas →
                </Link>
              </div>
            ) : (
              <div className="rounded-[10px] border border-[rgba(110,154,85,.4)] bg-verde-050 p-[15px]">
                <p className="text-[12.5px] leading-[1.5] font-semibold text-verde-700">
                  A todos los que cumplieron su plazo se les registró al menos
                  una llamada.
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-baseline justify-between rounded-[10px] bg-papel px-[13px] py-[11px]">
                <span className="text-[12px] leading-[1.3] font-semibold text-[rgba(19,28,36,.6)]">
                  Se les llamó, {informe.rango.etiquetaPrevio}
                </span>
                <span className="text-[13px] leading-none font-bold text-tinta">
                  {tasaDeLlamada(previa)} %
                </span>
              </div>
              <div className="flex items-baseline justify-between rounded-[10px] bg-papel px-[13px] py-[11px]">
                <span className="text-[12px] leading-[1.3] font-semibold text-[rgba(19,28,36,.6)]">
                  Este periodo
                </span>
                <span
                  className={`text-[13px] leading-none font-bold ${
                    tasaDeLlamada(e) >= tasaDeLlamada(previa) ? "text-verde-700" : "text-rojo"
                  }`}
                >
                  {tasaDeLlamada(e)} %
                  {previa.entraron > 0
                    ? ` · ${tasaDeLlamada(e) - tasaDeLlamada(previa) >= 0 ? "+" : "−"}${Math.abs(tasaDeLlamada(e) - tasaDeLlamada(previa))} pts`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 border-t border-borde-tarjeta pt-[13px] text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
        Se mide{" "}
        <strong className="font-bold text-tinta">dentro del mismo periodo</strong>,
        así que conviene que el corte empiece un viernes: quien llegó el sábado o
        el domingo tiene lunes, martes, miércoles y jueves para que lo llamen. Los
        que entraron sobre el cierre salen aparte como{" "}
        <strong className="font-bold text-tinta">«aún en plazo»</strong> y no
        cuentan como perdidos.
      </p>
    </section>
  );
}

function BloqueRecorrido({ informe }: { informe: Informe }) {
  const mayor = Math.max(...informe.fases.map((fila) => fila.personas), 1);
  const activas = informe.fases.reduce((suma, fila) => suma + fila.personas, 0);
  const pasos = informe.transiciones.filter(
    (t) =>
      !(
        informe.saltos > 0 &&
        ["GANAR"].includes(t.desde) &&
        ["ENTRENAR", "MULTIPLICAR"].includes(t.hacia)
      ),
  );

  return (
    <section className="tarjeta mt-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
        <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">El recorrido</h2>
        <p className="text-[12px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
          Dónde está hoy cada persona, y quiénes se movieron en el periodo.
        </p>
      </div>

      <div className="mt-[18px] grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="etiqueta-seccion">PERSONAS EN CADA FASE, HOY · Y CUÁNTO CAMBIÓ</p>
          <div className="mt-[14px] flex flex-col gap-3">
            {informe.fases.map((fila) => (
              <div key={fila.fase}>
                <div className="flex items-baseline justify-between gap-[10px]">
                  <span className="text-[12.5px] leading-none font-bold text-tinta">
                    {ETIQUETA_FASE[fila.fase]}
                  </span>
                  <span className="text-[12.5px] leading-none font-bold text-tinta">
                    {fila.personas}{" "}
                    {fila.neto !== 0 ? (
                      <span className={fila.neto > 0 ? "text-verde-700" : "text-rojo"}>
                        {fila.neto > 0 ? "+" : "−"}
                        {Math.abs(fila.neto)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div
                  className="mt-[6px] h-[14px] rounded-[4px]"
                  style={{
                    width: anchoDe(fila.personas, mayor),
                    background: COLOR_FASE[fila.fase],
                  }}
                />
              </div>
            ))}
          </div>
          {activas > 0 ? (
            <p className="mt-4 text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
              De {activas} personas activas,{" "}
              <strong className="font-bold text-tinta">
                el {porcentaje(informe.fases[0].personas, activas)} % sigue en Ganar
              </strong>
              .
            </p>
          ) : null}
        </div>

        <div>
          <p className="etiqueta-seccion">SE MOVIERON EN EL PERIODO</p>
          <div className="mt-[14px] flex flex-col gap-[9px]">
            {pasos.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
                Nadie cambió de fase en este periodo.
              </p>
            ) : (
              pasos.map((paso) => (
                <div
                  key={`${paso.desde}-${paso.hacia}`}
                  className="flex items-center gap-[11px] rounded-[10px] bg-papel px-[13px] py-[11px]"
                >
                  <span className="min-w-[26px] text-[20px] leading-none font-extrabold text-tinta">
                    {paso.cuantas}
                  </span>
                  <span className="text-[12.5px] leading-[1.35] font-semibold text-tinta">
                    {ETIQUETA_FASE[paso.desde]}{" "}
                    <span className="text-[rgba(19,28,36,.4)]">→</span>{" "}
                    {ETIQUETA_FASE[paso.hacia]}
                  </span>
                </div>
              ))
            )}

            {informe.saltos > 0 || informe.retrocesos > 0 ? (
              <div className="aviso-ambar mt-1">
                <p className="text-[9.5px] leading-none font-bold tracking-[.12em] text-ambar-texto">
                  NO SIGUIERON EL ORDEN
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.45] font-semibold text-tinta">
                  {informe.saltos > 0
                    ? `${informe.saltos} ${informe.saltos === 1 ? "persona se saltó" : "personas se saltaron"} una fase`
                    : ""}
                  {informe.saltos > 0 && informe.retrocesos > 0 ? " y " : ""}
                  {informe.retrocesos > 0
                    ? `${informe.retrocesos} ${informe.retrocesos === 1 ? "volvió" : "volvieron"} atrás`
                    : ""}
                  .
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function BloqueActividad({ informe }: { informe: Informe }) {
  const tope = Math.max(
    ...informe.porDia.flatMap((d) => [d.llamadas, d.visitas, d.registros]),
    1,
  );

  return (
    <section className="tarjeta mt-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">
          {informe.rango.grano === "dia"
            ? "Actividad, día por día"
            : informe.rango.grano === "semana"
              ? "Actividad, semana por semana"
              : "Actividad, mes por mes"}
        </h2>
        <div className="flex items-center gap-4">
          <Leyenda color={COLOR_LLAMADAS}>Llamadas</Leyenda>
          <Leyenda color={COLOR_VISITAS}>Visitas</Leyenda>
          <Leyenda color={COLOR_REGISTROS}>Registros</Leyenda>
        </div>
      </div>

      <div className="mt-[18px] overflow-x-auto">
        <div style={{ minWidth: `${informe.porDia.length * 54}px` }}>
          <div
            className="flex h-[180px] items-end gap-[14px] border-b border-[rgba(19,28,36,.12)]"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${informe.porDia.length}, minmax(0, 1fr))`,
            }}
          >
            {informe.porDia.map((dia) => (
              <div key={dia.dia} className="flex h-full items-end justify-center gap-[2px]">
                <Barra valor={dia.llamadas} tope={tope} color={COLOR_LLAMADAS} />
                <Barra valor={dia.visitas} tope={tope} color={COLOR_VISITAS} />
                <Barra valor={dia.registros} tope={tope} color={COLOR_REGISTROS} />
              </div>
            ))}
          </div>
          <div
            className="mt-2 gap-[14px]"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${informe.porDia.length}, minmax(0, 1fr))`,
            }}
          >
            {informe.porDia.map((dia) => (
              <span
                key={dia.dia}
                className="text-center text-[11px] leading-[1.4] font-semibold text-[rgba(19,28,36,.5)]"
              >
                {dia.etiqueta}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Leyenda({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-[6px] text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.55)]">
      <span className="h-[10px] w-[10px] rounded-[3px]" style={{ background: color }} />
      {children}
    </span>
  );
}

function Barra({ valor, tope, color }: { valor: number; tope: number; color: string }) {
  return (
    <div
      title={`${valor}`}
      className="w-[14px] rounded-t-[4px]"
      style={{
        height: `${valor <= 0 ? 0 : Math.max((valor / tope) * 100, 2)}%`,
        background: color,
      }}
    />
  );
}

function BloqueOp72({ informe }: { informe: Informe }) {
  const porEstado = new Map(informe.op72.map((fila) => [fila.estado, fila.cuantas]));
  const total = informe.op72.reduce((suma, fila) => suma + fila.cuantas, 0);
  const mayor = Math.max(...informe.op72.map((fila) => fila.cuantas), 1);

  return (
    <div className="tarjeta p-5">
      <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">Operación 72, hoy</h2>
      <p className="mt-[7px] text-[12px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
        Dónde están paradas las {total} tarjetas abiertas.
      </p>
      <div className="mt-4 flex flex-col gap-[11px]">
        {ORDEN_OP72.map((estado, indice) => (
          <div key={estado}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] leading-none font-semibold text-tinta">
                {ETIQUETA_OP72[estado]}
              </span>
              <span className="text-[12.5px] leading-none font-bold text-tinta">
                {porEstado.get(estado) ?? 0}
              </span>
            </div>
            <div
              className="mt-[6px] h-[14px] rounded-[4px]"
              style={{
                width: anchoDe(porEstado.get(estado) ?? 0, mayor),
                background: COLOR_OP72[indice],
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function BloqueHitos({ informe }: { informe: Informe }) {
  const mayor = Math.max(...informe.hitosPorTipo.map((fila) => fila.cuantos), 1);

  return (
    <div className="tarjeta p-5">
      <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">
        Hitos del periodo
      </h2>
      <p className="mt-[7px] text-[12px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
        Lo que la gente alcanzó.
      </p>
      <div className="mt-4 flex flex-col gap-[10px]">
        {informe.hitosPorTipo.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-[rgba(19,28,36,.16)] p-4 text-[12px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
            Nadie alcanzó un hito en este periodo.
          </p>
        ) : (
          informe.hitosPorTipo.map((fila) => (
            <div key={fila.kind} className="flex items-center gap-[10px]">
              <span className="w-[100px] shrink-0 text-[12px] leading-[1.3] font-semibold text-[rgba(19,28,36,.6)]">
                {ETIQUETA_HITO[fila.kind as keyof typeof ETIQUETA_HITO] ?? fila.kind}
              </span>
              <div
                className="h-[12px] rounded-[4px] bg-verde-700"
                style={{ width: anchoDe(fila.cuantos, mayor), maxWidth: "128px" }}
              />
              <span className="text-[12px] leading-none font-bold text-tinta">
                {fila.cuantos}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BloqueConsolidadores({ informe }: { informe: Informe }) {
  return (
    <section className="tarjeta mt-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
        <h2 className="text-[15px] leading-[1.2] font-bold text-tinta">Quién hizo qué</h2>
        <p className="text-[12px] leading-[1.4] font-medium text-[rgba(19,28,36,.55)]">
          Solo lo registrado en los formularios: es lo único que mueve una tarjeta.
        </p>
      </div>

      <div className="mt-[14px] overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b border-[rgba(19,28,36,.12)]">
              <Encabezado alineado="left">CONSOLIDADOR</Encabezado>
              <Encabezado>A CARGO</Encabezado>
              <Encabezado>LLAMÓ</Encabezado>
              <Encabezado>CONTESTARON</Encabezado>
              <Encabezado>VISITAS</Encabezado>
              <Encabezado>ENTREGÓ</Encabezado>
              <Encabezado>SIN TOCAR</Encabezado>
              <Encabezado>EFECTIVIDAD</Encabezado>
            </tr>
          </thead>
          <tbody>
            {informe.consolidadores.map((fila) => {
              const efectividad = porcentaje(fila.aCargo - fila.sinTocar, fila.aCargo);
              const flojo = efectividad < 40;
              return (
                <tr
                  key={fila.id}
                  className={`border-b border-[rgba(19,28,36,.06)] ${flojo ? "bg-ambar-fondo" : ""}`}
                >
                  <td className="py-[11px] pr-2 text-[12.5px] font-semibold text-tinta">
                    {fila.nombre}
                  </td>
                  <Celda>{fila.aCargo}</Celda>
                  <Celda fuerte>{fila.llamo}</Celda>
                  <Celda>{fila.contestaron}</Celda>
                  <Celda>{fila.visitas}</Celda>
                  <Celda>{fila.entrego}</Celda>
                  <td
                    className={`px-2 py-[11px] text-right text-[12.5px] ${flojo ? "font-bold text-ambar-texto" : "font-medium text-[rgba(19,28,36,.7)]"}`}
                  >
                    {fila.sinTocar}
                  </td>
                  <td
                    className={`py-[11px] pl-2 text-right text-[12.5px] font-bold ${flojo ? "text-rojo" : "text-tinta"}`}
                  >
                    {efectividad} %
                  </td>
                </tr>
              );
            })}
            {informe.consolidadores.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-5 text-[12.5px] font-medium text-[rgba(19,28,36,.5)]">
                  Nadie tiene personas asignadas en fase Ganar.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="mt-[13px] text-[11.5px] leading-[1.5] font-medium text-[rgba(19,28,36,.5)]">
        <strong className="font-bold text-tinta">«Sin tocar»</strong> son personas
        suyas a las que nadie les registró nada en el periodo, y{" "}
        <strong className="font-bold text-tinta">«Efectividad»</strong> es qué
        porcentaje de los suyos sí recibió algo. Es lo que hay que mirar primero.
      </p>

      <Link
        href={`/administracion/informe/personas?${parametrosDelRango(informe.rango)}`}
        className="boton-primario mt-[14px] inline-block"
      >
        Ver el detalle persona por persona
      </Link>
    </section>
  );
}

function Encabezado({
  children,
  alineado = "right",
}: {
  children: React.ReactNode;
  alineado?: "left" | "right";
}) {
  return (
    <th
      className={`px-2 pb-[9px] text-[10px] leading-none font-bold tracking-[.12em] text-[rgba(19,28,36,.42)] ${
        alineado === "left" ? "pl-0 text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

function Celda({ children, fuerte = false }: { children: React.ReactNode; fuerte?: boolean }) {
  return (
    <td
      className={`px-2 py-[11px] text-right text-[12.5px] ${fuerte ? "font-bold text-tinta" : "font-medium text-[rgba(19,28,36,.7)]"}`}
    >
      {children}
    </td>
  );
}
