import { Prisma, Role } from "@iglesia/prisma-client";
import { colaDeTelefono } from "@/lib/dominio";
import { getPrisma } from "@/lib/prisma";

/// Tablero de llamadas de HighLevel (solo administración). Reúne el
/// comportamiento de las llamadas del personal: cuántas, cuánto duraron y cómo
/// terminaron, en total y persona por persona.

export type RangoFechas = { desde: Date; hasta: Date };

/// Rango por defecto: los últimos 30 días hasta ahora.
export function rangoPorDefecto(): RangoFechas {
  const hasta = new Date();
  const desde = new Date(hasta);
  desde.setDate(desde.getDate() - 30);
  return { desde, hasta };
}

/// Interpreta las fechas del filtro (YYYY-MM-DD). Si faltan, usa el rango por
/// defecto. `hasta` es inclusivo: se lleva al final del día.
export function rangoDesdeParametros(
  desdeParam?: string,
  hastaParam?: string,
): RangoFechas {
  const base = rangoPorDefecto();
  const desde = desdeParam ? new Date(`${desdeParam}T00:00:00`) : base.desde;
  const hasta = hastaParam ? new Date(`${hastaParam}T23:59:59.999`) : base.hasta;
  return {
    desde: Number.isNaN(desde.getTime()) ? base.desde : desde,
    hasta: Number.isNaN(hasta.getTime()) ? base.hasta : hasta,
  };
}

export type FilaLlamadasPersona = {
  appUserId: string | null;
  nombre: string;
  rol: Role | null;
  llamadas: number;
  contestadas: number;
  salientes: number;
  entrantes: number;
  duracionTotal: number;
  duracionPromedio: number;
};

export type ResumenLlamadas = {
  global: {
    llamadas: number;
    contestadas: number;
    noContestadas: number;
    salientes: number;
    entrantes: number;
    duracionTotal: number;
    duracionPromedio: number;
    contactosAlcanzados: number;
    personalActivo: number;
  };
  porPersona: FilaLlamadasPersona[];
  /// Llamadas cuyo usuario de HighLevel no está enlazado a ningún personal.
  sinAsignar: FilaLlamadasPersona | null;
};

type FilaCruda = {
  app_user_id: string | null;
  llamadas: number;
  contestadas: number;
  salientes: number;
  entrantes: number;
  duracion_total: number;
};

function promedio(total: number, cantidad: number) {
  return cantidad > 0 ? Math.round(total / cantidad) : 0;
}

