import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { requerirRol } from "@/lib/auth";
import {
  ASISTENCIA_MINIMA_ESCUELA,
  cargarEscuela,
  construirParticipantesDeEscuela,
  esVistaCompletaDeEscuela,
  ROLES_ENTRENAR,
  TAREAS_MINIMAS,
} from "@/lib/entrenar";
import { Escuela, type ParticipanteVista, type SesionVista } from "./escuela";

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
  const prisma = await getPrisma();
  const escuela = await prisma.trainingProgram.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: escuela ? `${escuela.name} · Escuela` : "Escuela · Iglesia Vive",
  };
}

export default async function PaginaDeEscuela({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await requerirRol(ROLES_ENTRENAR);
  const escuela = await cargarEscuela(id);

  if (!escuela) notFound();

  const esSuya = escuela.leaderId === usuario.id;
  if (!esSuya && !esVistaCompletaDeEscuela(usuario)) notFound();

  const ahora = new Date();
  const participantes = construirParticipantesDeEscuela(escuela, ahora);

  const sesiones: SesionVista[] = escuela.sessions.map((sesion) => ({
    id: sesion.id,
    numero: sesion.number,
    fecha: FECHA.format(sesion.date),
    tema: sesion.topic,
    kind: sesion.kind,
    recurso: sesion.resource,
    tarea: sesion.task,
    realizada: sesion.date.getTime() <= ahora.getTime(),
  }));

  const registroPorInscripcion = new Map<
    string,
    Record<string, { present: boolean; taskDelivered: boolean }>
  >();
  for (const sesion of escuela.sessions) {
    for (const marca of sesion.attendance) {
      const actual = registroPorInscripcion.get(marca.enrollmentId) ?? {};
      actual[sesion.id] = {
        present: marca.present,
        taskDelivered: marca.taskDelivered,
      };
      registroPorInscripcion.set(marca.enrollmentId, actual);
    }
  }

  const vistas: ParticipanteVista[] = participantes.map((persona) => ({
    enrollmentId: persona.enrollmentId,
    learnerId: persona.learnerId,
    nombre: persona.nombre,
    presentes: persona.presentes,
    sesionesRealizadas: persona.sesionesRealizadas,
    porcentajeAsistencia: persona.porcentajeAsistencia,
    tareasEntregadas: persona.tareasEntregadas,
    tareasPedidas: persona.tareasPedidas,
    completado: persona.completadoEl
      ? `${FECHA.format(persona.completadoEl)}${persona.completadoPor ? ` · ${persona.completadoPor}` : ""}`
      : null,
    faltaParaCerrar: persona.faltaParaCerrar,
    registro: registroPorInscripcion.get(persona.enrollmentId) ?? {},
  }));

  const cerradas = vistas.filter((v) => v.completado).length;

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[1240px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {escuela.name}
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {escuela.leader.fullName} · desde {FECHA.format(escuela.startDate)} ·{" "}
            {escuela.sessions.length}{" "}
            {escuela.sessions.length === 1 ? "sesión" : "sesiones"} ·{" "}
            {vistas.length} {vistas.length === 1 ? "persona" : "personas"} ·{" "}
            {cerradas} {cerradas === 1 ? "cerrada" : "cerradas"}
          </p>
        </header>

        <Escuela
          programId={escuela.id}
          sesiones={sesiones}
          participantes={vistas}
          asistenciaMinima={ASISTENCIA_MINIMA_ESCUELA * 100}
          tareasMinimas={TAREAS_MINIMAS * 100}
          puedeEditar={esSuya || esVistaCompletaDeEscuela(usuario)}
        />
      </div>
    </main>
  );
}
