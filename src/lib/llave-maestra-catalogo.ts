/// Lo de la llave maestra que también necesita el navegador.
///
/// Vive aparte de `llave-maestra.ts` por la misma regla de siempre: ese módulo
/// habla con la base de datos y con la auditoría, así que si un componente de
/// cliente importara de ahí, esos módulos acabarían en el paquete del navegador
/// y el build se cae (pasó el 6-sep-2026 con `liderazgo.ts`).

/// Suficiente para que no se pueda adivinar, corta para que se pueda dictar por
/// teléfono. Debajo de esto no vale la pena la ceremonia.
export const LARGO_MINIMO_LLAVE = 12;
