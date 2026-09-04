# CLAUDE.md — Cerebro del proyecto (memoria persistente)

> Este archivo se carga automáticamente al inicio de cada sesión de Claude Code.
> Es la **memoria del proyecto**: contexto, decisiones y estado que NO se deben
> volver a preguntar. Manténlo actualizado al final de cada trabajo importante
> (sección «Bitácora» al final). **Nunca escribas secretos aquí** (tokens,
> contraseñas, claves) — solo dónde viven.

## 1. Qué es el proyecto

**Sistema de Transformación y Propósito** para **Iglesia Vive** (Vive Ministerio
Internacional, Neiva–Huila, Colombia). Plataforma de discipulado/consolidación:
registro de personas, Operación 72, Alpha, Casa de Fe, Escuela, mentoría,
eventos, y administración. Documentación de producto en `design/`
(`ESPECIFICACION_PRODUCTO.md`, `ARQUITECTURA_VISUAL.md`, `ROADMAP_DESARROLLO.md`,
`HANDOFF.md`).

## 2. Cómo trabaja el usuario (MUY IMPORTANTE)

- **Habla español.** Responder siempre en español, claro y directo.
- **NO trabaja en local.** Todo es en la nube. Nunca pedirle comandos locales.
  Las acciones manuales que le toquen son siempre en **páginas web** (GitHub,
  Cloudflare, Supabase, HighLevel/Nexus). Dar pasos con clics exactos.
- **El usuario fusiona los PR.** Yo desarrollo en la rama, abro PR, y él le da
  **Merge** en GitHub. Desplegar = fusionar a `main`.
- Prefiere soluciones definitivas y paso a paso; se frustra si repito cosas ya
  hechas o si algo queda a medias.
- **MÉTODO MOCKUPS (pedido el 3-sep-2026, afinado el 4-sep):** antes de
  construir **algo nuevo en la interfaz** —una pantalla, una sección, un tablero,
  un formulario nuevo, o un cambio que reorganiza lo que ya hay— mostrarle
  primero un **mockup** para que lo apruebe, y solo después escribir el código.
  Usar el skill `design` (canvas de mockups) para producirlo.
  **Van DIRECTO, sin mockup** (dicho por el usuario, 4-sep: «Directo»):
  - **Ajustes puntuales sobre pantallas que ya existen**: añadir o quitar un
    campo de un formulario, cambiar un texto, un rótulo, un botón, el
    comportamiento de un enlace.
  - Todo lo que no toca interfaz: datos, migraciones, webhooks, reglas de
    negocio en servidor.
  Ante la duda entre «ajuste» y «algo nuevo», es ajuste si cabe en la pantalla
  tal como está hoy y se puede describir en una frase.

## 3. Arquitectura y plataformas

| Pieza | Detalle |
|---|---|
| **Framework** | Next.js 16 (App Router, RSC, Server Actions), React 19, TypeScript, Tailwind 4 |
| **ORM** | Prisma 7 con `@prisma/adapter-pg` (PrismaPg). Cliente en `node_modules/@iglesia/prisma-client` (generado en postinstall). Enums = uniones de literales. |
| **Base de datos** | Supabase Postgres. **project_id = `cxtfftuexqmkktxumkfz`**, región `ca-central-1`. Plan **FREE** (verificado 4-sep-2026 en la barra del
panel; antes este archivo decía «Paid» y era falso — de ahí parte de la lentitud). Conexión por Session pooler. Extensiones: `unaccent`, `pg_trgm` en `public`. |
| **Hosting** | Cloudflare Workers + OpenNext (`@opennextjs/cloudflare`). **account_id = `69e3fbf14345159222eaf8ff45a16bd9`**, worker **`sistema-iglesia-vive`**. Plan **Workers Paid ($5)** (confirmado por el usuario). |
| **Emails** | Resend (best-effort; no-op si faltan `RESEND_API_KEY` / `EMAIL_FROM`). |
| **CRM** | HighLevel (marca blanca **Nexus**, app.nexusia.com.co). **locationId = `TDMnYRth8ofWhJ86uJKb`**. |
| **Dominio público** | micasavive.com (formularios de registro alojados en HighLevel). |

## 4. Despliegue (leer antes de tocar deploy)

- **Git-connected Workers Builds**: al hacer **push/merge a `main`**, Cloudflare
  reconstruye y despliega solo (~5 min). Las migraciones se aplican en ese
  build con `scripts/migrar.mjs` (ver §5).
- **Secretos** (env del worker): se toman **solo en el rebuild**. Cambiar un
  secreto en el panel NO afecta la versión viva hasta un nuevo build.
- **Configuración de build correcta** (Cloudflare → worker → Settings → Builds):
  - **Build command:** `npm run cf:build` (= `node scripts/migrar.mjs && opennextjs-cloudflare
    build`: aplica migraciones y genera `.open-next/worker.js`). ⚠️ Si aquí se pone
    solo `npx opennextjs-cloudflare build`, **las migraciones no corren** (fue el
    bug de sep-2026).
  - **Deploy command:** `npx wrangler deploy` (sube **y activa** al 100%).
    ⚠️ `npx wrangler versions upload` **sube pero NO activa** → el sitio no cambia.
  - `wrangler.jsonc` ya incluye `build.command = npx opennextjs-cloudflare build`
    como respaldo, para que el worker se compile aunque el «Build command» del
    panel esté vacío (eso rompió despliegues en ago-2026).
- **Verificar si un deploy ya está vivo** (desde Claude, sin panel):
  `curl -s -o /dev/null -w "%{http_code}" -X POST <URL_worker>/api/integraciones/highlevel/llamada -H 'content-type: application/json' -d '{}'`
  → **401** = desplegado (ruta existe, pide secreto). **307** = aún NO desplegado
  (redirige a `/ingresar`; la ruta no está en el bundle).
- URL del worker: `https://sistema-iglesia-vive.viveministeriointernacional.workers.dev`
- **No hay credenciales de Cloudflare en el entorno** → no puedo hacer
  `wrangler deploy` yo mismo; el deploy pasa por Workers Builds (merge del usuario).

## 5. Convención de ramas / git

- Desarrollar en la rama de trabajo (actual: `claude/operacion-72-dashboard-4wj0p3`),
  abrir PR contra `main`. El usuario fusiona.
- Si el PR de la rama ya está fusionado, **reiniciar la rama desde `main`**
  (`git fetch origin main && git checkout -B <rama> origin/main`) y poner el
  trabajo nuevo encima; abrir PR nuevo. Nunca apilar sobre historia ya fusionada.
