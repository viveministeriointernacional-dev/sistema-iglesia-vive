import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Sin caché incremental configurada: las dos pantallas de esta entrega son
// dinámicas (`force-dynamic` y datos por sesión), así que no hay nada que
// revalidar. Cuando entren pantallas de contenido —devocionales, eventos—
// conviene añadir el caché en R2: https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig();
