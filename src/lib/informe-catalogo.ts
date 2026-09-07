/// Lo del informe que también necesita el navegador (rótulos y periodos).
///
/// Aparte de `informe.ts` por la regla del 6-sep: ese módulo consulta la base
/// de datos, así que si un componente de cliente importara de ahí, `pg` acabaría
/// en el paquete del navegador y el build se cae.

/// Los cortes que ofrece el informe.
///
/// **La semana va de VIERNES a VIERNES** (decisión del usuario, 7-sep-2026):
/// la gente entra en las reuniones del sábado, el domingo y el miércoles, así
/// que un corte de domingo a domingo dejaría a los del fin de semana sin días
/// hábiles para llamarlos antes del cierre. Empezando el viernes, quedan lunes,
/// martes, miércoles y jueves dentro del mismo periodo.
///
/// El «mes» es, por lo mismo, **cuatro semanas de viernes a viernes** (28 días)
/// y no el mes del calendario.
export const PERIODOS = ["dia", "semana", "mes"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const ETIQUETA_PERIODO: Record<Periodo, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
};

/// Cuántos días cubre cada corte.
export const DIAS_DEL_PERIODO: Record<Periodo, number> = {
  dia: 1,
  semana: 7,
  mes: 28,
};

export function periodoValido(valor: string | undefined): Periodo {
  return (PERIODOS as readonly string[]).includes(valor ?? "")
    ? (valor as Periodo)
    : "semana";
}
