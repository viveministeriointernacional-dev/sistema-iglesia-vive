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

- **2026-09-07** — **Índices de consulta** (migración
  `20260907170000_indices_de_consulta`, 9 índices) **y el diagnóstico honesto de
  la lentitud**.
  El usuario pidió índices para optimizar. **Se midió antes de crearlos, y el
  resultado corrige la intuición:**
  - **Las tablas son diminutas.** La más grande es `audit_log` con **1 528
    filas / 952 kB**; `contact_attempt` tiene 398 filas / 248 kB. La consulta
    más pesada del informe (la de consolidadores, con cinco `EXISTS`
    correlacionados) tarda **20,4 ms de ejecución… y 19,6 ms de PLANIFICACIÓN**.
    Todo resuelve por escaneo completo, y **Postgres hace bien**: la tabla
    entera cabe en una docena de páginas.
  - **⚠️ Conclusión: los índices NO son el cuello de botella hoy.** La lentitud
    que se siente es **latencia de ida y vuelta al pooler de Supabase** (§9:
    plan FREE, `ca-central-1`) multiplicada por el número de consultas por
    página — y con `PrismaPg max:1` las consultas de un `Promise.all`
    **se serializan** sobre la única conexión. El informe hace 9 viajes; el
    tablero, otros tantos. Ahí está el segundo, no en el plan de ejecución.
  - **Aun así los índices se crearon**, como trabajo preventivo: el costo del
    escaneo crece en línea recta con la iglesia y `pg_stat_user_tables` ya
    muestra el patrón — `person` lleva **771 933 filas leídas** a punta de
    escaneo completo (2 044 escaneos), `learner_profile` 615 938. Cuando esas
    tablas pasen de unos miles de filas, el planificador los empieza a usar
    **solo**, sin tocar nada.
  - **El que más se va a notar: `learner_profile(consolidator_id)`** — hoy no
    existía ninguno por consolidador, y lo usan el alcance «solo mis personas»
    del tablero y el cálculo de carga del reparto automático.
  - Los otros ocho son por **rango de fechas**, que es lo que pide el informe y
    que los índices existentes no cubren porque **empiezan por otra columna**
    (`contact_attempt` tenía `(operation72_id, occurred_at)`, inútil cuando se
    filtra solo por fecha; `learner_status_change` igual).
  - **Van sin `CONCURRENTLY` a propósito**: `scripts/migrar.mjs` aplica cada
    migración dentro de `BEGIN/COMMIT` y ahí no se permite. Con estos tamaños
    el bloqueo de escritura dura milisegundos.
  - **Verificados contra la base real** creándolos dentro de una transacción y
    haciéndole `ROLLBACK`: los 9 se crean sin error y producción quedó intacta.
  - **Palancas reales para la velocidad, en orden** (siguen pendientes, §9):
    **(1) menos viajes por página** (juntar consultas), **(2) Hyperdrive**
    (cachea el pool en el borde y mata la latencia por viaje), **(3) Supabase
    Pro**. Un índice más no mueve la aguja hasta que la base crezca.

