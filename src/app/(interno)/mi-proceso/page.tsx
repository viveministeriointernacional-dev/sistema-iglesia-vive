import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { ETIQUETA_ROL, requerirUsuario } from "@/lib/auth";

export const metadata = { title: "Mi proceso · Iglesia Vive" };

/// Quien tiene expediente entra al suyo. El resto —líderes sin expediente
/// propio— ve este marcador hasta que exista el panel del mentor.
export default async function MiProceso() {
  const usuario = await requerirUsuario();

  // Quien tiene expediente entra directo al suyo.
  if (usuario.personId) {
    const prisma = await getPrisma();
    const propio = await prisma.learnerProfile.findUnique({
      where: { personId: usuario.personId },
      select: { id: true },
    });
    if (propio) redirect(`/expediente/${propio.id}`);
  }

  return (
    <main className="grid place-items-start justify-center px-5 py-[30px] pb-16">
      <div className="w-full max-w-[740px] rounded-[18px] bg-papel px-7 py-8 shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)]">
        <p className="etiqueta-seccion">{ETIQUETA_ROL[usuario.role].toUpperCase()}</p>
        <h1 className="mt-4 font-serif text-[29px] leading-[1.15] font-normal">
          Hola, {usuario.fullName.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          Tu panel de acompañamiento —tu red, tus alertas y tus tareas— es la
          siguiente pantalla en construcción. Por ahora están el registro de
          personas nuevas, el tablero de Operación 72 y el expediente.
        </p>
      </div>
    </main>
  );
}
