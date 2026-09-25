import Link from "next/link";
import { notFound } from "next/navigation";
import { requerirRol, ROLES_ADMIN } from "@/lib/auth";
import { cargarPersonaAdmin } from "@/lib/administracion";
import { momentoCorto, nombreCompleto } from "@/lib/dominio";
import { mentoresElegibles } from "@/lib/equipo";
import { getPrisma } from "@/lib/prisma";
import { cargarDeclaracionPendiente } from "@/lib/liderazgo";
import { ZONA_HORARIA } from "@/lib/dominio";
import { DeclaracionDeLiderazgo } from "./declaracion";
import { EditorPersona } from "./editor";
import { porDefecto } from "@/lib/vistas";
import { VISTAS } from "@/lib/vistas-catalogo";
import {
  VistasDeLaCuenta,
  type VistaDeLaCuenta,
} from "./vistas-de-la-cuenta";

const FECHA_DECLARACION = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_HORARIA,
  day: "numeric",
  month: "long",
});

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
  const prisma = await getPrisma();

  // Qué pantallas ve esta cuenta. Solo se consulta si tiene acceso creado: una
  // ficha sin cuenta no tiene menús que configurar.
  const cuentaId = persona.user?.id ?? null;
  const [filasDeRol, filasDeCuenta] = cuentaId
    ? await prisma.$transaction([
        prisma.viewRoleAccess.findMany({
          where: { role: persona.user!.role },
          select: { view: true, enabled: true },
        }),
        prisma.viewUserAccess.findMany({
          where: { userId: cuentaId },
          select: { view: true, enabled: true },
        }),
      ])
    : [[], []];

  const porRol = new Map(filasDeRol.map((f) => [f.view, f.enabled]));
  const excepciones = new Map(filasDeCuenta.map((f) => [f.view, f.enabled]));

  const vistasDeLaCuenta: VistaDeLaCuenta[] = persona.user
    ? VISTAS.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        // Lo que le daría su rol: la fila configurada si la hay, y si no el
        // defecto **con sus permisos reales** — porque hoy una casilla como
        // «líder de Alpha» también abre pantallas.
        porSuRol:
          porRol.get(v.id) ??
          porDefecto(v.id, {
            role: persona.user!.role,
            canLeadAlpha: persona.user!.canLeadAlpha,
            canLeadFaithHouse: persona.user!.canLeadFaithHouse,
            canMentor: persona.user!.canMentor,
            coordinaConsolidacion: persona.user!.coordinatesConsolidation,
            veTodosLosGrupos: persona.user!.canSeeAllGroups,
            llevaGi: persona.user!.canLeadGi,
            coordinaGi: persona.user!.coordinatesGi,
          }),
        excepcion: excepciones.get(v.id) ?? null,
      }))
    : [];
  const mentores = aprendiz ? await mentoresElegibles(prisma) : [];

  // Lo que la persona declaró de sí misma en el formulario público de
  // liderazgo y todavía nadie ha confirmado. Se muestra la más reciente: si
  // llenó el formulario dos veces, lo que vale es lo último que dijo.
  const declaracion = await cargarDeclaracionPendiente(
    prisma,
    persona.id,
    aprendiz?.phase ?? null,
  );

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

        {declaracion ? (
          <DeclaracionDeLiderazgo
            personId={persona.id}
            nombre={persona.nombre}
            declaracion={{
              id: declaracion.id,
              cuando: FECHA_DECLARACION.format(declaracion.creada),
              items: declaracion.items.map((item) => ({
                ...item,
                resueltoEl: item.resueltoEl
                  ? FECHA_DECLARACION.format(item.resueltoEl)
                  : null,
              })),
            }}
          />
        ) : null}

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
                  canMentor: persona.user.canMentor,
                  coordinatesConsolidation: persona.user.coordinatesConsolidation,
                  canSeeAllGroups: persona.user.canSeeAllGroups,
                  canLeadGi: persona.user.canLeadGi,
                  coordinatesGi: persona.user.coordinatesGi,
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
                  // `momentoCorto` y no `toLocaleDateString` a secas: es una
                  // marca de tiempo real, y sin la zona de Colombia todo lo
                  // registrado después de las 7 de la noche se pinta con la
                  // fecha del día siguiente (la regla del 8-sep-2026).
                  fecha: momentoCorto(persona.baja.fecha),
                  por: persona.baja.por,
                }
              : null
          }
          asistente={
            persona.asistente
              ? {
                  motivo: persona.asistente.motivo,
                  nota: persona.asistente.nota,
                  desde: persona.asistente.desde
                    ? momentoCorto(persona.asistente.desde)
                    : null,
                }
              : null
          }
        />

        {persona.user ? (
          <div className="mt-[14px]">
            <VistasDeLaCuenta
              userId={persona.user.id}
              vistas={vistasDeLaCuenta}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
