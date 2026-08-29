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
  }

  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  throw new Error(
    "Falta la conexión a Postgres: define DATABASE_URL o el binding HYPERDRIVE.",
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
