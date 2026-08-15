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

void initOpenNextCloudflareForDev();
