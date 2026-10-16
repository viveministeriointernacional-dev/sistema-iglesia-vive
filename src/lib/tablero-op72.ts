import { Prisma, type Operation72Status } from "@iglesia/prisma-client";
import { normalizarBusqueda } from "@/lib/dominio";
import { ESTADOS_EN_TABLERO } from "@/lib/op72";
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

/// **La columna VISITA PENDIENTE se ordena SIEMPRE por la fecha de la visita**,
/// pase lo que pase con el orden elegido arriba (decisión del usuario, 10-sep).
///
/// Ahí la pregunta no es «a quién registramos primero» sino «a quién le toca
/// visita antes», así que la lista se lee de arriba abajo en el orden en que se
/// van a hacer. Las **vencidas quedan primero** —su fecha ya pasó— que es justo
/// lo que hay que atender. Sin fecha acordada, al final (`NULLS LAST`).
///
/// Como `row_number()` reparte por estado, el `CASE` es NULL en todas las filas
/// de las demás columnas y ahí no altera nada: cae al orden de siempre.
const ORDEN_VISITA = `CASE WHEN f.status = 'VISITA_PENDIENTE'::"Operation72Status"
                             THEN f.visita_at END ASC NULLS LAST`;

export type SeleccionDelTablero = {
  /// Los ids de cada columna, ya en el orden en que se van a pintar. Solo de
  /// las columnas visibles.
  porEstado: Map<Operation72Status, string[]>;
  /// Cuántas hay en total en esa columna (no solo las que caben).
  ///
  /// **Están SIEMPRE las cinco columnas, aunque se esté mirando una sola.**
  /// Hasta el 16-oct-2026 solo venían las visibles, y al entrar en una columna
  /// los demás contadores de «Ver solo» se ponían en **cero** y «Todas»
  /// enseñaba el total de esa única columna: filtrar por Contactada decía
  /// «Todas 28» en vez de 85. Se notó al poner el ⊕ encima de cada contador,
  /// porque el ⊕ sí mira el tablero entero y los dos números se contradecían
  /// a la vista.
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
  // Las tarjetas son solo de las columnas visibles; los totales, de las cinco.
  const todas = [...ESTADOS_EN_TABLERO];

  const texto = consulta.trim();
  // El nombre y el correo salen de `person.search_text`, que ya está sin tildes
  // ni mayúsculas. El celular se compara solo por dígitos, porque el mismo
  // número aparece como «323 7448212», «+573237448212» o «3237448212» según
  // quién lo escribió.
  const patronTexto = texto ? `%${normalizarBusqueda(texto)}%` : null;
  const digitos = texto.replace(/\D/g, "");
  const patronDigitos = digitos.length >= 4 ? `%${digitos}%` : null;

  const filas = await prisma.$queryRaw<
    { id: string | null; status: Operation72Status; total: bigint; puesto: bigint | null }[]
  >`
    WITH filtradas AS (
      SELECT o.id, o.status, o.deadline_at, o.started_at, v.scheduled_at AS visita_at
      FROM operation72 o
      JOIN learner_profile lp ON lp.id = o.learner_id
      JOIN person p ON p.id = lp.person_id
      -- La visita acordada más reciente. Es la misma que pinta la tarjeta, que
      -- toma el primer intento de tipo VISITA ordenando por occurred_at desc.
      -- Las anuladas quedan fuera en los dos sitios: si aquí entraran, la
      -- columna seguiría ordenándose por una visita que ya no existe.
      LEFT JOIN LATERAL (
        SELECT ca.scheduled_at
        FROM contact_attempt ca
        WHERE ca.operation72_id = o.id
          AND ca.type = 'VISITA'
          AND ca.scheduled_at IS NOT NULL
          AND ca.annulled_at IS NULL
        ORDER BY ca.occurred_at DESC, ca.created_at DESC
        LIMIT 1
      ) v ON true
      WHERE o.status = ANY(${todas}::text[]::"Operation72Status"[])
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
        row_number() OVER (PARTITION BY f.status
          ORDER BY ${Prisma.raw(`${ORDEN_VISITA}, ${ORDEN[orden]}`)}) AS puesto
      FROM filtradas f
      JOIN operation72 o ON o.id = f.id
    )
    SELECT id, status, total, puesto
    FROM numeradas
    WHERE puesto <= ${tope}
      AND status = ANY(${estados as Operation72Status[]}::text[]::"Operation72Status"[])
    UNION ALL
    -- El total de CADA columna, también las que no se están pintando: son los
    -- contadores de «Ver solo», y tienen que decir la verdad siempre.
    SELECT NULL::text, status, count(*)::bigint, NULL::bigint
    FROM filtradas
    GROUP BY status
    -- El orden es el de la columna, no un detalle: el puesto es lo que decidió
    -- la función de ventana y es el orden en que se pintan las tarjetas. Las
    -- filas de total no tienen puesto y caen al final de su columna.
    ORDER BY status, puesto
  `;

  const porEstado = new Map<Operation72Status, string[]>();
  const totales = new Map<Operation72Status, number>();
  for (const fila of filas) {
    // Las filas sin id son los totales por columna, que vienen en el mismo
    // viaje (§12.5: con una sola conexión, cada consulta de más es latencia).
    if (fila.id === null) {
      totales.set(fila.status, Number(fila.total));
      continue;
    }
    const lista = porEstado.get(fila.status);
    if (lista) lista.push(fila.id);
    else porEstado.set(fila.status, [fila.id]);
  }
  return { porEstado, totales };
}
