import { ETIQUETA_ROL, requerirUsuario } from "@/lib/auth";

export const metadata = { title: "Mi proceso · Iglesia Vive" };

/// Marcador de posición. El panel del aprendiz, el panel del mentor y el
/// expediente están diseñados pero todavía no construidos: entran en la
/// siguiente entrega (design/README.md § Screens y ROADMAP_DESARROLLO.md).
export default async function MiProceso() {
  const usuario = await requerirUsuario();

  return (
    <main className="grid place-items-start justify-center px-5 py-[30px] pb-16">
      <div className="w-full max-w-[740px] rounded-[18px] bg-papel px-7 py-8 shadow-[0_20px_44px_-22px_rgba(14,42,78,.35)]">
        <p className="etiqueta-seccion">{ETIQUETA_ROL[usuario.role].toUpperCase()}</p>
        <h1 className="mt-4 font-serif text-[29px] leading-[1.15] font-normal">
          Hola, {usuario.fullName.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[13px] leading-[1.5] font-medium text-[rgba(19,28,36,.55)]">
          Tu panel —esta semana, tu progreso, tu devocional y tus eventos— es la
          siguiente pantalla en construcción. Por ahora, esta entrega cubre el
          registro de personas nuevas y el tablero de Operación 72.
        </p>
      </div>
    </main>
  );
}
