import { redirect } from "next/navigation";
import { Role } from "@iglesia/prisma-client";
import { requerirUsuario } from "@/lib/auth";

export default async function Inicio() {
  const usuario = await requerirUsuario();

  switch (usuario.role) {
    case Role.CONSOLIDADOR:
      redirect("/operacion-72");
    case Role.MENTOR:
    case Role.PASTOR:
    case Role.ADMIN:
      redirect("/mi-red");
    default:
      redirect("/mi-proceso");
  }
}