- **Migraciones: automáticas en cada despliegue.** Basta crear la carpeta en
  `prisma/migrations/<timestamp>_<nombre>/migration.sql` y fusionar: el build
  ejecuta `scripts/migrar.mjs` (vía `wrangler.jsonc` → `build.command` y
  `npm run cf:build`), que aplica lo que falte y lo registra en la tabla
  `app_migration`. Las 26 migraciones anteriores a `20260903230000` son la
  «base» (ya estaban en Supabase; se registran sin ejecutar). Requiere el
  **secreto de build `DATABASE_URL`** en Cloudflare (Settings → Builds → Build
  variables and secrets; es distinto del secreto de runtime). Sin él, el script
  avisa y no hace nada — el deploy no se rompe, pero la base no se migra.
  Si una migración falla, el build falla a propósito. Ya no hace falta
  `apply_migration` por MCP (el usuario lo tiene bloqueado por permisos).

## 6. Integración HighLevel (webhooks)

### Los TRES formularios públicos (mapa: link → formulario → webhook)

**Esto es lo primero que hay que mirar cuando «algo no llega».** Los nombres se
parecen muchísimo y ya nos costó tiempo dos veces.

| Link público (micasavive.com) | Formulario en HighLevel | Campos propios (`contact.…`) | Webhook del sistema | Qué hace |
|---|---|---|---|---|
| `/registro/nuevo` | **Registro Nuevo** (`R3al3ZYXNvV72rNUFi4p`) | `gender`, `invitado_por`, `tipo_de_invitacion`, `iglesia_actual`, `telefono_2_whatsapp`, `hora_llamada`, `peticion_oracion` | `/registro-nuevo` | **Alta de persona nueva** → crea la ficha + Operación 72 en **INICIADA** y reparte consolidador. **Es el formulario que usa el equipo de consolidación** para meter gente nueva. |
| `/registro/primera-llamada` | **Primera Llamada** (`vBWEMOXsEg2Bq5affr7H`) | `estado_primera_llamada` (**MULTIPLE_OPTIONS** → llega como arreglo), `observacion_primera_llamada_peticion`, `casa_de_fe` | `/visita` | **EL formulario de llamadas.** Contestó → CONTACTADA · no contestó → SEGUIMIENTO. |
| `/registro/primera-llamada/linea` | **Registro Llamada Línea** (`07rGKuRchJO15bxL2Unj`) | `confirmacion_de_visita`, `fecha_visita` (+ `estado_primera_llamada_linea`, `fecha_…`, `observacion_…`) | `/visita` | **EL formulario de visitas** → VISITA PENDIENTE. Su nombre engaña: dice «Llamada Línea» pero se usa **solo para visitas**. |

**Reparto definido por el usuario (4-sep) — cada formulario tiene UN oficio:**
- `/registro/nuevo` → **registrar personas nuevas** (crea la Op72 en INICIADA).
- `/registro/primera-llamada` → **registrar llamadas**, y es el **ÚNICO** para eso.
- `/registro/primera-llamada/linea` → **registrar visitas**, y es **exclusivo** para eso.

⚠️ **El nombre del tercero engaña**: el formulario se llama «Registro Llamada
Línea» y la URL dice `primera-llamada`, pero **es el de visitas**. Sus campos de
llamada (`estado_primera_llamada_linea`…) el parser los sigue aceptando como red
de seguridad —si vienen, registran el intento y mueven la tarjeta igual—, pero
en el uso real ese formulario se llena para agendar la visita.

⚠️ **«Primera Llamada» y «Registro Llamada Línea» son formularios DISTINTOS con
campos DISTINTOS.** `extraerVisita` (`highlevel.ts`) lee los dos juegos de
campos, por etiqueta, clave o id. Si aparece un formulario nuevo, hay que
añadir sus claves ahí o lo que se llene se descarta en silencio.

**Regla de negocio (definida por el usuario, 4-sep):** el equipo de
consolidación **NO tiene acceso a la plataforma**; trabaja solo con estos
links. Por eso **el formulario es el registro**: es lo único que mueve la
tarjeta. Las marcaciones del discador de HighLevel llegan a `call_log` y se ven
en `/administracion/llamadas`, pero **NO mueven Operación 72** — son evidencia
de que se llamó, y sirven para detectar a quien marca pero no registra.


- **Registro de personas:** `POST /api/integraciones/highlevel/registro-nuevo`.
  Header `x-iglesia-webhook-secret` = env `HIGHLEVEL_WEBHOOK_SECRET` (valor vive en
  Cloudflare, **no** en el repo). Workflow en HighLevel: «Se llenó Formulario
  Registro Nuevo» → paso Webhook.
- **Seguimiento de la línea (visitas):** `POST /api/integraciones/highlevel/visita`.
  Mismo secreto. Ver bitácora 2026-09-03.
- **Llamadas:** `POST /api/integraciones/highlevel/llamada`. Mismo secreto.
  Guarda en tabla `call_log`. Workflow en HighLevel: trigger **«Detalles de la
  llamada»** → acción **Webhook** (POST, header del secreto, y datos:
  `userId={{user.id}}`, `contactId`, `direction`, `callStatus`, `callDuration`,
  `from`, `to`, `callId`). Parser tolerante en `src/lib/llamada-highlevel.ts`.
- **Mapa de personal ↔ HighLevel:** en la lista «Mi personal» de HighLevel, el
  código bajo cada correo es el **user id de HighLevel**. Se guarda en
  `app_user.highlevel_user_id`. Sirve para: asignar el consolidador dueño de un
  contacto, y mapear quién hizo cada llamada. Sin ese id, la persona **no aparece**
  en el tablero de llamadas.
- **La API de HighLevel SÍ se puede usar** desde este entorno (esto antes decía lo
  contrario y era falso). `services.leadconnectorhq.com` responde con `curl`;
  `urllib` de Python recibe 403 del proxy, así que usar `curl`. El token PIT vive
  fuera del repo (scratchpad `.ghl-token`), nunca commitear.

## 7. Funcionalidades ya construidas (no rehacer)

- Emails de credenciales y de asignación de mentor (Resend), en creación de acceso
  y asignación de mentor.
- **Casa de Fe** como grupo con líder y miembros (misma página de Alpha).
- **Elegibilidad de mentor** por rol: `ROLES_MENTOR = [MENTOR, PASTOR, ADMIN]`
  (`src/lib/equipo.ts`). Líder de Alpha / Casa de Fe = permisos (`can_lead_*`).
- **Dar de baja / reactivar** personas (estado `RETIRADO`, `LearnerStatusChange`);
  desactiva su acceso; listado aparte en `/administracion/dados-de-baja`.
- **Ocultar dados de baja** del listado de administración salvo al buscar.
- **Búsqueda tolerante** (sin tildes/mayúsculas/exactitud): columna
  `person.search_text` + índice trigram, mantenida por trigger (`unaccent`).
  Helper `normalizarBusqueda` en `src/lib/dominio.ts`.