- **2026-09-07** — **Informe de la plataforma** (`/administracion/informe`, solo
  ADMIN; mockup aprobado:
  claude.ai/code/artifact/5e99c331-253a-4ec1-b5f1-cf84c196f34f).
  - **⚠️ LA SEMANA VA DE VIERNES A VIERNES** (decisión del usuario, y su
    razonamiento hay que conservarlo): la gente entra en las reuniones del
    **sábado (juvenil), domingo (familiar) y miércoles**, así que un corte de
    domingo a domingo dejaría a los del fin de semana **sin días hábiles** para
    llamarlos antes del cierre. Empezando el viernes quedan lunes, martes,
    miércoles y jueves dentro del mismo periodo. **El «mes» son, por lo mismo,
    4 semanas de viernes a viernes (28 días)**, no el mes del calendario.
  - **Esto resolvió el problema de medir la efectividad.** No hace falta una
    ventana rodante de 7 días: el periodo ya trae su propia ventana de cierre.
    Los que entran sobre el cierre (los 2 últimos días) salen aparte como
    **«aún en plazo»** y **no cuentan como perdidos**.
  - **`src/lib/informe.ts`**: `calcularRango` (matemática de periodos en hora
    Colombia, con `viernesDe`), `cargarInforme` y `cargarDetallePersonas`.
    `informe-catalogo.ts` para lo que toca el navegador (regla del 6-sep).
  - Bloques: tiles con **% contra el periodo anterior** (siempre con la cifra
    base al lado: de 1 a 3 también es «+200 %»), **embudo de efectividad**,
    **el recorrido** (personas por fase + neto del periodo + saltos y
    retrocesos), actividad día por día, Operación 72, hitos, y **tabla por
    consolidador con «sin tocar» y «efectividad»**.
  - **`/administracion/informe/personas`**: qué se le hizo a cada persona, con
    filtros (con movimiento · sin tocar · cambiaron de fase · dadas de baja).
  - **El neto por fase sale de `phase_change`**, no de fotos históricas (no
    existen): entradas menos salidas en el periodo. Es exacto.
  - **Tres trampas de SQL que `tsc` y `cf:build` NO ven** y que hay que probar
    contra la base (se probaron las tres):
    1. Un `generate_series` de días debe devolver el día como **texto**
       (`to_char`). Si vuelve como fecha, `pg` la construye en UTC y al
       formatearla en hora Colombia **se corre un día hacia atrás**.
    2. `CASE ${'$'}{parametro} WHEN …` falla con «could not determine data type»:
       hay que castear (`${'$'}{filtro}::text`).
    3. `IN (${'$'}{ids.join(...)})` en `$queryRaw` se parametriza como **un solo
       valor** y no filtra nada. Usar el ORM o `Prisma.join`.
  - La paleta de la gráfica de actividad (`#2f76c4` · `#c97b2c` · `#3f9f7a`)
    **pasó el validador de contraste y daltonismo**. No cambiarla a ojo.

