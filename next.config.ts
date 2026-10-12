import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 genera AGENTS.md y CLAUDE.md en cada arranque; no son fuente del
  // proyecto.
  agentRules: false,
  // Prisma y su adaptador `pg` no se empaquetan: se resuelven desde
  // node_modules, que es lo que necesita el bundler de Cloudflare para
  // encontrar el socket de workerd (pg-cloudflare).
  serverExternalPackages: [
    "@iglesia/prisma-client",
    "@prisma/adapter-pg",
    "pg",
    "pg-cloudflare",
  ],
};

export default nextConfig;

// Permite usar los bindings de Cloudflare (Hyperdrive) durante `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// ⚠️ **SOLO en desarrollo, y esto NO es cosmético: sin el `if`, declarar el
// binding de Hyperdrive ROMPE EL BUILD** (12-oct-2026).
//
// Esta función levanta la emulación local de los bindings, y para Hyperdrive
// wrangler exige entonces una Postgres local: `applyHyperdriveEnvVars` lanza
// «When developing locally, you should use a local Postgres connection
// string…» si no encuentra
// `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` ni un
// `localConnectionString`. Llamándola sin condición corría también en
// `next build`, así que **el build de Cloudflare habría fallado en el primer
// despliegue con el binding puesto** — y un build fallido deja el sitio sin
// actualizar sin que nada lo diga (la lección del 24-sep).
//
// Se descartó la salida fácil: poner `localConnectionString` en
// `wrangler.jsonc` habría metido una cadena con contraseña en el repositorio
// (§10).
//
// En `next build` NODE_ENV es «production», así que no se llama y no hay
// emulación que exija nada. En producción el worker recibe los bindings de
// verdad, que no pasan por aquí. Y la función se llama «ForDev» precisamente
// porque el build no la necesita.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}