/// Resumen global + desglose por persona en un rango de fechas.
export async function resumenLlamadas({
  desde,
  hasta,
}: RangoFechas): Promise<ResumenLlamadas> {
  const prisma = await getPrisma();

  // Una sola pasada agregada por persona (incluye la fila de no asignados).
  const filas = await prisma.$queryRaw<FilaCruda[]>`
    SELECT app_user_id,
           count(*)::int AS llamadas,
           count(*) FILTER (WHERE answered)::int AS contestadas,
           count(*) FILTER (WHERE direction = 'outbound')::int AS salientes,
           count(*) FILTER (WHERE direction = 'inbound')::int AS entrantes,
           coalesce(sum(duration_seconds), 0)::int AS duracion_total
    FROM call_log
    WHERE started_at >= ${desde} AND started_at <= ${hasta}
    GROUP BY app_user_id
  `;

  const contactos = await prisma.$queryRaw<{ n: number }[]>`
    SELECT count(DISTINCT contact_id)::int AS n
    FROM call_log
    WHERE started_at >= ${desde} AND started_at <= ${hasta}
      AND contact_id IS NOT NULL
  `;

  // Nombres del personal registrado (los que tienen cuenta en HighLevel).
  const personal = await prisma.appUser.findMany({
    where: { highlevelUserId: { not: null } },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
  const nombrePorId = new Map(personal.map((p) => [p.id, p]));

  const porId = new Map<string, FilaCruda>();
  let sinAsignarCruda: FilaCruda | null = null;
  for (const fila of filas) {
    if (fila.app_user_id) porId.set(fila.app_user_id, fila);
    else sinAsignarCruda = fila;
  }

  // Se listan TODOS los del personal registrado (aunque no hayan llamado), para
  // ver el comportamiento de cada uno; luego se ordena por nº de llamadas.
  const porPersona: FilaLlamadasPersona[] = personal
    .map((p) => {
      const c = porId.get(p.id);
      const llamadas = c?.llamadas ?? 0;
      const duracionTotal = c?.duracion_total ?? 0;
      return {
        appUserId: p.id,
        nombre: p.fullName,
        rol: p.role,
        llamadas,
        contestadas: c?.contestadas ?? 0,
        salientes: c?.salientes ?? 0,
        entrantes: c?.entrantes ?? 0,
        duracionTotal,
        duracionPromedio: promedio(duracionTotal, llamadas),
      };
    })
    .sort((a, b) => b.llamadas - a.llamadas || a.nombre.localeCompare(b.nombre));

  // Puede haber llamadas de un usuario de HighLevel sin cuenta enlazada.
  for (const [id, c] of porId) {
    if (!nombrePorId.has(id)) {
      porPersona.push({
        appUserId: id,
        nombre: "Personal sin enlazar",
        rol: null,
        llamadas: c.llamadas,
        contestadas: c.contestadas,
        salientes: c.salientes,
        entrantes: c.entrantes,
        duracionTotal: c.duracion_total,
        duracionPromedio: promedio(c.duracion_total, c.llamadas),
      });
    }
  }

  const totalLlamadas = filas.reduce((s, f) => s + f.llamadas, 0);
  const totalContestadas = filas.reduce((s, f) => s + f.contestadas, 0);
  const totalSalientes = filas.reduce((s, f) => s + f.salientes, 0);
  const totalEntrantes = filas.reduce((s, f) => s + f.entrantes, 0);
  const totalDuracion = filas.reduce((s, f) => s + f.duracion_total, 0);

  return {
    global: {
      llamadas: totalLlamadas,
      contestadas: totalContestadas,
      noContestadas: totalLlamadas - totalContestadas,
      salientes: totalSalientes,
      entrantes: totalEntrantes,
      duracionTotal: totalDuracion,
      duracionPromedio: promedio(totalDuracion, totalLlamadas),
      contactosAlcanzados: contactos[0]?.n ?? 0,
      personalActivo: porPersona.filter((p) => p.appUserId && p.llamadas > 0).length,
    },
    porPersona,
    sinAsignar: sinAsignarCruda
      ? {
          appUserId: null,
          nombre: "Sin asignar",
          rol: null,
          llamadas: sinAsignarCruda.llamadas,
          contestadas: sinAsignarCruda.contestadas,
          salientes: sinAsignarCruda.salientes,
          entrantes: sinAsignarCruda.entrantes,
          duracionTotal: sinAsignarCruda.duracion_total,
          duracionPromedio: promedio(
            sinAsignarCruda.duracion_total,
            sinAsignarCruda.llamadas,
          ),
        }
      : null,
  };
}

export type LlamadaDetalle = {
  id: string;
  startedAt: Date;
  direction: string | null;
  status: string | null;
  answered: boolean;
  durationSeconds: number;
  contactNombre: string | null;
  toNumber: string | null;
  fromNumber: string | null;
};

export type DetallePersona = {
  persona: { id: string; nombre: string; rol: Role | null } | null;
  fila: FilaLlamadasPersona;
  llamadas: LlamadaDetalle[];
};

/// Historial individual: métricas de una persona más sus últimas llamadas, con
/// el nombre del contacto cuando se puede resolver por el id de HighLevel.
export async function detalleLlamadasPersona(
  appUserId: string,
  { desde, hasta }: RangoFechas,
): Promise<DetallePersona | null> {
  const prisma = await getPrisma();
  const persona = await prisma.appUser.findUnique({
    where: { id: appUserId },
    select: { id: true, fullName: true, role: true },
  });
  if (!persona) return null;

  const registros = await prisma.callLog.findMany({
    where: { appUserId, startedAt: { gte: desde, lte: hasta } },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      startedAt: true,
      direction: true,
      status: true,
      answered: true,
      durationSeconds: true,
      toNumber: true,
      fromNumber: true,
      contactId: true,
    },
  });

  // Resuelve el nombre del contacto por su id de HighLevel (una sola consulta).
  const contactIds = Array.from(
    new Set(registros.map((r) => r.contactId).filter((v): v is string => Boolean(v))),
  );
  const contactos = contactIds.length
    ? await prisma.highLevelContact.findMany({
        where: { contactId: { in: contactIds } },
        select: {
          contactId: true,
          person: { select: { firstName: true, lastName: true } },
        },
      })
    : [];
  const nombrePorContacto = new Map(
    contactos.map((c) => [
      c.contactId,
      `${c.person.firstName} ${c.person.lastName ?? ""}`.trim(),
    ]),
  );

  // Respaldo: cuando la llamada no trae contacto enlazado por id, se busca a
  // quién se llamó por el número marcado (saliente = «to», entrante = «from»),
  // comparando solo la cola de dígitos, como en el resto del sistema.
  const numeroDeLaLlamada = (r: (typeof registros)[number]) =>
    r.direction === "inbound" ? r.fromNumber : r.toNumber;
  const colasPendientes = Array.from(
    new Set(
      registros
        .filter((r) => !(r.contactId && nombrePorContacto.has(r.contactId)))
        .map((r) => colaDeTelefono(numeroDeLaLlamada(r)))
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const nombrePorTelefono = new Map<string, string>();
  if (colasPendientes.length) {
    const porTelefono = await prisma.$queryRaw<
      { nombre: string; cola_call: string | null; cola_wa: string | null }[]
    >`
      SELECT (first_name || ' ' || coalesce(last_name, '')) AS nombre,
             right(regexp_replace(coalesce(call_phone, ''), '[^0-9]', '', 'g'), 10) AS cola_call,
             right(regexp_replace(coalesce(whatsapp_phone, ''), '[^0-9]', '', 'g'), 10) AS cola_wa
      FROM person
      WHERE right(regexp_replace(coalesce(call_phone, ''), '[^0-9]', '', 'g'), 10) IN (${Prisma.join(colasPendientes)})
         OR right(regexp_replace(coalesce(whatsapp_phone, ''), '[^0-9]', '', 'g'), 10) IN (${Prisma.join(colasPendientes)})
    `;
    for (const fila of porTelefono) {
      const nombre = fila.nombre.trim();
      if (fila.cola_call) nombrePorTelefono.set(fila.cola_call, nombre);
      if (fila.cola_wa && !nombrePorTelefono.has(fila.cola_wa)) {
        nombrePorTelefono.set(fila.cola_wa, nombre);
      }
    }
  }

  const nombreDeContacto = (r: (typeof registros)[number]) => {
    if (r.contactId && nombrePorContacto.has(r.contactId)) {
      return nombrePorContacto.get(r.contactId) ?? null;
    }
    const cola = colaDeTelefono(numeroDeLaLlamada(r));
    return cola ? nombrePorTelefono.get(cola) ?? null : null;
  };

  const llamadas: LlamadaDetalle[] = registros.map((r) => ({
    id: r.id,
    startedAt: r.startedAt,
    direction: r.direction,
    status: r.status,
    answered: r.answered,
    durationSeconds: r.durationSeconds,
    contactNombre: nombreDeContacto(r),
    toNumber: r.toNumber,
    fromNumber: r.fromNumber,
  }));

  const llamadasTotal = llamadas.length;
  const contestadas = llamadas.filter((l) => l.answered).length;
  const duracionTotal = llamadas.reduce((s, l) => s + l.durationSeconds, 0);

  return {
    persona: { id: persona.id, nombre: persona.fullName, rol: persona.role },
    fila: {
      appUserId: persona.id,
      nombre: persona.fullName,
      rol: persona.role,
      llamadas: llamadasTotal,
      contestadas,
      salientes: llamadas.filter((l) => l.direction === "outbound").length,
      entrantes: llamadas.filter((l) => l.direction === "inbound").length,
      duracionTotal,
      duracionPromedio: promedio(duracionTotal, llamadasTotal),
    },
    llamadas,
  };
}

/// Duración en formato legible: "5 min 12 s", "48 s", "1 h 3 min".
export function formatoDuracion(segundos: number): string {
  if (!segundos) return "0 s";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}