- **2026-09-07** — **⚠️ La llave maestra no se podía guardar: Cloudflare limita
  PBKDF2 a 100 000 iteraciones.** Al pulsar «Guardar la llave maestra» salía la
  pantalla negra «This page couldn't load · A server error occurred».
  **Causa:** puse **210 000** iteraciones (la recomendación de OWASP) y el
  runtime de Workers **no acepta más de 100 000 en una sola llamada**:
  `crypto.subtle.deriveBits` lanza
  `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
  supported`. Es un tope duro de workerd para que nadie use el Worker como
  quemador de CPU ([workerd#1346](https://github.com/cloudflare/workerd/issues/1346)).
  **Arreglo: rondas encadenadas.** `derivar` da tantas vueltas de 100 000 como
  haga falta, y la salida de cada una alimenta la siguiente. Hoy **2 rondas =
  200 000 iteraciones** efectivas, sin que ninguna llamada pase del tope. El
  total se guarda en `master_key.iterations` y la verificación usa **el de la
  fila**, no la constante, así que subir las rondas mañana no invalida las
  llaves ya guardadas.
  **Probado**: misma llave → misma huella, otra llave → otra huella, 110 ms.
  **No hubo que migrar nada**: la tabla estaba vacía (nunca se llegó a guardar
  ninguna llave).
  **REGLA para todo lo que use `crypto.subtle` en este proyecto: el tope de
  PBKDF2 en Workers es 100 000 por llamada.** `tsc` y `cf:build` NO lo ven — es
  un error de ejecución, no de compilación.

- **2026-09-07** — **Generador de claves en los tres sitios que faltaban.**
  `generarContrasena` (`src/lib/contrasena.ts`) ya existía pero **solo se usaba
  en «Restablecer contraseña»**. Los demás campos eran texto pelado, así que la
  clave salía o muy corta (el sistema la rechazaba) o adivinable.
  - Componente compartido **`src/components/generador-de-clave.tsx`**: botón
    «Generar una» + «Copiar», y **muestra el valor en claro** a propósito — hay
    que poder leerlo para dictarlo antes de guardarlo.
  - Puesto en: **Crear acceso** (administración), **`/nueva-clave`** (la persona
    se pone la suya tras recuperar) y **Llave maestra**. En los dos últimos
    llena **las dos casillas** de una vez: copiar a mano algo que ya generó el
    sistema solo sirve para equivocarse.
  - **`generarLlaveMaestra`** para la llave: mismo alfabeto legible (sin l/1/I
    ni O/0) pero **tres bloques, 18 caracteres**, por encima del mínimo de 12.
    Sigue siendo dictable por teléfono a propósito: de nada sirve una llave
    invulnerable que haya que dejar escrita en un papel para no olvidarla.
  - `/nueva-clave` pasó a tener las dos casillas **controladas** (conservan su
    `name`, así que la Server Action sigue funcionando igual sin JS).

- **2026-09-07** — **Llave maestra: entrar a cualquier perfil con su correo.**
  Pedido del usuario. Le ofrecí tres formas y **eligió «llave maestra propia,
  aparte de tu contraseña»** (las otras dos eran «Ingresar como» desde
  Administración y usar literalmente la contraseña del administrador).
  **Por qué no es la contraseña del administrador**: si lo fuera, no se podría
  rotar sin cambiarle el ingreso a quien administra, y la contraseña del día a
  día pasaría a ser la llave de todo el sistema, incluidas las notas pastorales.
  - **Tabla `master_key`** (modelo `MasterKey`, migración
    `20260907140000_llave_maestra`). **El valor NUNCA se guarda**: solo su huella
    **PBKDF2-SHA256, 210 000 iteraciones, sal propia de 16 bytes**
    (`crypto.subtle`, que sí existe en el Worker). Comparación en tiempo fijo.
    Índice único parcial `((revoked_at IS NULL)) WHERE revoked_at IS NULL` para
    que solo haya una llave viva; rotar revoca la anterior en la misma
    transacción. Mínimo 12 caracteres.
  - **Cómo entra**: en `/ingresar`, si `signInWithPassword` falla **y** el correo
    es de un `app_user` activo, se comprueba la llave. Si acierta, se abre la
    sesión de ese perfil con la llave de servicio en **dos pasos**: Supabase Auth
    no tiene «entrar como», así que se genera un **magic link**
    (`admin.generateLink`, que no se envía a ninguna parte) y se canjea su
    `hashed_token` con `verifyOtp` en el cliente con cookies. Queda una sesión
    normal de esa persona. **Requiere `SUPABASE_SERVICE_ROLE_KEY`** en el Worker.
  - **La llave solo se comprueba tras un fallo y sobre un correo que existe y
    está activo**, y la respuesta es siempre la misma frase: así no sirve para
    averiguar qué correos hay.
  - **Auditoría**: `acceso.llave_maestra_usada` (con el perfil al que entró),
    `…_cambiada` y `…_revocada`, las tres con su `case` en `actividad.ts`.
    Ojo: en la de uso **no se usa `A()`** — quién escribió la llave no se sabe,
    es un secreto compartido; lo que se registra es **a qué perfil entró**.
  - **Pantalla `/administracion/llave-maestra`** (solo ADMIN, botón nuevo en la
    cabecera de Administración): ponerla, cambiarla o quitarla, con la fecha del
    último cambio y del último uso. Se escribe dos veces porque después nadie la
    puede volver a ver. **`LARGO_MINIMO_LLAVE` vive en
    `src/lib/llave-maestra-catalogo.ts`** por la regla del 6-sep: lo que usa el
    navegador va en el catálogo.
  - **Sin llave configurada, este camino no existe** — es el estado inicial.
  - **SOLO EL ADMINISTRADOR PRINCIPAL LA CONFIGURA** (aclarado por el usuario el
    mismo día): `CORREO_ADMIN_PRINCIPAL` + `esAdminPrincipal` en `auth.ts`, y
    `conAdminPrincipal` en `administracion/acciones.ts`. **Hay CUATRO ADMIN**
    (Administración Iglesia Vive, Alejandro Facundo, Juan Felipe Carvajal, Laura
    Charry), así que `ROLES_ADMIN` no bastaba: los cuatro habrían podido poner o
    quitar la llave. El botón tampoco se le muestra a los demás.
    El correo va **en el código, no en la base**: si viviera en una tabla,
    cualquier ADMIN podría ponerse a sí mismo como dueño desde Administración.
  - **Lo que NO se puede hacer, y hay que decirlo así:** limitar *quién usa* la
    llave. Se escribe en la pantalla de ingreso, **antes** de que exista sesión,
    así que el sistema no sabe quién la teclea — solo a qué perfil entró. La
    llave vale lo que valga el cuidado con que se guarde.

- **2026-09-07** — **Autorización de bajas: nadie sale del sistema sin que un
  administrador lo apruebe** (mockup aprobado:
  claude.ai/code/artifact/c045bd7e-341f-43dd-9063-6502384acc42).
  Antes, cualquiera del equipo de consolidación retiraba a una persona de un
  clic y eso era definitivo. Ahora hay dos manos.
  - **Tabla `baja_request`** (modelo `BajaRequest`, migración
    `20260907120000_solicitud_de_baja`): motivo, nota del consolidador, quién la
    pidió, estado (`PENDIENTE` · `AUTORIZADA` · `RECHAZADA` · `RETIRADA`), quién
    la resolvió y `resolution_note`. **Índice único parcial** para que solo haya
    UNA solicitud pendiente por persona.
  - **Núcleo en `src/lib/baja.ts`**: `solicitarBaja`, `resolverSolicitudDeBaja`,
    `retirarSolicitudDeBaja`, junto al ya existente `darDeBajaAprendiz` (que no
    cambió: sigue siendo lo que aplica la baja de verdad).
  - **Quién decide qué**: `puedeAutorizarBaja` (`auth.ts`, hoy = `ROLES_ADMIN`).
    **La regla va por el ACTOR, no por la pantalla**: quien puede autorizar la
    aplica directo desde donde sea; los demás la piden. Un PASTOR pide, no
    autoriza — corrige lo que dije al presentar el mockup.
  - **Pedir la baja NO saca a la persona del tablero.** Sigue en la columna y en
    la carga de su consolidador hasta que haya respuesta; si desapareciera, dar
    de baja sería una forma de aliviar carga sin que nadie revise el motivo.
  - **La nota es obligatoria al pedirla** (mín. 10 caracteres): es lo único que
    el administrador va a leer. Al dar de baja directo sigue siendo opcional.
  - **`/administracion/dados-de-baja` pasó a `/administracion/bajas`** («Bajas»
    en el menú), con la sección **PENDIENTES DE AUTORIZAR** arriba y el listado
    de siempre abajo, que ahora dice quién pidió y quién autorizó.
  - **`/administracion/bajas/<id>`**: la pantalla de revisión. Muestra el motivo,
    lo que escribió el consolidador y **lo que dice el sistema** — registros de
    `contact_attempt`, marcaciones reales de `call_log` (por `contactId` de
    HighLevel) y la hora en que la persona pidió que la llamaran. Ese cruce es
    lo que deja ver si de verdad se intentó.
  - **Devolver exige observación** (mín. 10 caracteres) y esa observación
    aparece en la tarjeta del tablero en el bloque azul **QUÉ HACER CON ESTA
    PERSONA**, con quién la escribió. Se queda a la vista hasta que se vuelva a
    pedir la baja (la solicitud más nueva reemplaza a la anterior).
  - **Reactivar también acepta observación** («¿Qué proceso se sigue con esta
    persona?»). Va al `learner_status_change` y a la auditoría, **no** a una
    tarjeta: reactivar no devuelve sola la Operación 72, así que la persona no
    vuelve al tablero.
  - Auditoría nueva: `operacion72.baja_solicitada` · `baja_autorizada` ·
    `baja_rechazada` · `baja_retirada`, las cuatro con su `case` en
    `actividad.ts`.

- **2026-09-07** — **La «hora de llamada» del CRM se estaba tirando a la basura.**
  El campo existe en HighLevel como **`contact.hora_llamada`**, id
  **`wWioQQ2mGFbj7d7hZw4R`**, nombre «Hora de llamada», tipo **LARGE_TEXT**
  (texto libre, NO una lista de franjas). Dos fallos encadenados:
  1. **La clave no coincidía.** El parser buscaba `callSchedules`,
     `call_schedules` y `horarioLlamada`. `normalizarClave` quita todo lo que no
     sea alfanumérico, así que `horarioLlamada` → `horariollamada` pero el campo
     real es `hora_llamada` → `horallamada`. **Nunca casaban**: el dato llegaba
     y se descartaba en silencio.
  2. **`listaHorarios` comparaba la cadena ENTERA** contra mañana/tarde/noche,
     así que «Tarde después de las 4 pm» no reconocía nada. Ahora busca las
     palabras **dentro** del texto.
  **Ahora un solo campo alimenta las dos cosas**: la franja que se reconozca
  (`callSchedules`) y el texto tal cual (`callScheduleNote`). Lo que no nombra
  franja («Después de las 2 pm», «Cualquier hora») se conserva íntegro en la
  nota.
  **También va de vuelta:** `exportarDatosPersona` ahora escribe el campo en el
  CRM (`CAMPO.horaLlamada`), porque es lo que el equipo mira antes de marcar.
  **Datos recuperados:** se leyeron los 220 contactos que tienen el campo en
  HighLevel y se rellenaron los que estaban en blanco → **76 personas
  recuperadas** (de 140 a 216 con hora) y 19 con franja reconocida. Solo se
  tocó lo vacío; nada escrito a mano se pisó.
  Ojo con el diagnóstico: **de 267 registros del CRM solo 9 tenían la hora**, y
  esos 9 eran del reenvío manual del 3-sep (yo controlaba el mapeo). O sea:
  **ningún registro real del workflow la traía**.

- **2026-09-06** — **El id de HighLevel de Nora Bonilla estaba mal por DOS
  caracteres** y por eso María Eugenia Chávez se quedó «sin consolidador»
  aunque en el CRM sí se le había asignado a Nora.
  ```
  HighLevel : t8HuZDPMHztakrzIFIJQ
  Sistema   : t8HuZDPMHztakrzlFlJQ
                             ^ ^   (I mayúscula vs l minúscula)
  ```
  Error de transcripción al copiar el código a ojo de la lista «Mi personal».
  **Corregido en `app_user`** y reenviada la asignación: María Eugenia quedó con
  Nora. **Se validaron los 15 ids contra `GET /users/<id>` de la API: los otros
  14 están bien.** Solo había 1 contacto de Nora en el CRM, así que no hubo más
  arrastre; y las 90 llamadas de `call_log` ya estaban bien atribuidas (el
  webhook de llamadas la reconocía por correo).
  **El sistema se comportó bien**: preguntó a la API, no encontró al usuario y
  **se negó a tocar el consolidador** (422) en vez de adivinar.
  **Mejora hecha:** ese rechazo era **invisible** —la respuesta se la queda
  HighLevel— así que ahora se **audita** (`highlevel.usuario_sin_mapear`) y sale
  en «Actividad del día» en rojo con el id, para poder corregirlo.
  **Cómo validar todos los ids de un tirón:** `GET
  services.leadconnectorhq.com/users/<id>` con el PIT — 200 = existe (devuelve
  el nombre), 404 = mal copiado.

- **2026-09-06** — **⚠️ SE ROMPIÓ `main` y se arregló (PR #64). Dos lecciones.**
  1. **Squash sobre historia ya fusionada duplica código.** Los PR #62 y #63 se
     fusionaron con squash sobre ramas que ya contenían el mismo bloque, y
     `resolverDeclaracion` quedó **dos veces** en `liderazgo.ts`. Al reiniciar la
     rama desde `main` (§5), **verificar que no quedó nada duplicado**.
  2. **`tsc` NO basta antes de fusionar: hay que correr `npm run cf:build`.**
     `liderazgo.ts` pasó a importar `highlevel-salida` (que arrastra `pg` y
     `fs`/`net`/`tls`/`dns`) y el formulario, que es **componente de cliente**,
     importaba de ahí → esos módulos acababan en el paquete del navegador y el
     build se caía con «Module not found: Can't resolve 'dns'». `tsc` pasó
     igual; solo el build lo vio.
     **Arreglo estructural: `src/lib/liderazgo-catalogo.ts`** con las listas y
     formatos que usan los dos lados. **REGLA: lo que use el navegador va en el
     catálogo; lo que toque base de datos o red, en `liderazgo.ts`.** El mismo
     cuidado vale para cualquier `lib` que importe un componente `"use client"`.

- **2026-09-06** — **El id de HighLevel de Nora Bonilla estaba mal por DOS
  caracteres** y por eso María Eugenia Chávez se quedó «sin consolidador»
  aunque en el CRM sí se le había asignado a Nora.
  ```
  HighLevel : t8HuZDPMHztakrzIFIJQ
  Sistema   : t8HuZDPMHztakrzlFlJQ
                             ^ ^   (I mayúscula vs l minúscula)
  ```
  Error de transcripción al copiar el código a ojo de la lista «Mi personal».
  **Corregido en `app_user`** y reenviada la asignación: María Eugenia quedó con
  Nora. **Se validaron los 15 ids contra `GET /users/<id>` de la API: los otros
  14 están bien.** Solo había 1 contacto de Nora en el CRM, así que no hubo más
  arrastre; y las 90 llamadas de `call_log` ya estaban bien atribuidas (el
  webhook de llamadas la reconocía por correo).
  **El sistema se comportó bien**: preguntó a la API, no encontró al usuario y
  **se negó a tocar el consolidador** (422) en vez de adivinar.
  **Mejora hecha:** ese rechazo era **invisible** —la respuesta se la queda
  HighLevel— así que ahora se **audita** (`highlevel.usuario_sin_mapear`) y sale
  en «Actividad del día» en rojo con el id, para poder corregirlo.
  **Cómo validar todos los ids de un tirón:** `GET
  services.leadconnectorhq.com/users/<id>` con el PIT — 200 = existe (devuelve
  el nombre), 404 = mal copiado.

- **2026-09-06** — **⚠️ ROMPÍ `main` y lo arreglé (PR #64). Dos lecciones.**
  1. **Squash sobre historia ya fusionada duplica código.** Los PR #62 y #63 se
     fusionaron con squash sobre ramas que ya contenían el mismo bloque, y
     `resolverDeclaracion` quedó **dos veces** en `liderazgo.ts`. Al reiniciar la
     rama desde `main` (§5), **verificar que no quedó nada duplicado**.
  2. **`tsc` NO basta antes de fusionar: hay que correr `npm run cf:build`.**
     `liderazgo.ts` pasó a importar `highlevel-salida` (que arrastra `pg` y
     `fs`/`net`/`tls`/`dns`) y el formulario, que es **componente de cliente**,
     importaba de ahí → esos módulos acababan en el paquete del navegador y el
     build se caía con «Module not found: Can't resolve 'dns'». `tsc` pasó
     igual; solo el build lo vio.
     **Arreglo estructural: `src/lib/liderazgo-catalogo.ts`** con las listas y
     formatos que usan los dos lados. **REGLA: lo que use el navegador va en el
     catálogo; lo que toque base de datos o red, en `liderazgo.ts`.** El mismo
     cuidado vale para cualquier `lib` que importe un componente `"use client"`.

- **2026-09-05** — **El formulario de liderazgo ahora SÍ escribe en HighLevel**
  (decisión del usuario: exportar todo, crear y actualizar).
  Se había quedado sin exportar nada, a diferencia de los otros tres caminos que
  crean o actualizan el contacto. Ahora `guardarActualizacionDeLiderazgo` llama
  a `exportarDatosPersona` **fuera de la transacción** (es red: sostenerla dentro
  dejaría ocupada la única conexión de BD de la petición) y best-effort.
  `exportarDatosPersona` cubre los dos casos por sí sola: si ya hay enlace
  actualiza el contacto, y si no lo hay llama a `exportarContactoNuevo`, que usa
  **`/contacts/upsert`** — así un líder que ya existe en el CRM se reconoce por
  teléfono o correo y **no se duplica**.
  **Los hitos y la etapa NO se exportan**: no existen en HighLevel.
  Consecuencia asumida: el liderazgo queda mezclado con los contactos de
  consolidación en el CRM. Se le ofrecieron al usuario tres opciones (no
  exportar / exportar todo / solo actualizar sin crear) y eligió exportar todo.

- **2026-09-04** — **Consolidador: sincronización de DOBLE VÍA con HighLevel**
  (decisión del usuario: «que se sincronicen mutuamente; si se cambia acá, se
  cambia allá, y viceversa»).
  **Quién decide el consolidador: un flujo de HighLevel**, casi al instante del
  registro. El sistema solo preguntaba **una vez, en el alta**, y nunca volvía a
  escuchar ni a avisar.
  - `sincronizarConsolidador` (`src/lib/consolidador.ts`) es ahora el **único**
    camino para cambiar el consolidador. Audita `consolidador.reasignado` con
    `metadata.origen` = `sistema` | `highlevel`.
  - `exportarConsolidador` escribe el `assignedTo` del contacto cuando el cambio
    nació acá. `consultarDuenoDelContacto` pregunta quién es el dueño.
  - `POST /api/integraciones/highlevel/asignacion` recibe los cambios del CRM.
    **Al paso Webhook le basta `contactId = {{contact.id}}`**: qué merge-tags
    existen cambia entre versiones y disparadores (⚠️ **`{{contact.assigned_to}}`
    NO existe en este panel** — lo confirmó el usuario), así que si el cuerpo no
    trae usuario, el sistema **le pregunta a la API**, que es la respuesta
    autorizada. Trigger: **«Contacto Modificado» → «Usuario asignado ha
    cambiado»**.
  - **El eco se corta con una sola regla**: si el valor que llega ya es el que
    hay, no se escribe nada ni se devuelve nada. El segundo rebote se apaga solo.
  - Un usuario de HighLevel sin mapear **no borra** el consolidador (422); si la
    API no responde, tampoco se toca nada (503).
  - **`HIGHLEVEL_API_TOKEN` SÍ existe en el Worker** (confirmado por el usuario
    el 4-sep). Con él funciona la consulta a la API y la mitad «sistema → CRM».
  **VIVO Y PROBADO EN PRODUCCIÓN (4-sep):**
  1. Prueba propia: POST con **solo `contactId`** → el sistema consultó la API y
     movió a **María Julieth Durán** de Jakeline Guerrero a **Ana Lucía
     Gutiérrez** (que es quien de verdad la llamaba). El envío repetido devolvió
     **`sin_cambios`**: el anti-eco funciona.
  2. Prueba del usuario: cambió el usuario asignado de un contacto en HighLevel
     y **el workflow disparó solo** — **Juan Felipe Rojas** pasó de Freddy Cadena
     a **Santiago Viveros**, con `origen: highlevel` en la auditoría.
  El usuario dejó el cuerpo con `contactId` + `userId`. **No se puede saber por
  la bitácora cuál de los dos caminos trajo el dato** (merge-tag o consulta a la
  API) y da igual: el resultado es el mismo, que era el objetivo de no depender
  de la etiqueta.
  **Estado medido antes del arreglo** (414 fichas enlazadas): 186 coinciden,
  **206 sin dueño en HighLevel** (193 son el import masivo de agosto, que nunca
  pasó por el flujo) y **21 con dueño distinto** — las 21 son cambios hechos
  **del lado del sistema** que nunca se le contaron al CRM.
  **DECISIÓN DEL USUARIO: las de Johana Ramírez en el CRM se dejan quietas. No
  volver a proponerlo ni recordarlo.**
  **Lección de método:** `dateUpdated` de un contacto de HighLevel es la última
  modificación **por cualquier motivo** — NO dice cuándo se asignó el usuario.
  Deduje de ahí una «carrera» que no existía; la evidencia buena está en
  `audit_log`, en `metadata.highLevelOwnerId` del `persona.registrada`.

- **2026-09-04** — **Auditoría de las llamadas del día: 6 personas estaban en la
  columna equivocada; corregidas.** Se cruzaron los **33 envíos de formulario de
  hoy** (26 personas distintas) contra la columna real de cada tarjeta.
  **Resultado: 20 correctas, 6 mal.** Las 6 quedaron mal porque su registro
  **nunca llegó al sistema**: cayeron en la **ventana 09:58–11:55** (hora
  Colombia), justo cuando el paso Webhook del workflow de llamadas tenía la
  URL y el secreto equivocados. Recuperadas reenviando el envío original:
  - **Jaime Arturo** (contestó) INICIADA → **CONTACTADA**
  - **Marly Yulieth** (contestó) INICIADA → **CONTACTADA**
  - **Geraldine Fernández** (contestó 11:20) SEGUIMIENTO → **CONTACTADA**
  - **Yenny Patricia** (no contestó) INICIADA → **SEGUIMIENTO**
  - **Margarita Rojas** (no contestó) INICIADA → **SEGUIMIENTO**
  - **Diego Alejandro Barrera** (no contestó) INICIADA → **SEGUIMIENTO**
  **De 12:43 en adelante TODO entró bien**: cada envío deja su
  `highlevel.seguimiento_recibido` 1–5 s después y la tarjeta se movió sola.
  **No se reenvían** los envíos perdidos cuyo efecto ya estaba cubierto por otro
  posterior que sí llegó (mismo resultado, mismas 12 h): duplicarían el intento
  sin cambiar la columna.
  **Cuatro personas llamadas hoy no tienen columna y está bien**: Tatiana
  Torres, Laura Patricia Muñoz, Gilberto Matheus y Katherine García están
  **dadas de baja** (Op72 CERRADA), así que el registro se acepta y no mueve
  nada. **Verificado por hora: en las cuatro la llamada fue ANTES de la baja**,
  y la baja salió de esa misma llamada (1, 1, 21 y 3 minutos después; la nota de
  baja repite lo que dijo la persona). O sea: **el equipo NO está llamando gente
  ya retirada** — está llamando, enterándose y dando de baja en el acto, que es
  el uso correcto. Bajas hechas por Nini Guerrón (1) y Nora Bonilla (3).
  Efecto colateral: como los registros de Laura Patricia (11:53) y Tatiana
  (11:55) cayeron en la ventana perdida y al reenviarlos la Op72 ya estaba
  cerrada, **la observación de esas dos llamadas no quedó en el expediente**;
  sí quedó, casi con las mismas palabras, en la nota de la baja.
  **La regla quedó comprobada en producción**: no contestó → SEGUIMIENTO ·
  contestó → CONTACTADA · visita confirmada → VISITA PENDIENTE, y una vez
  CONTACTADA un «no contestó» posterior **no** la devuelve.

- **2026-09-04** — **`HIGHLEVEL_WEBHOOK_SECRET` ROTADO** (ya no es pendiente).
  Se generó uno nuevo de 48 caracteres y se cambió en los **cuatro** sitios:
  Cloudflare (Settings → Variables and Secrets, **Type = Secret**, nunca Text) y
  los **tres** workflows de HighLevel (paso Webhook → header
  `x-iglesia-webhook-secret`). El valor **no vive en el repo**: está en
  Cloudflare y en los workflows.
  **Verificado** con la prueba de contacto inexistente en las tres rutas:
  `/visita` 404, `/registro-nuevo` 422, `/llamada` 200 con el **nuevo**; y
  **401 en las tres** con el viejo. O sea: el nuevo autoriza y el viejo ya no.
  **Ventana de rotación: se perdieron 4 envíos de formulario** (rechazados con
  401 mientras el secreto no coincidía). Se recuperaron todos leyendo
  `GET /forms/submissions?locationId=…` con el PIT y **reenviándolos al webhook**
  con el secreto nuevo:
  - **Margarita Campos** → SEGUIMIENTO («se hizo 2 llamadas no contesto»).
  - **Daniel Mejía** → VISITA PENDIENTE (visita del 5 de sept confirmada).
  - **Tatiana Torres** y **Laura Patricia Muñoz** → `sin_cambios`, **correcto**:
    su Operación 72 ya está **CERRADA**, así que la llamada no tenía tarjeta que
    mover. La observación de esas dos llamadas sí quedó solo en HighLevel.
  **Cómo auditar una pérdida de envíos** (receta reutilizable): cruzar
  `GET /forms/submissions` (createdAt + contactId) contra
  `select … from audit_log where action like 'highlevel%'` — cada envío que
  llegó deja un `highlevel.seguimiento_recibido` **1–5 s después**; el que no
  aparece, se perdió. Para reenviarlo basta un POST con el `contactId`,
  `locationId` y los **ids de campo** tal como vienen en `others` (el parser los
  reconoce por id).

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
  **⚠️ Rotar `HIGHLEVEL_WEBHOOK_SECRET` — HECHO el mismo 4-sep (ver arriba).** Su valor completo
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
