/// Lo del informe que también necesita el navegador.
///
/// Aparte de `informe.ts` por la regla del 6-sep: ese módulo consulta la base
/// de datos, así que si un componente de cliente importara de ahí, `pg` acabaría
/// en el paquete del navegador y el build se cae.

/// Cada cuánto se agrupa la gráfica de actividad. Un año son 365 barras: no se
/// leen y no valen la pena. Se decide por el largo del periodo.
export type Grano = "dia" | "semana" | "mes";

export function granoPara(dias: number): Grano {
  if (dias <= 31) return "dia";
  if (dias <= 182) return "semana";
  return "mes";
}
