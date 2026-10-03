import Link from "next/link";

/// Las pestañas de la sección «Escuela».
///
/// ⚠️ **El prematrimonial vive bajo `/escuela` para no abrir otra entrada en el
/// menú** (decisión del usuario, 3-oct-2026). Es lo mismo que se hizo con «Los
/// 12 temas» y «Por revisar» bajo `/alpha`: la pestaña hereda la vista, así que
/// no hubo que crear ninguna vista nueva en el configurador ni encenderla a
/// mano.
///
/// ⚠️ **PERO el permiso NO se hereda del todo.** «Escuela» la ve también el rol
/// MENTOR, y el usuario cerró el prematrimonial a **pastores y
/// administración**. Por eso la pestaña se pinta solo si
/// `conPrematrimonial`, y cada página del prematrimonial repite el guardia:
/// enseñar una pestaña que da «no tienes permiso» es peor que no enseñarla
/// (la regla del 16-sep-2026).
const PESTANAS = [
  { id: "escuelas", nombre: "Escuelas", href: "/escuela" },
  { id: "prematrimonial", nombre: "Prematrimonial", href: "/escuela/prematrimonial" },
] as const;

export type PestanaDeEscuela = (typeof PESTANAS)[number]["id"];

export function PestanasDeEscuela({
  activa,
  conPrematrimonial,
  pendientes,
}: {
  activa: PestanaDeEscuela;
  /// Si la cuenta puede llevar el prematrimonial. En falso no se pinta nada:
  /// una sola pestaña sin alternativa es ruido.
  conPrematrimonial: boolean;
  /// Lo que espera al pastor: temas por revisar más parejas por destapar.
  /// **Sin este número, una pareja termina su taller y se queda esperando una
  /// conversación que nadie recuerda agendar.**
  pendientes?: number;
}) {
  if (!conPrematrimonial) return null;

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
            {p.id === "prematrimonial" && pendientes ? (
              <span
                className={`ml-1.5 rounded-[9px] px-1.5 py-0.5 text-[10.5px] font-bold ${
                  esta ? "bg-white text-azul-900" : "bg-[#b45309] text-white"
                }`}
              >
                {pendientes}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
