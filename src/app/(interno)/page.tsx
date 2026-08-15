import { redirect } from "next/navigation";
import { Role } from "@iglesia/prisma-client";
import { requerirUsuario } from "@/lib/auth";

export default async function Inicio() {
  const usuario = await requerirUsuario();

  switch (usuario.role) {
    case Role.CONSOLIDADOR:
    case Role.PASTOR:
    case Role.ADMIN:
      redirect("/operacion-72");
    default:
      redirect("/mi-proceso");
  }
}
