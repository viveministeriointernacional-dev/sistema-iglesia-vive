import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 ya no carga archivos .env por su cuenta.
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    // Las migraciones se aplican contra la conexión directa (puerto 5432),
    // no contra el pooler.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Las migraciones corren contra la conexión directa (puerto 5432) cuando
    // existe; el pooler no admite sentencias DDL en modo transacción.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
