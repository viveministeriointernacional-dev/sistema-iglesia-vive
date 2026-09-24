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

// ⚠️ **Un `ALTER TABLE` sobre una tabla viva puede quedarse esperando para
// siempre.** `app_user` se lee en CADA petición del sitio, así que añadirle una
// columna —que pide un candado exclusivo— se queda en la cola detrás de
// cualquier consulta en curso, y detrás de ese ALTER se encola todo lo demás.
// Fue lo que tumbó el despliegue del 23-sep-2026: la migración se fusionó a las
// 3 de la tarde, con el equipo trabajando.
//
// Con `lock_timeout` la migración **falla rápido en vez de colgarse**, y el
// reintento de abajo la vuelve a probar cuando el momento esté libre. Sin esto,
// el build se queda pegado y de paso frena al resto del sitio.
await cliente.query("SET lock_timeout = '15s'");
// Una migración de este proyecto son milisegundos de trabajo real; si una pasa
// de dos minutos es que está esperando algo, no trabajando.
await cliente.query("SET statement_timeout = '120s'");

/// Errores que NO son culpa del SQL: el candado estaba ocupado. Se reintentan.
const REINTENTABLES = new Set([
  "55P03", // lock_not_available
  "40P01", // deadlock_detected
  "40001", // serialization_failure
  "57014", // query_canceled (statement_timeout)
]);

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const INTENTOS = 4;
  let ejecutadas = 0;

  for (const nombre of nuevas) {
    if (aplicadas.has(nombre)) continue;
    const sql = await readFile(join(CARPETA, nombre, "migration.sql"), "utf8");

    let aplicada = false;
    for (let intento = 1; intento <= INTENTOS && !aplicada; intento += 1) {
      console.log(
        `[migrar] Aplicando ${nombre}…${intento > 1 ? ` (intento ${intento} de ${INTENTOS})` : ""}`,
      );
      await cliente.query("BEGIN");
      try {
        await cliente.query(sql);
        await cliente.query("INSERT INTO app_migration (name) VALUES ($1)", [nombre]);
        await cliente.query("COMMIT");
        ejecutadas += 1;
        aplicada = true;
      } catch (error) {
        await cliente.query("ROLLBACK");

        // ⚠️ **El mensaje solo NO alcanza para diagnosticar.** El 23-sep-2026
        // el log dijo «FALLÓ …:» y ahí se acabó: sin código, sin detalle, sin
        // la instrucción culpable. Costó una noche. El código SQLSTATE dice de
        // un vistazo si fue el SQL (42601 sintaxis), los permisos (42501) o un
        // candado ocupado (55P03), que son problemas muy distintos.
        const codigo = error?.code ? ` [${error.code}]` : "";
        const mensaje = error instanceof Error ? error.message : String(error);
        console.error(`[migrar] FALLÓ ${nombre}${codigo}: ${mensaje}`);
        for (const [rotulo, valor] of [
          ["detalle", error?.detail],
          ["pista", error?.hint],
          ["dónde", error?.where],
          ["instrucción", error?.internalQuery],
        ]) {
          if (valor) console.error(`[migrar]   ${rotulo}: ${valor}`);
        }

        if (REINTENTABLES.has(error?.code) && intento < INTENTOS) {
          // La tabla estaba ocupada. Se espera cada vez un poco más: si hay una
          // consulta larga en curso, insistir al instante solo la vuelve a
          // encontrar ocupada.
          const pausa = intento * 20_000;
          console.error(
            `[migrar]   La tabla estaba ocupada. Reintento en ${pausa / 1000} s.`,
          );
          await espera(pausa);
          continue;
        }

        process.exitCode = 1;
        break;
      }
    }
    if (process.exitCode) break;
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
