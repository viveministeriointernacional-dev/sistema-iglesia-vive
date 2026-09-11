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

- **2026-09-11** — **Las 7 «visitas» del 9-sep no eran visitas: eran gente que
  YA lleva proceso. Corregidas (6 por mí, 1 por el usuario).**
  **Cómo se descubrió, que es la parte que vale:** buscando a quién preguntarle
  por la hora inverosímil, se leyeron **las observaciones** de cada registro:
  «miembro activo de Casa Vive», «ha vivido su proceso con Pas. Felipe y Aleja»,
  «está recibiendo mentoría de parejas (Pas. Cristina)». Las siete las registró
  **Nini Guerrón** una tras otra entre 11:01 y 11:15. **No estaba agendando
  visitas: no tenía dónde decir eso**, así que usó «Agendar visita» y puso la
  hora en la que estaba llenando el formulario.
  ⚠️ **Mi hipótesis anterior —«se abrió el selector del celular y quedó en
  ahora»— era FALSA.** La evidencia estaba en las observaciones y no las había
  leído. **LECCIÓN: antes de teorizar sobre un dato raro, leer la observación
  que lo acompaña.** El equipo casi siempre escribió la verdad en alguna parte.
  **Lo aplicado a las 6** (Francisco Sandoval, Saidy Aragón, Jenny Ruiz,
  Valentina Cubillos, Nicolás y Óscar Tabares), replicando lo que hace
  `pasarAEntregaPorProcesoPrevio`: a **LISTA PARA ENTREGA**, `detail` y
  `prior_process_note` con **la nota que Nini ya había escrito** (verbatim, sin
  reescribirla), mentor propuesto, y la **visita falsa ANULADA** con
  `annulled_reason` explicando que nunca fue una visita.
  **⚠️ CÓMO SE VALIDÓ LA PROPUESTA DE MENTOR SIN PODER EJECUTAR EL CÓDIGO** (no
  hay `DATABASE_URL` en el entorno, así que solo se puede SQL por el MCP): se
  reprodujo la regla de `proponerMentor` en SQL —sin línea de origen y sin
  género registrado en ninguna de las 6, así que cae a `elegirPorCarga`: menor
  carga, a igual carga mayor capacidad libre, a igual todo el primero por
  nombre— y dio **Laura Charry**. **El sistema real había propuesto
  exactamente Laura Charry** para Mateo Tabares minutos antes, lo que confirma
  que la réplica es fiel. **Esa es la forma de comprobar una réplica en SQL:
  buscar un caso que el código ya resolvió y ver si coincide.**
  **⚠️ Mateo Tabares lo movió el usuario ANTES, por el camino viejo**
  («Cerrar visita y preparar entrega», 11-sep 3:13 p. m.), y eso **le dejó en
  el expediente un `contact_attempt` «Visita realizada»** con nota «Ya esta se
  encuentra en un proceso.» — **una visita que nunca se hizo**. Es justo lo que
  el botón nuevo evita. **NO se tocó**: fue una decisión suya, consciente y de
  hace minutos; se le preguntó si quiere limpiarlo.
  Todo probado con `BEGIN … ROLLBACK` en la misma llamada antes de aplicar, y
  verificado después: las 6 en LISTA PARA ENTREGA, con su nota, su mentor y su
  visita anulada.

- **2026-09-11** — **El PR #81 entró COMPLETO y las dos migraciones corrieron**
  (`20260911200000_visita_anulada` · `20260911213000_proceso_previo`),
  verificado en `app_migration` y en las columnas: 3 `annulled%` en
  `contact_attempt` y `prior_process_note` en `operation72`.
  `git log --oneline origin/main..origin/<rama>` quedó **vacío**: esta vez no se
  quedó nada fuera. **Y la mejor prueba de que el despliegue está vivo no la
  puse yo**: el usuario usó el tablero minutos después del merge.

- **2026-09-11** — **⚠️ SEGUNDA VEZ QUE UN MERGE SE LLEVA SOLO PARTE DEL
  TRABAJO. Regla nueva para que no haya una tercera.**
  El **PR #80 se fusionó a los DOS MINUTOS de abrirlo** (abierto 19:20:34,
  fusionado 19:22:23), cuando la rama solo tenía sus **dos primeros commits**.
  Los **tres siguientes quedaron huérfanos** y **sus dos migraciones nunca
  corrieron**: se comprobó en la base —0 columnas `annulled%`, 0
  `prior_process_note`, 0 migraciones `202609112%` registradas— mientras `main`
  sí tenía el arreglo de las cinco horas. Pasó igual con el PR #77 el mismo día.
  **REGLA: NO abrir el PR hasta que TODO el trabajo esté empujado.** El usuario
  fusiona en minutos, no en horas, así que un PR abierto es un PR que ya se
  está fusionando. Si hace falta seguir trabajando después de abrirlo, avisarle
  explícitamente de que no lo fusione todavía.
  **Y la comprobación que lo destapa en un segundo**, que hay que hacer
  siempre después de un merge:
  `git log --oneline origin/main..origin/<rama>` — si devuelve algo, **eso se
  quedó fuera**. Mirar el `commits` y el `head.sha` del PR también lo dice.
  Arreglado con §5: rama rehecha desde `main`, los tres commits por encima
  (`cherry-pick`), **cero duplicados verificados función por función** (la
  lección del 6-sep), build y pruebas en verde, PR #81 nuevo.
  ⚠️ **Ojo con la trampa de creer que ya está**: `main` contenía los commits del
  PR y el sitio estaba desplegado, así que «el merge entró» era cierto **y aun
  así faltaba la mitad del trabajo**. Que `main` avance no significa que
  avanzara con todo.

