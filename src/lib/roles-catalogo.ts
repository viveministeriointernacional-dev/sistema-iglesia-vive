import { Role } from "@iglesia/prisma-client";

/// Los nombres de los roles, tal como se leen en pantalla.
///
/// Vive aparte de `auth.ts` por la regla del 6-sep-2026: `auth.ts` importa
/// Prisma (y con él `pg`, `net`, `dns`…), así que un componente de cliente que
/// lo importara rompería el build de Cloudflare — y `tsc` no lo vería.
/// La matriz de `/administracion/vistas` es de cliente y necesita estos nombres.
export const ETIQUETA_ROL: Record<Role, string> = {
  APRENDIZ: "Aprendiz",
  CONSOLIDADOR: "Consolidador",
  LIDER_ALPHA: "Líder Alpha",
  MENTOR: "Mentor",
  PASTOR: "Pastor",
  ADMIN: "Administrador",
};
