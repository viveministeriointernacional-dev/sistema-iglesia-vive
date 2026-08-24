# Sistema de Transformación y Propósito — Iglesia Vive

Plataforma interna que documenta y acompaña el proceso de una persona desde que
llega a Iglesia Vive hasta que se gradúa como mentora. Cuatro fases:
**Ganar → Fortalecer → Entrenar → Multiplicar**.

Esta primera entrega cubre dos de las cuatro pantallas del handoff de diseño:

- **Autorregistro público** desde un enlace abierto (`/registro`).
- **Registro interno de persona nueva** en tres pasos (`/registro-interno`).
- **Tablero Operación 72** (`/operacion-72`), las primeras 72 horas de cada
  persona nueva.

Más la base sobre la que se apoyan: autenticación con roles, modelo de datos
relacional, auditoría de acciones sensibles y cola de eventos de integración.

## Stack

| Pieza | Elección |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Estilos | Tailwind CSS 4 con los design tokens del handoff |
| Datos | PostgreSQL (Supabase) con Prisma 7 (adaptador `pg`) |
| Autenticación | Supabase Auth (correo y contraseña) + roles en `app_user` |
| Despliegue | Cloudflare Workers con OpenNext + Hyperdrive |

## Puesta en marcha

```bash
npm install
cp .env.example .env.local        # completa las cuatro variables
npm run db:migrate                # aplica prisma/migrations
npm run db:seed                   # datos de arranque para desarrollo
npm run dev
```