- **2026-09-11** — **Atajo para quien YA lleva proceso en la iglesia: pasa
  directo a LISTA PARA ENTREGA** (pedido del usuario: «hay personas que ya
  hacen parte de la iglesia, ya llevan un proceso, pero están en alguna fase de
  Operación 72… pendiente por asignar mentor»).
  **El problema, que es el de fondo del tablero:** Operación 72 da por hecho
  que la persona es **nueva** —llamarla, acordar visita, hacerla—. Pero entra
  gente que **ya se congrega y ya lleva proceso** (hizo Alpha, está en una Casa
  de Fe, se bautizó), y con ella esos tres pasos no tienen sentido: no hay nada
  que averiguar por teléfono ni ninguna casa que visitar. Lo único que le falta
  es **mentor**. Sin el atajo había que **fingir una llamada y una visita que
  nunca ocurrieron** para poder entregarla.
  - **Enlace «Ya lleva proceso · pasar a entrega»** en el pie de la tarjeta,
    **desde las CUATRO columnas** (iniciada, seguimiento, contactada, visita
    pendiente): que alguien ya esté en la iglesia no depende de en qué casilla
    cayó su tarjeta. `pasarAEntregaPorProcesoPrevio` en
    `operacion-72/acciones.ts`. Las cuatro se escriben una por una en la acción
    (no `ESTADOS_EN_TABLERO`, que incluye la quinta).
  - **⚠️ NO se inventa ninguna visita.** `cerrarVisita` deja un
    `contact_attempt` VISITA con «Visita realizada» porque ahí sí se hizo; aquí
    **no se crea ningún intento**. Escribir «visita realizada» metería en el
    expediente una visita que nadie hizo — el mismo error que evitan las otras
    acciones del día.
  - **Sí propone mentor** (`proponerMentor`, igual que `cerrarVisita`), así que
    la tarjeta llega a la última columna con su candidato y solo hay que
    confirmarlo. Queda **pendiente de mentor, NO entregada**.
  - **⚠️ COLUMNA NUEVA `prior_process_note`** (migración
    `20260911213000_proceso_previo`) **y no `detail`**, que fue el hallazgo
    importante: `detail` es un resumen libre que **la siguiente acción
    reescribe**, así que la nota se habría perdido justo antes de que el mentor
    la necesitara.
  - **⚠️ LO QUE CASI QUEDÓ MAL, y hay que recordarlo: el correo al mentor NO
    lee `operation72.detail`.** Yo había escrito en el panel «es lo que va a
    leer el mentor» y **era falso** — se comprobó con `grep detail` sobre
    `correo-entrega.ts` y `correo.ts`: **cero coincidencias**. Arreglado de
    verdad: la nota entra en el bloque **«quién es»** del correo como «Ya lleva
    proceso». Va ahí y **no en el historial** porque no es algo que pasó en una
    fecha, es quién es la persona — y sin ella el mentor recibiría **un
    historial casi vacío** (solo el registro) sin saber por qué.
  - **La tarjeta también lo dice.** Ojo: desde el 3-sep **la tarjeta no pinta
    `detail`**, así que sin esto la persona aparecería en «Lista para entrega»
    **sin ninguna explicación**. Se añadió al bloque verde de entrega: «Ya
    lleva proceso · …».
  - Auditoría `operacion72.pasa_a_entrega_por_proceso_previo` (catálogo en
    `audit.ts` + `case` en `actividad.ts`, en verde, con `desde` = la columna de
    la que venía).
  - **La nota es obligatoria** (mín. 10 caracteres), como en los demás paneles:
    es lo único que le explica al mentor por qué le llega alguien sin llamada
    ni visita.
  - Migración probada con `BEGIN … ROLLBACK` en la misma llamada, repetida
    entera para comprobar que es idempotente, y verificado después que
    producción quedó en 0 columnas.
  - **Dato de contexto medido de paso: hay 47 personas en LISTA PARA ENTREGA**,
    todas con mentor propuesto, esperando que alguien confirme la entrega.

- **2026-09-11** — **Deshacer una visita agendada a la persona EQUIVOCADA: el
  tercer caso, y el primero en que el tablero RETROCEDE** (pedido del usuario:
  «se le asigna una visita por error… nos equivocamos de persona»).
  **Por qué no servía nada de lo que había, que es lo que hay que entender
  antes de tocar esto:** el tablero **solo avanzaba**. Las dos herramientas de
  visita daban por hecho que la visita EXISTÍA — «se movió» (se corrió) y «la
  fecha estaba mal escrita» (existía a otra hora). Aquí **la visita nunca
  existió para esa persona**, y la única salida era dejarla esperando una
  visita que nadie iba a hacer.
  - **Botón «No era esta persona»** en la tarjeta, junto a «Cambiar la fecha»,
    y solo si hay visita acordada. `deshacerVisitaAgendada` en
    `operacion-72/acciones.ts`.
  - **⚠️ EL REGISTRO SE ANULA, NO SE BORRA** (decisión del usuario). Migración
    `20260911200000_visita_anulada`: `annulled_at`, `annulled_by_id`,
    `annulled_reason` en `contact_attempt`. Anulado **deja de pintar en la
    tarjeta y de ordenar la columna** —que es lo que había que arreglar— pero
    **sigue visible, TACHADO, en el expediente**, con quién lo deshizo y por
    qué. Borrarlo dejaría la ficha sin ninguna explicación de por qué la
    tarjeta se movió y volvió, que es justo lo que alguien va a querer entender
    dentro de seis meses.
  - **⚠️ VUELVE A CONTACTADA, no a INICIADA ni a SEGUIMIENTO** (decisión del
    usuario). La llamada a esa persona **sí ocurrió** y ya se habló con ella;
    devolverla al principio la pondría otra vez en la fila de «hay que
    llamarla», que es falso.
  - **⚠️ LA LLAMADA DEL MISMO ENVÍO SE CONSERVA** (decisión del usuario).
    Alguien marcó y alguien habló — lo que se equivocó fue **a qué ficha se le
    apuntó la visita**. Anularla le quitaría a esa persona un contacto que de
    verdad recibió y la dejaría pareciendo desatendida.
  - **⚠️ LOS CINCO SITIOS QUE HAY QUE FILTRAR, y ninguno es opcional** (anular
    sin tocarlos habría dejado la tarjeta exactamente igual):
    1. `operacion-72/page.tsx` — la consulta de intentos (`annulledAt: null`):
       pinta la visita acordada **y el último movimiento**.
    2. `tablero-op72.ts` — el `LEFT JOIN LATERAL` de `ORDEN_VISITA`: sin el
       filtro, la columna seguiría **ordenándose por una visita que ya no
       existe**.
    3. `correo-entrega.ts` — el mentor buscaría a alguien en una visita
       retirada.
    4. `administracion.ts` (asistentes) — una visita anulada **no cuenta como
       contacto**: si contara, el indicador ámbar de «nadie le habla hace 90
       días» daría por atendido a quien nadie atendió.
    5. `expediente.ts` — **aquí SÍ entran**, es el único sitio donde deben
       constar. Tono nuevo `anulado` en `HitoLineaDeTiempo` → tachado y gris.
    `mi-proceso` **no** hizo falta tocarlo: `miHistoria` nunca incluyó los
    contactos, así que la persona no ve esto.
  - **`anularVisitaEnHighLevel`** limpia «Confirmación de visita» y «Fecha
    visita» del contacto. **Sin esto el arreglo sería inútil**: el equipo de
    consolidación trabaja **solo con el CRM** (§6), así que el CRM seguiría
    diciendo «visita confirmada» y alguien iría a visitar a quien no era.
  - Auditoría `operacion72.visita_anulada` (catálogo en `audit.ts` + `case` en
    `actividad.ts`, en **rojo**: no es un ajuste de agenda, es un registro que
    se retira). **NO entra en el contador de visitas del día**: se retiró, no
    se hizo.
  - Migración probada con `BEGIN … ROLLBACK` en la misma llamada, **incluida la
    repetición entera para comprobar que es idempotente** (§5), y verificado
    después que producción quedó en 0 columnas. La consulta de orden con el
    filtro nuevo devuelve **28**, las mismas 28 tarjetas de VISITA PENDIENTE
    con visita: ninguna pierde la suya.