- **Indicadores de carga** al navegar (`(interno)/loading.tsx`).
- **1 sola conexión de BD por petición** (`PrismaPg max:1`) para no agotar el
  pooler de Supabase (evita errores 1102 / «max clients»).
- **Tablero de llamadas** (solo ADMIN): tabla `call_log`, webhook, y
  `/administracion/llamadas` (global + por persona + historial individual con «A
  quién se llamó»). Libs: `src/lib/llamadas.ts`, `src/lib/llamada-highlevel.ts`.

## 8. Operaciones de datos ya hechas

- Fusionado: **Nora Bonilla** (consolidadora, `app_user`) ↔ **Noraima Coa Barrios**
  (persona/expediente). Nora tiene `highlevel_user_id = t8HuZDPMHztakrzlFlJQ`.
- Fusionado: **Carlos Andrés** (persona/expediente) ↔ **Carlos Zambrano** (cuenta
  consolidadora con 11 discípulos; `highlevel_user_id = 1ecXv5QNMEvAOnlb5nRC`).
  Sobrevive la cuenta de Zambrano con el expediente enganchado.
- Revisados/fusionados duplicados en toda la base (agosto 2026).
- Import masivo histórico de contactos hecho vía webhook (256 en ago-2026).

## 9. Pendientes / temas abiertos

- **Lentitud**: Cloudflare está en Workers Paid, pero **Supabase está en FREE**
  (compute más pequeño y sin pooler dedicado). Palancas: subir Supabase a Pro, o
  **Hyperdrive** (cachea el pool de conexiones a Supabase en el borde). Plantilla
  comentada en `wrangler.jsonc`.
- **Registros de HighLevel**: si dejan de entrar, revisar que el workflow de
  registro esté activo y enviando; algunos llegan y se marcan «duplicado» (409).
- Rotar el `HIGHLEVEL_WEBHOOK_SECRET` (estuvo expuesto en capturas).
- **Tabla huérfana `inbound_registration`** en Supabase: ya no está en el modelo
  de Prisma. No estorba; se puede borrar cuando el usuario lo autorice.

## 10. Reglas duras

- **Nunca** commitear secretos (tokens, contraseñas, `HIGHLEVEL_WEBHOOK_SECRET`,
  PIT de HighLevel, service role de Supabase). Solo referenciar dónde viven.
- **Nunca** poner identificadores de modelo en commits/PR/código.
- `BYPASS_AUTH_LOCAL`, si se usa para pruebas, **siempre** revertir.
- Probar el webhook del propio sistema con el secreto es legítimo (es su sistema).

## 11. Comandos útiles

- Typecheck: `npx tsc --noEmit` · Lint: `npx eslint <archivos>`
- Build Cloudflare local (verificación): `npm run cf:build`
- Validar deploy sin credenciales: `npx wrangler deploy --dry-run --outdir /tmp/x`

## 12. Bitácora (añadir lo nuevo arriba)

- **2026-09-04** — **LOS TRES FORMULARIOS QUEDARON VIVOS.** Cerrado el de
  **llamadas** (`/registro/primera-llamada`), que era el hueco: probado punta a
  punta con un envío real — **Geraldine Fernández** pasó sola a **SEGUIMIENTO**
  con la observación completa (párrafo largo con tildes, sin cortes).
  **Dos errores de configuración en el paso Webhook del workflow
  `3. Formulario de Primera Llamada Enviado`**, ambos silenciosos:
  1. La **URL apuntaba a `/registro-nuevo`** en vez de `/visita`. Habría
     intentado crear una persona nueva en cada llamada registrada.
  2. El **secreto era otro** (64 caracteres en vez de 48) → el sistema
     devolvía **401** y los envíos se perdían sin dejar rastro.
  **Cómo verificar un secreto sin exponerlo ni tocar datos:** `POST` al webhook
  con ese header y un `contact_id` inexistente → **401 = secreto malo**,
  **404 = secreto bueno** (autorizado, contacto no encontrado). Vale para los
  tres webhooks.
  **⚠️ PENDIENTE URGENTE: rotar `HIGHLEVEL_WEBHOOK_SECRET`.** Su valor completo
  quedó legible en capturas de pantalla del 4-sep. Pasos: generar uno nuevo →
  Cloudflare → Settings → Variables and Secrets → esperar el despliegue →
  actualizarlo en los **tres** workflows de HighLevel.
  **Pendiente menor:** el rótulo del movimiento dice **«No contestó (línea)»**
  aunque venga del formulario del **consolidador**; el «(línea)» está cableado en
  `programarVisitaDesdeCrm` (`registro.ts`) de cuando solo existía el formulario
  de la línea. Hay que distinguir el origen.

- **2026-09-04** — **El formulario del consolidador no movía nada** (caso María
  Julieth Durán, +57 320 473 2415). La llamaron **3 veces** el 3 y 4 de sep
  (Ana Lucía Gutiérrez, todas `no-answer`, en `call_log`) y su tarjeta seguía en
  **INICIADA** sin un solo `contact_attempt`. Causa: `/registro/primera-llamada`
  y `/registro/primera-llamada/linea` son **formularios distintos** y el parser
  solo conocía los campos «…_linea» (ver el mapa de los tres formularios en §6).
  Tres arreglos en un solo commit:
  1. `extraerVisita` lee también `estado_primera_llamada` y
     `observacion_primera_llamada_peticion`.
  2. **`texto()` acepta arreglos**: `estado_primera_llamada` es
     `MULTIPLE_OPTIONS` en HighLevel y llega como `["No contestó"]`, no como
     texto — se leía vacío.
  3. **Anti-duplicados sin fecha**: ese formulario no pregunta la fecha, así que
     se usaba `new Date()` y la comparación exacta nunca coincidía → un reenvío
     habría duplicado el intento. Sin fecha declarada el criterio pasa a ser
     «mismo resultado en las últimas 12 h».
  **PENDIENTE CRÍTICO del usuario:** agregarle el paso **Webhook** al workflow
  que escucha «Primera Llamada» (parece `3. Formulario de Primera Llamada
  Enviado`), apuntando a `/visita` con el header del secreto y **Custom Data
  vacío**. **Mientras eso no exista, NINGUNA llamada llega al sistema** — y el
  usuario confirmó (4-sep) que ese es el **único** formulario con el que se
  registran llamadas. Tenía 5 envíos del 3-sep que nunca entraron. Esto explica
  por qué el tablero se ve «congelado» aunque el equipo esté llamando.
  **Ofrecido y NO construido:** guardar la respuesta de **«¿Desea iniciar Casa de
  Fe?»** (`contact.casa_de_fe`), que hoy se descarta.

