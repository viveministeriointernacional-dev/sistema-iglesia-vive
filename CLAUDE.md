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

## 3. Arquitectura y plataformas

| Pieza | Detalle |
|---|---|
| **Framework** | Next.js 16 (App Router, RSC, Server Actions), React 19, TypeScript, Tailwind 4 |
| **ORM** | Prisma 7 con `@prisma/adapter-pg` (PrismaPg). Cliente en `node_modules/@iglesia/prisma-client` (generado en postinstall). Enums = uniones de literales. |
| **Base de datos** | Supabase Postgres. **project_id = `cxtfftuexqmkktxumkfz`**, región `ca-central-1`. Plan **Paid**(ver nota). Conexión por Session pooler. Extensiones: `unaccent`, `pg_trgm` en `public`. |
| **Hosting** | Cloudflare Workers + OpenNext (`@opennextjs/cloudflare`). **account_id = `69e3fbf14345159222eaf8ff45a16bd9`**, worker **`sistema-iglesia-vive`**. Plan **Workers Paid ($5)** (confirmado por el usuario). |
| **Emails** | Resend (best-effort; no-op si faltan `RESEND_API_KEY` / `EMAIL_FROM`). |
| **CRM** | HighLevel (marca blanca **Nexus**, app.nexusia.com.co). **locationId = `TDMnYRth8ofWhJ86uJKb`**. |
| **Dominio público** | micasavive.com (formularios de registro alojados en HighLevel). |

## 4. Despliegue (leer antes de tocar deploy)

- **Git-connected Workers Builds**: al hacer **push/merge a `main`**, Cloudflare
  reconstruye y despliega solo (~5 min). No hay `migrate deploy` en el build.
- **Secretos** (env del worker): se toman **solo en el rebuild**. Cambiar un
  secreto en el panel NO afecta la versión viva hasta un nuevo build.
- **Configuración de build correcta** (Cloudflare → worker → Settings → Builds):
  - **Build command:** `npx opennextjs-cloudflare build` (genera `.open-next/worker.js`).
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
- Migraciones: crear el archivo en `prisma/migrations/` **y** aplicarla a Supabase
  con el MCP (`apply_migration`) — no hay paso automático de migración en deploy.

## 6. Integración HighLevel (webhooks)

- **Registro de personas:** `POST /api/integraciones/highlevel/registro-nuevo`.
  Header `x-iglesia-webhook-secret` = env `HIGHLEVEL_WEBHOOK_SECRET` (valor vive en
  Cloudflare, **no** en el repo). Workflow en HighLevel: «Se llenó Formulario
  Registro Nuevo» → paso Webhook.
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
- **La API de HighLevel está bloqueada por egress** en este entorno (host
  `services.leadconnectorhq.com` no permitido). No se puede jalar datos por API;
  el token PIT vive fuera del repo (scratchpad `.ghl-token`), nunca commitear.

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

- **Activación del deploy**: confirmar que el «Deploy command» del panel sea
  `npx wrangler deploy` (no `versions upload`) para que la versión se active.
- **Lentitud**: ya están en Paid (CPU no es el límite). Siguiente palanca =
  **Hyperdrive** (cachea el pool de conexiones a Supabase en el borde). Plantilla
  comentada en `wrangler.jsonc`.
- **Registros de HighLevel**: si dejan de entrar, revisar que el workflow de
  registro esté activo y enviando; algunos llegan y se marcan «duplicado» (409).
- Rotar el `HIGHLEVEL_WEBHOOK_SECRET` (estuvo expuesto en capturas).

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
