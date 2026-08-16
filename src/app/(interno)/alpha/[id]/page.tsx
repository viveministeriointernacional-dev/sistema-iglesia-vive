import { notFound } from "next/navigation";
import { requerirRol, ROLES_ALPHA } from "@/lib/auth";
import {
  ASISTENCIA_MINIMA,
  cargarGrupo,
  construirParticipantes,
  esVistaCompletaDeAlpha,
  SESIONES_DE_ALPHA,
} from "@/lib/alpha";
import { Grupo, type ParticipanteVista, type SesionVista } from "./grupo";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const grupo = await cargarGrupo(id);
  return { title: grupo ? `${grupo.name} · Alpha` : "Alpha · Iglesia Vive" };
}

export default async function PaginaGrupoDeAlpha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await requerirRol(ROLES_ALPHA);
  const grupo = await cargarGrupo(id);

  if (!grupo) notFound();

  // Un líder solo entra a sus grupos.
  const esSuyo = grupo.leaderId === usuario.id;
  if (!esSuyo && !esVistaCompletaDeAlpha(usuario)) notFound();

  const ahora = new Date();
  const participantes = construirParticipantes(grupo, ahora);

  const sesiones: SesionVista[] = grupo.sessions.map((sesion) => ({
    id: sesion.id,
    numero: sesion.number,
    fecha: FECHA.format(sesion.date),
    tema: sesion.topic,
    realizada: sesion.date.getTime() <= ahora.getTime(),
  }));

  const asistenciaPorInscripcion = new Map<
    string,
    Record<string, { present: boolean; note: string | null }>
  >();
  for (const sesion of grupo.sessions) {
    for (const marca of sesion.attendance) {
      const actual = asistenciaPorInscripcion.get(marca.enrollmentId) ?? {};
      actual[sesion.id] = { present: marca.present, note: marca.note };
      asistenciaPorInscripcion.set(marca.enrollmentId, actual);
    }
  }

  const vistas: ParticipanteVista[] = participantes.map((persona) => ({
    enrollmentId: persona.enrollmentId,
    learnerId: persona.learnerId,
    nombre: persona.nombre,
    presentes: persona.presentes,
    sesionesRealizadas: persona.sesionesRealizadas,
    porcentaje: persona.porcentaje,
    cumpleAsistencia: persona.cumpleAsistencia,
    tieneFocusDay: persona.focusDay !== null,
    validado: persona.validadoEl
      ? `${FECHA.format(persona.validadoEl)}${persona.validadoPor ? ` · ${persona.validadoPor}` : ""}`
      : null,
    faltaParaValidar: persona.faltaParaValidar,
    asistencia: asistenciaPorInscripcion.get(persona.enrollmentId) ?? {},
  }));

  const validados = vistas.filter((v) => v.validado).length;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {grupo.name}
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {grupo.leader.fullName} · desde {FECHA.format(grupo.startDate)} ·{" "}
            {grupo.sessions.length} de {SESIONES_DE_ALPHA} sesiones ·{" "}
            {vistas.length} {vistas.length === 1 ? "persona" : "personas"} ·{" "}
            {validados} {validados === 1 ? "validada" : "validadas"}
          </p>
        </header>

        <Grupo
          programId={grupo.id}
          sesiones={sesiones}
          participantes={vistas}
          asistenciaMinima={ASISTENCIA_MINIMA * 100}
          puedeEditar={esSuyo || esVistaCompletaDeAlpha(usuario)}
        />
      </div>
    </main>
  );
}