- **2026-09-04** — **Recorrido de Operación 72 revisado punta a punta + limpieza
  de datos.** El código hace exactamente lo que el usuario describe: registro →
  **INICIADA**; llamada **no contestó → SEGUIMIENTO**, **contestó → CONTACTADA**;
  formulario de visita → **VISITA PENDIENTE**; cerrar visita →
  **LISTA PARA ENTREGA**; entregar → sale del tablero. Igual por los dos
  caminos (tablero y webhook del CRM). Detalle correcto y deliberado: **una vez
  CONTACTADA, un «no contestó» posterior NO la devuelve a SEGUIMIENTO** (queda
  en el historial; ya se habló con ella).
  **Dos bolsas de datos viejos encontradas en CONTACTADA (eran 292):**
  1. **35 personas corregidas → SEGUIMIENTO.** Su única llamada era «No
     contestó» (24-ago) y nunca contestaron; quedaron en CONTACTADA porque la
     columna SEGUIMIENTO **no existía** entonces. Auditadas con la acción nueva
     `operacion72.estado_corregido` (catálogo en `audit.ts` + `case` en
     `actividad.ts`). Reparto: Freddy Cadena 9, Carlos Suárez 7, Santiago
     Viveros 4, Nini Guerrón 4, Jakeline Guerrero 4, Johanna Quintero 3,
     Emelin Parra 2, Laura Charry 1, Ruth Bonilla 1.
  2. **184 personas del import masivo del 26-ago** («Primera llamada (importado
     de HighLevel)», `outcome` NULL: no se sabe si contestaron).
     **DECISIÓN DEL USUARIO (4-sep): se quedan en CONTACTADA, no se tocan.**
     No volver a proponerlo.
  Tablero tras la corrección: INICIADA 60 · SEGUIMIENTO 36 · CONTACTADA 257 ·
  VISITA PENDIENTE 6 · LISTA PARA ENTREGA 0.
  **Consulta útil para auditar el tablero** (última llamada por operación):
  `distinct on (operation72_id) … order by operation72_id, occurred_at desc`.

- **2026-09-04** — **Visitas desde el CRM: VIVO y probado punta a punta.** Se llenó
  el formulario real y la tarjeta de Valeria Atencio pasó sola a
  **VISITA_PENDIENTE** («Visita 5 de sept · virtual»), con dos `contact_attempt`:
  la llamada de la línea (CONTESTO_BIEN + observación completa) y la visita
  agendada (`is_virtual = true`). **No hizo falta mapear NADA en Custom Data**:
  la acción Webhook de HighLevel manda el contacto completo y el parser
  (`indiceDeCampos`) lo encuentra en `customFields` / `customData` / `data` /
  `contact` / raíz, reconociendo cada campo por etiqueta, clave o id.
  **Configuración final del workflow** (se le añadió el paso Webhook al workflow
  **ya existente** `Se llenó Formulario Registro Llamada Línea`, en vez de crear
  uno nuevo): POST a `…/api/integraciones/highlevel/visita`, header
  `x-iglesia-webhook-secret`, **Custom Data vacío**.
  **Tres trampas que costaron el rato** (revisar estas primero si algo falla):
  1. **Nombres de formulario casi idénticos.** La URL
     `micasavive.com/registro/primera-llamada/linea` aloja el formulario
     **«Registro Llamada Línea»** (`07rGKuRchJO15bxL2Unj`), **NO** «Primera
     Llamada» (`vBWEMOXsEg2Bq5affr7H`). El trigger apuntaba al equivocado.
  2. **Workflow en `draft`.** No dispara aunque todo lo demás esté bien.
     Verificable desde aquí: `GET services.leadconnectorhq.com/workflows/?locationId=…`
     con el PIT — devuelve nombre y `status` de los 35 workflows (pero **no** los
     pasos internos: el paso Webhook solo se comprueba enviando el formulario).
  3. **URL equivocada.** `/registro-nuevo` es para altas; visitas van a `/visita`;
     llamadas del CRM a `/llamada`.
  Los envíos del formulario se pueden auditar con
  `GET /forms/submissions?locationId=…` y los ids con `GET /forms/?locationId=…`.
  Detalle menor: la fecha de visita queda a mediodía Colombia porque el
  formulario solo captura el día, no la hora.

