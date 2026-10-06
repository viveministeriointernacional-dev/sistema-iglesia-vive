import { cache } from "react";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@iglesia/prisma-client";

/// Cliente de Prisma o el cliente dentro de una transacción.
export type ClientePrisma = PrismaClient | Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prisma: Promise<PrismaClient> | undefined;
};

/// workerd no deja usar un socket abierto durante otra petición: en Cloudflare
/// el cliente vive una petición, no el proceso entero.
function enCloudflareWorkers() {
  return globalThis.navigator?.userAgent === "Cloudflare-Workers";
}

/// Cadena de conexión a Postgres.
///
/// En Cloudflare la conexión llega por el binding de Hyperdrive, que mantiene
/// el pool del lado de Cloudflare; sin él, cada invocación abriría una conexión
/// nueva contra Supabase. Fuera de Workers (desarrollo local, seed,
/// migraciones) se usa DATABASE_URL.
async function cadenaDeConexion(): Promise<string> {
  if (enCloudflareWorkers()) {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const contexto = await getCloudflareContext({ async: true });
    const hyperdrive = (
      contexto.env as unknown as { HYPERDRIVE?: { connectionString?: string } }
    ).HYPERDRIVE;
    if (hyperdrive?.connectionString) return hyperdrive.connectionString;

    // ⚠️ **Aquí el worker SIGUE FUNCIONANDO, y por eso hay que gritarlo.**
    // Sin el binding se cae a DATABASE_URL y todo responde igual, solo que
    // lento: cada petición vuelve a abrir su conexión contra Supabase. Un
    // despliegue que se deje el binding fuera no rompe nada — deshace la mejora
    // en silencio, que es la forma más cara de perderla. El aviso sale una vez
    // por arranque en frío y queda en el registro del worker (observability).
    avisarSinHyperdrive();
  }

  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  throw new Error(
    "Falta la conexión a Postgres: define DATABASE_URL o el binding HYPERDRIVE.",
  );
}

let yaSeAviso = false;

function avisarSinHyperdrive() {
  if (yaSeAviso) return;
  yaSeAviso = true;
  console.warn(
    "[prisma] SIN Hyperdrive: no hay binding HYPERDRIVE, así que cada petición " +
      "abre su propia conexión contra Supabase y se paga la latencia completa. " +
      "Revisa el bloque \"hyperdrive\" de wrangler.jsonc.",
  );
}

async function crearCliente(): Promise<PrismaClient> {
  // El socket se cierra solo al terminar la petición: en workerd los objetos de
  // E/S mueren con el contexto que los creó.
  // `max: 1` es clave en Cloudflare: sin esto, `pg` abre un pool de hasta 10
  // conexiones POR PETICIÓN. Con cientos de peticiones se agota el pooler de
  // Supabase (error «max clients reached», que en el navegador se ve como 1102).
  // Una conexión por petición es suficiente —Prisma serializa las consultas de
  // esa petición— y mantiene el uso de conexiones bajo control. Los tiempos de
  // espera cortos liberan la conexión pronto en vez de dejarla colgada.
  //
  // ⚠️ **Con Hyperdrive `max: 1` SIGUE SIENDO LO CORRECTO, y no se tocó a
  // propósito.** Hyperdrive mantiene su propio pool del lado de Cloudflare, así
  // que lo que abarata es *abrir* la conexión, no tener varias. Subirlo dejaría
  // correr en paralelo las consultas sueltas de un `Promise.all` —que hoy van en
  // fila— pero es un cambio de concurrencia aparte: medir primero Hyperdrive
  // solo, o no se sabría cuál de los dos movió el número.
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: await cadenaDeConexion(),
      max: 1,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
    }),
  });
}

/// Memoizado por petición: en Cloudflare cada petición estrena cliente.
const clientePorPeticion = cache(crearCliente);

/// El cliente se crea en la primera consulta, no al importar el módulo: el
/// build de Next evalúa los módulos sin variables de entorno.
export function getPrisma(): Promise<PrismaClient> {
  if (enCloudflareWorkers()) return clientePorPeticion();
  globalForPrisma.prisma ??= crearCliente();
  return globalForPrisma.prisma;
}
