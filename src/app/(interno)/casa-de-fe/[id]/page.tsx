import { notFound } from "next/navigation";
import { requerirPermiso } from "@/lib/auth";
import {
  cargarCasaDeFe,
  construirMiembros,
  puedeAdministrarCasaDeFe,
  puedeVerCasaDeFe,
} from "@/lib/casa-de-fe";
import { CasaDeFe, type MiembroVista } from "./grupo";

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
  const usuario = await requerirPermiso(puedeVerCasaDeFe);
  const grupo = await cargarCasaDeFe(id);

  if (!grupo) notFound();

  // Solo entra quien la lleva, quien la abrió, o la dirección.
  const puedeEditar = puedeAdministrarCasaDeFe(usuario, grupo);
  if (!puedeEditar && grupo.createdById !== usuario.id) notFound();

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
            {grupo.leader.fullName} · desde {FECHA.format(grupo.startDate)} ·{" "}
            {miembros.length} {miembros.length === 1 ? "persona" : "personas"}
            {grupo.closedAt ? " · cerrada" : ""}
          </p>
        </header>

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