- **2026-09-04** — **Migraciones automáticas VIVAS y verificadas** (PR #57).
  Tras fusionar, el build creó `app_migration` con **27 filas** (26 registradas
  sin ejecutar + `20260903230000_correo_enviado` aplicada) en 2 s. Desde ahora,
  **crear la carpeta de migración y fusionar a `main` basta**: nadie entra a
  Supabase. Lo que faltaba era esto:
  1. **El «Build command» del panel** era `npx opennextjs-cloudflare build`, que
     **no** ejecuta `scripts/migrar.mjs`. Ahora es **`npm run cf:build`**.
  2. **El secreto de build `DATABASE_URL`** no existía (Settings → Builds →
     Variables and secrets). Es **distinto** del secreto de runtime; tener uno no
     pone el otro.
  3. **La migración de `email_sent` no era idempotente.** La tabla ya existía
     (creada a mano) y el registro estaba vacío → el script iba a hacer
     `CREATE TABLE` sobre algo existente → build caído y **sitio sin desplegar**.
     Ahora usa `IF NOT EXISTS`. **REGLA: toda migración nueva debe poder
     repetirse sin romper** (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.).
  4. `pg` pasó a **dependencia directa** en `package.json` (antes llegaba de
     rebote con `@prisma/adapter-pg`).
  **Cómo diagnosticar esto en el futuro:** si `app_migration` **no existe**, el
  script **nunca arrancó** (la crea en su primera instrucción, antes de aplicar
  nada). Si existe pero le falta una migración, esa falló.
  **Ojo con el panel de Cloudflare:** guardar un secreto crea una «versión» del
  Worker pero **NO dispara un build**; y «Deployment History» solo lista
  despliegues activados, así que los builds de rama no aparecen ahí. La vía
  segura para forzar el build sigue siendo **fusionar a `main`**.

- **2026-09-04** — **Verificación de estado** (diagnóstico; el desenlace está en
  la entrada de arriba). La tabla **`email_sent` ya existe**
  en Supabase (11 columnas + los 3 índices de la migración) y **ya tiene copias
  de correo guardadas**, así que la vista previa de correos en «Actividad del
  día» funciona. **Pero la tabla `app_migration` NO existe**: eso significa que
  `scripts/migrar.mjs` **todavía no se ha ejecutado en ningún build** (falta el
  secreto de build `DATABASE_URL` en Cloudflare → Settings → Builds → Build
  variables and secrets, o falta un build después de ponerlo). `email_sent` se
  creó por fuera del script. **Consecuencia:** la próxima migración nueva NO se
  aplicará sola hasta que ese secreto exista. Cuando se ejecute por primera vez,
  el script registrará las 26 previas + `20260903230000_correo_enviado` sin
  volver a ejecutarlas (`BASE`), así que no hay riesgo de duplicar.
  Worker vivo y respondiendo (`/`, `/ingresar`, `/registro`,
  `/administracion/actividad` → 200; webhook de llamadas → 401). Proyecto de
  Supabase `ACTIVE_HEALTHY`, Postgres 17.6.
  - **Causa encontrada**: el «Build command» del panel era
    `npx opennextjs-cloudflare build`, que **no** ejecuta `scripts/migrar.mjs`.
    Corregido a **`npm run cf:build`** (ese sí encadena migración + compilación).
    Y el secreto de build `DATABASE_URL` **no existía** en Settings → Builds →
    Variables and secrets (solo estaban `HIGHLEVEL_WEBHOOK_SECRET`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SUPABASE_URL`).
  - **Ojo con el panel**: guardar un secreto crea una «versión» del Worker pero
    **NO dispara un build**. Para que corran las migraciones hay que ir a
    Deployments → ⋯ del último build de Git → **Retry build**.
  - **Incidente**: se creó un secreto con el nombre mal escrito
    (`SUPABASE_SERVICE_ROLE_KEYY`) y al limpiarlo **se borró también el bueno**,
    dejando al Worker sin `SUPABASE_SERVICE_ROLE_KEY` (se caen restablecer
    contraseña y crear accesos; el resto sigue). Se repuso con la llave
    **legacy `service_role`** (Supabase → Settings → API Keys → pestaña «Legacy
    anon, service_role API keys» → Reveal → Copy). **No** usar la nueva
    `sb_secret_…` sin probarla antes, y **nunca** pulsar «Disable JWT-based API
    keys».

- **2026-09-03** — **Pantalla «Actividad del día»** (`/administracion/actividad`,
  solo ADMIN; mockup aprobado:
  claude.ai/code/artifact/73f0ccb6-5d35-4341-b8d3-c509e13eccab). Lee la
  bitácora `audit_log` por día (límites en hora Colombia), las llamadas reales
  de `call_log` y los correos de `email_sent`, y los traduce a frases «quién
  hizo qué, a quién y en qué quedó» en `src/lib/actividad.ts`
  (`cargarActividad`: resuelve nombres por `entityType`
  learner_profile/person/operation72/app_user/faith_house_group/alpha_program/
  event y por ids en `metadata`). Contadores, filtros por tipo y por nombre,
  agrupado por hora; clic en un movimiento abre la **vista previa** a la derecha
  (`lista.tsx`): el correo tal cual salió (iframe `sandbox`), lo que se llenó en
  la llamada (se enlaza el `contact_attempt` creado ±2 min), el resumen de la
  visita, motivo de baja, etc. **Toda acción nueva de auditoría debe tener su
  `case` en `cargarActividad`** o saldrá como texto crudo.
  - Nuevas acciones auditadas: `alpha.grupo_creado` y `evento.creado` (antes
    crear un Alpha o un evento no quedaba registrado).
  - **Copia de cada correo enviado**: tabla `email_sent` (modelo `EmailSent`;
    migración `20260903230000_correo_enviado` **creada pero NO aplicada: el
    usuario rechazó aplicarla**). `enviarCorreo` acepta `registro`
    (`RegistroDeCorreo`) y guarda la copia best-effort (si la tabla no existe,
    solo `console.error`). Hoy la pasa `correoEntregaAMentor`
    (`tipo: "entrega_a_mentor"`). La actividad tolera la tabla ausente
    (`.catch(() => [])`). **Pendiente: aplicar la migración** para que la vista
    previa de correos funcione.
  - Las llamadas del CRM se muestran mezcladas (el usuario no pidió lo
    contrario); se quitan filtrando por tipo.

- **2026-09-03** — **Correo de entrega a mentor, nuevo** (mockup aprobado:
  claude.ai/code/artifact/7bd0a7d6-0107-4e9a-b0e8-5d9163bbeaf2). Sale al
  entregar desde el tablero (`entregarAMentor`) y al asignar mentor desde
  Administración (`asignarMentor`); ambos usan `enviarCorreoDeEntrega`
  (`src/lib/correo-entrega.ts`), que carga todo y llama a
  `correoEntregaAMentor` (`correo.ts`). Reemplaza a `correoMentorAsignado`
  (eliminada). Asunto: «TE ENTREGAMOS A NOMBRE PARA QUE LA/LO MENTOREES».
  Bloques: (1) quién es — Consolidó + entregada cuándo, celular, horario de
  llamada, edad, quién la invitó (+ «se conserva su línea»), llegó por,
  iglesia; (2) qué te pedimos — llamarla y presentarse o presentarle a su
  líder, vincularla a Alpha o Casa de Fe **solo si no está ya en un proceso**,
  asignarle líder; (3) historial de Operación 72 completo (registro + cada
  `contact_attempt` con quién, cuándo y observación); (4) petición de oración;
  (5) botones a expediente, /alpha y /casa-de-fe. **Decisión del usuario: las
  notas pastorales NO van en el correo** (se ven en el expediente, auditadas).

- **2026-09-03** — **Registro interno «solo la ficha» (sin Operación 72).**
  Pedido del usuario: registrar gente del equipo desde la plataforma sin que
  entre a consolidación, para asignarle rol/permisos en Administración. Mockup
  aprobado: claude.ai/code/artifact/6c304435-b2ca-4048-b523-690a18964463.
  - `crearRegistroEnTransaccion` acepta `sinOperacion72: true`: crea persona +
    `learner_profile` (para que Administración muestre sus secciones), hito
    REGISTRO, auditoría `persona.registrada` con `sinOperacion72: true`; **no**
    crea Op72, **no** asigna consolidador, **no** encola `operacion72_iniciada`.
  - Pregunta «¿Qué hacemos con este registro?» al final del paso ORIGEN del
    asistente (`PasoDestino`), por defecto «Iniciar Operación 72». Solo la ven
    **ADMIN y PASTOR** (`ROLES_REGISTRO_SOLO_FICHA` en `src/lib/auth.ts` — no
    puede vivir en `acciones.ts` porque un archivo `"use server"` solo exporta
    funciones async). El botón cambia a «Guardar solo la ficha» y redirige a
    `/administracion/<personId>`.
  - El webhook de HighLevel sigue creando siempre con Operación 72.

- **2026-09-03** — **«Database error loading user» al restablecer contraseña.**
  Al intentar restablecer la contraseña de Nora Bonilla desde administración,
  Supabase Auth respondió ese error. Causa: **12 cuentas de `auth.users`**
  (creadas en bloque el 24-ago) tenían `NULL` en columnas técnicas
  (`confirmation_token`, `recovery_token`, `email_change`,
  `email_change_token_new`…) donde el motor de Supabase (GoTrue) exige texto
  vacío `''`; al cargar el usuario, falla. Es el síntoma clásico de usuarios
  insertados por SQL en vez de por la API. **Corregido con un `UPDATE …
  coalesce(col, '')`** sobre esas 12 cuentas; 0 pendientes. **Regla:** si vuelve
  a aparecer ese error, revisar `NULL` en esas columnas antes de tocar código.
  Nunca insertar usuarios en `auth.users` por SQL: usar `auth.admin.createUser`.

- **2026-09-03** — **Tarjetas de Operación 72 explícitas, baja desde el tablero y
  webhook de visitas** (mockup aprobado por el usuario:
  claude.ai/code/artifact/62dc9ac9-0589-4d37-a854-6c10d3fd6d14).
  1. **Tarjeta** (`operacion-72/page.tsx` + `tarjeta.tsx`): cada dato con rótulo
     — CELULAR, CONSOLIDA (nombre real), LO/LA INVITÓ, LLEGÓ POR, EDAD (solo si se
     conoce; se acabó el «0 años»). Dato ausente = «No quedó registrado» (antes
     «Sin registrar» a secas era el punto de entrada). Bloque **ÚLTIMO
     MOVIMIENTO** = último `contact_attempt` con quién y cuándo
     (`tituloDelMovimiento` en `op72.ts`; `momentoLegible`/`telefonoLegible` en
     `dominio.ts`); en VISITA PENDIENTE muestra **VISITA ACORDADA** (fecha, lugar,
     y si la agendó la línea desde el CRM: `byUserId` nulo). Chip ahora dice
     «QUEDAN n H» / «VENCIÓ HACE n DÍAS». Ya **no se usa `operation72.detail`**
     en la tarjeta (sigue guardándose para el expediente). Hallazgo: el texto
     «bienvenida por WhatsApp enviada» era **fijo y falso** (el sistema no envía
     WhatsApp); ahora dice «Registrada · consolidador asignado».
  2. **Dar de baja desde el tablero**: núcleo compartido en `src/lib/baja.ts`
     (`darDeBajaAprendiz`), usado por administración y por
     `darDeBajaDesdeTablero` (mismo alcance que las demás acciones del tablero).
     Motivo **obligatorio** de lista cerrada `MOTIVOS_DE_BAJA` (`op72.ts`) +
     nota opcional; auditoría `operacion72.dado_de_baja`. Los motivos son
     propuesta mía; el usuario no los ha revisado aún.
  3. **Webhook `POST /api/integraciones/highlevel/visita`** para los formularios
     «Registro Visita» / «Primera Llamada» / «Asignar a Línea» sobre contactos
     que ya existen. Mismo secreto. Reconoce a la persona por `highlevel_contact`
     o, si no está enlazada, por celular/correo (solo si hay UNA candidata).
     Parser `normalizarSeguimientoHighLevel` (`highlevel.ts`, lee los mismos
     campos personalizados que ya usaba el registro). `programarVisitaDesdeCrm`
     ahora devuelve `"visita" | "llamada" | null` y **también aplica la llamada
     sola**: contestó → CONTACTADA, no contestó → SEGUIMIENTO (idempotente por
     resultado+fecha). Añadido a `RUTAS_PUBLICAS`. Auditoría
     `highlevel.seguimiento_recibido`. `secretoValido` ahora vive en
     `src/lib/webhook.ts` (las tres rutas lo comparten).
  **RESUELTO el 4-sep-2026** (ver entrada de arriba). Quedó así en HighLevel:
  workflow `Se llenó Formulario Registro Llamada Línea` (publicado) → paso
  Webhook a esa URL, **sin Custom Data**. Lo de abajo era el plan original con
  `contactId={{contact.id}}`, `locationId={{location.id}}`, `phone`, `email`,
  `formName` y los campos «Confirmación de visita», «Fecha visita», «Estado
  Primera Llamada Linea», «Fecha Primera Llamada Linea», «Observación Primera
  LLamada Linea».

- **2026-09-03** — **El correo del sistema por fin funciona (nunca había enviado
  uno).** El usuario restableció una contraseña desde administración, la pantalla
  dijo «enviada por correo» y no llegó nada. Causa: **`RESEND_API_KEY` y
  `EMAIL_FROM` no existían en el Worker** — o sea que *ningún* correo del sistema
  se había enviado jamás (credenciales, aviso a mentor, recuperación). Y no se
  notaba porque `enviarCorreo` devolvía `false` en silencio y quien la llamaba
  descartaba el resultado. Tres arreglos:
  1. **`enviarCorreo` devuelve `ResultadoCorreo`** (`{enviado:true}` o
     `{enviado:false, motivo}`) y los cuatro correos lo propagan. Las acciones de
     administración lo suben a la pantalla como **aviso ámbar** («la contraseña sí
     cambió, pero el correo no salió porque…») y lo guardan en la auditoría
     (`correoEnviado`, `motivoCorreo`). En `/recuperar` la respuesta al usuario
     debe seguir siendo siempre la misma, así que ahí el motivo **solo** queda en
     la auditoría. (PR #46)
  2. **Infraestructura de correo montada**: cuenta de Resend, dominio de envío
     **`send.micasavive.com`** verificado. El DNS de micasavive.com se administra
     **en HighLevel** (Settings → Domains → Registros DNS), no en Cloudflare.
     Registros añadidos: TXT `resend._domainkey.send` (DKIM), MX `send.send`
     (`feedback-smtp.us-east-1.amazonses.com`, prioridad 10), TXT `send.send`
     (SPF) y TXT `_dmarc`. Los nombres van **cortos**, sin `.micasavive.com`.
  3. **⚠️ REGLA: `wrangler deploy` conserva los Secrets pero REEMPLAZA las
     variables de texto** del Worker por las de `wrangler.jsonc`. La `EMAIL_FROM`
     puesta a mano en el panel **desapareció en el siguiente despliegue**, sin
     aviso. Por eso `EMAIL_FROM` ahora vive en `wrangler.jsonc` → `vars` (no es
     secreto). **Toda variable de texto nueva va ahí; solo los secretos van al
     panel.** (PR #47)
  **Verificado en producción**: se ejecutó el flujo real de `/recuperar` contra el
  worker vivo y la auditoría registró `correoEnviado: true`.
  Truco útil para probar una Server Action sin navegador: `GET` a la página,
  sacar del HTML los campos ocultos `$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1`
  y `$ACTION_KEY`, y reenviarlos por `POST` con `curl -F` junto con los campos del
  formulario (es la ruta sin JS de Next).

- **2026-09-03** — **Cuatro ajustes de producto pedidos por el usuario (un solo PR):**
  1. **Ningún dato de la persona se oculta.** El teléfono se enmascaraba
     (`telefonoParcial`, «323 ••• 8212») en el expediente, en la lista de
     administración y en el buscador; se eliminó la función y se muestra completo.
     El expediente ahora tiene la sección **«DATOS DE LA PERSONA»** con TODO
     (nombre, género, nacimiento, celular, WhatsApp, correo, dirección, petición,
     horario para llamar), y es **editable si `acceso.puedeEscribir`** (su
     consolidador, su mentor, coordinación, pastor, admin). Núcleo compartido en
     `src/lib/persona.ts` (`actualizarDatosPersona`: valida, guarda, audita y
     refleja a HighLevel); formulario compartido
     `src/components/formulario-datos-persona.tsx` (lo usan administración y el
     expediente). Acción `guardarDatosPersonaDesdeExpediente` en
     `expediente/[id]/acciones.ts`; auditoría `expediente.datos_actualizados`
     (añadida al catálogo `AccionAuditada` de `src/lib/audit.ts` — **toda acción
     nueva de auditoría debe añadirse ahí o no compila**).
  2. **Filtros en el tablero de Operación 72** (`operacion-72/page.tsx`), por URL
     (`?q=…&orden=…`, formulario GET sin JS): orden **por urgencia** (defecto:
     dentro de plazo primero, luego vencidas recientes), **más reciente primero**
     y **más antiguo primero** (por `startedAt`); búsqueda por **nombre** (vía
     `person.search_text` normalizado) o **celular** (solo dígitos, con
     `regexp_replace` en SQL porque el mismo número aparece con espacios/+57).
     Aplica a todas las columnas, incluida SEGUIMIENTO. Grid pasa a 5 columnas.
  3. **Nuevo estado `SEGUIMIENTO`** en `Operation72Status` (migración
     `20260903180000_op72_seguimiento`, aplicada: `ADD VALUE … AFTER 'INICIADA'`).
     Regla: al registrar una llamada desde INICIADA **o** SEGUIMIENTO,
     **contestó → CONTACTADA**, **no contestó → SEGUIMIENTO** (antes «no contestó»
     dejaba la tarjeta en INICIADA, indistinguible de quien nunca recibió intento).
     Columna nueva entre INICIADA y CONTACTADA; transición «Volver a llamar»;
     `tarjeta.tsx` muestra el formulario de llamada también en SEGUIMIENTO;
     `programarVisitaDesdeCrm` también avanza desde SEGUIMIENTO.
  **Recordatorio:** `ESTADOS_EN_TABLERO` se deriva de `COLUMNAS_OP72`, así que la
  carga de consolidadores y el cierre al cambiar de fase ya incluyen SEGUIMIENTO.

- **2026-09-03** — **Ser mentor pasa a ser un permiso acumulable** (decisión del
  usuario: «un consolidador puede ser al mismo tiempo mentor o líder de Alpha»).
  Antes el rol era **uno solo**, así que consolidador+mentor era imposible.
  Alpha y Casa de Fe ya eran permisos (`can_lead_*`), así que **eso ya funcionaba**;
  lo que faltaba era mentor. Se añadió `app_user.can_mentor` (migración
  `20260903150000_permiso_mentor`, aplicada). **Pastor NO se hizo acumulable**
  (el usuario lo dejó para después: implica autoridad sobre toda la iglesia).
  **Fuente única de verdad en `src/lib/auth.ts`** — usar SIEMPRE estos helpers en
  vez de comparar roles a mano:
  - `puedeMentorear(usuario)` = rol MENTOR/PASTOR/ADMIN **o** `canMentor`.
  - `DONDE_PUEDE_MENTOREAR` = el mismo filtro para consultas de Prisma.
  - `tieneRed(usuario)` = ve `/mi-red` (rol con red o `canMentor`).
  - `puedeConfirmarEntrega(usuario)` = confirma la entrega a mentor.
  Aplicado en: `equipo.mentoresElegibles`, `asignacion.mentoresDisponibles` y
  `mentorDeLaLinea`, `fases.puedeCambiarFase`, `operacion-72/acciones` (propuesta
  y confirmación de entrega), `administracion/acciones`, y las páginas
  `mi-red` / `mi-proceso` / `layout` (que antes filtraban por `ROLES_CON_RED`).
  `candidatosConCarga` ahora acepta un rol **o** un filtro de Prisma.
  UI: casilla **«Puede ser mentor (acompaña discípulos)»** en administración,
  junto a las de Alpha y Casa de Fe.

- **2026-09-03** — **Regla del recorrido definida por el usuario:** al pasar de
  **GANAR → FORTALECER** la persona **deja de ser de consolidación** (la acompaña
  su mentor, que luego le asigna líder de Alpha o de Casa de Fe) y la **carga del
  consolidador debe bajar**. Bug encontrado: la carga se calculaba solo por el
  estado de la Operación 72, que quedaba **abierta** al avanzar de fase → 5
  personas en FORTALECER/ENTRENAR/MULTIPLICAR seguían pesando en su consolidador.
  Fix (doble):
  1. `expediente/[id]/acciones.ts`: al salir de GANAR se cierra la Operación 72
     como **ENTREGADA** («Entregada a mentor · pasa a Fortalecer») + auditoría
     `operacion72.entregada`.
  2. `asignacion.ts` → `consolidadoresDisponibles`: la carga cuenta solo personas
     en **fase GANAR** con Op72 en curso (red de seguridad si alguna quedara abierta).
  **El vínculo con el consolidador se CONSERVA** como historial del expediente.
  **Trazabilidad de fase: ya existía** — tabla `phase_change` (fromPhase, toPhase,
  decidedById, `decidedAt` con fecha y hora, nota) + `learner_profile.phaseStartedAt`
  + auditoría `fase.cambiada`. No hubo que construirla.
  Datos corregidos: las 5 Op72 abiertas se cerraron con auditoría.

- **2026-09-03** — **Consolidadores: lista completa y datos corregidos.** Ojo con
  las consultas: cruzar `app_user` con `person` por INNER JOIN **oculta** a los
  consolidadores sin ficha. Había 3 sin ficha (y por eso **fuera del reparto
  automático**, que filtra por género): **Ana Lucía Gutiérrez**, **Nini Guerrón**
  y **Carlos Suárez**. Arreglado: Ana enlazada a su ficha existente (mismo celular
  +573102328666, sin crear duplicado); Carlos enlazado a su ficha «Carlos enrique»
  (mismo correo) y nombre corregido a «Carlos Enrique Suárez»; Nini con ficha nueva.
  Laura Charry: se le puso género MUJER (también estaba fuera del reparto).
  **Johana Ramírez**: se le quitó el rol de consolidadora (rol → APRENDIZ) **pero
  conserva acceso** al sistema; sus **19 personas se reasignaron** por la regla del
  sistema (mismo género → menor carga; sin género → solo menor carga), con **19
  registros de auditoría `consolidador.reasignado`** (persona, género, consolidador
  anterior y nuevo con sus ids, criterio y motivo).
  **Pendiente:** la ficha de «Cristina Ramírez losada» tiene el correo de Nini
  (`ninijguerrons@gmail.com`); el usuario prefirió no tocarla por ahora.

- **2026-09-03** — **Registros de HighLevel VIVOS**. Se agregó por fin el paso
  **Webhook** al workflow «1. Se llenó Formulario Registro Nuevo» (antes no
  existía: el flujo inscribía y terminaba en pasos de «Mensaje», por eso nunca
  llegaba nada). Entraron Pedro Pérez y Maria Julieth Duran, ambos con
  **Operación 72 = INICIADA**. Dos bugs encontrados y arreglados en el camino:
  1. **422 «La fecha de nacimiento no es válida»** (PR #37): si el contacto no
     tenía fecha, HighLevel mandaba el merge-tag **sin resolver**
     (`{{contact.date_of_birth}}` literal) y el validador estricto tumbaba TODO
     el alta. Fix: `texto()` en `highlevel.ts` ignora `{{...}}`; `birthDate` se
     normaliza tolerante (ISO, con hora, o `dd/mm/aaaa`); email mal formado se
     ignora en vez de abortar.
  2. **Persona sin consolidador** (PR #38): cuando el contacto no tiene usuario
     asignado, HighLevel manda **la palabra literal `"null"`**. El parser la
     tomaba como id real → `ownerId="null"` → creía que había dueño → **saltaba
     el reparto automático**. También ensuciaba textos (`churchName="null"`).
     Fix: `texto()` trata `"null"`/`"undefined"` como vacío, en el parser de
     registro **y** en el de llamadas. Limpiadas 2 filas contaminadas.
  **Mapeo del webhook de registro** (Custom Data): `contactId={{contact.id}}`,
  `locationId={{location.id}}`, `formId` fijo, `firstName`, `lastName`, `email`,
  `phone`, `ownerId={{contact.assigned_to}}`, más los campos del formulario
  (que viven como **campos personalizados del CONTACTO**, no «del formulario»).
  **No** hace falta `submissionId` (no existe variable) y `HIGHLEVEL_REGISTRO_FORM_ID`
  **no está configurada** en Cloudflare, así que el `formId` no se valida.
  **Regla de cupo (definida por el usuario, 3-sep):** el tope es **24** y es tope
  solo de la **MENTORÍA** (un mentor acompaña hasta 24 discípulos en fase
  Multiplicar). En
  **consolidación NO es tope**: el reparto automático siempre asigna al del
  **mismo género con menor carga**, aunque todos estén sobre 12 (la capacidad
  queda como referencia visual, no como bloqueo). Implementado en
  `src/lib/asignacion.ts`: `elegirPorCarga` (con tope, para mentores) vs
  `elegirPorMenorCarga` (sin tope, para consolidadores). Contexto: todas las
  consolidadoras MUJER estaban llenas/sobre cupo con el viejo tope de 12 y por eso
  Maria Julieth entró sin consolidadora; se le asignó Jakeline Guerrero (la de
  menor carga). El `capacity` de los 31 usuarios pasó de 12 a **24** (migración
  `20260903120000_capacidad_24`, aplicada) y el default del esquema también.

- **2026-09-01** — **Hora Colombia** en toda la UI. El servidor (Workers/Node)
  corre en UTC, así que los formateadores `Intl.DateTimeFormat("es-CO", …)` sin
  `timeZone` mostraban las horas 5 h adelantadas. Se añadió `ZONA_HORARIA =
  "America/Bogota"` (UTC-5 fijo, sin horario de verano) en `src/lib/dominio.ts`
  y se fijó `timeZone: ZONA_HORARIA` en todos los formateadores que muestran
  hora (tablero de llamadas, `expediente` FORMATO_CITA, `operacion-72/acciones`
  FORMATO_VISITA, `eventos`, `eventos/[id]`, `mi-proceso` FECHA_LARGA, `registro`
  FORMATO_VISITA). Además el filtro por día del tablero de llamadas
  (`rangoDesdeParametros` en `src/lib/llamadas.ts`) interpretaba el día en UTC;
  ahora fija el offset `-05:00` en los límites (`T00:00:00-05:00` /
  `T23:59:59.999-05:00`) para que el día seleccionado cubra el día completo en
  Colombia. **Regla:** todo formateo de fecha/hora nuevo debe usar
  `timeZone: ZONA_HORARIA`. Ojo: NO aplicar la zona a campos de solo-fecha
  (p. ej. `birthDate`, guardados a medianoche UTC) porque se correrían un día
  hacia atrás — solo a marcas de tiempo reales.

- **2026-09-01** — Registros por webhook fallaban con **500** («No se pudo guardar
  el registro»). Causa: la transacción de alta (~12 consultas) superaba el
  **timeout por defecto de 5 s de Prisma** con la latencia del pooler → P2028 →
  rollback. El registro tardaba ~7 s. Fix: `$transaction(..., { timeout: 30_000,
  maxWait: 15_000 })` en `registro-nuevo/route.ts` y `registro-interno/acciones.ts`.
  Palanca de fondo: **Hyperdrive** (bajar latencia). Nota: los 9 registros del 30
  ago nunca entraron porque el webhook estaba caído esos días.

- **2026-09-01** — Tablero de llamadas VIVO y probado punta a punta (webhook →
  `call_log` → asignado a la persona por `highlevel_user_id`). Llegaron llamadas
  reales pero con valores `{{}}` (merge-tags sin resolver: en el workflow de
  HighLevel las Custom Data tenían la clave pero el valor del `{{ }}` vacío). Se
  blindó el parser (`texto()` en `llamada-highlevel.ts`) para ignorar `{{...}}`.
  **Acción del usuario pendiente:** mapear bien los valores en el paso Webhook de
  HighLevel (seleccionar el campo real en cada `{{ }}`).
- **2026-09-01** — Deploy del tablero por fin activo (Deploy command = `npx wrangler
  deploy`, PR #31). Bug encontrado: el webhook `/api/integraciones/highlevel/llamada`
  no estaba en `RUTAS_PUBLICAS` de `src/lib/supabase/sesion.ts`, así que el
  middleware lo redirigía a `/ingresar` (307). Se agregó a la lista. **Recordatorio:
  todo webhook público nuevo debe añadirse a `RUTAS_PUBLICAS`.**
- **2026-09-01** — Creado este `CLAUDE.md` (memoria persistente). Añadido tablero
  de llamadas (PR #28/#29) y arreglo de despliegue vía `wrangler.jsonc build.command`
  (PR #30). Enlazado `highlevel_user_id` de Nora. Pendiente: activar el deploy
  (Deploy command = `npx wrangler deploy`) para que el tablero cargue.
