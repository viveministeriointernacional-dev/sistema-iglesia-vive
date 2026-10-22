# CLAUDE.md — Cerebro del proyecto (memoria persistente)

> Este archivo se carga automáticamente al inicio de cada sesión de Claude Code.
> Es la **memoria del proyecto**: contexto, decisiones y estado que NO se deben
> volver a preguntar. **Nunca escribas secretos aquí** (tokens, contraseñas,
> claves) — solo dónde viven.
>
> ## ⚠️ La memoria son DOS piezas. Esto es solo la primera.
>
> | | Qué es | Cuándo se lee |
> |---|---|---|
> | **`CLAUDE.md`** (este archivo) | El contexto que hace falta **siempre**: qué es el proyecto, cómo trabaja el usuario, arquitectura, despliegue, reglas duras, **las trampas que ya costaron caro** (§12) y el **índice** de todo lo hecho (§13). | **Entero, en cada sesión.** |
> | **`docs/bitacora/<año>-<mes>.md`** | El **historial completo**: 99 entradas con qué se hizo, por qué, qué se midió y con qué se tropezó. | **Solo cuando hace falta**, buscando. |
>
> **Se partió el 12-oct-2026 y el motivo está medido:** el archivo pesaba
> **303 KB** y el **92 %** era bitácora. Cada sesión arrancaba gastando ~85 000
> tokens en historia que casi nunca se necesitaba ese día, y la ventana de
> contexto se agotaba a media tarea.
>
> **⚠️ LO QUE ESTO EXIGE A CAMBIO, y es la contrapartida honesta: lo que no está
> cargado no se recuerda, hay que BUSCARLO.** Antes de dar algo por nuevo, por
> no hecho o por no decidido — una pantalla, un campo, una regla de negocio, un
> error que suena conocido — **buscar primero**:
>
> ```
> grep -n "<palabra>" docs/bitacora/*.md
> sed -n '<desde>,<hasta>p' docs/bitacora/<mes>.md     # la entrada entera
> ```
>
> El §13 lista las 99 entradas en una línea cada una, para saber qué existe.
>
> **Al terminar un trabajo importante** se escribe la entrada nueva **arriba del
> archivo del mes**, su renglón **arriba del §13**, y —si de ahí sale una regla
> general— **también en §12**.

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
  - **Deploy command:** ⚠️ **CORREGIDO EL 12-OCT-2026: es
    `opennextjs-cloudflare deploy`, NO `npx wrangler deploy`.** Este archivo dijo
    lo segundo durante semanas y **era falso**; se vio en el rastro de un build
    fallido (`at async deployCommand (@opennextjs/cloudflare/dist/cli/commands/
    deploy.js)`). **La diferencia importa de verdad:** `wrangler deploy` NO llama
    a `getPlatformProxy()` y `opennextjs-cloudflare deploy` **SÍ**, así que el
    despliegue monta la emulación local de los bindings y puede fallar por cosas
    que al build no le pasan — exactamente lo de Hyperdrive del 12-oct. Con la
    suposición vieja ese fallo era imposible de prever.
    ⚠️ `npx wrangler versions upload` **sube pero NO activa** → el sitio no cambia.
  - **⚠️ EL BUILD Y EL DESPLIEGUE SON DOS ETAPAS, Y FALLAN POR SEPARADO.** En el
    panel se ven como **Building** y **Deploying** con su tiempo cada una. Un
    «Building ✅ 23 s · Deploying ❌ 13 s» NO es un error de compilación: es que
    el worker se construyó bien y no se pudo activar. **Mirar cuál de las dos
    está en rojo antes de buscar la causa**, o se pierde media hora leyendo el
    log equivocado.
  - **⚠️ Y UN BUILD DE RAMA EN VERDE NO PRUEBA QUE EL DE `main` VAYA A PASAR**,
    porque la rama **no ejecuta el Deploy command**. El 12-oct el mismo commit
    salió **Ready** en la rama y **Failed** en `main`: esa discrepancia es la
    pista de que lo que falla es el despliegue, no el código.
  - `wrangler.jsonc` ya incluye `build.command = npx opennextjs-cloudflare build`
    como respaldo, para que el worker se compile aunque el «Build command» del
    panel esté vacío (eso rompió despliegues en ago-2026).
- **Verificar si un deploy ya está vivo** (desde Claude, sin panel):
  `curl -s -o /dev/null -w "%{http_code}" -X POST <URL_worker>/api/integraciones/highlevel/llamada -H 'content-type: application/json' -d '{}'`
  → **401** = desplegado (ruta existe, pide secreto). **307** = aún NO desplegado
  (redirige a `/ingresar`; la ruta no está en el bundle).
- URL del worker: `https://sistema-iglesia-vive.viveministeriointernacional.workers.dev`
- **⚠️ HAY UN SEGUNDO WORKER EN LA CUENTA, Y NO ES BASURA: `recordatorio-casas-de-fe`.**
  Veinte líneas escritas a mano en el editor del panel (no sale de este repo, no
  tiene build ni despliegue automático). Su único oficio es tener los **Cron
  Triggers** que el worker principal no puede tener (§12.2) y llamar al webhook
  `POST /api/recordatorios/casas-de-fe`:
  - `0 11 * * *` → 6:00 a. m. Colombia → `?tipo=DIA`
  - `0 0 * * *` → 7:00 p. m. Colombia → `?tipo=NOCHE_ANTES`
  - secreto del worker: variable **`SECRETO`** (el valor va también en el worker
    principal como **`RECORDATORIOS_SECRET`**; los dos tienen que coincidir).
  - **Cómo comprobar que está vivo sin entrar al editor:** pedirle su URL
    (`https://recordatorio-casas-de-fe.viveministeriointernacional.workers.dev`)
    → **404 «Este worker solo trabaja por horario.»** = su código está puesto ·
    **200 «Hello World!»** = se quedó en la plantilla y **no dispara nada**.
  - **Si alguien lo borra, los recordatorios se apagan en silencio.** No tiene
    nada que avise.
- **Secretos del worker principal que no están en ningún otro sitio:**
  `HIGHLEVEL_WEBHOOK_SECRET` (los tres webhooks del CRM) y **`RECORDATORIOS_SECRET`**
  (solo el recordatorio de Casas de Fe). ⚠️ **Cloudflare NO deja volver a leer un
  secreto guardado.** El de HighLevel solo se puede releer entrando a un paso
  Webhook de un flujo del CRM; el de recordatorios no se puede releer en ninguna
  parte, así que si se pierde **se cambia en los dos workers a la vez**.
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
- **El dueño del contacto (consolidador) viaja en DOS momentos**, y hasta el
  20-oct solo viajaba en uno: al **cambiarlo** (`exportarConsolidador`, desde
  `consolidador.ts`) y, desde ese día, también al **crear** el contacto
  (`exportarContactoNuevo`). ⚠️ Al crear **se pregunta primero** quién es el
  dueño (`consultarDuenoDelContacto`) y **solo se escribe si está vacío**: el
  `upsert` puede devolver un contacto que ya existía con dueño puesto a mano, y
  eso manda sobre nuestra regla automática.
  ⚠️ **Y una persona SIN teléfono y SIN correo no se puede exportar**:
  `/contacts/upsert` la rechaza, el error se traga (best-effort) y **queda sin
  enlace**, así que ningún dato suyo sincroniza nunca. Pasó con Saray Barreiro
  el 20-oct, y era la única de 154.
- **⚠️ EL WHATSAPP DE ESTE CRM NO MANDA TEXTO LIBRE: SOLO PLANTILLAS APROBADAS
  POR META.** Es la regla que gobierna todo lo de abajo y la descubrimos tarde
  (22-oct), con el recordatorio ya construido. La acción «WhatsApp» de un flujo
  pide una **plantilla** obligatoria, y la plantilla lleva el texto fijo con
  huecos `{{1}}`, `{{2}}`… que se mapean a campos del contacto.
  **Lo que de verdad limita el diseño:** el **valor** de una variable **no puede
  llevar saltos de línea**, ni tabuladores, ni cuatro espacios seguidos. La
  plantilla sí puede tener los párrafos que quiera — la restricción es sobre lo
  que se mete en el hueco. Así que **el mensaje se parte en dos**: el saludo y el
  cierre viven en la plantilla, y del sistema solo viaja el centro, **en una sola
  línea**.
  Las plantillas viven en **Configuración → WhatsApp → Plantillas** (68 el
  22-oct, casi todas «Activo»). La del recordatorio es `recordatorio_casa_de_fe`.
- **El recordatorio de Casas de Fe, por WhatsApp**: el sistema escribe **el
  centro del mensaje, en UNA línea** (`variableDeWhatsApp`, que termina
  aplanando cualquier espacio en blanco para que no se cuele un salto) en el
  campo **«Recordatorio de casa de fe»**, y mueve la etiqueta
  **`casa-de-fe-recordatorio`**, que es la que dispara el flujo. El campo se busca **por nombre** con `buscarIdsDeCampos`, así que no
  hay ningún id que copiar.
  ⚠️ **La etiqueta se QUITA y se vuelve a poner.** El workflow escucha «se
  añadió esta etiqueta»; del segundo día en adelante ya está puesta, añadirla
  otra vez no es un cambio y **el mensaje no sale**. Sin eso el recordatorio
  funciona un día y nunca más.
  ⚠️ **Y si el campo no existe, no se toca la etiqueta**: aquí el campo **es**
  el mensaje, así que disparar sin él manda un WhatsApp vacío. (El acceso al
  taller hace lo contrario a propósito: ahí falta un dato, no el mensaje.)
- **⚠️ EL WHATSAPP DEL ACCESO AL TALLER NUNCA HA FUNCIONADO, pese a lo que dice
  la bitácora del 2-oct.** Su plantilla, `codigo_ingreso_escuela`, está
  **Rechazada** por Meta — y entretanto el sistema registró
  **`casa_de_fe.acceso_enviado` 56 veces** entre el 2 y el 21-oct: escribió los
  campos, movió la etiqueta, y Meta no mandó nada. Solo salieron los correos.
  **Nadie se enteró en tres semanas porque el sistema no puede saber qué hace el
  CRM con la etiqueta una vez puesta.** HighLevel no enseña el motivo del
  rechazo; las dos sospechas, sin confirmar, son que un **código de 6 dígitos**
  obliga a la categoría *Authentication* (está como *Marketing*) y que el texto
  promete «el botón de aquí abajo» **sin que la plantilla tenga botón**.
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
- **GI · Generación Imparable**: permisos `can_lead_gi` / `coordinates_gi`,
  reparto de jóvenes (`gi_assignment`), devocional diario (`gi_devotional`) y
  observaciones (`gi_note`). Pantallas `/gi` y `/gi/[id]`. **GI no cambia la
  línea de mentoría de nadie**, y solo marca el líder de GI.
