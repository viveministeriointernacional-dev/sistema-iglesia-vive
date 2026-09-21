import { notFound } from "next/navigation";
import { diaLargo } from "@/lib/dominio";
import { requerirVista } from "@/lib/auth";
import { paraPermiso } from "@/lib/encargados-catalogo";
import { hoyEnColombia } from "@/lib/dominio";
import { ReunionDelGrupo } from "@/components/reunion-del-grupo";
import { diaISO } from "@/lib/reunion-catalogo";
import {
  guardarReunion,
  casaDeFeCambiarLider,
  casaDeFeAnadirEncargado,
  casaDeFeQuitarEncargado,
  casaDeFeCuentasQuePuedenLlevar,
} from "../acciones";
import { EncargadosDelGrupo } from "@/components/encargados-del-grupo";
import {
  cargarCasaDeFe,
  construirMiembros,
  puedeAdministrarCasaDeFe,
  puedeEntrarACasaDeFe,
} from "@/lib/casa-de-fe";
import { CasaDeFe, type MiembroVista } from "./grupo";

export const dynamic = "force-dynamic";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const grupo = await cargarCasaDeFe(id);
  return {
    title: grupo ? `${grupo.name} · Casa de Fe` : "Casa de Fe · Iglesia Vive",
  };
}

export default async function PaginaCasaDeFe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await requerirVista("grupos");
  const grupo = await cargarCasaDeFe(id);

  if (!grupo) notFound();

  // Entra quien la lleva, quien la abrió, la administración, el líder que tiene
  // al líder del grupo en su rama — y, **solo a mirar**, quien tiene el permiso
  // «ve todos los grupos». De ahí que sean dos preguntas y no una: antes bastaba
  // con `puedeEditar`, y eso dejaba fuera a quien puede verla sin tocarla.
  const permiso = paraPermiso(grupo);
  const [puedeEditar, puedeEntrar] = await Promise.all([
    puedeAdministrarCasaDeFe(usuario, permiso),
    puedeEntrarACasaDeFe(usuario, permiso),
  ]);
  if (!puedeEntrar) notFound();

  const miembros: MiembroVista[] = construirMiembros(grupo).map((miembro) => ({
    membershipId: miembro.membershipId,
    learnerId: miembro.learnerId,
    nombre: miembro.nombre,
    fase: miembro.fase,
    telefono: miembro.telefono,
  }));

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[820px]">
        <header>
          <h1 className="font-serif text-[30px] leading-[1.1] font-normal text-tinta">
            {grupo.name}
          </h1>
          <p className="mt-2 text-[13px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {grupo.leader.fullName} · desde {diaLargo(grupo.startDate)} ·{" "}
            {miembros.length} {miembros.length === 1 ? "persona" : "personas"}
            {grupo.closedAt ? " · cerrada" : ""}
          </p>
        </header>

        <EncargadosDelGrupo
          clase="casa-de-fe"
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
          cuentasQuePuedenLlevar={casaDeFeCuentasQuePuedenLlevar.bind(null, grupo.id)}
          cambiarLider={casaDeFeCambiarLider.bind(null, grupo.id)}
          anadirEncargado={casaDeFeAnadirEncargado.bind(null, grupo.id)}
          quitarEncargado={casaDeFeQuitarEncargado.bind(null, grupo.id)}
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

        <CasaDeFe
          groupId={grupo.id}
          miembros={miembros}
          cerrada={grupo.closedAt !== null}
          puedeEditar={puedeEditar}
        />
      </div>
    </main>
  );
}