Variables de entorno (ver `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase Auth.
- `DATABASE_URL` — conexión de la aplicación (pooler, puerto 6543).
- `DIRECT_URL` — conexión directa (puerto 5432) para las migraciones.
- `HIGHLEVEL_WEBHOOK_SECRET` — secreto compartido solo con el workflow que
  recibe el formulario **Registro Nuevo**.
- `HIGHLEVEL_REGISTRO_FORM_ID` — identificador del formulario permitido.
- `REGISTRO_PUBLICO_RATE_LIMIT_SECRET` — secreto recomendado para anonimizar
  la dirección de red usada por el límite de intentos del formulario público.

> El esquema ya está aplicado en el proyecto Supabase de desarrollo
> (`cxtfftuexqmkktxumkfz`). Para que Prisma no intente recrearlo, marca las dos
> migraciones como aplicadas la primera vez:
>
> ```bash
> npx prisma migrate resolve --applied 20260814000000_init
> npx prisma migrate resolve --applied 20260814000100_rls_cerrado
> ```

### Cómo se entra

El acceso a las pantallas internas es **por invitación**. El formulario
`/registro` sí es público, pero registrarse allí no crea una cuenta de acceso.

1. Un administrador crea la persona usuaria en Supabase Auth (correo y
   contraseña) desde el panel de Supabase.
2. El mismo correo debe existir en la tabla `app_user` con su rol. El seed crea
   los usuarios de desarrollo; en producción los crea la administración.
3. En el primer inicio de sesión, la aplicación enlaza el `auth_user_id` de
   Supabase con el registro de `app_user`. Si el correo no tiene rol activo, la
   sesión se cierra y no se entra.

Roles disponibles: `APRENDIZ`, `CONSOLIDADOR`, `LIDER_ALPHA`, `MENTOR`,
`PASTOR`, `ADMIN`.

## Qué hay implementado

### Autorregistro público (`/registro`)

Una persona puede abrir el enlace sin iniciar sesión y enviar directamente sus
datos al sistema. Se exigen nombres, apellidos, género, fecha de nacimiento,
teléfono, correo, horario de llamada, dirección, punto de encuentro, asistencia
a una iglesia, invitación, petición de oración y la autorización de uso de
datos; únicamente WhatsApp es opcional. El detalle de «Otro» y el nombre del
invitador son obligatorios cuando corresponden. El formulario aplica campo
trampa, límite por conexión y detección de duplicados; la respuesta nunca
revela si un teléfono o correo ya existía.

Un envío nuevo crea la persona, el expediente y Operación 72. El equipo puede
seguir usando el flujo con búsqueda interna y confirmación humana desde
`/registro-interno`.

### Registro interno en tres pasos (`/registro-interno`)

Identidad → Contacto → Origen, sin perder lo escrito al avanzar o retroceder.
El nombre es el único campo obligatorio en el flujo interno; el resto puede
completarse después desde el expediente.

Al guardar, en una sola transacción:

1. Se detectan **duplicados por teléfono y correo** antes de crear el
   expediente. Si hay coincidencia, la pantalla la muestra y exige decisión
   humana: nunca se crea un segundo expediente en silencio.
2. Se crea la persona y su expediente con el origen y la línea.
3. Se **asigna consolidador** automáticamente respetando el género y
   balanceando carga; si nadie tiene cupo, la tarjeta lo dice y queda para un
   líder.
4. Se inicia **Operación 72** con vencimiento a 72 horas.
5. Se registran los hitos, la auditoría y los eventos de integración
   (`aprendiz_creado`, `operacion72_iniciada`).

### Tablero Operación 72 (`/operacion-72`)

Cuatro columnas: `INICIADA · CONTACTADA · VISITA PENDIENTE · LISTA PARA
ENTREGA`. Las horas restantes, el color de urgencia y el avance de la barra se
calculan **en servidor** a partir de `deadline_at`:

- vencida (`≤ 0 h`) — rojo;
- urgente (`≤ 12 h`) — ámbar;
- normal — verde.

Cada paso registra un `ContactAttempt` y una entrada de auditoría; el historial
es acumulativo. La entrega a mentor cierra Operación 72, crea la relación de
discipulado con fecha y responsable, y saca la tarjeta del tablero.

Alcance por rol: un consolidador ve y opera solo las personas que tiene
asignadas; pastor y administración ven toda la iglesia. **Sin línea conocida, la
entrega la confirma un líder** (mentor, pastor o administración).

## Reglas de negocio respetadas

Del handoff y de `design/ESPECIFICACION_PRODUCTO.md`:

- Ninguna transición de fase es automática por porcentaje: requiere validación
  humana con responsable y fecha.
- La relación de discipulado **no** es un campo `mentor_id`: es
  `MentorRelationship`, con desde/hasta, motivo y quién autorizó.
- Con invitador conocido se conserva la línea; sin invitador se propone mentor
  por perfil y lo confirma un líder.
- La asignación de consolidador respeta el género y balancea carga; queda
  auditada.
- El historial es acumulativo: no se sobrescriben estados críticos en silencio.
- Las notas pastorales son privadas frente al aprendiz (modeladas en
  `PrivateNote`; su pantalla llega con el expediente).

## Despliegue en Cloudflare Workers

La aplicación se despliega con [OpenNext](https://opennext.js.org/cloudflare),
que empaqueta Next.js para workerd. La configuración está versionada
(`wrangler.jsonc`, `open-next.config.ts`): no dejes que el asistente de Wrangler
la genere en cada build.

```bash
npm run cf:preview   # build + Worker en local (usa .dev.vars)
npm run cf:deploy    # build + despliegue
```

En **Workers Builds**, basta con el comando de despliegue:

| Ajuste | Valor |
| --- | --- |
| Deploy command | `npm run cf:deploy` |
| Build command | *(vacío)* |

`cf:deploy` compila y despliega en un solo paso. Si prefieres separarlos, pon
`npx opennextjs-cloudflare build` como build command y `npx wrangler deploy`
como deploy command; lo que no funciona es dejar el build vacío con
`npx wrangler deploy`, porque OpenNext no encuentra nada compilado.

Variables del proyecto en el panel de Cloudflare:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — hacen
  falta **en el build**, porque Next las inserta en el bundle del navegador.
- `DATABASE_URL` — como *secret*, si no usas Hyperdrive.

### Postgres desde el Worker

Tres detalles que no son opcionales y que ya están resueltos en el repo:

1. **Hyperdrive.** Un Worker no mantiene un pool de conexiones entre
   invocaciones. Sin Hyperdrive, cada petición abre una conexión nueva contra
   Supabase y el pooler se agota. Crea la configuración y añade el binding a
   `wrangler.jsonc`:

   ```bash
   npx wrangler hyperdrive create iglesia-vive-db \
     --connection-string="postgresql://postgres.PROYECTO:CONTRASENA@aws-0-REGION.pooler.supabase.com:5432/postgres"
   ```

   `src/lib/prisma.ts` toma la conexión del binding `HYPERDRIVE` cuando existe y
   cae a `DATABASE_URL` en cualquier otro entorno.

2. **Un cliente por petición.** workerd no deja usar un socket abierto durante
   otra petición: el cliente se memoiza por petición en Cloudflare y como
   singleton fuera de ahí.

3. **El cliente de Prisma se genera dentro de `node_modules`**
   (`@iglesia/prisma-client`) y está declarado en `serverExternalPackages`. Así
   el bundler de Next no lo procesa y la resolución por condiciones elige la
   variante `workerd`, que importa el compilador de consultas como módulo
   WebAssembly. workerd no permite compilar WASM en caliente.

El middleware se mantiene como `middleware.ts` (runtime edge) y no como el
`proxy.ts` de Next 16: el proxy solo corre en Node y el adaptador de Cloudflare
todavía no lo soporta.

## Estructura

```
prisma/
  schema.prisma            modelo de datos
  migrations/              SQL versionado (init + RLS cerrado)
  seed.ts                  datos de arranque de desarrollo
src/
  app/
    ingresar/              inicio de sesión
    (interno)/
      operacion-72/        tablero, tarjetas y acciones de servidor
      registro/            asistente de 3 pasos y acciones de servidor
  lib/
    auth.ts                sesión, roles y guardas
    asignacion.ts          consolidador por género y carga; propuesta de mentor
    op72.ts                reloj de 72 h, urgencia y transiciones
    audit.ts               auditoría y cola de integración
    supabase/              clientes de navegador, servidor y sesión
design/                    handoff, especificación y prototipo de referencia
```

## Seguridad de los datos

Toda lectura y escritura pasa por la API de Next.js con Prisma, que aplica el
control de acceso en código. Las tablas de `public` tienen RLS habilitado sin
políticas y sin permisos para `anon` / `authenticated`, de modo que las claves
públicas de Supabase no alcanzan los datos.

## Entrada desde HighLevel

`POST /api/integraciones/highlevel/registro-nuevo` recibe en tiempo real el
contacto generado por el formulario **Registro Nuevo**. El endpoint:

- exige `x-iglesia-webhook-secret` y valida el identificador del formulario;
- crea la persona, su expediente, Operación 72, hitos, auditoría y eventos en
  una única transacción;
- usa `locationId + contactId` como identidad estable para que un reintento no
  cree otro expediente;
- concilia una coincidencia única por teléfono o correo con la persona que ya
  existe, completando únicamente sus campos vacíos;
- devuelve `409` cuando hay varias coincidencias y hace falta revisión humana.

En HighLevel crea un workflow con el disparador **Form Submitted**, filtrado por
**Registro Nuevo**, y agrega una acción **Custom Webhook** con método `POST`,
tipo `application/json`, el encabezado `x-iglesia-webhook-secret` y un cuerpo
como este (los nombres de variables se eligen desde el selector de HighLevel):

```json
{
  "contactId": "{{contact.id}}",
  "locationId": "ID_DE_LA_UBICACION",
  "formId": "ID_DEL_FORMULARIO",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "email": "{{contact.email}}",
  "phone": "{{contact.phone}}",
  "address": "{{contact.address1}}"
}
```

Los campos adicionales aceptan sus nombres canónicos (`gender`, `birthDate`,
`whatsappPhone`, `prayerRequest`, `callSchedules`, `callScheduleNote`,
`entryPoint`, `entryPointOther`, `churchAttendance`, `invitationKind`,
`invitedByName`) o sus
equivalentes habituales en español. El Private Integration Token de HighLevel
no se expone en este webhook ni se guarda en el repositorio.

## Lo que sigue

Panel del aprendiz, expediente completo con notas pastorales auditadas, panel
del mentor y del pastor, Alpha, Casa de Fe, Escuela Ser Líder y el envío real de
la cola de integración a GoHighLevel. Ver `design/ROADMAP_DESARROLLO.md`.
