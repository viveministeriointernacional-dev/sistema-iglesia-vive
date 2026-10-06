import type { OpcionDeLinea } from "@/lib/lineas-catalogo";

/// **El filtro por mentor y su línea.**
///
/// Es un formulario GET con un `<select>`, no una tira de botones: hoy son 17
/// líneas y una tira de 17 chips ocuparía más que el calendario. Y es GET con
/// su botón **a propósito** —en vez de enviarlo al cambiar la opción— para que
/// funcione sin una línea de JavaScript, como el resto de los filtros de la
/// plataforma.
///
/// Los demás parámetros viajan en campos ocultos: sin ellos, filtrar por una
/// línea devolvería a la semana de hoy y a la pestaña de listas, perdiendo
/// dónde estaba la persona.
export function FiltroDeLinea({
  opciones,
  elegido,
  ocultos,
}: {
  opciones: OpcionDeLinea[];
  elegido: string | null;
  ocultos: Record<string, string>;
}) {
  // Con una sola línea no hay nada que elegir, y un desplegable de una opción
  // es ruido: la regla del 16-sep —lo que no sirve, no se enseña.
  if (opciones.length < 2) return null;

  return (
    <form method="get" action="/alpha" className="flex flex-wrap items-center gap-[8px]">
      {Object.entries(ocultos).map(([clave, valor]) => (
        <input key={clave} type="hidden" name={clave} value={valor} />
      ))}

      <label
        htmlFor="mentor"
        className="text-[11.5px] leading-none font-semibold text-[rgba(19,28,36,.55)]"
      >
        Línea de
      </label>
      <select
        id="mentor"
        name="mentor"
        defaultValue={elegido ?? ""}
        className="h-[34px] rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-[10px] text-[12px] font-semibold text-tinta"
      >
        <option value="">Toda la iglesia</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre} · {o.casas} {o.casas === 1 ? "casa" : "casas"}
            {o.alpha > 0 ? ` · ${o.alpha} Alpha` : ""}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-[34px] rounded-[9px] border border-[rgba(19,28,36,.18)] bg-white px-[13px] text-[11.5px] leading-none font-semibold text-tinta"
      >
        Ver
      </button>
    </form>
  );
}
