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
- **⚠️ Que ALGUNOS chunks coincidan no valida un chunk CONCRETO como huella.**
  El 14-oct comprobé que 10 de 11 chunks de `/ingresar` coincidían con mi
  build, y aun así el chunk que yo vigilaba daba **404 con el código ya
  desplegado** — defendí ese falso negativo dos días. **El CSS sí vale**:
  es uno solo y se compara por **nombre Y tamaño en bytes**.
- **⚠️ SI UN MERGE NO DESPLIEGA EN ~15 MINUTOS, NO ES EL CÓDIGO: PEDIRLE AL
  USUARIO QUE REFRESQUE «Deployments» Y LE DÉ `Retry build`.** Los builds de
  Cloudflare **se atascan en cola sin dar ninguna señal de error**: el 14-oct
  tres merges seguidos (#114, #115, #116) pasaron **~20 horas** sin desplegar
  nada, y el Retry lo resolvió **en dos minutos**. Antes de molestarle,
  descartar el repositorio con `wrangler deploy --dry-run` y una llamada a
  `getPlatformProxy()`, que es lo que ejecuta el Deploy command.
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

### 12.5 Rendimiento

- **Con `PrismaPg max: 1` las consultas se SERIALIZAN**, aunque vayan en un
  `Promise.all`: cada viaje de más es una latencia de más. Juntar en un
  `$transaction` o en una sola consulta.
- **⚠️ Para comparar latencias: 20-25 muestras y mirar el CONTROL de cada
  tanda.** Un mínimo de 5 muestras es ruido, no una medida (llegó a dar «~0 ms»
  y «−450 ms»). Si el control se movió, **la tanda no vale**.
- **⚠️ Antes de usar una ruta como medidor, comprobar EN EL CÓDIGO que de
  verdad llega a la base.** `/taller/mis` sin cookie no consulta nada: medirla
  es medir el arranque del worker.
- El truco que funciona: **un par de rutas hermanas que devuelven el mismo
  404**, una tocando la base y otra no. **La resta es el viaje a la base,
  aislado.**

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
- **El orden en la pantalla es la única forma de decir ciertas cosas sin un
  cartel**: lo que caduca o bloquea a alguien va **arriba del todo**.

### 12.7 Datos y fusiones de fichas

- **El hito REGISTRO no se pisa** con el del duplicado: su fecha sería la del
  día en que se creó el duplicado.
- **Un campo en blanco no borra lo que ya estaba** (`coalesce(nullif(...))`).
- **Mirar CADA VEZ de qué lado está el contacto de HighLevel y las fechas
  buenas de los hitos**: en cuatro fusiones vinieron con la ficha vieja y en la
  quinta con la nueva.
- **Al fusionar, revisar nombre Y apellidos**, no solo apellidos.
- **Lo marcado a mano manda sobre lo automático.**
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

### `docs/bitacora/2026-10.md` — octubre de 2026 (15 entradas)

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
