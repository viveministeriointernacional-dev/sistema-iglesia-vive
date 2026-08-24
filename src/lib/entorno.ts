/// Lee una variable de entorno del Worker.
///
/// En Cloudflare las variables y los secretos viven en el entorno del Worker.
/// Casi siempre llegan también a `process.env`, pero no es algo con lo que se
/// pueda contar: depende de cómo se hayan configurado y de cuándo se desplegó.
/// Un secreto que el panel muestra bien puesto y que aun así el código no ve es
/// difícil de diagnosticar desde afuera, así que se miran los dos sitios.
///
/// Primero `process.env`, que es lo único que hay fuera de Workers —desarrollo
/// local, el seed, las migraciones—, y después el contexto de Cloudflare.
export async function variableDeEntorno(
  nombre: string,
): Promise<string | undefined> {
  const directa = process.env[nombre];
  if (directa) return directa;

  if (globalThis.navigator?.userAgent !== "Cloudflare-Workers") return undefined;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const contexto = await getCloudflareContext({ async: true });
    const valor = (contexto.env as unknown as Record<string, unknown>)[nombre];
    return typeof valor === "string" && valor ? valor : undefined;
  } catch {
    // Fuera de una petición no hay contexto. No es un error: significa que esa
    // variable no está disponible aquí.
    return undefined;
  }
}
