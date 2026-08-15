import { requerirRol, ROLES_CONSOLIDACION } from "@/lib/auth";
import { AsistenteDeRegistro } from "./asistente";

export const metadata = { title: "Registrar persona · Iglesia Vive" };

export default async function PaginaRegistro() {
  await requerirRol(ROLES_CONSOLIDACION);

  return (
    <main className="grid place-items-start justify-center px-5 py-[30px] pb-16">
      <AsistenteDeRegistro />
    </main>
  );
}
