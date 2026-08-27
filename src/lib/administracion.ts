import {
  MilestoneKind,
  MilestoneStatus,
  Phase,
  Role,
} from "@iglesia/prisma-client";
import { nombreCompleto, normalizarTelefono } from "@/lib/dominio";
import { getPrisma } from "@/lib/prisma";

/// Hitos que un administrador puede marcar o quitar a mano desde el panel.
/// `REGISTRO` y `OPERACION_72` los maneja el sistema y no se editan aquí.
export const HITOS_EDITABLES: MilestoneKind[] = [
  MilestoneKind.ALPHA,
  MilestoneKind.FOCUS_DAY,
  MilestoneKind.CASA_DE_FE,
  MilestoneKind.ENCUENTRO,
  MilestoneKind.BAUTISMO,
  MilestoneKind.EVALUACION_CIERRE,
  MilestoneKind.ENTRADA_ESCUELA,
  MilestoneKind.SERVICIO,
  MilestoneKind.GRADUACION,
  MilestoneKind.VALIDACION_PASTORAL,
  MilestoneKind.MULTIPLICACION,
];

export const ETIQUETA_HITO: Record<MilestoneKind, string> = {
  REGISTRO: "Registro",
  OPERACION_72: "Operación 72",
  ALPHA: "Alpha",
  FOCUS_DAY: "Focus Day",
  CASA_DE_FE: "Casa de Fe",
  ENCUENTRO: "Encuentro",
  BAUTISMO: "Bautismo",
  EVALUACION_CIERRE: "Evaluación de cierre",
  GRADUACION: "Graduación",
  VALIDACION_PASTORAL: "Validación pastoral",
  ENTRADA_ESCUELA: "Entró a la Escuela",
  SERVICIO: "Está sirviendo",
  MULTIPLICACION: "Multiplicación",
};

export const FASES: Phase[] = [
  Phase.GANAR,
  Phase.FORTALECER,
  Phase.ENTRENAR,
  Phase.MULTIPLICAR,
];

export type FilaAdmin = {
  personId: string;
  learnerId: string | null;
  nombre: string;
  telefono: string | null;
  email: string | null;
  rol: Role | null;
  activo: boolean;
  fase: Phase | null;
  tieneAcceso: boolean;
};

/// Tamaños de página que ofrece el listado de personas.
export const TAMANOS_PAGINA = [10, 20, 50] as const;

export type PaginaAdmin = {
  filas: FilaAdmin[];
  total: number;
  page: number;
  size: number;
  paginas: number;
};

/// Busca personas para el panel, paginado. Sin consulta trae las más recientes.
export async function buscarPersonasAdmin(
  consulta: string,
  page = 1,
  size = 20,
): Promise<PaginaAdmin> {
  const texto = consulta.trim();
  const digitos = normalizarTelefono(texto);
  const tam = (TAMANOS_PAGINA as readonly number[]).includes(size) ? size : 20;
  const prisma = await getPrisma();

  const where = {
    active: true,
    ...(texto.length >= 2
      ? {
          OR: [
            { firstName: { contains: texto, mode: "insensitive" as const } },
            { lastName: { contains: texto, mode: "insensitive" as const } },
            { email: { contains: texto, mode: "insensitive" as const } },
            ...(digitos
              ? [
                  { callPhone: { contains: digitos } },
                  { whatsappPhone: { contains: digitos } },
                ]
              : []),
          ],
        }
      : {}),
  };

  const total = await prisma.person.count({ where });
  const paginas = Math.max(1, Math.ceil(total / tam));
  const pag = Math.min(Math.max(1, Math.trunc(page) || 1), paginas);

  const personas = await prisma.person.findMany({
    where,
    orderBy: texto.length >= 2 ? { firstName: "asc" } : { createdAt: "desc" },
    skip: (pag - 1) * tam,
    take: tam,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      callPhone: true,
      email: true,
      learnerProfile: { select: { id: true, phase: true } },
      user: { select: { role: true, active: true } },
    },
  });

  return {
    total,
    paginas,
    page: pag,
    size: tam,
    filas: personas.map((persona) => ({
      personId: persona.id,
      learnerId: persona.learnerProfile?.id ?? null,
      nombre: nombreCompleto(persona),
      telefono: persona.callPhone,
      email: persona.email,
      rol: persona.user?.role ?? null,
      activo: persona.user?.active ?? true,
      fase: persona.learnerProfile?.phase ?? null,
      tieneAcceso: Boolean(persona.user),
    })),
  };
}

export type PersonaAdmin = NonNullable<
  Awaited<ReturnType<typeof cargarPersonaAdmin>>
>;

/// Carga el detalle completo de una persona para el editor del panel.
export async function cargarPersonaAdmin(personId: string) {
  const prisma = await getPrisma();

  const persona = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      birthDate: true,
      callPhone: true,
      whatsappPhone: true,
      email: true,
      address: true,
      prayerRequest: true,
      learnerProfile: {
        select: {
          id: true,
          phase: true,
          status: true,
          milestones: { select: { kind: true, status: true } },
          mentorRelationships: {
            where: { endedAt: null },
            select: { mentor: { select: { fullName: true } } },
          },
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          active: true,
          capacity: true,
          canLeadAlpha: true,
          canLeadFaithHouse: true,
          coordinatesConsolidation: true,
        },
      },
    },
  });

  if (!persona) return null;

  const hitosCompletados = new Set(
    (persona.learnerProfile?.milestones ?? [])
      .filter((hito) => hito.status === MilestoneStatus.COMPLETADO)
      .map((hito) => hito.kind),
  );

  return {
    ...persona,
    nombre: nombreCompleto(persona),
    hitosCompletados,
    mentorActual:
      persona.learnerProfile?.mentorRelationships[0]?.mentor.fullName ?? null,
  };
}