- **2026-09-11** — **El campo «Hora visita» de HighLevel quedó VIVO y probado
  con envíos reales.** El usuario lo puso en el formulario **Registro Llamada
  Línea** y llegó de inmediato: id **`YncLUTwKQ7eNkYLPhF3G`**, en `others` del
  envío. Dos envíos el 11-sep: «4:00 pm» (prueba) y **«5 p.m» → Lourdes Cruz
  González quedó con la visita el 14 de sept a las 17:00 hora Colombia**, o sea
  que `horaDesdeCrm` y `fechaDesdeCrm` hacen lo suyo en producción.
  **Cómo se comprueba sin entrar al panel** (receta): `GET
  /forms/submissions?locationId=…&formId=07rGKuRchJO15bxL2Unj` con el PIT y
  mirar si el id del campo aparece en `others`. ⚠️ **`GET /forms/` NO sirve para
  esto**: devuelve los formularios con `fields: []`, así que no dice qué campos
  tiene ninguno. **El envío real es la única evidencia.**
  **Fallo encontrado al revisar, y arreglado: el resumen no imprimía la hora.**
  El detalle del CRM se formateaba con día y mes a secas («Visita 14 de sept»)
  aunque la hora ya estuviera guardada bien. Era correcto cuando la hora no
  existía —imprimir el mediodía de relleno habría **afirmado una hora que nadie
  pactó**— pero ahora hay que distinguir los dos casos.
  **`horaConocidaDelCrm(valor, hora)`** dice si la hora la dijo alguien o es el
  mediodía de relleno, y el detalle usa un formateador con hora solo en el
  primer caso. **Esta distinción es la razón de ser del helper**: varias
  observaciones dicen literalmente «está por confirmar la hora», así que ahí el
  mediodía significa «falta confirmar» y mentir sobre eso es peor que no decirlo.
  Corregido a mano el resumen de Lourdes (la única ya guardada con hora conocida
  y resumen sin ella). **7 casos nuevos en `fecha-crm.test.ts`.**

- **2026-09-11** — **⚠️ QUINTA TRAMPA DE FECHAS, y la más caliente: un
  `<input type="datetime-local">` manda la hora SIN ZONA, y el servidor corre
  en UTC.** Lo reportó el usuario después de que el arreglo del repintado no
  bastara: «se ajusta la hora de visita pero sale mal, no sé si es porque está
  tomando el uso horario mal». **Tenía razón.**
  **La causa.** El campo entrega `2026-09-11T16:30` — una cadena **sin `Z` y
  sin `±HH:mm`**. `new Date()` sobre eso la resuelve **en la zona del
  servidor**, que en Cloudflare Workers es **UTC**. Así que las 4:30 de la
  tarde que escribía el consolidador se guardaban como 16:30 UTC, o sea
  **11:30 de la mañana en Colombia**. **Cinco horas menos, en toda visita
  agendada o movida desde el tablero, y en todo evento creado.**
  **La prueba que lo cerró:** Ana López. El usuario dijo «la hora es 4:30 pm»,
  la base decía **11:30 a. m.** — exactamente el desfase, sin margen de duda.
  **Arreglo: `momentoDesdeCampo(valor)` en `dominio.ts`**, que es **la otra
  mitad de `momentoParaCampo`**. Le pega `DESFASE_COLOMBIA` (`-05:00`, fijo
  todo el año) antes de construir la fecha, y **respeta el valor que ya traiga
  zona**. Usado en `agendarVisita`, `reprogramarVisita` y `crearEvento`.
  **REGLA: nunca `new Date(<lo que venga de un datetime-local>)`. Siempre
  `momentoDesdeCampo`.** Los dos helpers son un par: si se pinta el campo con
  `momentoParaCampo`, se lee con `momentoDesdeCampo`. **La prueba que importa
  es la de ida y vuelta** (`momento-campo.test.ts`): el panel de reprogramar
  rellena con uno y guarda con el otro, así que si las dos mitades no cuadran,
  **abrir el panel y guardar sin tocar nada corre la hora**.
  **⚠️ Lo que salva de perseguir fantasmas: el camino del CRM NUNCA tuvo el
  fallo.** `fechaDesdeCrm` ya construía la fecha con el offset puesto. Por eso
  en la base convivían visitas buenas (las del CRM, con su hora correcta) y
  malas (las del tablero, cinco horas antes), y comparar unas con otras es lo
  que permite saber de qué lado está el error.
  **Datos corregidos: las 9 tarjetas vivas de VISITA PENDIENTE agendadas desde
  el tablero** (+5 h en `contact_attempt.scheduled_at` **y** en
  `operation72.detail`, que es la regla del día anterior: cambiar solo la fecha
  deja la tarjeta mintiendo). Ana López quedó en **11 de sept, 4:30 p. m.**,
  que es exactamente lo que el usuario había escrito — la mejor comprobación de
  que sumar 5 h reconstruye lo que se teclteó. Probado con `BEGIN … ROLLBACK` en
  la misma llamada antes de aplicar.
  **⚠️ PENDIENTE DEL USUARIO — 7 de esas 9 quedaron con hora inverosímil**
  (Francisco Sandoval, Saidy Aragón, Jenny Ruiz, Valentina Cubillos y los tres
  Tabares: todas del 9-sep entre 11:01 y 11:15). En esas, la hora guardada era
  **exactamente el momento en que se llenó el formulario**, así que lo más
  probable es que en el celular se abrió el selector, marcó «ahora» y se
  aceptó. Corregirlas devuelve lo que se tecleó, pero **eso no es una hora de
  visita real**: hay que preguntarle al equipo a qué hora era cada una.
  **NO se tocaron las 54 visitas históricas** (columnas ya cerradas): la
  corrección se limitó a lo que el equipo va a usar hoy.

- **2026-09-11** — **⚠️ BUG REAL Y VIEJO: las acciones guardaban bien pero la
  PANTALLA no se repintaba.** Lo reportó el usuario: «a Ana López le acabo de
  cambiar la hora de visita pero no realizó el cambio». **Sí la realizó** — y
  dos veces, porque al no ver el cambio lo volvió a hacer: quedaron dos
  reprogramaciones con **un minuto de diferencia** (4:30 p. m. → 11:30 a. m. →
  11:29 a. m.).
  **La causa.** Las acciones del servidor llaman `revalidatePath`, que **limpia
  la caché del servidor pero NO repinta la página que el navegador ya tiene**.
  `ejecutar` en `tarjeta.tsx` cerraba el panel y no pedía nada más, así que el
  dato quedaba guardado y en pantalla seguía el valor viejo.
  **Arreglo: `router.refresh()` después de cada acción exitosa.**
  **⚠️ POR QUÉ NADIE LO HABÍA NOTADO EN MESES, que es la parte útil:** casi
  todas las acciones del tablero **mueven la tarjeta de columna**, y ese salto
  tapaba el problema. Reprogramar una visita fue la primera acción en la que
  **la tarjeta se queda en su sitio y lo único que cambia es un dato** — ahí
  quedó a la vista.
  **REGLA: toda acción de servidor que muta y deja al usuario en la misma
  pantalla necesita `router.refresh()`. `revalidatePath` NO basta.**
  **Barrido hecho**: de 22 componentes con `useTransition`, **12 ya lo tenían**,
  **1 no lo necesita** (`buscador-personas.tsx` solo lee) y **9 no lo tenían**.
  Arreglados los 3 donde el efecto es claro y no hay estado local que pelear:
  `operacion-72/tarjeta.tsx`, `administracion/asistentes/volver.tsx` y
  `components/formulario-datos-persona.tsx`.
  **Quedan 3 por revisar con cuidado** — `administracion/[id]/declaracion.tsx`,
  `expediente/[id]/casa-de-fe.tsx` y `expediente/[id]/panel-lateral.tsx`:
  **los tres llevan su propio estado local y se actualizan solos**, así que
  meterles un refresh a ciegas puede pelear con lo que ya pintan. Hay que
  mirarlos uno por uno. (`registro-interno/asistente.tsx` redirige al terminar,
  así que no aplica.)