- **La red dice quién reúne**: el árbol de «Mi red» enseña en cada renglón los
  grupos que esa persona lleva, a cuántos reúne y si es líder de GI, **sin
  cambiar de quién cuelga nadie**.
- **Tablero de llamadas** (solo ADMIN): tabla `call_log`, webhook, y
  `/administracion/llamadas` (global + por persona + historial individual con «A
  quién se llamó»). Libs: `src/lib/llamadas.ts`, `src/lib/llamada-highlevel.ts`.
- **Operación 72 tiene pestaña «Histórico»** (17-oct, solo ADMIN):
  `/operacion-72/historico` con la línea de movimientos del recorrido, **siete
  paneles** (uno por salto, **cada uno con su escala**, y el tope escrito
  porque es lo único que impide comparar alturas entre paneles), la gráfica de
  las tres puertas de salida y la tabla. Rango libre y grano Día / Semana /
  Mes; abre con **las últimas 8 semanas** (el defecto del informe, «esta
  semana», dejaría un solo tramo). Cada punto abre la ventana de detalle. Libs:
  `src/lib/historico-op72.ts` (+ catálogo). **Y «fuera del recorrido» es una
  lista, no una frase** (20-oct): los saltos que no son ninguno de los siete
  paneles van uno por uno y abribles, repartidos en **«Fueron por otro camino»**
  y **«No se sabe de qué lista venían»** — eran el **28 %** de lo medido y los
  dos grupos significan cosas distintas. ⚠️ El primero **NO se llama «se
  saltaron un paso»**, y la razón está medida: **31 de sus 46 son el atajo «ya
  lleva proceso»**, que salta la visita a propósito (§12.6). **Las salidas van aparte de la
  línea a propósito**: las bajas son limpiezas puntuales (198 de 211 en ocho
  días) y sumadas aplastarían la medida del trabajo semanal.
- **Recordatorio de las Casas de Fe** (21-oct): correo + WhatsApp al **líder**,
  a sus **encargados** y al **mentor de la línea**, con las casas que se reúnen
  ese día. Libs: `src/lib/recordatorio-casas-de-fe.ts` (+ catálogo), webhook
  `POST /api/recordatorios/casas-de-fe`. **Lo dispara un WORKER APARTE de
  Cloudflare, `recordatorio-casas-de-fe`**, de 20 líneas, con dos Cron Triggers:
  `0 11 * * *` (6:00 a. m. Colombia → `tipo=DIA`) y `0 0 * * *` (7:00 p. m. →
  `tipo=NOCHE_ANTES`). ⚠️ **No es un cron del worker principal** porque OpenNext
  solo exporta `fetch` (§12.2), y ⚠️ **no es un workflow de HighLevel**, que era
  el plan del 21-oct: **esa cuenta no tiene NINGÚN activador por horario**. Usa
  su propio secreto `RECORDATORIOS_SECRET` (§4). **Cuatro reglas que
  lo sostienen:** un aviso por **persona y día**, no por casa (el líder que más
  lleva tiene 7 casas y el mentor con más línea recibiría 19 avisos semanales);
  **si la casa se reúne antes de las 9:00 a. m. el aviso sale la noche
  anterior** — eran tres casas el 21-oct (06:00, 07:00 y 08:34) y al día
  siguiente ya eran **seis**, así que la regla vale más de lo que parecía; es
  **idempotente** por el índice único de `faith_house_reminder` (usuario · día ·
  tipo), así que el disparo se puede reintentar; y **las direcciones van solo
  al correo**. El WhatsApp sale por **etiqueta + campo personalizado**, igual
  que el acceso al taller.
- **El tablero de Operación 72 dice cuánto se movió** (16-oct): encima de cada
  contador de «Ver solo» va un **⊕ con cuántas entraron** a esa lista en el
  periodo, y al final un **⊖ rojo con cuántas salieron** de Operación 72; los
  dos abren la ventana de detalle. El tablero tiene **selector de periodo**
  (Hoy · Esta semana · Semana pasada · Este mes), de `atajosDelInforme`, así que
  la semana es **de viernes a viernes** como en el informe. Lib:
  `src/lib/movimiento-op72.ts` (+ su catálogo). **Tres reglas que lo sostienen:**
  un giro en el sitio (volver a llamar y que no conteste) **no es una entrada**;
  el ⊖ son **tres puertas** (entregada / asistente / baja) y la ventana las
  separa; y la consulta **no recorre `audit_log`** (21 ms en vez de 115) porque
  entra por `created_at` y luego por `(entity_type, entity_id)`.
- **El informe se abre al clic, y Operación 72 tiene histórico** (16-oct): los
  **seis recuadros** (personas nuevas, llamadas, visitas, entregadas, hitos,
  bajas) abren una ventana con quiénes fueron, el día, la hora y quién lo hizo;
  y el bloque **«Cómo se movió Operación 72»** enseña los saltos de columna del
  periodo, cada uno abrible. **El desglose no se carga hasta que se hace clic.**
  Libs: `src/lib/informe-detalle.ts` y `informe-detalle-catalogo.ts`.
  El histórico se **deriva de `audit_log`** (no hay tabla de historial) y por eso
  **no llega antes del 15-ago-2026**; ojo con la trampa de los dos
  `entity_type` (§12.4).
  **⚠️ «VISITAS» cuenta las CUMPLIDAS** (`result = VISITA_CUMPLIDA`), no las
  acordadas, y el pie dice cuántas se acordaron (16-oct). Lo mismo el embudo, la
  gráfica por día y la tabla de consolidadores; **`medirBrecha` es la excepción
  a propósito**, porque su oficio es mirar las acordadas.

## 8. Operaciones de datos ya hechas

- Fusionado: **Nora Bonilla** (consolidadora, `app_user`) ↔ **Noraima Coa Barrios**
  (persona/expediente). Nora tiene `highlevel_user_id = t8HuZDPMHztakrzlFlJQ`.
- Fusionado: **Carlos Andrés** (persona/expediente) ↔ **Carlos Zambrano** (cuenta
  consolidadora con 11 discípulos; `highlevel_user_id = 1ecXv5QNMEvAOnlb5nRC`).
  Sobrevive la cuenta de Zambrano con el expediente enganchado.
- Fusionado (7-sep-2026): **Emelin Parra** (ficha del 26-ago, con su cuenta,
  su contacto de HighLevel y 18 personas a cargo) ↔ **Emelin Parra Guerrón**
  (ficha creada el 5-sep por el formulario de liderazgo). Sobrevive la primera,
  con los datos que ella escribió (celular **+573116665492**, correo
  `emelindparra@gmail.com`, dirección, apellidos), la etapa **ENTRENAR** y el
  mentor **Juliana Facundo** que se decidieron el 7-sep, y los **9 hitos CON
  FECHA** (los 8 de la ficha nueva venían sin fecha: gana el dato más preciso).
  Su declaración de liderazgo, ya resuelta, quedó enganchada a la ficha real.
  **Ojo:** esos renglones se habían confirmado sobre la ficha duplicada, que no
  tenía cuenta, así que no habían aplicado ningún permiso; se comprobó que los
  permisos de su cuenta ya coincidían con lo decidido. El celular viejo
  **+573209724604 no quedó guardado** (0 llamadas en `call_log`; el nuevo tiene 7).
- Fusionados (7-sep-2026) **otros tres duplicados creados por el formulario de
  liderazgo el 5-sep**, con la regla del usuario: **mandan los datos de la
  última actualización**. Sobrevive siempre la ficha vieja (es la que tiene la
  CUENTA y el contacto de HighLevel):
  **Jairo Esquivel → Jairo Esquibel Narvaez** (MENTOR), **Lucero Artunduaga →
  Lucero Artunduaga Navia** (PASTOR) y **María José → María José Rojas Puentes**
  (LÍDER DE ALPHA). En los tres se tomaron apellidos, nacimiento, celular y
  dirección del 5-sep; las declaraciones quedaron enganchadas al expediente
  real; y el mentor asignado sobre el duplicado pasó a la ficha buena con el
  anterior cerrado (solo aplicaba a María José: Paola Viveros).
  **Dos reglas que hay que repetir en cualquier fusión futura:**
  1. **El hito REGISTRO NO se pisa con el del duplicado.** Su fecha sería la del
     día en que se creó el duplicado. A María José le habría cambiado su
     registro real de **2025-07-03** por el 5-sep-2026.
  2. **Un campo en blanco no borra lo que ya estaba** (`coalesce(nullif(...))`).
     Gracias a eso María José conservó su celular anterior como WhatsApp.
  Error cometido y corregido en el acto: actualicé apellidos pero no el nombre,
  y quedó «María Rojas Puentes» — le faltaba el «José», que vivía en
  `first_name`. **Al fusionar, revisar nombre Y apellidos, no solo apellidos.**
- Fusionado (10-sep-2026): **Yuli Perdomo** (ficha del 3-sep, con su CUENTA de
  MENTOR, su mentoría con Jairo Esquivel, su discípula Sandra Barón y sus 2
  cambios de fase hasta MULTIPLICAR) ↔ **Yuli Katherine Hernandez Perdomo**
  (ficha del 8-sep, creada por el formulario de liderazgo). Sobrevive la
  primera; quedó con el nombre completo, el correo `yhernandez17@udi.edu.co`,
  nacimiento 1993-03-10 y dirección que ella escribió el 8-sep.
  **⚠️ ESTE CASO INVIERTE DOS COSAS QUE PARECÍAN FIJAS:**
  1. **El contacto de HighLevel estaba en la ficha NUEVA, no en la vieja**
     (`vJzy5tRukmAn7gSq1rVF`, con 4 llamadas en `call_log`). En las 4 fusiones
     anteriores siempre venía con la ficha vieja. **Hay que mirarlo cada vez**,
     no darlo por sentado, o el CRM se queda apuntando a una ficha borrada.
  2. **Las fechas buenas de los hitos estaban en la ficha NUEVA.** La vieja
     tenía **los 12 hitos con fecha 2026-09-03**, que es el día en que se creó
     la ficha — o sea, la fecha de nada. La nueva traía las que ella misma
     declaró: escuela 2022-08, encuentro y bautismo 2022-10, servicio 2023-04,
     Casa de Fe 2023-08, Alpha 2026-06. **Se tomaron esas 6.**
     Se respetaron las dos reglas de siempre: **REGISTRO no se pisa** (queda
     3-sep, el real) y **FOCUS_DAY tampoco** (en la nueva venía sin fecha, y un
     blanco no borra).
  **⚠️ PENDIENTE DEL USUARIO — conflicto real, NO lo resolví yo:** el 10-sep
  «Administración Iglesia Vive» resolvió la declaración sobre la ficha
  duplicada y **DESCARTÓ el hito GRADUACIÓN**, pero la ficha vieja lo tiene
  marcado como conseguido (con la fecha falsa del 3-sep). Se **conservó** el
  hito: borrar un logro es destructivo y las dos decisiones son humanas. Hay
  que preguntarle si Yuli se graduó de la Escuela o no.
  **Y el mismo tropiezo de Emelin, otra vez:** esas 9 confirmaciones se
  aplicaron sobre la ficha duplicada, **que no tenía cuenta**, así que
  **ningún permiso llegó a aplicarse**. Su cuenta real quedó como estaba
  (MENTOR, activa, líder de Alpha y de Casa de Fe).
  Método: todo en **una sola transacción**, probada antes con `BEGIN … ROLLBACK`
  en la misma llamada. Verificado después: **1 sola ficha** con ese correo y ese
  celular, 12 hitos, 2 declaraciones, 1 contacto de CRM, 1 discípula.
