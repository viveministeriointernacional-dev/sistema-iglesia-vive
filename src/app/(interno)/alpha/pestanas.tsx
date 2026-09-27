import Link from "next/link";

/// Las pestañas de «Alpha y Casa de Fe».
///
/// ⚠️ **Las cuatro viven bajo `/alpha`, y eso es lo que las hace heredar el
/// permiso.** Poner «Los 12 temas» o «Por revisar» como entradas propias del
/// menú habría obligado a crear dos vistas nuevas en el configurador y a
/// encendérselas a mano a las 29 cuentas que llevan un grupo. Aquí, quien ya
/// ve la sección las ve.
const PESTANAS = [
  { id: "listas", nombre: "Listas", href: "/alpha" },
  { id: "calendario", nombre: "Calendario", href: "/alpha?vista=calendario" },
  { id: "temas", nombre: "Los 12 temas", href: "/alpha/temas" },
  { id: "revisar", nombre: "Por revisar", href: "/alpha/por-revisar" },
] as const;

export type PestanaDeGrupos = (typeof PESTANAS)[number]["id"];

export function PestanasDeGrupos({
  activa,
  porRevisar,
}: {
  activa: PestanaDeGrupos;
  /// Cuántos talleres esperan revisión. **Sin este número, un taller enviado se
  /// queda esperando sin que nadie sepa que llegó** — y el equipo no vive
  /// dentro de la plataforma.
  porRevisar?: number;
}) {
  return (
    <nav className="flex flex-wrap overflow-hidden rounded-[10px] border border-[rgba(19,28,36,.18)]">
      {PESTANAS.map((p) => {
        const esta = p.id === activa;
        return (
          <Link
            key={p.id}
            href={p.href}
            aria-current={esta ? "page" : undefined}
            className={`px-4 py-[10px] text-[12.5px] leading-none ${
              esta
                ? "bg-azul-900 font-bold text-white"
                : "bg-white font-semibold text-[rgba(19,28,36,.55)]"
            }`}
          >
            {p.nombre}
            {p.id === "revisar" && porRevisar ? (
              <span
                className={`ml-1.5 rounded-[9px] px-1.5 py-0.5 text-[10.5px] font-bold ${
                  esta ? "bg-white text-azul-900" : "bg-[#b45309] text-white"
                }`}
              >
                {porRevisar}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
