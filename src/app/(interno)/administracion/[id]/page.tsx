import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { cargarPersonaAdmin } from "@/lib/administracion";
import { nombreCompleto } from "@/lib/dominio";
import { mentoresElegibles } from "@/lib/equipo";
import { getPrisma } from "@/lib/prisma";
import { EditorPersona } from "./editor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const persona = await cargarPersonaAdmin(id);
  return {
    title: persona
      ? `${nombreCompleto(persona)} · Administración`
      : "Administración · Iglesia Vive",
  };
}

export default async function PaginaPersonaAdmin({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirRol(ROLES_ADMIN);
  const { id } = await params;
  const persona = await cargarPersonaAdmin(id);
  if (!persona) notFound();

  const aprendiz = persona.learnerProfile;
  const mentores = aprendiz ? await mentoresElegibles(await getPrisma()) : [];

  return (
    <main className="px-5 py-7 pb-16 sm:px-[26px]">
      <div className="mx-auto max-w-[820px]">
        <Link
          href="/administracion"
          className="text-[12px] leading-none font-semibold text-azul-700"
        >
          ← Volver a administración
        </Link>

        <header className="mt-3">
          <h1 className="font-serif text-[28px] leading-[1.1] font-normal text-tinta">
            {persona.nombre}
          </h1>
          <p className="mt-2 text-[12.5px] leading-none font-medium text-[rgba(19,28,36,.55)]">
            {persona.user
              ? `Con acceso · ${persona.user.email}`
              : "Sin acceso al sistema"}
            {persona.mentorActual ? ` · Mentor: ${persona.mentorActual}` : ""}
          </p>
        </header>

        <EditorPersona
          personId={persona.id}
          learnerId={aprendiz?.id ?? null}
          datos={{
            firstName: persona.firstName,
            lastName: persona.lastName ?? "",
            gender: persona.gender ?? "",
            birthDate: persona.birthDate
              ? persona.birthDate.toISOString().slice(0, 10)
              : "",
            callPhone: persona.callPhone ?? "",
            whatsappPhone: persona.whatsappPhone ?? "",
            email: persona.email ?? "",
            address: persona.address ?? "",
            prayerRequest: persona.prayerRequest ?? "",
          }}
          cuenta={
            persona.user
              ? {
                  id: persona.user.id,
                  email: persona.user.email,
                  role: persona.user.role,
                  capacity: persona.user.capacity,
                  active: persona.user.active,
                  canLeadAlpha: persona.user.canLeadAlpha,
                  canLeadFaithHouse: persona.user.canLeadFaithHouse,
                  coordinatesConsolidation: persona.user.coordinatesConsolidation,
                }
              : null
          }
          fase={aprendiz?.phase ?? null}
          hitosCompletados={[...persona.hitosCompletados]}
          mentores={mentores.map((m) => ({ id: m.id, nombre: m.nombre }))}
          mentorActualId={persona.mentorActualId}
          estado={persona.estado}
          baja={
            persona.baja
              ? {
                  motivo: persona.baja.motivo,
                  fecha: persona.baja.fecha.toLocaleDateString("es-CO", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                  por: persona.baja.por,
                }
              : null
          }
        />
      </div>
    </main>
  );
}
