import { permanentRedirect } from "next/navigation";

/// El árbol dejó de ser una pantalla aparte: vive dentro de «Mi red»
/// (7-sep-2026). Esta ruta se queda como puente para los enlaces guardados y
/// para quien la tenga en favoritos.
export default async function PaginaRedAntigua({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string }>;
}) {
  const { fase } = await searchParams;
  permanentRedirect(`/mi-red?vista=arbol${fase ? `&fase=${fase}` : ""}`);
}
