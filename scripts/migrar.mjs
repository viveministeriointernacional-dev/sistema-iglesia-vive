// Aplica en la base de datos las migraciones de `prisma/migrations/` que aún
// no se hayan aplicado. Corre solo, antes de compilar el worker (`npm run
// cf:build`), así cada despliegue deja la base al día sin que nadie entre a
// Supabase.
//
// Cómo decide qué aplicar:
// - Lleva su propio registro en la tabla `app_migration` (nombre, fecha).
// - Las migraciones anteriores a BASE ya están en Supabase (se aplicaron a mano
//   mientras no existía este paso): se registran como aplicadas SIN ejecutarlas.
// - Las demás se ejecutan en orden, cada una dentro de una transacción, y se
//   registran. Si una falla, el build falla: no se despliega código cuya base
//   no está lista.
// - Sin DATABASE_URL (por ejemplo, un build local) avisa y no hace nada.
//
// Uso: node scripts/migrar.mjs [--dry-run]
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const BASE = "20260903230000"; // primera migración que SÍ ejecuta este script
const CARPETA = join(process.cwd(), "prisma", "migrations");
const simulacion = process.argv.includes("--dry-run");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

const carpetas = (await readdir(CARPETA, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
  .map((d) => d.name)
  .sort();

const previas = carpetas.filter((n) => n.slice(0, 14) < BASE);
const nuevas = carpetas.filter((n) => n.slice(0, 14) >= BASE);

if (simulacion) {
  console.log(`[migrar] ${previas.length} migraciones de base (se registran sin ejecutar).`);
  console.log(`[migrar] ${nuevas.length} migraciones que este script ejecuta si faltan:`);
  for (const n of nuevas) console.log(`  - ${n}`);
  process.exit(0);
}

if (!url || /localhost|127\.0\.0\.1/.test(url)) {
  console.log("[migrar] Sin DATABASE_URL del entorno: no se aplican migraciones aquí.");
  process.exit(0);
}

const cliente = new pg.Client({
  connectionString: url,
  ssl: /supabase\.co|supabase\.com|pooler\.supabase/.test(url) ? { rejectUnauthorized: false } : undefined,
});
await cliente.connect();

try {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS app_migration (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      executed BOOLEAN NOT NULL DEFAULT true
    )
  `);
  const { rows } = await cliente.query("SELECT name FROM app_migration");
  const aplicadas = new Set(rows.map((r) => r.name));

  for (const nombre of previas) {
    if (aplicadas.has(nombre)) continue;
    await cliente.query(
      "INSERT INTO app_migration (name, executed) VALUES ($1, false) ON CONFLICT DO NOTHING",
      [nombre],
    );
  }

  let ejecutadas = 0;
  for (const nombre of nuevas) {
    if (aplicadas.has(nombre)) continue;
    const sql = await readFile(join(CARPETA, nombre, "migration.sql"), "utf8");
    console.log(`[migrar] Aplicando ${nombre}…`);
    await cliente.query("BEGIN");
    try {
      await cliente.query(sql);
      await cliente.query("INSERT INTO app_migration (name) VALUES ($1)", [nombre]);
      await cliente.query("COMMIT");
      ejecutadas += 1;
    } catch (error) {
      await cliente.query("ROLLBACK");
      console.error(`[migrar] FALLÓ ${nombre}:`, error instanceof Error ? error.message : error);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) {
    console.log(
      ejecutadas
        ? `[migrar] Listo: ${ejecutadas} migración(es) aplicada(s).`
        : "[migrar] La base ya estaba al día.",
    );
  }
} finally {
  await cliente.end();
}
