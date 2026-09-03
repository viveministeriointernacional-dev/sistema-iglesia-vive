import {
  requerirRol,
  ROLES_CONSOLIDACION,
  ROLES_REGISTRO_SOLO_FICHA,
} from "@/lib/auth";
import { AsistenteDeRegistro } from "./asistente";

export const metadata = { title: "Registrar persona · Iglesia Vive" };

export default async function PaginaRegistro() {
  const usuario = await requerirRol(ROLES_CONSOLIDACION);
  const puedeElegirDestino = ROLES_REGISTRO_SOLO_FICHA.includes(usuario.role);

  return (
    <main className="grid place-items-start justify-center px-5 py-[30px] pb-16">
      <AsistenteDeRegistro puedeElegirDestino={puedeElegirDestino} />
    </main>
  );
}
