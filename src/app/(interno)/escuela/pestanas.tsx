import Link from "next/link";

/// Las pestañas de la sección «Escuela».
///
/// ⚠️ **El prematrimonial y el cuestionario de líderes viven bajo `/escuela`
/// para no abrir otra entrada en el menú** (decisión del usuario, 3-oct-2026,
/// y la misma línea para el cuestionario). Es lo que se hizo con «Los 12 temas»
/// y «Por revisar» bajo `/alpha`: la pestaña hereda la vista, así que no hubo
/// que crear ninguna vista nueva en el configurador ni encenderla a mano a
/// nadie.
///
/// ⚠️ **PERO el permiso NO se hereda del todo.** «Escuela» la ve también el rol
/// MENTOR, y los dos están cerrados a **pastores y administración**. Por eso
/// cada pestaña se pinta solo si su propio permiso lo deja, y cada página
/// repite el guardia: enseñar una pestaña que da «no tienes permiso» es peor
/// que no enseñarla (la regla del 16-sep-2026).
export type PestanaDeEscuela = "escuelas" | "prematrimonial" | "cuestionario";

export function PestanasDeEscuela({
  activa,
  conPrematrimonial,
  conCuestionario = false,
  pendientes,
  pendientesCuestionario,
}: {
  activa: PestanaDeEscuela;
  /// Si la cuenta puede llevar el prematrimonial.
  conPrematrimonial: boolean;
  /// Si la cuenta puede revisar el cuestionario de líderes.
  conCuestionario?: boolean;
  /// Lo que espera al pastor en el prematrimonial: temas por revisar más
  /// parejas por destapar. **Sin este número, una pareja termina su taller y se
  /// queda esperando una conversación que nadie recuerda agendar.**
  pendientes?: number;
  /// Cuántos cuestionarios de líder esperan revisión. Mismo motivo: un líder
  /// que envió su tema no puede dictarlo hasta que alguien lo revise.
  pendientesCuestionario?: number;
}) {
  // Con una sola pestaña y ninguna alternativa, la barra es ruido.
  if (!conPrematrimonial && !conCuestionario) return null;

  const pestanas = [
    { id: "escuelas" as const, nombre: "Escuelas", href: "/escuela", distintivo: 0 },
    ...(conPrematrimonial
      ? [
          {
            id: "prematrimonial" as const,
            nombre: "Prematrimonial",
            href: "/escuela/prematrimonial",
            distintivo: pendientes ?? 0,
          },
        ]
      : []),
    ...(conCuestionario
      ? [
          {
            id: "cuestionario" as const,
            nombre: "Cuestionario de líderes",
            href: "/escuela/cuestionario",
            distintivo: pendientesCuestionario ?? 0,
          },
        ]
      : []),
  ];

  return (
    <nav className="flex flex-wrap overflow-hidden rounded-[10px] border border-[rgba(19,28,36,.18)]">
      {pestanas.map((p) => {
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
            {p.distintivo > 0 ? (
              <span
                className={`ml-1.5 rounded-[9px] px-1.5 py-0.5 text-[10.5px] font-bold ${
                  esta ? "bg-white text-azul-900" : "bg-[#b45309] text-white"
                }`}
              >
                {p.distintivo}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