- **Saray Barreiro (20-oct):** consolidadora puesta a mano en **Johanna
  Quintero Correa** porque **manda HighLevel** (decisión del usuario). Auditado
  con `origen: "highlevel"`, que es lo que impide devolver el eco al CRM.
  ⚠️ **Sigue SIN teléfono ni correo**, así que `/contacts/upsert` la rechaza y
  **no tiene enlace al CRM**: nada suyo sincroniza, y nadie puede llamarla.
  Su contacto en HighLevel existe (`syOqdckurzAbVfkJWkIv`), pero el webhook lo
  rechazó como duplicado de ella misma sin guardar el enlace.
- **Maricela Rojas (20-oct):** creada **a mano por SQL** porque su registro por
  el formulario **se lo absorbió la ficha de Celina Osorio Rojas**, que tiene
  el mismo teléfono (**312 3444054**). Decisión del usuario: **son dos personas
  distintas** — la evidencia es la llamada del 5-oct, donde quien contestó ese
  número **negó ser Celina**. Se imitaron las **8 escrituras** de
  `crearRegistroEnTransaccion` (incluido el **código de miembro**, que es fácil
  de olvidar) más el traslado del contacto `Kbxw0HrXPyU9i26i7ihc`, que era de
  ella y colgaba de Celina.
  ⚠️ **PENDIENTE DEL USUARIO:** ese teléfono sigue en **las dos** fichas, así
  que el próximo registro con él volverá a engancharse mal; y la Op72 de Celina
  sigue en **CONTACTADA por esa misma llamada**, así que puede que a Celina
  **nunca se la haya contactado**.
- **NO fusionar (decisión del usuario, 7-sep):** **Luna Sandoval / Lina Mercedes
  Jovel** (`linitajovel@gmail.com`) y **Nini Guerrón / Dilan Cadena**
  (`ninijguerrons@gmail.com`) **son personas distintas que comparten correo** —
  se mantienen separadas. Igual **Miguel Ángel Linares / Anny Carolina Rivera**
  (`annyrivera021@gmail.com`). Son los 3 correos repetidos que quedan en la base
  y están bien así.
- Revisados/fusionados duplicados en toda la base (agosto 2026).
- Import masivo histórico de contactos hecho vía webhook (256 en ago-2026).

## 9. Pendientes / temas abiertos

- **⚠️ HYPERDRIVE: YA ESTÁ VIVO (12-oct-2026).** Lo que queda escrito aquí es
  **la configuración, para no volver a decidirla**:
  **id `67fbd6377dda4e9a81ad95471a6e4708`** · host
  `aws-0-ca-central-1.pooler.supabase.com` (**Session pooler**, puerto **5432**;
  la conexión directa no resuelve a IPv4 en el plan FREE) · usuario
  `postgres.cxtfftuexqmkktxumkfz` · **caché DESACTIVADA** · **Maximum
  connections 20**.
  **⚠️ Los dos valores del panel que vinieron MAL de fábrica y hay que volver a
  mirar si alguien recrea la configuración:**
  1. **«Enable caching» viene MARCADA** (Max Age 60 s · SWR 15 s). Con eso el
     equipo vería datos de hasta un minuto antes: registra una llamada, la
     tarjeta no se mueve, la registra otra vez — el fallo del 11-sep, y **no
     parecería caché, parecería que el sistema no guarda**. De Hyperdrive
     queremos **el pool, no la caché**.
  2. **«Maximum connections» viene en 60, y la base no da para eso.** Medido:
     `max_connections` = 60, menos 3 reservadas al superusuario, menos ~12 en
     uso por los servicios de Supabase → **~45 reales**. Y como va por el
     Session pooler, **cada conexión de Hyperdrive ocupa una conexión real de
     Postgres**. Pedir 60 es el camino al «max clients reached» (error 1102) por
     el que existe la regla de una conexión por petición (§7).
- **Lentitud**: con Hyperdrive puesto, el viaje a la base pasó de **236 a
  ~80 ms de mínimo y de 258 a ~100 ms de mediana** — unas **3 veces** más
  rápido (`docs/bitacora/2026-10.md`, 12-oct: lleva la advertencia de
  cómo medirlo sin engañarse).
  **Supabase sigue en FREE**, así que la palanca que queda es subirlo a Pro.
- **Bajar los viajes a la base de `/taller/mis`**, que sigue siendo la pantalla
  con más consultas: hace **cuatro viajes EN FILA** (`learnerPorToken`, luego
  `cargarMisTalleres`, `cargarMiPrematrimonial` y `resumenDelCuestionario`, que
  con `PrismaPg max:1` no corren en paralelo aunque vayan en un `Promise.all`).
  Se pueden bajar a dos. Se aplazó a propósito para medir Hyperdrive solo; **ya
  está medido, así que esto se puede hacer cuando se quiera**.
- **Registros de HighLevel**: si dejan de entrar, revisar que el workflow de
  registro esté activo y enviando; algunos llegan y se marcan «duplicado» (409).
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

## 12. Reglas aprendidas (las trampas que ya costaron caro)

> Cada renglón de aquí **ya ocurrió** y está contado entero en la bitácora
> (§13). Esto es el resumen que debe estar **siempre cargado**: si una de estas
> se olvida, se repite el error — y varias no las ve `tsc`, ni `eslint`, ni el
> build.

### 12.1 Fechas y zonas horarias (siete trampas, todas reales)

- **Al PINTAR**: `momentoCorto` / `momentoLargo` para **marcas de tiempo**
  (llevan hora Colombia) y `diaCorto` / `diaLargo` para **fechas sueltas**
  (sin zona). **Cómo se decide sin pensarlo: si la columna lleva `@db.Date`, va
  con `dia…`; si no, con `momento…`.** Ponerle zona a una fecha suelta la corre
  **un día atrás**; no ponérsela a una marca real adelanta un día **todo lo de
  después de las 7 p. m.**
- **⚠️ Nunca `AT TIME ZONE 'America/Bogota'` a secas** sobre una columna
  `timestamp without time zone` del modelo: **SUMA 5 h** en vez de restarlas.
  Hay que anclar primero: `x AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota'`.
- **⚠️ Pero `auth.users` y `app_migration.applied_at` son `timestamptz`**, y
  ahí basta **UN SOLO** `at time zone 'America/Bogota'`. Aplicarles el doble
  suma 5 h. **Cuando dos fechas de la misma base se contradicen (algo creado
  antes que su propia tabla), sospechar del TIPO de la columna antes que de los
  datos.**
- **Nunca `new Date(<lo que venga de un datetime-local>)`**: ese campo manda la
  hora **sin zona** y el servidor corre en UTC → cinco horas de menos. Se lee
  con **`momentoDesdeCampo`** y se pinta con **`momentoParaCampo`**: son un par,
  y la prueba que importa es la de **ida y vuelta**.
- **Para probar un rango a mano** contra esas columnas, escribir los límites
  como **instantes UTC** (`timestamp '2026-09-07 05:00:00'` = medianoche
  colombiana), **no** como texto con `-05:00` — Postgres descarta ese offset.
- **Las fechas civiles van como texto «AAAA-MM-DD» de punta a punta**, nunca
  como `Date`. Y una hora que se repite («los miércoles a las 7 p. m.») se
  guarda como **texto «HH:mm»**: no es un instante.
- En el `.ics`, la hora va con **`TZID` y su `VTIMEZONE`**, nunca en UTC.

### 12.2 Despliegue: cómo se sabe que algo está VIVO

- **Build y Deploy son dos etapas y fallan por separado.** El panel las muestra
  como *Building* y *Deploying* con su tiempo. Mirar **cuál de las dos está en
  rojo** antes de buscar la causa.
- **⚠️ Un build de rama en verde NO prueba que el de `main` vaya a pasar**: la
  rama **no ejecuta el Deploy command**. El mismo commit puede salir *Ready* en
  la rama y *Failed* en `main` — y esa discrepancia es **la pista** de que lo
  que falla es el despliegue, no el código.
- **«✅ Deployment successful» en un PR NO significa fusionado ni desplegado**:
  es el build de la **rama**, con su vista previa (que además apunta a la
  **base de datos real**).
- **Comprobar un merge, las dos mitades:**
  `git log --oneline origin/main..origin/<rama>` **vacío** y los **padres del
  merge** (`git log --format='%h %p'`) iguales a la **cabeza de la rama**. Si no,
  GitHub fusionó una cabeza vieja — **ha pasado CUATRO veces**.
- **⚠️ Tras un merge reciente, el primer `git fetch` puede traer una copia en
  CACHÉ** y hacer creer que `main` no se movió. Pasó el 14-oct: dije que el
  #116 no estaba fusionado y GitHub lo daba por `merged: true`. **Repetir el
  fetch antes de decirle a nadie que su merge no entró.**
- **La huella del despliegue**, según qué se tocó: si es trabajo de **servidor**,
  la **hoja de estilos** (nombre y bytes exactos); si es de **cliente**, el
  chunk de JS; si hay **ruta nueva**, pedirla.
