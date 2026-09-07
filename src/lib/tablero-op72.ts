import { Prisma, type Operation72Status } from "@iglesia/prisma-client";
import { normalizarBusqueda } from "@/lib/dominio";
import type { ClientePrisma } from "@/lib/prisma";

/// Qué tarjetas van en cada columna del tablero, y cuántas hay en total, **en
/// una sola consulta**.
///
/// Antes esto costaba hasta doce viajes a la base por carga de página: uno para
/// los totales, y dos por columna (las que siguen dentro de plazo y las
/// vencidas, en consultas separadas). Con `PrismaPg max: 1` esos viajes **se
/// hacen uno detrás de otro** sobre la única conexión de la petición, así que
/// cada uno suma su latencia completa hasta Supabase. Las consultas en sí
/// tardan milisegundos; lo que se sentía lento era la fila de viajes.
///
/// Ahora sale todo de una: una función de ventana numera las tarjetas dentro de
/// cada columna y devuelve solo los ids que caben. La página hace después **una**
/// consulta para traer los datos de esos ids.

export type OrdenTablero = "urgencia" | "reciente" | "antiguo";

/// El orden dentro de cada columna. Se arma con `Prisma.raw` desde este mapa
/// cerrado, nunca desde algo que escriba el usuario.
///
/// **`urgencia`** es la regla del tablero: primero quienes siguen dentro de sus
/// 72 horas, del que menos margen tiene al que más; después las vencidas, de la
/// más reciente a la más antigua (una deuda de esta semana se recupera; una de
/// hace meses ya no es lo urgente). Las tres claves juntas dan exactamente el
/// mismo resultado que las dos consultas separadas que había antes — se
/// comprobó fila por fila contra la base: 60 de 60 en el mismo puesto.
const ORDEN: Record<OrdenTablero, string> = {
  urgencia: `(o.deadline_at >= now()) DESC,
             CASE WHEN o.deadline_at >= now() THEN o.deadline_at END ASC,
             o.deadline_at DESC`,
  reciente: "o.started_at DESC",
  antiguo: "o.started_at ASC",
};

export type SeleccionDelTablero = {
  /// Los ids de cada columna, ya en el orden en que se van a pintar.
  porEstado: Map<Operation72Status, string[]>;
  /// Cuántas hay en total en esa columna (no solo las que caben).
  totales: Map<Operation72Status, number>;
};

export async function seleccionarTarjetasDelTablero(
  prisma: ClientePrisma,
  opciones: {
    estados: readonly Operation72Status[];
    /// Cuando el consolidador solo ve su red. Nulo = ve toda la iglesia.
    consolidadorId: string | null;
    consulta: string;
    orden: OrdenTablero;
    /// El límite más alto de las columnas visibles. Cada columna se recorta
    /// después a su propio límite.
    tope: number;
  },
): Promise<SeleccionDelTablero> {
  const { estados, consolidadorId, consulta, orden, tope } = opciones;
  if (estados.length === 0) {
    return { porEstado: new Map(), totales: new Map() };
  }

  const texto = consulta.trim();
  // El nombre y el correo salen de `person.search_text`, que ya está sin tildes
  // ni mayúsculas. El celular se compara solo por dígitos, porque el mismo
  // número aparece como «323 7448212», «+573237448212» o «3237448212» según
  // quién lo escribió.
  const patronTexto = texto ? `%${normalizarBusqueda(texto)}%` : null;
  const digitos = texto.replace(/\D/g, "");
  const patronDigitos = digitos.length >= 4 ? `%${digitos}%` : null;

  const filas = await prisma.$queryRaw<
    { id: string; status: Operation72Status; total: bigint; puesto: bigint }[]
  >`
    WITH filtradas AS (
      SELECT o.id, o.status, o.deadline_at, o.started_at
      FROM operation72 o
      JOIN learner_profile lp ON lp.id = o.learner_id
      JOIN person p ON p.id = lp.person_id
      WHERE o.status = ANY(${estados as Operation72Status[]}::text[]::"Operation72Status"[])
        AND (${consolidadorId}::text IS NULL OR lp.consolidator_id = ${consolidadorId}::text)
        AND (
          ${patronTexto}::text IS NULL
          OR p.search_text LIKE ${patronTexto}::text
          OR (
            ${patronDigitos}::text IS NOT NULL
            AND (
              regexp_replace(coalesce(p.call_phone, ''), '\\D', '', 'g') LIKE ${patronDigitos}::text
              OR regexp_replace(coalesce(p.whatsapp_phone, ''), '\\D', '', 'g') LIKE ${patronDigitos}::text
            )
          )
        )
    ), numeradas AS (
      SELECT f.id, f.status,
        count(*) OVER (PARTITION BY f.status) AS total,
        row_number() OVER (PARTITION BY f.status ORDER BY ${Prisma.raw(ORDEN[orden])}) AS puesto
      FROM filtradas f
      JOIN operation72 o ON o.id = f.id
    )
    SELECT id, status, total, puesto
    FROM numeradas
    WHERE puesto <= ${tope}
    ORDER BY status, puesto
  `;

  const porEstado = new Map<Operation72Status, string[]>();
  const totales = new Map<Operation72Status, number>();
  for (const fila of filas) {
    const lista = porEstado.get(fila.status);
    if (lista) lista.push(fila.id);
    else porEstado.set(fila.status, [fila.id]);
    totales.set(fila.status, Number(fila.total));
  }
  return { porEstado, totales };
}
