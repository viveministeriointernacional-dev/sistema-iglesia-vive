import Link from "next/link";

/// **Quién lleva el grupo, visto desde la línea elegida.** Es el botón de
/// arriba pedido el 27-oct-2026: «que haya un botón arriba que diga directas,
/// o sea, las que lleva directamente Alejandro Facundo, y las indirectas».
export type QuienLaLleva = "todas" | "directas" | "linea";

/// Lo que llega por la URL, ya limpio. Un valor inventado cae en «todas» en
/// vez de dejar la pantalla vacía, igual que hace el filtro de línea con un
/// mentor que no existe.
export function quienLaLlevaDeLaUrl(valor: string | undefined): QuienLaLleva {
  return valor === "directas" || valor === "linea" ? valor : "todas";
}

/// ⚠️ **Mismo criterio que el reparto de la lista: el botón solo sale cuando
/// hay algo que elegir.** Sin línea puesta, «directa» no significa nada —
/// ¿directa de quién?—. Y con una línea que el mentor lleva entera (9 de las
/// 20 el 27-oct) o en la que no lleva ninguna (Administración, 0 de 60), uno
/// de los dos botones devolvería una pantalla en blanco: la regla del 16-sep,
/// lo que no sirve no se enseña.
export function FiltroDeDirectas({
  elegido,
  nombre,
  directas,
  deSuLinea,
  enlace,
}: {
  elegido: QuienLaLleva;
  nombre: string;
  directas: number;
  deSuLinea: number;
  enlace: (quien: QuienLaLleva) => string;
}) {
  if (directas === 0 || deSuLinea === 0) return null;

  const opciones = [
    ["todas", "Todas", directas + deSuLinea],
    ["directas", `Las que lleva ${nombre}`, directas],
    ["linea", "Las de su línea", deSuLinea],
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-[8px]">
      {opciones.map(([clave, texto, cuantos]) => {
        const activo = elegido === clave;
        return (
          <Link
            key={clave}
            href={enlace(clave)}
            className={`rounded-[20px] px-[13px] py-2 text-[11.5px] leading-none ${
              activo
                ? "border-[1.5px] border-azul-900 bg-azul-050 font-bold text-tinta"
                : "border border-[rgba(19,28,36,.18)] bg-white font-semibold text-[rgba(19,28,36,.55)]"
            }`}
          >
            {texto} · {cuantos}
          </Link>
        );
      })}
    </div>
  );
}