- **⚠️ Una huella positiva necesita su CONTROL.** Un 200 solo dice «esto
  responde»; el par **200/404 sobre rutas hermanas** dice «responde PORQUE el
  código nuevo está». Y la huella del CSS **solo vale si se comprueba ANTES que
  el archivo nuevo NO existe (404) y que el viejo tiene OTRO tamaño** — si
  coinciden, no prueba nada (falso positivo del 3-oct).
- **Comparar nombres de paquete para demostrar que algo NO está desplegado da
  falsos negativos.** Sirve para probar que SÍ, no que no.
- **⚠️ UN CHUNK DE PÁGINA NO SIRVE COMO HUELLA, NI PARA SÍ NI PARA NO.**
  Pasó **dos veces** (#114 el 14-oct, #118 el 15-oct): el chunk que yo vigilaba
  daba **404 con el código demostrablemente vivo** — la segunda vez
  comprobado contra el usuario, que estaba viendo la pantalla nueva en su
  navegador mientras mi `curl` decía 404. Que 10 de 11 chunks de `/ingresar`
  coincidan con el build local **no valida un chunk concreto**: los de página
  se nombran distinto en Cloudflare.
- **⚠️ EL CSS SÍ VALE COMO HUELLA, PERO HAY QUE RECONSTRUIR JUSTO ANTES DE
  COMPARAR. La trampa es un `.open-next` VIEJO.** El 16-oct (#120) dije «no ha
  desplegado» porque producción servía 66 646 bytes y mi build local daba
  66 547, con otro hash. **Era falso, y la causa fui yo:** ese `.open-next` se
  había generado **antes de mi última edición** (el arreglo del `<dialog>`, que
  añadió `mx-0` y movió el CSS), así que el archivo que yo vigilaba
  correspondía a un código que nunca llegó a existir en `main`.
  **Comprobado después por `sha256`: el CSS de producción y el de mi build
  local son EL MISMO ARCHIVO, byte a byte.** El build de Cloudflare **sí**
  reproduce el local. Así que la regla es: **`npm run cf:build` y acto seguido
  comparar**; si entre el build y la comparación se editó algo, la huella no
  vale.
  Y el control honesto para saber si **hay** huella: si el CSS de tu build
  (ya reconstruido) **es idéntico** al de producción, ese trabajo **no cambia
  el CSS** y por esta vía no hay nada que comprobar — es el caso de un cambio
  de solo servidor, textos y lógica (#123).
- **✅ LA HUELLA QUE SÍ FUNCIONA: BUSCAR DENTRO DEL CSS DE PRODUCCIÓN UN LITERAL
  QUE SOLO PUEDA VENIR DEL CÓDIGO NUEVO.** No depende del hash ni del tamaño.
  La receta, con su control, en tres pasos:
  1. Elegir clases arbitrarias del trabajo nuevo (`max-h-[88vh]`,
     `rounded-t-[20px]`, `min-h-[180px]`…).
  2. **Comprobar con `git grep -- "<literal>" <commit-anterior> -- 'src/*'` que
     NO existían antes.** Sin este paso la prueba no vale: el 16-oct, de cinco
     literales, `w-[42px]` ya estaba en otra pantalla y había que descartarlo.
  3. Descargar el CSS que referencia el HTML y buscarlos dentro. Si están,
     **el código está vivo**.
  ⚠️ **Y NO SERVIRSE DE PATRONES QUE TAILWIND GENERA SIEMPRE**: `::backdrop`
  está en el *reset*, y los nombres de los tokens del `@theme`
  (`ambar-barra`, `verde-500`…) salen como variables **aunque nadie use la
  clase**. El 16-oct esos cuatro patrones dieron «1 y 1» y parecían confirmar;
  no probaban nada.
- **⚠️ PARA UNA PANTALLA INTERNA QUE NO PRODUCE NI UNA CLASE NUEVA sí que no
  hay huella posible desde fuera.** El middleware da 307 a todo sin sesión, así
  que no queda nada que pedir. **La prueba es pedirle al usuario que abra la
  pantalla** — y antes, comprobar en la base que esa persona cumple las
  condiciones para que la sección le salga, para que el «no la veo» signifique
  algo. Es lo que se hizo con el #118 y funcionó a la primera.
  **Pero si la pantalla trae clases nuevas, SÍ hay huella**: la de buscar el
  literal dentro del CSS, de arriba. Es el caso del #120.
- **⚠️ SI UN MERGE NO DESPLIEGA EN ~15 MINUTOS, NO ES EL CÓDIGO: PEDIRLE AL
  USUARIO QUE REFRESQUE «Deployments» Y LE DÉ `Retry build`.** Los builds de
  Cloudflare **se atascan en cola sin dar ninguna señal de error**: el 14-oct
  tres merges seguidos (#114, #115, #116) pasaron **~20 horas** sin desplegar
  nada, y el Retry lo resolvió **en dos minutos**. Antes de molestarle,
  descartar el repositorio con `wrangler deploy --dry-run` y una llamada a
  `getPlatformProxy()`, que es lo que ejecuta el Deploy command.
- **⚠️ NO HAY CRONS: EL WORKER QUE GENERA OPENNEXT SOLO EXPORTA `fetch`.**
  Comprobado en `.open-next/worker.js` (21-oct): `export default { async fetch(…)`
  y nada más. Un **Cron Trigger de Cloudflare se podría configurar y no tendría
  nada que lo atendiera**, y parchear el worker generado es frágil porque se
  rehace en cada build.
  **✅ Lo que SÍ funciona: un SEGUNDO worker de Cloudflare, suyo, que no hace más
  que llamar al webhook.** Veinte líneas con `scheduled` y los Cron Triggers
  puestos ahí. Es como se dispara el recordatorio de Casas de Fe
  (`recordatorio-casas-de-fe`, §4).
  ⚠️ **Y NO con un workflow de HighLevel, que es lo que decía aquí el 21-oct por
  la mañana y resultó FALSO: esa cuenta no tiene ningún activador por horario.**
  Se buscó `program`, `recurr`, `fech` y `hora` en la lista de activadores; lo
  único parecido, «Recordatorio de fecha personalizada», cuelga de una fecha del
  contacto, no de un reloj — no sirve para «todos los días a las 6». **Antes de
  dar por bueno un disparador en una herramienta ajena, buscarlo en SU lista**,
  no suponer que existe porque sería lo razonable.
  ⚠️ **Y el worker nuevo necesita SU PROPIO secreto, no el de siempre: Cloudflare
  no deja volver a leer un secreto ya guardado**, ni a su dueño. El valor de
  `HIGHLEVEL_WEBHOOK_SECRET` solo está escrito dentro de los pasos Webhook de
  los flujos de HighLevel, y buscarlo ahí costó una hora sin encontrarlo (el
  flujo de registro tiene cinco ramas y lo que parecían webhooks eran «Go To»).
  Salió más barato aceptar un segundo secreto en la ruta.
- **La migración corre al EMPEZAR el build; el worker se activa al terminarlo.**
  A los 2 minutos del merge la base puede estar migrada y la ruta todavía no
  existir. No diagnosticar con una sola de las dos señales.
- Verificar si un deploy está vivo, sin panel: `POST .../api/integraciones/
  highlevel/llamada` → **401** = desplegado · **307** = aún no.

### 12.3 Migraciones

- **Toda migración debe poder repetirse sin romper** (`IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`, guardas en los `DELETE`/`UPDATE`). Si no, el
  siguiente build falla y **el sitio se queda sin desplegar**.
- **Probarla antes, siempre.** Dos formas, y la segunda es mejor: `BEGIN … ;
  ROLLBACK;` **en la misma llamada** (nunca confiar en que el conector lo
  deshaga), o el **clúster Postgres 16 de usar y tirar** del contenedor
  (`/usr/lib/postgresql/16/bin`), que **sí permite repetir la migración**.
  `initdb` **no corre como root** (`su -s /bin/bash nobody`) y el clúster tiene
  que vivir **fuera** del scratchpad (es `root 700`).
- **⚠️ Probarla NO garantiza el despliegue.** Comprueba el SQL, no que la tabla
  esté libre. **Una migración que toca una tabla caliente (`app_user`,
  `person`, `learner_profile`) se fusiona DE NOCHE**: un `ALTER TABLE` pide
  candado exclusivo y a las 3 de la tarde muere esperando.
- **Si una migración falla, el error vive ÚNICAMENTE en el log del build de
  Cloudflare.** En Postgres no queda nada: comprobado, 63 filas y las 63 son
  puntos de control. No perder tiempo buscándolo en Supabase.
- `ALTER TYPE … ADD VALUE` **sí** corre dentro de la transacción, mientras el
  valor **no se USE** en ella.
- **⚠️ UN GUARDA DEL TIPO «solo si nadie lo ha usado todavía» CONVIERTE LA
  MIGRACIÓN EN UN NO-OP PERMANENTE Y SILENCIOSO.** Se registra como aplicada y
  no se reintenta nunca, así que si la condición falla entre el merge y el
  despliegue, el cambio no entra y **nadie se entera**. Si lo que protege es
  recuperable (texto que deja de pintarse, no de existir), va **incondicional**
  y se comprueba después.
- **⚠️ En un `UPDATE … FROM`, el `WHERE` que acota la fila es lo único que
  impide tocar las hermanas.** La 10 del taller 3 y la 10 del taller 2 son dos
  filas con el mismo `number`: sin `t.number = 3` se cambian las dos. **Probarlo
  con una fila hermana en la tabla**, no solo con la que se quiere cambiar.
- **⚠️ Un `ON DELETE SET NULL` puede volver IMBORRABLE la fila referenciada si
  un CHECK prohíbe el estado que deja.** Pasó el 13-oct: un CHECK simétrico
  («o están la fecha y el autor, o ninguno») hacía que **ninguna cuenta que
  hubiera marcado una petición se pudiera borrar** — y el error no mencionaba
  nada de oración. **Al escribir un CHECK sobre una columna con SET NULL,
  probar SIEMPRE borrando la fila referenciada.**
- Si `app_migration` no existe, el script **nunca arrancó** (la crea en su
  primera instrucción).

### 12.4 Código: lo que el compilador NO ve

- **⚠️ Un archivo `"use server"` solo puede exportar funciones `async`.** Una
  constante ahí **tumba la página entera en ejecución**, con `tsc`, `eslint` y
  `cf:build` **los tres en verde**. Hay un guardián:
  `src/lib/use-server.test.ts`. Las listas y mapas que toque el navegador van
  al **catálogo** (`op72.ts`, `*-catalogo.ts`).
- **`tsc --noEmit` NO basta: hay que correr `npm run cf:build`.** Ha cazado
  errores de tipos en pruebas y, sobre todo, módulos de servidor (`pg`, `dns`,
  `net`) colándose en el paquete del navegador.
- **⚠️ Al volver `async` una función que ya se usaba como condición, revisar A
  MANO cada `if (!fn(...))`.** `!promesa` es **siempre `false`**: el guardia
  deja de bloquear y `tsc` solo avisa donde hay una asignación tipada. Es un
  fallo de **seguridad**, no de estilo.
- **Toda acción de servidor que muta y deja al usuario en la misma pantalla
  necesita `router.refresh()`.** `revalidatePath` limpia la caché del servidor
  pero **no repinta** lo que el navegador ya tiene — el usuario cree que no se
  guardó y lo hace dos veces.
- **`npm install` se lleva el cliente de Prisma** (`node_modules/@iglesia/
  prisma-client`) y aparecen 20 «Cannot find module» sin relación. Se arregla
  con **`npx prisma generate`**.
- **Los id de este esquema son `text`, no `uuid`.** Un `::uuid` en SQL crudo
  revienta solo al ejecutarlo.
- **Un `as unknown as` casi siempre está tapando un modelo mal hecho.**
- En `$queryRaw`: ni backticks ni `${...}` dentro de los comentarios `--`.
  `IN (${ids.join(",")})` se parametriza como **un solo valor** y no filtra
  nada — usar el ORM o `Prisma.join`.
- **PBKDF2 en Workers: tope de 100 000 iteraciones por llamada.** Más, lanza en
  ejecución. Se encadenan rondas.
- **Añadir una columna son TRES archivos, no uno**: el `select` de la página y
  los dos `select` del lib. `tsc` no ve las selecciones de Prisma por sí solo.
- **⚠️ Al contar algo por `action`, buscar TODAS las acciones que lo producen.**
  Dar de baja se audita con **dos** acciones distintas según de dónde se haga:
  `operacion72.dado_de_baja` (tablero) y `administracion.dado_de_baja`
  (Administración). El 16-oct, de 8 bajas de una semana **una entró por la
  segunda**: contar solo la primera daba 7 y **nada lo habría delatado**. El
  catálogo de `audit.ts` es la lista a leer entera, no la acción que primero
  aparece en el `grep`.
- **⚠️ En una cadena derivada, la regla que atrapa un caso especial tiene que ir
  ANTES de la que decide por posición.** `grupoDelSalto` ordena los saltos por
  su puesto en el recorrido, y `BAJA` va la última de todas: sin el `if` que la
  atrapa primero, **una baja desde cualquier columna se cuenta como AVANCE** y
  el informe dice que progresaron 211 personas que se perdieron. El orden de
  los `if` no es estilo, es el significado.
- **⚠️ Un hueco en una cadena derivada no da error: da un salto que parece otra
  cosa.** Antes de meter la baja en la cadena de Operación 72, quien salía por
  una baja y volvía (`regresa_tras_baja`) dejaba el rastro «misma lista, dos
  veces seguidas» — idéntico a «se le volvió a llamar y sigue ahí». Se contaba
  como un giro en el sitio en vez de como la entrada que era.
- **⚠️ Para reconstruir una historia desde `audit_log`, unificar PRIMERO por la
  entidad de negocio.** Las acciones de Operación 72 se auditan con **dos
  `entity_type` distintos** —unas con `operation72` (el id de la tarjeta) y
  otras con `learner_profile` (el id del expediente)— y **`operacion72.entregada`
  está PARTIDA entre los dos** (89 filas y 23). Agrupar por `entity_id` a secas
  rompe cualquier `LAG`: el 16-oct eso dejaba **80 de 136 movimientos «sin
  origen conocido»** y la pantalla se veía perfectamente normal. Se arregla con
  `COALESCE(o.learner_id, a.entity_id)` antes de ordenar. **Un histórico mal
  reconstruido no falla: miente.**

### 12.5 Rendimiento

- **Con `PrismaPg max: 1` las consultas se SERIALIZAN**, aunque vayan en un
  `Promise.all`: cada viaje de más es una latencia de más. Juntar en un
  `$transaction` o en una sola consulta.
- **⚠️ Antes de dar por buena una pantalla de gráficas, DIBUJARLA con los
  números de verdad.** Los seis paneles del diseño sumaban 286 movimientos
  contra los 480 de la línea de arriba: **el 40 % no aparecía en ninguno**, y
  eso no se ve leyendo el código. Se arregló añadiendo el panel que faltaba
  (`Iniciada → Visita pendiente`, 56). La receta: un script que llame a **las
  funciones reales de dibujo** con datos medidos y escupa un HTML.
- **⚠️ Para comparar latencias: 20-25 muestras y mirar el CONTROL de cada
  tanda.** Un mínimo de 5 muestras es ruido, no una medida (llegó a dar «~0 ms»
  y «−450 ms»). Si el control se movió, **la tanda no vale**.
- **⚠️ Antes de usar una ruta como medidor, comprobar EN EL CÓDIGO que de
  verdad llega a la base.** `/taller/mis` sin cookie no consulta nada: medirla
  es medir el arranque del worker.
- El truco que funciona: **un par de rutas hermanas que devuelven el mismo
  404**, una tocando la base y otra no. **La resta es el viaje a la base,
  aislado.**
- **⚠️ Una consulta que vale para el informe puede no valer para una pantalla
  que se abre todo el día.** La cadena de `audit_log` del informe recorre la
  tabla entera: 115 ms y subiendo para siempre. Para el tablero se reescribió
  en dos pasos —**quiénes se movieron** por el índice `created_at`, y luego
  **su historia** por `(entity_type, entity_id)`— y bajó a **21 ms sin ningún
  recorrido de tabla**, con un coste que depende de la semana y no del
  historial. **Antes de reusar una consulta, mirar cuántas veces al día se va
  a ejecutar y con qué `EXPLAIN (ANALYZE)`.**

### 12.6 Producto y permisos

- **Lo que no abre, NO se enseña como enlace** — y al derecho: **si se enseña,
  tiene que funcionar.** Un botón que siempre va a fallar es peor que no
  enseñarlo.
- **El guardia va en la PÁGINA y en la ACCIÓN, no solo en el menú.** Esconder
  la pestaña y dejar la dirección abierta es cosmético.
- **Una pestaña dentro de una vista hereda el permiso de la vista** (y así no
  hay que crear nada en el configurador) — **pero si esa vista la ven más roles
  de la cuenta, hay que repetir el guardia** en cada página y en cada acción, y
  **pintar la pestaña solo a quien pasa la segunda comprobación**.
- **Lo que es secreto NO SALE del servidor**: el código de miembro, el token del
  calendario, la respuesta correcta de un cuestionario. Mandarlo y no pintarlo
  es inútil — se ve con el inspector.
- **Las credenciales no se escriben en la auditoría.**
- **Las revisiones y los intentos SE APILAN, NO SE PISAN**: cuántas veces se le
  devolvió algo a alguien es la señal de que algo no va bien.
- **Un estado que se puede DERIVAR no se guarda** (si no, un reenvío se queda
  «devuelto» para siempre).
- **Un aviso que sale siempre se deja de leer.** Solo cuando hay algo que hacer.
- **⚠️ PROMETER Y HACER SON DOS HECHOS DISTINTOS: UN INDICADOR QUE LOS SUMA
  MIENTE.** El recuadro «VISITAS» del informe contaba las acordadas junto con
  las cumplidas e **inflaba casi cuatro veces** (43 en un mes cuando se habían
  cumplido 11; 16-oct-2026). La causa: **las dos se guardan como
  `type = VISITA`** y solo las separa `result` (`VISITA_CUMPLIDA` /
  `VISITA_ACORDADA` en `op72.ts`, con `esVisitaCumplida()`). Tres cosas que
  hay que repetir en cualquier indicador parecido:
  1. **Buscar TODOS los sitios que lo cuentan**, no solo el recuadro. Eran
     cinco, y arreglar uno habría dejado el informe contradiciéndose.
  2. **Si un sitio ya filtraba bien, es un descuido, no una decisión** — aquí
     `medirBrecha` filtraba por `'Visita agendada'` desde el primer día.
  3. **La cifra grande es el hecho; la promesa va en el pie**, como el «con
     formulario» de llamadas. La diferencia entre las dos es lo que hay que
     vigilar, así que no se tira: se enseña debajo.
  Y lo anulado no se cuenta en ninguna de las dos.
- **⚠️ UN «OTROS» GRANDE NO ES UN RESUMEN, ES UN ESCONDITE — Y DOS CIFRAS
  PARECIDAS EN LA MISMA PANTALLA SE LEEN COMO LA MISMA.** En el histórico, los
  movimientos que no cabían en ningún panel eran **141 de 508 (el 28 %)** y se
  decían en una frase que no se podía abrir; encima, el aviso de arriba hablaba
  de **139** «sin origen conocido» y el pie de **141** «fuera de carril»: nadie
  iba a suponer que son grupos distintos que **solo comparten 96**. Separados,
  aparecen **45 saltos reales del equipo** que la suma tapaba. **Si un «otros»
  pasa de una décima parte del total, hay que desglosarlo y hacerlo abrible; y
  si dos números de la misma pantalla casi coinciden sin ser lo mismo, uno de
  los dos está mal nombrado.**
- **⚠️ Y AL DESGLOSAR UN «OTROS», EL RÓTULO DEL GRUPO NUEVO ES UNA AFIRMACIÓN:
  HAY QUE COMPROBARLA.** El mismo día, al partir los 142 del histórico, llamé
  al grupo «se saltaron un paso» — y **31 de sus 46 son el atajo «ya lleva
  proceso»**, que se salta la visita **a propósito** (los tres pares hacia
  «Lista para entrega», 31 de 31 por `pasa_a_entrega_por_proceso_previo`). El
  rótulo acusaba al equipo de un descuido en dos tercios de los casos: la misma
  trampa que estaba arreglando, un nivel más abajo. **Antes de nombrar un
  grupo, mirar QUÉ ACCIÓN produjo sus filas**, no solo de dónde a dónde van. Y
  si el grupo mezcla causas que el dato no separa, el rótulo nombra **el hecho**
  y el pie dice las causas **avisando que no las distingue** — partirlo en un
  grupo más solo vale si su número puede cuadrar con su propia lista.
- **⚠️ UN ENVÍO CUYA ÚLTIMA MILLA LA HACE OTRO SISTEMA NO ESTÁ HECHO HASTA QUE
  ESE SISTEMA LO CONFIRME — Y SI NO, FALLA EN SILENCIO DURANTE SEMANAS.** El
  WhatsApp del acceso al taller llevaba **56 envíos y tres semanas sin mandar
  nada**: el sistema escribía los campos y movía la etiqueta, la auditoría decía
  `casa_de_fe.acceso_enviado`, y la plantilla de Meta estaba **Rechazada**. Todo
  lo que nosotros controlamos salió perfecto; lo que no controlamos no pasó. El
  nombre de la acción (`acceso_enviado`) **afirmaba un hecho que no era nuestro**.
  Tres cosas que hay que repetir:
  1. **Auditar lo que de verdad hicimos**, no lo que esperamos que pase después:
     «se puso la etiqueta» es cierto; «se envió» no lo sabemos.
  2. **Antes de dar por vivo un canal ajeno, mandarse UNO a sí mismo** y mirarlo
     llegar. Es la única prueba, y cuesta dos minutos.
  3. **Si el canal no puede confirmar, decirlo en la pantalla** en vez de dejar
     que el silencio parezca éxito.
- **⚠️ Y ANTES DE ESCRIBIR UN MENSAJE PARA UN CANAL AJENO, MIRAR QUÉ FORMATO
  ADMITE ESE CANAL.** El recordatorio se diseñó entero —mockup aprobado, código,
  pruebas— dando por hecho que se podía mandar texto libre por WhatsApp. **No se
  puede:** solo plantillas aprobadas, y el valor de una variable no admite ni un
  salto de línea (§6). Rehacerlo fue barato porque el texto estaba en una sola
  función del catálogo; haberlo mirado antes habría sido gratis.
- **El orden en la pantalla es la única forma de decir ciertas cosas sin un
  cartel**: lo que caduca o bloquea a alguien va **arriba del todo**.
- **⚠️ SI UN NÚMERO SE PUEDE PULSAR PARA VER DE DÓNDE SALE, EL NÚMERO Y SU
  LISTA TIENEN QUE CONTARSE CON LA MISMA REGLA, ESCRITA UNA SOLA VEZ.** En
  Oración el recuadro se cuenta en memoria y su filtro en el `WHERE` de la
  consulta: con «7 días» puesto en los dos sitios, basta tocar uno para que
  arriba diga 5 y abajo salgan 7, y nada avisa. Se comparte la función que
  calcula el límite, y se prueba el **caso borde**.
- **⚠️ EL ÚLTIMO TRAMO DE CUALQUIER SERIE TEMPORAL CASI SIEMPRE ESTÁ EN CURSO.**
  La semana en curso lleva dos días y el mes en curso, diez. Dibujado igual que
  los demás, **la línea cae a plomo al final siempre** y parece un derrumbe cada
  vez que alguien abre la pantalla. Va con trazo discontinuo y punto hueco, y
  la tabla lo dice con palabras.
- **⚠️ Un pico que no es trabajo no va en la gráfica del trabajo.** Las bajas de
  Operación 72 son limpiezas de lista: 198 de 211 en ocho días, 67 en uno solo.
  Sumadas a la línea de movimientos, una semana de 25 pasa a 99 y la gráfica
  deja de medir lo que su título dice. Van en su propia gráfica. Es la misma
  regla que dejó el import de agosto fuera del histórico.

### 12.7 Datos y fusiones de fichas

- **El hito REGISTRO no se pisa** con el del duplicado: su fecha sería la del
  día en que se creó el duplicado.
- **Un campo en blanco no borra lo que ya estaba** (`coalesce(nullif(...))`).
- **Mirar CADA VEZ de qué lado está el contacto de HighLevel y las fechas
  buenas de los hitos**: en cuatro fusiones vinieron con la ficha vieja y en la
  quinta con la nueva.
- **Al fusionar, revisar nombre Y apellidos**, no solo apellidos.
- **Lo marcado a mano manda sobre lo automático.**
- **⚠️ ANTES DE CREAR UNA FICHA POR SQL, LEER `crearRegistroEnTransaccion`
  ENTERA: SON OCHO ESCRITURAS, NO TRES.** `person` · **`member_code`** (el
  código de miembro, que es el que más fácil se olvida y sin él la persona no
  puede entrar al taller) · `learner_profile` · `operation72` · **dos
  `milestone`** (REGISTRO completado y OPERACION_72 en curso) · **tres filas de
  `audit_log`** · **dos `integration_event`**. Y si la persona trae petición de
  oración, una novena en `prayer_request` con `origin: REGISTRO`.
- **⚠️ Y el consolidador NO se elige a ojo: se corre la regla.** La carga de
  `asignarConsolidador` **no es «personas activas»**, es **fase GANAR con la
  Op72 en una de las cinco columnas del tablero** — con el otro criterio salen
  números muy distintos (Johanna, 7 contra 12). El desempate importa: mayor
  cupo libre y, a igualdad, **el primero por nombre**, porque el `reduce` solo
  sustituye con mejora estricta sobre una lista ordenada por `fullName`.
- **⚠️ Las marcas de tiempo de un INSERT a mano van como
  `now() AT TIME ZONE 'UTC'`**, nunca `CURRENT_TIMESTAMP`: las columnas son
  `timestamp without time zone` que guardan UTC, y dejarlo a la zona de la
  sesión es la trampa de §12.1. Se comprueba contra una fila que ya exista.
- **⚠️ UN TELÉFONO REPETIDO NO DA UN DUPLICADO: SE TRAGA AL RECIÉN LLEGADO.**
  El webhook de registro casa por teléfono, y si el número ya está en otra
  ficha **engancha el contacto nuevo a ESA ficha y no crea nada**. El único
  rastro es una fila `highlevel.contacto_vinculado` con criterio «Mismo
  teléfono registrado»; desde fuera se ve igual que un registro perdido. Pasó
  con Maricela Rojas el 20-oct.
- Todo en **una sola transacción**, probada antes con `BEGIN … ROLLBACK`.

### 12.8 Método de trabajo

- **Medir antes de diseñar.** Varias veces el dato cambió el trabajo: las
  parejas metidas dentro del nombre del grupo, los 13 consolidadores fuera de
  fase, las 64 casillas que no eran 43 preguntas.
- **Antes de teorizar sobre un dato raro, leer la observación que lo
  acompaña.** El equipo casi siempre escribió la verdad en alguna parte.
- **Una observación del equipo es evidencia, no prueba**: cruzarla con el resto
  del expediente antes de mover a alguien.
- **Probar al revés es lo que hace valer una prueba**: romper a propósito y
  comprobar que fallan **exactamente** las que deben.
- **Cuando una prueba falla dos veces seguidas, sospechar de la prueba.**
- **Para verificar una pantalla sin navegador**: correr su lógica con datos de
  producción y cruzarla con algo que el usuario ya vio.
- **Para saber si una credencial de la base sigue sirviendo, pedirle al sitio
  algo que la use.** No hace falta preguntar.
- **⚠️ NO abrir el PR hasta que TODO esté empujado** — el usuario fusiona en
  minutos. **Y si aparece trabajo nuevo con un PR ya abierto, se abre OTRO PR:
  no se apila sobre el abierto** (así entró a medias el #112).
  **⚠️ ESTO HA COSTADO CINCO MERGES A MEDIAS, Y LA CAUSA SOY YO, NO GITHUB.** La
  última, el #121 el 16-oct: abrí el PR y **empujé un commit más a la misma rama
  después**; GitHub fusionó la cabeza que tenía cuando se abrió (`40ef462`) y
  dejó la nueva (`ab113e2`) fuera de `main`. **Un push a una rama con PR abierto
  NO garantiza que el merge se lo lleve.** Si ya ocurrió: la rama queda con lo
  que falta encima de lo ya fusionado, así que **se abre un PR nuevo** —
  `git log --oneline origin/main..origin/<rama>` dice exactamente qué quedó
  fuera, y si sale un solo commit, eso es todo lo que hay que fusionar.
- **Squash sobre historia ya fusionada duplica código**: al reiniciar la rama
  desde `main`, verificar que no quedó nada duplicado.
- **⚠️ `execute_sql` del MCP se cuelga 60 s** con `do $$ … raise notice`, con
  `create temp table` y con **una transacción de varias sentencias y un
  `select` final**. Usar **CTEs de escritura con un `select` final**, o partir
  en varias llamadas. Al agotarse, comprobar en el acto `pg_stat_activity` y
  `pg_locks` — hasta hoy siempre quedó en 0 y 0.
- **Toda acción nueva de auditoría necesita su `case` en `actividad.ts`** o sale
  como texto crudo, y su entrada en el catálogo de `audit.ts` o no compila.
- **Todo webhook público nuevo va en `RUTAS_PUBLICAS`** o el middleware lo
  redirige con 307.
- En este entorno: `pdftoppm`, `pypdf` y `pdfminer` fallan (el `cryptography` de
  Debian está roto); sirve **`pypdfium2` + `pillow`**, y `pip install --upgrade
  cffi` lo arregla.

## 13. Bitácora · índice

> **El historial completo NO se carga con este archivo**: vive en
> `docs/bitacora/<año>-<mes>.md`. Aquí queda **una línea por entrada**, para
> saber que algo existe y poder ir a buscarlo.
>
> **Cómo se busca:**
> `grep -n "<palabra>" docs/bitacora/*.md` → archivo y línea ·
> `sed -n '<desde>,<hasta>p' docs/bitacora/<mes>.md` → la entrada entera.
> Buscar por el nombre de la pantalla, del archivo, del campo o del error
> suele funcionar mejor que por la fecha.
>
> **Al terminar un trabajo importante**, la entrada nueva va **arriba del
> archivo del mes** y su renglón **arriba de este índice**. Si de ese trabajo
> sale una regla general, va **además** a §12.

### `docs/bitacora/2026-10.md` — octubre de 2026 (27 entradas)

- **22-oct** · ⚠️ **El WhatsApp de este CRM no manda texto libre: solo plantillas aprobadas, y el VALOR de una variable no admite ni un salto de línea** · ⚠️ **y de paso: el WhatsApp del acceso al taller NUNCA ha salido — 56 envíos en 3 semanas con la plantilla Rechazada**, y nadie se enteró porque `acceso_enviado` afirma un hecho que no es nuestro · el mensaje se parte en dos y nace `variableDeWhatsApp` · ayer eran 3 casas de madrugada y hoy son 6.
- **21-oct (tarde)** · ⚠️ **El disparador NO podía ser un workflow de HighLevel: esa cuenta no tiene activadores por horario** (4 búsquedas, 0 resultados) · lo mueve **un SEGUNDO worker de Cloudflare** con dos crons · huella 200 «Hello World!» → **404** · ⚠️ **Cloudflare no deja releer un secreto guardado** y buscarlo en el CRM costó una hora: los «webhooks» del flujo eran **«Go To»** · la ruta acepta dos secretos.
- **21-oct** · **Recordatorio de Casas de Fe por correo y WhatsApp** · ⚠️ **el worker solo exporta `fetch`, no `scheduled`**: lo dispara un workflow de HighLevel, no un cron · uno por **persona y día** (hoy serían 16 y son 10) · **si se reúne antes de las 9:00, el aviso sale la noche anterior** · la etiqueta se quita y se vuelve a poner o solo funciona un día.
- **20-oct** · **Saray y Maricela: dos «no entraron» por causas distintas** · Saray no tenía enlace al CRM (sin teléfono ni correo) · a Maricela **se la absorbió la ficha de Celina por compartir el teléfono** · ⚠️ **me equivoqué dos veces y las desmontó el dato** · Maricela creada a mano: **8 escrituras, no 3**.
- **20-oct** · ⚠️ **El consolidador NO llegaba a HighLevel al nacer en la plataforma**: `exportarContactoNuevo` no mandaba `assignedTo` y **96 de 154** se exportan así · ahora se pregunta el dueño y **solo se escribe si está vacío** · y Saray no tiene enlace porque **no tiene teléfono ni correo**, que el `upsert` rechaza en silencio.
- **20-oct** · El bloque nuevo quedó VIVO (PR #130) · ⚠️ **y mi rótulo «se saltaron un paso» era FALSO para 31 de 46**: son el atajo «ya lleva proceso», que salta la visita a propósito · pasa a **«Fueron por otro camino»** · el chunk de página dio 404 con el código vivo, **tercera vez**.
- **20-oct** · **«Fuera del recorrido» del histórico pasa de una frase a una lista abrible** · eran **141 de 508 movimientos (28 %)** resumidos en un renglón · ⚠️ **139 y 141 parecían la misma cifra y solo 96 coinciden**: separadas, salen **45 saltos reales del equipo** · los 12 pares cuadran con la ventana, comprobado contra producción.
- **20-oct** · **La 10 del taller 3 pasa de escribir a marcar** (`OPCION`, 5 opciones) · de una sola marca para que nadie pueda decir «apartamento» y «casa» a la vez · la quinta no está en el libro y se añadió adrede · ⚠️ el `UPDATE` va **incondicional** porque un guarda se quedaría en nada para siempre y sin avisar.
- **17-oct** · **Los tres recuadros de Oración filtran la lista** al pulsarlos · la ventana de tiempo sale de **una sola función** para que el número y su lista no discrepen · una prueba vigila el mapa recuadro → filtro, que si no fallaría en silencio · ⚠️ **nadie ha pulsado nunca «Ya oramos por esto»**.
- **17-oct** · **Pestaña «Histórico» en Operación 72** · ⚠️ **el informe no contaba NINGUNA baja**: 211 de 875 movimientos (24 %) y el salto más frecuente de todos invisible · sin la regla, una baja contaba como **avance** · el preview con datos reales delató que faltaba un panel (40 % fuera) · los colores de la marca fallan el validador · el último tramo va discontinuo.
- **16-oct** · **El tablero dice cuánto se movió**: ⊕ sobre cada contador y ⊖ rojo al final, con selector de periodo · ⚠️ **hay DOS acciones de baja** y una de 8 entró por la segunda · un giro en el sitio no es entrada · **115 → 21 ms** sin recorrer `audit_log` · y el fallo viejo de los contadores en cero al filtrar.
- **16-oct** · ✅ **CORRECCIÓN: el CSS SÍ es huella** — comprobado por `sha256` que producción y el build local son el MISMO archivo · el falso negativo del #120 fue mío, por comparar con un `.open-next` anterior a mi última edición.
- **16-oct** · ⚠️ **«VISITAS» contaba promesas: inflaba casi 4 veces** (43 en un mes cuando se cumplieron 11) · acordar y cumplir van los dos como `type = VISITA` y solo los separa `result` · **cinco sitios lo contaban, uno ya filtraba bien**.
- **16-oct** · ⚠️ **El #121 se fusionó A MEDIAS: QUINTA vez, y la causa fui yo** — empujé un commit a la rama DESPUÉS de abrir el PR y GitHub fusionó la cabeza vieja.
- **16-oct** · El desglose quedó VIVO (PR #120) · ⚠️ **el NOMBRE del CSS no es huella**: 66 547 vs 66 646 bytes y estaba desplegado · la prueba es **un literal que solo exista en el código nuevo**, verificado con `git grep`.
- **16-oct** · **Cada indicador del informe se abre** (quiénes, día y hora) **y Operación 72 tiene histórico** · ⚠️ **las acciones de Op72 se auditan con DOS `entity_type`** y eso daba 80 de 136 movimientos «sin origen» · el histórico no llega antes del 15-ago.
- **15-oct** · **Volver al tablero de Op72 tras una baja** · reactivar no reabría la Op72: 206 personas vivas sin tarjeta · **Casa de Fe y asignar mentor YA funcionaban** con solo estar activa.
- **14-oct** · El módulo de oración quedó VIVO (219 de 217 personas) · ⚠️ **tres merges sin desplegar en 20 h: lo arregló `Retry build`** · dos falsos negativos míos (fetch en caché, y el chunk como huella).
- **14-oct** · **Módulo de oración**: el líder de intercesión ve todas las peticiones · formulario público `/pedir-oracion` · 217 trasladadas · **un CHECK simétrico volvía imborrables las cuentas**.
- **12-oct** · **La memoria se parte en dos**: `CLAUDE.md` (siempre) y `docs/bitacora/` (se busca) · 303 → 51 KB · verificado por sha256 · el 6-sep estaba duplicado.
- **12-oct** · El código del taller se ve en la ficha de la Casa de Fe — credencial, solo viaja a quien edita; cero viajes nuevos.
- **12-oct** · El taller 2 corto quedó VIVO (PR #113) · **CUARTA vez** que un merge se lleva media rama, y la causa fui yo.
- **12-oct** · Taller 2 del prematrimonial: de 64 casillas a 34 · renumerar 1..22 · probado en el clúster de usar y tirar.
- **12-oct** · **HYPERDRIVE VIVO** (PR #110 + #111): 236 → ~80 ms · `localConnectionString` falsa · `getPlatformProxy` · **el Deploy command estaba mal en §4**.
- **12-oct** · **Pantallas de error propias** (PR #108): no había NI UN `error.tsx` en 14 meses · `statement_timeout = 10 s` · el middleware no lo atrapa nadie.
- **5-oct** · El cuestionario de líderes quedó VIVO (PR #103) · 12 temas · 63 preguntas · los DOS QR y en qué se diferencian.
- **5-oct** · **Cuestionario de Dominio para Líderes**: no es el taller de Casa de Fe · la nota solo se ve al aprobar · el servidor borra `correctChoice`.
- **3-oct** · El QR de «Actualizar datos» **inscribe en la Escuela Ser Líder** (`?escuela=1`) · y por fin se puede **retirar** a alguien.
- **3-oct** · El PR #101 entró completo · el equipo estrenó el prematrimonial a los 41 minutos · **el falso positivo del CSS idéntico**.
- **3-oct** · El prematrimonial quedó VIVO (PR #100), **pero el merge se llevó solo parte** (tercera vez) · `applied_at` es `timestamptz`.
- **3-oct** · **Prematrimonial**: 12 temas que la pareja responde por separado · comparar ORDENAR por puesto · aprobar es del tema, devolver es de uno.
- **2-oct** · **«Mis talleres»**: al entrar a una Casa de Fe le llegan código y enlace **por correo Y por WhatsApp** · los campos se buscan por nombre · abrir no es empezar.

### `docs/bitacora/2026-09.md` — septiembre de 2026 (87 entradas)

> ⚠️ **El 6-sep está DUPLICADO en el archivo**: sus dos entradas aparecen dos
> veces (la de Nora, idéntica byte a byte; la de `main`, con una palabra de
> diferencia). Son residuo del squash de ese mismo día — el que duplicó
> `resolverDeclaracion`. **No se borraron**: quitar historial es decisión del
> usuario. Aquí van con un renglón cada una, no cuatro.

- **27-sep** · **Taller virtual de Casa de Fe, un QR por tema** · el modelo de los 12 temas YA existía · renombrar un tema reasigna lo marcado · la pregunta que es un DIBUJO.
- **25-sep** · «Dejar como asistente» desde la ficha · **131 personas a las que nadie podía marcar** desde ninguna parte.
- **24-sep** · ⚠️ **El build del PR #94 falló en la migración y el sitio quedó 9 h sin actualizar** · la causa es un CANDADO · el log no lo decía · `migrar.mjs` endurecido.
- **23-sep** · **GI · Generación Imparable** · GI no cambia la línea de mentoría de nadie · la red dice quién reúne · el devocional no se audita.
- **22-sep** · Los encargados quedaron VIVOS · **«✅ Deployment successful» en un PR NO es fusionado** · la vista previa apunta a la base real.
- **21-sep** · **Cambiar el líder de un grupo y poner encargados** · 7 grupos tenían la pareja metida en el NOMBRE · `coLeaderIds` obligatorio a propósito.
- **21-sep** · El calendario semanal quedó VIVO · **la huella de un trabajo de servidor es el CSS**.
- **19-sep** · **Calendario semanal de los grupos** · reparto en columnas · dos que se tocan no se cruzan · la franja de horas se calcula.
- **18-sep** · El punto en el mapa quedó VIVO · **pedir un archivo que solo existe en el build nuevo SÍ prueba que está**.
- **18-sep** · **Ubicar el grupo en el mapa con el pin** · Leaflet, no Google (clave con facturación) · el pin va clavado en el centro · media coordenada no ubica nada.
- **17-sep** · Hora, lugar y calendario VIVOS · la migración corre al empezar el build y el worker se activa al terminarlo.
- **17-sep** · **Hora, lugar y calendario `.ics`** · la hora es TEXTO «HH:mm» · `TZID` con su `VTIMEZONE` · `RRULE` · el token es una credencial · escapar y plegar a 75 OCTETOS.
- **16-sep** · **Vistas por perfil**: cada menú se enciende desde Administración · el defecto no puede mirar solo el rol (10 consolidadores lo habrían perdido).
- **16-sep** · Permiso «ve todos los grupos» VIVO.
- **16-sep** · ⚠️ **La contraseña de un pastor se cambió CINCO veces en una hora** · mirar `last_sign_in_at` ANTES de tocar la contraseña · `auth.users` es `timestamptz`.
- **16-sep** · Permiso nuevo **«ve todos los grupos» (solo mirar)** para el líder de intercesión · separar «ver» de «administrar».
- **12-sep** · «Actividad del día» con calendario y rango · **los seis contadores se calculaban sobre una lista recortada** y ya iban a mentir.
- **12-sep** · ⚠️ **TUMBÉ EL TABLERO EN PRODUCCIÓN**: una constante en un archivo `"use server"` · los tres chequeos en verde · **nació el guardián `use-server.test.ts`**.
- **12-sep** · Un administrador puede **devolver una tarjeta a cualquier columna** · el plazo se reinicia · no se inventa ninguna llamada.
- **12-sep** · Alpha y Casa de Fe: cada líder ve los suyos y los de su rama · ⚠️ **`!promesa` es siempre `false`**: dos guardias quedaron abiertos y `tsc` no lo vio.
- **11-sep** · **La vista de TODA la iglesia deja de ser del rol PASTOR** · el daño no era el título, eran los indicadores.
- **11-sep** · «Mi red» pasa a mostrar la rama **EN CASCADA** · `WITH RECURSIVE` · los 193 pares comprobados en los dos sentidos.
- **11-sep** · Mateo Tabares limpiado, igual a los otros seis.
- **11-sep** · Las 23 cuentas del equipo con el hito OPERACIÓN 72 en curso (listado).
- **11-sep** · El tablero de Operación 72 **deja de aparecerle a los pastores** · «Registrar persona» estaba en el mismo bloque del menú.
- **11-sep** · ⚠️ Hallazgo abierto: 23 cuentas con el hito OPERACIÓN 72 que **no se puede completar nunca**.
- **11-sep** · **Las 7 «visitas» del 9-sep no eran visitas** · la evidencia estaba en las observaciones · **leer la observación antes de teorizar**.
- **11-sep** · El PR #81 entró completo y las dos migraciones corrieron.
- **11-sep** · ⚠️ **SEGUNDA vez que un merge se lleva solo parte** · la receta `origin/main..origin/<rama>` · no abrir el PR hasta tenerlo todo empujado.
- **11-sep** · **Atajo «ya lleva proceso» → LISTA PARA ENTREGA** · columna propia `prior_process_note`, porque `detail` lo reescribe la acción siguiente.
- **11-sep** · **Deshacer una visita agendada a la persona equivocada** · se ANULA, no se borra · los cinco sitios que hay que filtrar · vuelve a CONTACTADA.
- **11-sep** · El campo «Hora visita» de HighLevel quedó vivo · cómo comprobarlo sin entrar al panel · `GET /forms/` NO sirve.
- **11-sep** · ⚠️ **QUINTA TRAMPA DE FECHAS**: `datetime-local` manda sin zona y el servidor es UTC → **cinco horas** · nace `momentoDesdeCampo`.
- **11-sep** · ⚠️ **Las acciones guardaban bien pero la pantalla no se repintaba** · `revalidatePath` no basta: **`router.refresh()`**.
- **11-sep** · ⚠️ El despliegue SÍ entraba y **mi prueba daba falso negativo** (comparar nombres de paquete no sirve).
- **11-sep** · Cambiar la fecha u hora de una visita: **«se movió» apila, «estaba mal escrita» corrige en su sitio**.
- **11-sep** · Las 9 visitas a mediodía corregidas a mano · **la hora en prosa trae rangos y no se puede automatizar** · hay que tocar `detail` también.
- **10-sep** · Reprogramar una visita que no se pudo cumplir · lo pactado se apila, no se pisa.
- **10-sep** · Hora de la visita y **VISITA PENDIENTE ordenada por fecha de visita** · el truco del `CASE` con `row_number()`.
- **9-sep** · **«Asistentes de la iglesia»**: el TERCER desenlace de Operación 72 · el indicador que manda es «nadie les habla hace 90 días».
- **8-sep** · «LLAMADAS» en el informe pasa a contar **marcaciones** (decisión del usuario pese a mi objeción).
- **8-sep** · ⚠️ El despliegue se quedó atascado · cómo comprobarlo cuando el CSS no sirve de huella.
- **8-sep** · **Un día significa lo mismo en TODAS las pantallas** · nacen `momentoCorto/Largo` y `diaCorto/Largo` · 113 de 428 registros se veían un día adelante.
- **8-sep** · ⚠️ **CUARTA TRAMPA DE SQL**: `AT TIME ZONE 'America/Bogota'` a secas **SUMA** 5 h · la gráfica decía 7 y el tile 18.
- **7-sep** · «Mi red» y «Árbol» pasan a ser **UNA sola pantalla** · los indicadores salen siempre de `cargarRed`.
- **7-sep** · El formulario de liderazgo reconoce también por **correo + nacimiento** (6 correos repetidos, 0 pares con los dos datos).
- **7-sep** · **Cada cosa declarada se confirma por separado** · los hitos ya NO se aplican solos · ⚠️ **escribí sin querer en producción: `BEGIN … ROLLBACK` en la MISMA llamada**.
- **7-sep** · El informe se quedó **sin «modos»**: es un calendario y ya.
- **7-sep** · Informe con **rango libre** y comparación automática · meses completos se corren por meses, lo demás por días.
- **7-sep** · **Menos viajes a la base en el tablero**: de ~15 a 6 · `row_number() OVER (PARTITION BY status)`.
- **7-sep** · **Índices de consulta** (9) · y el diagnóstico honesto: **no eran el cuello de botella**, era la latencia por viaje.
- **7-sep** · **Informe de la plataforma** · **la semana va de VIERNES a VIERNES** y por qué · tres trampas de SQL que `tsc` no ve.
- **7-sep** · ⚠️ La llave maestra no se podía guardar: **Cloudflare limita PBKDF2 a 100 000 iteraciones** por llamada.
- **7-sep** · Generador de claves en los tres sitios que faltaban.
- **7-sep** · **Llave maestra**: entrar a cualquier perfil con su correo · magic link + `verifyOtp` · solo el administrador principal la configura.
- **7-sep** · **Autorización de bajas**: nadie sale sin que un administrador lo apruebe · pedir la baja no saca a la persona del tablero.
- **7-sep** · La «hora de llamada» del CRM **se estaba tirando a la basura** · la clave no casaba · 76 personas recuperadas.
- **6-sep** · El id de HighLevel de Nora Bonilla **mal por DOS caracteres** (`I` por `l`) · cómo validar todos los ids · el rechazo era invisible y ahora se audita.
- **6-sep** · ⚠️ **Se rompió `main`**: squash sobre historia fusionada **duplica código** · y **`tsc` no basta, hay que correr `cf:build`** · nace `liderazgo-catalogo.ts`.
- **5-sep** · El formulario de liderazgo ahora **sí escribe en HighLevel** · `upsert` para no duplicar.
- **4-sep** · **Consolidador: sincronización de DOBLE VÍA con HighLevel** · el eco se corta con una sola regla · `dateUpdated` NO dice cuándo se asignó.
- **4-sep** · Auditoría de las llamadas del día: **6 personas en la columna equivocada** por la ventana del secreto.
- **4-sep** · `HIGHLEVEL_WEBHOOK_SECRET` **rotado** · **cómo auditar una pérdida de envíos** cruzando `/forms/submissions` con `audit_log`.
- **4-sep** · **Los tres formularios quedaron vivos** · cómo verificar un secreto sin exponerlo (401 vs 404).
- **4-sep** · El formulario del consolidador **no movía nada**: `MULTIPLE_OPTIONS` llega como arreglo · anti-duplicados sin fecha.
- **4-sep** · Recorrido de Operación 72 revisado punta a punta · 35 personas corregidas a SEGUIMIENTO · las 184 del import **se quedan** (decisión).
- **4-sep** · Visitas desde el CRM vivas · **tres trampas**: nombres de formulario casi idénticos, workflow en `draft`, URL equivocada.
- **4-sep** · **Migraciones automáticas vivas** · el «Build command» del panel debe ser `npm run cf:build` · el secreto de build es DISTINTO del de runtime.
- **4-sep** · Verificación de estado · si `app_migration` no existe, el script nunca arrancó · el incidente del secreto borrado.
- **3-sep** · **Pantalla «Actividad del día»** · toda acción nueva necesita su `case` en `actividad.ts` · copia de cada correo (`email_sent`).
- **3-sep** · **Correo de entrega a mentor** · las notas pastorales NO van en el correo (decisión del usuario).
- **3-sep** · **Registro interno «solo la ficha»** (sin Operación 72), para el equipo.
- **3-sep** · ⚠️ «Database error loading user»: 12 cuentas con `NULL` donde GoTrue exige `''` · **nunca insertar usuarios por SQL**.
- **3-sep** · Tarjetas de Operación 72 explícitas · baja desde el tablero · **webhook `/visita`** · el texto «bienvenida por WhatsApp» era fijo y FALSO.
- **3-sep** · **El correo del sistema por fin funciona** (nunca había enviado uno) · ⚠️ **`wrangler deploy` REEMPLAZA las variables de texto**: van en `wrangler.jsonc`.
- **3-sep** · Cuatro ajustes de producto · **ningún dato de la persona se oculta** · filtros en el tablero · nace el estado **SEGUIMIENTO**.
- **3-sep** · **Ser mentor pasa a ser un permiso acumulable** (`can_mentor`) · los helpers de `auth.ts` como fuente única.
- **3-sep** · **Regla del recorrido**: al pasar a FORTALECER la persona deja de ser de consolidación y la carga baja · el cupo 24 es solo de mentoría.
- **3-sep** · Consolidadores: lista completa y datos corregidos · ⚠️ **un INNER JOIN con `person` OCULTA a los que no tienen ficha**.
- **3-sep** · **Registros de HighLevel vivos** · los merge-tags sin resolver (`{{...}}`) y la palabra literal `"null"`.
- **1-sep** · **Hora Colombia en toda la UI** · nace `ZONA_HORARIA` · no aplicarla a campos de solo-fecha.
- **1-sep** · Registros por webhook con **500**: la transacción pasaba del timeout de 5 s de Prisma.
- **1-sep** · Tablero de llamadas vivo y probado punta a punta.
- **1-sep** · Deploy del tablero activo · **todo webhook público nuevo va en `RUTAS_PUBLICAS`**.
- **1-sep** · Creado este `CLAUDE.md`.
