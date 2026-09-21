import { notFound } from "next/navigation";
import { diaLargo, momentoLargo } from "@/lib/dominio";
import { requerirVista } from "@/lib/auth";
import { paraPermiso } from "@/lib/encargados-catalogo";
import { hoyEnColombia } from "@/lib/dominio";
import { ReunionDelGrupo } from "@/components/reunion-del-grupo";
import { diaISO } from "@/lib/reunion-catalogo";
import {
  guardarReunion,
  alphaCambiarLider,
  alphaAnadirEncargado,
  alphaQuitarEncargado,
  alphaCuentasQuePuedenLlevar,
} from "../acciones";
import { EncargadosDelGrupo } from "@/components/encargados-del-grupo";
import {
  ASISTENCIA_MINIMA,
  cargarGrupo,
  construirParticipantes,
  puedeAdministrarGrupo,
  puedeEntrarAGrupo,
  SESIONES_DE_ALPHA,
} from "@/lib/alpha";
import { Grupo, type ParticipanteVista, type SesionVista } from "./grupo";

export const dynamic = "force-dynamic";


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
  const usuario = await requerirVista("grupos");
  const grupo = await cargarGrupo(id);

  if (!grupo) notFound();

  // Entra quien lleva el grupo, quien lo abrió, la administración, el líder que
  // tiene al líder del grupo en su rama — y, **solo a mirar**, quien tiene el
  // permiso «ve todos los grupos». Por eso son dos preguntas y no una.
  const permiso = paraPermiso(grupo);
  const [puedeEditar, puedeEntrar] = await Promise.all([
    puedeAdministrarGrupo(usuario, permiso),
    puedeEntrarAGrupo(usuario, permiso),
  ]);
  if (!puedeEntrar) notFound();

  const ahora = new Date();
  const participantes = construirParticipantes(grupo, ahora);

  const sesiones: SesionVista[] = grupo.sessions.map((sesion) => ({
    id: sesion.id,
    numero: sesion.number,
    fecha: diaLargo(sesion.date),
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
      ? `${momentoLargo(persona.validadoEl)}${persona.validadoPor ? ` · ${persona.validadoPor}` : ""}`
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
            {grupo.leader.fullName} · desde {diaLargo(grupo.startDate)} ·{" "}
            {grupo.sessions.length} de {SESIONES_DE_ALPHA} sesiones ·{" "}
            {vistas.length} {vistas.length === 1 ? "persona" : "personas"} ·{" "}
            {validados} {validados === 1 ? "validada" : "validadas"}
          </p>
        </header>

        <EncargadosDelGrupo
          clase="alpha"
          lider={{
            id: grupo.leader.id,
            fullName: grupo.leader.fullName,
            role: grupo.leader.role,
          }}
          encargados={grupo.coLeaders.map((encargado) => ({
            // `id` es la CUENTA, no el renglón de la tabla: es lo que reciben
            // las acciones y lo que compara `candidatosDisponibles`.
            id: encargado.userId,
            fullName: encargado.user.fullName,
            role: encargado.user.role,
            desde: encargado.addedAt,
          }))}
          puedeEditar={puedeEditar}
          cuentasQuePuedenLlevar={alphaCuentasQuePuedenLlevar.bind(null, grupo.id)}
          cambiarLider={alphaCambiarLider.bind(null, grupo.id)}
          anadirEncargado={alphaAnadirEncargado.bind(null, grupo.id)}
          quitarEncargado={alphaQuitarEncargado.bind(null, grupo.id)}
        />

        <div className="mb-[14px]">
          <ReunionDelGrupo
            nombre={grupo.name}
            reunion={{
              weekday: grupo.weekday,
              meetingTime: grupo.meetingTime,
              everyNWeeks: grupo.everyNWeeks,
              durationMinutes: grupo.durationMinutes,
              address: grupo.address,
              latitude: grupo.latitude,
              longitude: grupo.longitude,
            }}
            inicio={diaISO(grupo.startDate)}
            hoy={hoyEnColombia()}
            puedeEditar={puedeEditar}
            guardar={guardarReunion.bind(null, grupo.id)}
          />
        </div>

        <Grupo
          programId={grupo.id}
          sesiones={sesiones}
          participantes={vistas}
          asistenciaMinima={ASISTENCIA_MINIMA * 100}
          puedeEditar={puedeEditar}
        />
      </div>
    </main>
  );
}