- **2026-09-11** — **⚠️ EL DESPLIEGUE SÍ ESTABA ENTRANDO, y mi prueba para
  detectarlo daba FALSO NEGATIVO.** Lo destapó un pantallazo del usuario: en el
  tablero vivo se ven **«Asiste, no quiere proceso»** (PR #76) y la columna
  **ordenada por fecha de visita** (PR #77). O sea que los despliegues llegaron.
  **La prueba del 8-sep —«el sitio pide `35yis8a6jlmce.js`, luego corre la
  versión vieja»— NO SIRVE**: ese paquete se sigue sirviendo en versiones
  nuevas, así que da falso negativo. **No volver a usarla como única evidencia.**
  Lo que sí sirve: **mirar en pantalla una función que solo exista en el PR
  fusionado**, o comprobar un dato que solo el código nuevo produce.

- **2026-09-11** — **Cambiar la fecha u hora de una visita: DOS razones, y cada
  una guarda distinto** (el usuario lo precisó: «en su momento se digitó mal o
  se reprogramó»).
  **La distinción no es cosmética, decide qué queda en el expediente:**
  - **«Se movió la visita»** → sí hubo una visita pactada para ese día y se
    corrió. **Se apila un registro nuevo** («antes era el X») y el historial
    muestra el movimiento. **Cuántas veces se corrió una visita es la señal de
    que algo no va bien con esa persona**, y por eso no se puede perder.
  - **«La fecha estaba mal escrita»** → **NUNCA hubo** visita a esa hora.
    **Se corrige el registro en su sitio**, sin apilar nada: dejar un «se
    reprogramó» ahí **inventaría un movimiento que no ocurrió**. El cambio queda
    en la auditoría (`operacion72.visita_corregida`), que es su lugar.
  - Botón **«Cambiar la fecha de la visita»** en la tarjeta, solo si hay visita
    acordada. Abre `FormularioDeVisita` **ya lleno con lo pactado** y el texto
    del botón cambia según la razón elegida.
  - **`momentoParaCampo(fecha)` en `dominio.ts`**: `AAAA-MM-DDTHH:mm` **en hora
    de Colombia**, que es lo que pide `<input type="datetime-local">`. **Fácil
    de equivocar**: el navegador lo interpreta en la zona de quien mira, así que
    mandar la hora UTC pondría una visita de las 4 de la tarde a las 9 de la
    noche. **Probado con el borde**: 02:00 UTC del día 16 → `2026-09-15T21:00`.
  - La tarjeta **se queda en VISITA PENDIENTE**: cambiar una cita no es avanzar
    ni retroceder.
  - **⚠️ Lección de git:** este trabajo **se quedó fuera del PR #77**. El usuario
    lo fusionó cuando la rama solo tenía el primer commit, y el de reprogramar
    se subió después, quedando huérfano en la rama. Se rehízo desde `main`
    (§5) y se comprobó que no quedó nada duplicado. **Tras un merge, verificar
    qué commits quedaron fuera antes de seguir empujando a la misma rama.**

- **2026-09-11** — **Las 9 visitas que quedaron a mediodía, corregidas a mano**
  (autorizado por el usuario tras revisar la lista).
  El equipo **ya escribía la hora**, pero dentro del texto de la observación,
  porque el formulario del CRM no tenía dónde ponerla. De **30 visitas del CRM,
  26 quedaron a las 12:00** y **13 traían la hora escrita**.
  Corregidas: Yesid González 8:00 a. m. · Ana López 4:30 p. m. · Amanda Suárez
  8:30 p. m. · Sergio Bermúdez 10:00 a. m. · Laura Camila Méndez 10:00 a. m. ·
  Rubianid Moreno 3:30 p. m. · Sofía Muñoz 6:00 p. m. · Evelyn Rojas 3:00 p. m.
  · Dayver Tafur 1:00 p. m.
  - **⚠️ POR QUÉ ESTO NO SE PUEDE AUTOMATIZAR:** la hora en prosa trae **rangos**
    («de 3 a 4 p.m», «en el transcurso de 1 a 3 p.m») y un buscador se queda con
    **la hora del final**. En 2 de 9 habría puesto la hora equivocada. Se tomó
    **la de inicio**, decidido a mano.
  - **⚠️ NO BASTA CON CAMBIAR `contact_attempt.scheduled_at`:** la tarjeta pinta
    un resumen guardado aparte en **`operation72.detail`**. Si solo se cambia la
    fecha, **la tarjeta sigue diciendo mediodía** aunque el dato ya esté bien.
    Hay que actualizar los dos.
  - **NO se tocaron las observaciones** (son la evidencia de que la corrección
    es fiel) ni **las 6 visitas a mediodía sin hora escrita** — varias dicen
    literalmente «está por confirmar la hora», así que ahí el mediodía significa
    «falta confirmar» y es honesto.
  - Probado con `BEGIN … ROLLBACK` antes de aplicar, y verificado después.

- **2026-09-10** — **Reprogramar una visita que no se pudo cumplir** (pedido del
  usuario, el mismo día que lo de la hora). **Refinado el 11-sep: ver arriba.**
  - **Botón «No se pudo · mover la visita»** en la tarjeta, y **solo aparece si
    hay visita acordada**. Abre **el mismo `FormularioDeVisita`** de siempre,
    ya lleno con lo pactado (fecha, hora, lugar, virtual): mover una visita casi
    siempre es correr la hora, no rehacerla desde cero.
  - **⚠️ LO PACTADO NO SE PISA: SE APILA.** Cada reprogramación crea **su propio
    `contact_attempt`**, con `result` = «Visita reprogramada · antes era el X».
    Si se sobrescribiera la visita anterior, nadie podría ver después **cuántas
    veces se corrió** una visita — y eso es justo la señal de que algo no está
    funcionando con esa persona. La tarjeta y el orden de la columna toman
    siempre **la más reciente**, así que la vista no se ensucia.
  - **La tarjeta se queda en VISITA PENDIENTE**: mover una cita no es avanzar ni
    retroceder. `reprogramarVisita` exige ese estado y refleja a HighLevel igual
    que `agendarVisita`.
  - Auditoría `operacion72.visita_reprogramada` con `antes` y `cuando`, y su
    `case` en `actividad.ts` («movió la visita de X · ahora …», con las dos
    fechas en el detalle). También entra en el contador de **visitas** del día.
  - **`momentoParaCampo(fecha)` en `dominio.ts`**: da `AAAA-MM-DDTHH:mm` **en
    hora de Colombia**, que es lo que pide un `<input type="datetime-local">`.
    **Ojo, esto es fácil de equivocar**: el navegador interpreta ese valor en la
    zona de quien mira, así que hay que entregarlo ya convertido — mandar la
    hora UTC pondría una visita de las 4 de la tarde a las 9 de la noche.
    **Probado con el caso de borde**: 02:00 UTC del día 16 → `2026-09-15T21:00`,
    o sea el día anterior, que es lo correcto en Colombia.
  - El formulario quedó reutilizable con `texto`, `inicial` y `notaPlaceholder`
    opcionales; agendar por primera vez no cambió en nada.

- **2026-09-10** — **Hora de la visita, y «Visita pendiente» ordenada por fecha
  de visita** (pedido del usuario).
  **Ojo con el diagnóstico, que es lo que ahorra tiempo la próxima:** el
  formulario del **tablero** ya pedía fecha Y hora (`datetime-local`) desde
  siempre. El que solo capturaba el día era el del **CRM**
  (`/registro/primera-llamada/linea`), y por eso toda visita que agendaba la
  línea quedaba **a mediodía** — se ve en la base: montones de visitas a las
  12:00 clavadas.
  - **`extraerVisita` lee ahora `horaVisita`** en campo aparte («Hora visita»,
    «Hora de la visita», `contact.hora_visita`), porque el formulario de
    HighLevel pregunta día y hora por separado.
  - **`fechaDesdeCrm(valor, hora?)`** las junta, y **solo cuando el día viene
    sin hora propia**: si el valor ya trae hora, esa manda. Sin hora
    reconocible se conserva el mediodía de siempre — mejor una hora aproximada
    que una inventada.
  - **`horaDesdeCrm`** aguanta lo que escriba la gente: `16:30`, `4:30 pm`,
    `4 p. m.`, `8am`, `09:05`. **Las dos excepciones del reloj de 12 h están
    cubiertas y probadas**: `12 am` = medianoche, `12 pm` = mediodía. Lo que no
    nombra una hora (`en la tarde`) devuelve `null`. **13 casos en
    `fecha-crm.test.ts`.**
  - **⚠️ ACCIÓN DEL USUARIO: falta crear el campo «Hora visita» en HighLevel** y
    ponerlo en el formulario. Mientras no exista, todo sigue igual (mediodía);
    el sistema ya está listo para recibirlo.
  - **La columna VISITA PENDIENTE se ordena SIEMPRE por la fecha de la visita**,
    ascendente, **pase lo que pase con el filtro de orden** (`ORDEN_VISITA` en
    `tablero-op72.ts`). Ahí la pregunta no es «a quién registramos primero» sino
    «a quién le toca visita antes». **Las vencidas quedan arriba** (su fecha ya
    pasó) y las que no tienen fecha, al final (`NULLS LAST`).
    Se le ofrecieron al usuario las dos direcciones y **eligió la más próxima
    primero**, no la literal «más reciente a más antigua» que había dicho.
  - **Truco del `CASE` que vale la pena recordar:** como `row_number()` reparte
    por estado, `CASE WHEN f.status = 'VISITA_PENDIENTE' THEN f.visita_at END`
    es NULL en todas las filas de las demás columnas, así que ahí **no altera
    nada** y cae al orden de siempre. Una sola consulta, sin ramas.
  - La visita sale de un `LEFT JOIN LATERAL` sobre `contact_attempt` (tipo
    VISITA, `scheduled_at` no nulo, la más reciente por `occurred_at`), que es
    **exactamente la misma que pinta la tarjeta**.
  - **Probado contra la base antes de subir**: la columna quedó 28-ago → 2-sep →
    5-sep → 9-sep… y **de las otras cuatro columnas no se movió ni una tarjeta**
    (278 de 278 en el mismo puesto; en VISITA PENDIENTE se movieron 23 de 26).
  - **Tropiezo del día:** un backtick dentro de un comentario `--` del SQL
    **cierra el template literal** de TypeScript. `tsc` lo cazó como «`,`
    expected» en una línea que se veía bien. **En un `$queryRaw`, ni backticks
    ni `${'$'}{}` dentro de los comentarios SQL.**

- **2026-09-09** — **«Asistentes de la iglesia»: el TERCER desenlace de la
  Operación 72** (pedido del usuario; mockup aprobado:
  claude.ai/code/artifact/c79aa611-60b0-4531-9503-add93940b317).
  Había gente que **no se puede dar de baja porque sí asiste**, pero que no
  quiere Alpha, ni Casa de Fe, ni discipulado. Hasta hoy el tablero solo tenía
  dos salidas —entregar a mentor o dar de baja— así que esas personas se
  quedaban atascadas en una columna, llamándolas para siempre.
  - **Estado nuevo `LearnerStatus.ASISTENTE`** (migración
    `20260909120000_asistentes`) + columnas `attendee_since`,
    `attendee_reason`, `attendee_note` en `learner_profile`.
    **NO se reutilizó `PAUSADO`** (existe, 0 personas, pero significa otra
    cosa) ni `RETIRADO` (apaga el acceso).
  - **La diferencia con la baja, que es lo que hay que conservar:** la baja
    **apaga el acceso** y **necesita autorización de un administrador**, porque
    saca a alguien del sistema. Marcar asistente **no hace ninguna de las dos**:
    solo reconoce que hoy no quiere proceso. Conserva expediente, acceso y lo
    alcanzado. Lo único que cambia: **sale del tablero y deja de contarle carga
    a su consolidador** (si siguiera contando, el equipo cargaría para siempre
    con gente a la que ya no hay que llamar).
  - **La mentoría NO se cierra** al marcar asistente (la baja sí la cierra): si
    alguien ya la acompañaba, ese vínculo es lo único que la mantiene cerca.
  - **Pantalla `/administracion/asistentes`** (solo ADMIN, botón «Asistentes» en
    la cabecera): 4 indicadores, buscador por nombre/celular y 4 cortes por URL
    sin JS. Cada renglón trae **la tira de hitos** (`HITOS_DEL_RECORRIDO`:
    Registro · Operación 72 · Alpha · Casa de Fe · Bautismo · Encuentro ·
    Escuela) con lo conseguido en verde y con fecha, y lo que falta en punteado.
    **Todo sale de UNA consulta con relaciones** — el pooler cobra por viaje.
  - **⚠️ El indicador que manda es el ámbar: «nadie les habla hace 90 días»**
    (`DIAS_SIN_CONTACTO`, plazo fijado por el usuario). Sin él la pantalla sería
    un cajón donde la gente se archiva y se olvida, que es justo el riesgo.
    **Sin ningún registro también cuenta como silencio**: no es que se le haya
    hablado hace mucho, es que no consta que se le haya hablado nunca.
  - **«Volver a proceso»** la devuelve a ACTIVO y, **solo si está en GANAR**, al
    tablero con **72 horas nuevas contadas desde hoy** (no desde su registro
    original: lo que se mide es la respuesta del equipo desde que la persona
    dijo que sí, no un plazo vencido hace meses). De FORTALECER en adelante la
    acompaña su mentor y no vuelve al tablero.
  - **`MOTIVOS_DE_ASISTENTE`** (5, lista cerrada como los de baja) en `op72.ts`.
    **La nota es obligatoria** (mín. 10 caracteres) en los dos sitios: el motivo
    sirve para contar, la nota es lo que le explica el caso a quien abra el
    listado dentro de un año.
  - **Ojo con la tira de hitos:** `OPERACION_72` solo pasa a COMPLETADO **al
    entregar a mentor**, así que a un asistente casi siempre le sale en
    punteado. **Es correcto** (no la terminó), aunque en el mockup salía verde.
  - **Efectos secundarios revisados uno por uno**: Alpha y Casa de Fe filtran
    candidatos por `ACTIVO`, así que **un asistente no se puede inscribir sin
    volver antes al proceso** (correcto); `expediente/acciones` exige `ACTIVO`
    para cambiar de fase (correcto); `informe.ts:371` cuenta por fase solo
    `ACTIVO`, así que los asistentes salen del recorrido (correcto: no están en
    proceso); `arbol`, `red` y `equipo` filtran `not RETIRADO`, así que siguen
    apareciendo. Badge verde **«Asistente»** en el listado de Administración.
  - Auditoría: `operacion72.marcado_asistente` y `operacion72.vuelve_a_proceso`,
    las dos con su `case` en `actividad.ts`.
  - **Migración probada contra la base con `BEGIN … ROLLBACK` en la misma
    llamada** (regla del 7-sep): las 3 columnas, el valor del enum y el índice
    se crean sin error, y se verificó después que producción quedó en 0/0.
    Confirmado de paso que **`ALTER TYPE … ADD VALUE` sí corre dentro de la
    transacción de `migrar.mjs`** en PG 17.6, mientras el valor no se USE en la
    misma transacción.

- **2026-09-08** — **«LLAMADAS» en el informe pasa a contar MARCACIONES, la
  misma fuente que el historial** (decisión del usuario, dicha dos veces: «que
  sean los mismos datos en cada vista» y «no se ve la misma cantidad de
  llamadas»).
  Le expliqué que eran cosas distintas a propósito (§6: marcaciones ≠ registros)
  y **aun así pidió que cuadraran**. Es su llamada y se hizo.
  - El tile **LLAMADAS** y la barra de la gráfica salen ahora de **`call_log`**,
    con los mismos límites que `/administracion/llamadas`. Para el 7-sep: **52 y
    52**, idénticos.
  - **No se perdió la otra cifra**: debajo del tile va **«N con formulario»**
    (`llamadasRegistradas`, de `contact_attempt`), y la leyenda de la gráfica
    dice **«Llamadas marcadas»**. La diferencia entre las dos es justo lo que
    hay que vigilar —quien marca pero no registra—, así que sigue a la vista.
  - Comprobado contra la base en 5 días: tile, barra e historial dan lo mismo
    (4-sep 59·59, 7-sep 52·52), y «con formulario» 27 y 20.
  - **Ojo con el bloque de efectividad**: sigue midiendo sobre `contact_attempt`
    («se les registró una llamada»), que es lo correcto ahí — el embudo mide el
    proceso, no el esfuerzo del discador.

- **2026-09-08** — **⚠️ EL DESPLIEGUE SE QUEDÓ ATASCADO: los PR #73 y #74 están
  fusionados en `main` pero NO están vivos.** Verificado a las 05:13 UTC, más de
  40 min después del merge (lo normal son 5).
  **Cómo se comprueba cuando el CSS no sirve de huella** (estos dos PR no
  tocaron ni una clase de Tailwind, así que la hoja de estilos salió idéntica y
  no distingue versiones):
  1. Sacar de la página viva los paquetes que pide:
     `curl -s <URL>/ingresar | grep -o '/_next/static/chunks/[a-z0-9._-]*\.js'`.
  2. Compilar el commit sospechoso (`npm run cf:build`) y ver si produce ese
     mismo nombre. Los nombres llevan hash del contenido.
  Resultado: el sitio pide **`35yis8a6jlmce.js`**, que **NO** lo produce ni el
  build del PR #73 ni el del #74 → **está corriendo todavía el PR #72**.
  El sitio está **sano** (`/ingresar` 200, `/actualizar-datos` 200, webhook 401):
  no es una caída, es que el build nuevo no entra.
  **Pendiente del usuario:** mirar Cloudflare → Workers & Pages →
  `sistema-iglesia-vive` → **Deployments**, y decir si el build está en curso o
  falló. Desde aquí no hay credenciales para verlo.

- **2026-09-08** — **Un día significa lo mismo en TODAS las pantallas**
  (pedido del usuario: «que sean los mismos datos en cada vista, no puede haber
  un desfase; estamos en Colombia»). Barrido completo tras el bug de la gráfica.
  **Había DOS clases de fecha mezcladas y nadie las distinguía**, así que la
  misma cosa salía con días distintos según la pantalla:
  1. **Marca de tiempo real** (`occurred_at`, `created_at`, `decided_at`,
     `achieved_at`, `validated_at`, `completed_at`, `MentorRelationship.started_at`,
     `Event.starts_at`): se guarda en UTC. **Sin `timeZone` se pintaba en UTC**, o
     sea que **todo lo de después de las 7 de la noche salía con la fecha del día
     siguiente**.
  2. **Fecha suelta**, columna **`@db.Date`** (`birth_date`, `start_date`,
     `end_date`, la fecha de una sesión de Alpha o Escuela, y **`ServiceAssignment`
     start/ended**): Prisma la trae a **medianoche UTC**, así que **aplicarle hora
     Colombia la corre un día ATRÁS**.
  **La regla, y cómo se decide sin pensarlo:** mirar el esquema — **si el campo
  lleva `@db.Date`, va con `dia…`; si no, con `momento…`**.
  **Cuatro helpers en `dominio.ts`**, para que no haya que acordarse:
  `momentoCorto` · `momentoLargo` (hora Colombia) y `diaCorto` · `diaLargo`
  (sin zona). **Se borraron los 9 formateadores sueltos** que había en
  escuela, alpha, casa de fe, expediente (×2), mi-red y mi-proceso.
  **Dos archivos usaban UN SOLO formateador para las dos clases** —
  `expediente/[id]/page.tsx` y `mi-proceso/page.tsx`—, que es justo por donde se
  colaba el error: la próxima sesión de Alpha (fecha suelta) y el hito
  conseguido (marca real) se pintaban igual.
  **Impacto medido en la base**: se veían un día adelante **113 de 428**
  `contact_attempt`, **106 de 705** hitos y **12 de 34** cambios de fase.
  El más visible era «Mi red», que decía *«Último registro: 8 sep»* de una
  llamada que el informe y el expediente fechaban el 7.
  **Comprobado**: a las 18:59 hora Colombia antes y ahora dan lo mismo; a las
  19:00 antes decía el día siguiente y ahora no. Y a una fecha suelta ponerle
  zona la deja en el día anterior — por eso `diaCorto` no la lleva.
  **Los límites de día ya estaban bien en todas partes** (`informe.ts`,
  `llamadas.ts`, `actividad.ts` construyen `T00:00:00-05:00` /
  `T23:59:59.999-05:00`): el desfase estaba solo al PINTAR.

- **2026-09-08** — **⚠️ CUARTA TRAMPA DE SQL: `AT TIME ZONE 'America/Bogota'`
  sobre una columna `timestamp without time zone` SUMA 5 h en vez de restarlas.**
  El usuario preguntó por qué el informe mostraba menos llamadas que el
  historial. **Los tiles estaban bien** (usan `BETWEEN ${'$'}{desde} AND
  ${'$'}{hasta}` con `Date` de JS, que Prisma manda como `timestamptz`), pero la
  **gráfica «Actividad, día por día» estaba mal**: en la misma pantalla, el tile
  decía **18** y la barra del 7-sep decía **7**.
  **La causa.** Todas las marcas de tiempo del proyecto son `timestamp without
  time zone` **con la hora en UTC**. En Postgres:
  - `timestamp AT TIME ZONE 'z'` → **interpreta** el valor como si ya estuviera
    en `z` y devuelve `timestamptz`. Sobre una hora UTC eso **suma** 5 h.
  - Lo correcto es anclarla primero: **`x AT TIME ZONE 'UTC' AT TIME ZONE
    'America/Bogota'`** → `timestamp` en hora Colombia de verdad.
  Con el desfase de los cubos, el error efectivo era de **10 horas**: una llamada
  de las **18:04 del 7-sep** aparecía como **04:04 del 8-sep**, así que **toda
  llamada después de las 2 de la tarde caía en el día siguiente** — y como el
  equipo llama por la tarde, la barra de hoy siempre salía corta.
  **Medido antes y después** (4 y 7 de sep): 14 → **27** y 7 → **18**, y el 18
  cuadra exactamente con el tile. Arreglado en las 3 subconsultas de
  `actividadPorPeriodo` (llamadas, visitas y registros).
  **Ojo: `src/lib/llamadas.ts` NUNCA tuvo el bug** — construye los límites con
  `new Date("…T00:00:00-05:00")` y compara como `timestamptz`, que es la otra
  forma correcta de hacerlo.
  **REGLA: nunca escribir `AT TIME ZONE 'America/Bogota'` a secas sobre una
  columna del modelo.** O se anclan en UTC primero, o se comparan contra `Date`
  de JS con el offset puesto.
  **Y la respuesta a la pregunta del usuario, que NO era un bug:** el historial
  cuenta **marcaciones del discador** (`call_log`) y el informe cuenta
  **registros de formulario** (`contact_attempt`). El 7-sep hubo **52
  marcaciones a 33 personas** pero solo **18 registros de 16 personas**: **17
  personas marcadas sin registrar**. Esa diferencia es justo lo que el sistema
  está hecho para revelar (§6), no un fallo.

- **2026-09-07** — **«Mi red» y «Árbol» pasan a ser UNA sola pantalla**
  (mockup aprobado: claude.ai/code/artifact/9dd38781-3cd4-4006-aa34-d2406dcf7e64;
  el usuario eligió que abra en **Lista**).
  Eran dos entradas del menú que enseñaban **a la misma gente** con el mismo
  buscador y unos indicadores parecidos pero distintos; lo único que cambiaba de
  verdad era cómo se ordenaban las personas.
  - **Un solo encabezado** —buscador, 5 indicadores y las barras de fase— y un
    **interruptor Lista / Árbol** que cambia nada más el cuerpo. La vista viaja
    por URL (`/mi-red?vista=arbol`), sin JS.
  - **⚠️ Los indicadores salen SIEMPRE de `cargarRed`, en las dos vistas.**
    Antes cada pantalla calculaba los suyos, así que las mismas cifras daban
    números distintos según dónde estuvieras. Se añadieron `porFase` y
    `operacion72Vencida` a `ResumenDeLaRed`, **calculados sobre las personas que
    ya se cargaron** — cero consultas nuevas.
  - **`cargarArbol` solo se ejecuta cuando se está mirando el árbol**, y
    `cargarEquipo` solo en la lista: es la parte cara y no se paga si no se ve.
  - **Las barras de fase ahora filtran las DOS vistas**: en lista recortan la
    lista, en árbol lo aplanan (que es lo que ya hacían).
  - **Arreglado un bache de permisos**: `/mi-red` pedía `tieneRed` y `/red`
    pedía `ROLES_CON_RED`, así que **un consolidador con permiso de mentor veía
    la lista pero no el árbol**. Ahora las dos piden `tieneRed`.
  - **`/red` no se borró**: quedó como `permanentRedirect` a
    `/mi-red?vista=arbol` (conservando `?fase=`), para los enlaces guardados.
  - Se quitaron del encabezado los indicadores de **logros acumulados**
    (Encuentros, Bautismos, Graduaciones, Multiplicadores): esas cifras ya viven
    en el Informe y aquí competían con lo que hay que atender hoy.

- **2026-09-07** — **El formulario de liderazgo reconoce a la persona también
  por CORREO + FECHA DE NACIMIENTO** (decisión del usuario).
  **El caso que lo destapó:** Emelin Parra llenó el formulario del QR y le creó
  una **ficha nueva** en vez de actualizar la suya. No fue un fallo del código:
  el formulario buscaba **solo por celular** y ella escribió un número distinto
  al que tenía registrado. El correo que puso (`emelindparra@gmail.com`) era
  justo el de su cuenta en el sistema — con eso se habría reconocido sola.
  Las dos fichas se fusionaron a mano (ver §8).
  **La regla nueva: primero el celular; si no aparece, correo Y nacimiento.**
  **Los dos datos son obligatorios a propósito.** Se midió antes de decidir:
  - **6 correos están repartidos en 2 o más fichas** de la base
    (`ninijguerrons@gmail.com` lo tienen Nini Guerrón y Dilan Cadena, entre
    otros), así que **buscar solo por correo habría escrito encima de la persona
    equivocada**.
  - **0 pares comparten correo Y fecha de nacimiento.** Con los dos datos, hoy
    no existe un solo caso ambiguo en toda la base.
  - Probado contra la base: por correo+nacimiento, Emelin da **exactamente 1**
    candidata.
  Se conserva la regla de siempre: **más de una candidata → el formulario para y
  avisa**, en vez de adivinar (ahora el aviso distingue si fue por celular o por
  correo). Cuando la reconoce por correo, **el celular que acaba de escribir
  pisa al de la ficha** —es con el que pide que la llamen hoy— y queda anotado
  en «lo que cambiaste». La auditoría registra `reconocidaPor`:
  `celular` | `correo+nacimiento`.

- **2026-09-07** — **Cada cosa declarada se confirma por separado** (mockup
  aprobado: claude.ai/code/artifact/4c4c3bf5-fce2-446e-9b4d-e7a3bec2e27a).
  El bloque «Pendiente de confirmar» del expediente tenía **un solo botón para
  todo**: si alguien declaraba cuatro roles y solo uno era cierto, había que
  aceptarlos los cuatro o rechazarlos los cuatro.
  - **⚠️ CAMBIO DE COMPORTAMIENTO: los hitos ya NO se aplican solos.** Antes,
    quien llenaba el formulario de liderazgo y marcaba «me gradué de la Escuela»
    **escribía ese hito en su expediente al instante**, sin que nadie lo
    revisara — lo único que esperaba confirmación eran los roles y la etapa.
    Ahora los hitos también esperan, que es lo que dice la regla 3 del propio
    formulario («el formulario no otorga nada»).
  - **Tabla `leadership_declaration_item`** (modelo
    `LeadershipDeclarationItem`, migración
    `20260907190000_declaracion_por_partes`): un renglón por cosa — `kind` =
    `ROL` · `ETAPA` · `HITO`, su `value` del catálogo, `achieved_at` para los
    hitos, y **estado, responsable y fecha propios**. Antes solo se sabía «X
    confirmó la declaración»; ahora se sabe qué confirmó y qué descartó.
  - **`resolverDeclaracion` acepta `itemId`**: con él resuelve un renglón, sin
    él resuelve **los que sigan pendientes** (los botones del pie). Lo ya
    resuelto no se vuelve a tocar.
  - **Cada renglón dice qué pasa si se confirma** («Le activa el permiso de
    mentor» vs «Queda como información del expediente»), que es lo que no se
    veía y es justo lo que hay que saber para decidir.
  - **Hallazgo: una persona podía tener DOS declaraciones pendientes** (llenó el
    formulario dos veces) y la pantalla solo mostraba la más reciente: la vieja
    esperaba para siempre, invisible. Ahora una declaración nueva marca la
    anterior como **`REEMPLAZADA`**, en el código y en la migración. Eran 28
    declaraciones de 26 personas → quedan 26, con **64 renglones**, 0
    duplicados.
  - **⚠️ LECCIÓN DE MÉTODO, IMPORTANTE: `execute_sql` del MCP de Supabase NO
    deshace nada por su cuenta.** Probando la migración escribí **sin querer en
    producción**: la primera prueba llevaba `BEGIN;` y el conector la abortó al
    terminar, pero la segunda —el mismo SQL, sin `BEGIN`— corrió en autocommit
    y **quedó aplicada** (tabla creada, 2 declaraciones marcadas). Se revirtió
    en el acto (`DROP TABLE` + devolver las 2 a `PENDIENTE`) y se verificó que
    la base volvió exactamente a 28 pendientes / 0 reemplazadas / 30 en total.
    **REGLA: toda prueba de SQL contra producción va envuelta en `BEGIN; … ;
    ROLLBACK;` EN LA MISMA llamada** — nunca confiar en que el conector la
    deshaga.

- **2026-09-07** — **El informe se quedó SIN «modos»: es un calendario y ya.**
  El usuario dijo que no le gustó cómo se hacía el informe: «quisiera que lo
  dejaras abierto para que yo mismo escogiera el periodo». Las pestañas Día ·
  Semana · Mes obligaban a elegir **antes** una forma de contar, y el rango
  libre había quedado como un cuarto modo dentro de ellas.
  **Ahora hay una sola cosa: DESDE y HASTA.** Los cortes de antes son **atajos**
  que solo rellenan esas dos casillas (Hoy · Ayer · Esta semana · Semana pasada ·
  Este mes · Mes pasado · Este año), así que después de pulsar uno se pueden
  correr las fechas a mano sin salir de ningún sitio.
  - **Se borraron `PERIODOS`, `Periodo`, `ETIQUETA_PERIODO`, `DIAS_DEL_PERIODO`
    y `periodoValido`**, y `Rango` ya no tiene campo `periodo`. `calcularRango`
    pasó de `(periodo, dia, desde, hasta)` a **`(desde?, hasta?)`**. La URL es
    siempre `?desde=…&hasta=…`. Menos código y una sola forma de decir lo mismo.
  - **`atajosDelInforme(hoy)`** en `informe.ts` calcula los siete atajos en hora
    Colombia. El chip se pinta como activo comparando **las dos fechas**, no una
    clave: si mueves el rango a mano y coincide con un atajo, se enciende solo.
  - **Sin parámetros el informe abre en la semana de VIERNES A JUEVES.** El
    razonamiento del usuario (7-sep) sigue vivo y hay que conservarlo: la gente
    entra en las reuniones del **sábado, domingo y miércoles**, así que un corte
    de domingo a domingo los dejaría sin días hábiles para llamarlos antes del
    cierre. Pero ahora es **el punto de partida, no una jaula**.
  - **La comparación no cambió** (sigue la regla del PR #69): meses de calendario
    completos se corren por meses, todo lo demás por su propio largo en días.
    **Probado con los 7 atajos + agosto + año completo + fechas al revés + sin
    parámetros + el viaje ← →**: todo correcto.

- **2026-09-07** — **Informe: rango de fechas libre, y la comparación se
  calcula sola.** Pedido del usuario: «si coloco un periodo de 7 días, lo compare
  con los 7 días anteriores; si coloco un mes, con el mes anterior; si coloco 12
  meses, con el año anterior».
  **Una sola regla cubre los tres casos, y es la clave de esta entrada:** si el
  tramo elegido cubre **meses de calendario completos** (empieza el día 1 y
  termina el último día de un mes), se corre hacia atrás **por meses**; si no, se
  corre **por su propio largo en días**. Restar días no sirve para meses —los
  meses no miden lo mismo y los bisiestos corren la fecha—, y restar meses no
  sirve para tramos sueltos. `mesesCompletos` + `correr` en `informe.ts`.
  Las flechas ← y → usan **la misma función**, así que el paso de navegación y el
  de comparación siempre coinciden: ir atrás y volver adelante cae en el mismo
  sitio.
  - **Cuarto periodo `rango`** en `informe-catalogo.ts` (además de día, semana y
    mes de viernes a viernes, que **no cambiaron**). Viaja por URL como
    `?periodo=rango&desde=…&hasta=…`; los cortes fijos siguen viajando con un
    solo día de ancla. Formulario GET con dos `input type="date"`, sin JS, como
    el resto de la pantalla. Si las fechas vienen al revés se enderezan.
  - **La gráfica cambia de grano sola** (`granoPara`): por día hasta 31 días, por
    semana hasta 182, por mes de ahí en adelante. Un año en barras diarias son
    365 barras que nadie lee. `actividadPorDia` pasó a `actividadPorPeriodo` y el
    `interval` del `generate_series` se arma con `Prisma.raw` desde un mapa
    cerrado. **Probado contra la base**: 12 cubos mensuales con datos reales
    (agosto sale con los 267 registros del import masivo, que es la cifra
    conocida).
  - **La comparación se nombra en pantalla** (`etiquetaPrevio`): «se compara con
    el mes anterior» / «con el año anterior» / «con los 7 días anteriores». Antes
    decía «periodo anterior» a secas y no se sabía contra qué.
  - **Matemática probada en los 9 casos**: 7 días, mes de 31, febrero de 28, año
    completo, trimestre, año bisiesto 2028, y el viaje ← seguido de → vuelve al
    mismo tramo.
  - El margen de «aún en plazo» pasó a `dias <= 2 ? 0 : 2`: en un periodo de uno
    o dos días no queda plazo que reservar, y en los largos siguen siendo dos
    días (el plazo para llamar a alguien no crece porque el informe abarque un
    año).

- **2026-09-07** — **Menos viajes a la base en el tablero de Operación 72: de
  ~15 a 6.** Es la palanca (1) del diagnóstico de lentitud de hoy, y la eligió
  el usuario.
  **El problema no era el plan de ejecución, era la FILA DE VIAJES.** Con
  `PrismaPg max: 1` (necesario para no agotar el pooler de Supabase), **Prisma
  serializa todas las consultas de una petición sobre la única conexión**, así
  que un `Promise.all` de 10 consultas son 10 latencias, una detrás de otra.
  El tablero hacía: 1 auth + 1 totales + 1 mentores + **2 por columna × 5
  columnas** + 1 intentos + 1 solicitudes (+1 la búsqueda por teléfono).
  **Nuevo `src/lib/tablero-op72.ts` → `seleccionarTarjetasDelTablero`**: una
  sola consulta con `row_number() OVER (PARTITION BY status ORDER BY …)` que
  devuelve **los ids de las cinco columnas y sus totales de un tirón**, con el
  alcance por consolidador y la búsqueda (nombre y teléfono) dentro del mismo
  SQL. La página hace después UNA `findMany` con esos ids y los reordena en
  memoria (`findMany` no respeta el orden del `in`).
  **La regla de orden `urgencia` cabe en un solo ORDER BY de tres claves:**
  ```sql
  (deadline_at >= now()) DESC,                                  -- dentro de plazo primero
  CASE WHEN deadline_at >= now() THEN deadline_at END ASC,       -- menos margen primero
  deadline_at DESC                                               -- vencidas: la más reciente
  ```
  **Comprobado fila por fila contra la base antes de cambiar nada: 60 de 60 en
  el mismo id y el mismo puesto que las dos consultas viejas, 0 diferencias.**
  También se probaron las tres ramas del filtro (sin filtro, por consolidador,
  por nombre y por teléfono) con los parámetros tal como los manda Prisma
  (arreglo de texto + nulos), porque **los casts son lo que se rompe**:
  `${'$'}{estados}::text[]::"Operation72Status"[]` y `${'$'}{param}::text IS NULL`.
  El `ORDER BY` se arma con `Prisma.raw` **desde un mapa cerrado**, nunca desde
  algo que escriba el usuario.
  **Pendiente de la misma palanca:** el informe todavía hace 9 viajes (4 de
  ellos son `groupBy` chiquitos que se pueden juntar en uno).

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
