# Sistema de Transformación y Propósito — Iglesia Vive

Plataforma interna que documenta y acompaña el proceso de una persona desde que
llega a Iglesia Vive hasta que se gradúa como mentora. Cuatro fases:
**Ganar → Fortalecer → Entrenar → Multiplicar**.

Esta primera entrega cubre dos de las cuatro pantallas del handoff de diseño:

- **Registro de persona nueva** en tres pasos (`/registro`).
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

> El esquema ya está aplicado en el proyecto Supabase de desarrollo
> (`cxtfftuexqmkktxumkfz`). Para que Prisma no intente recrearlo, marca las dos
> migraciones como aplicadas la primera vez:
>
> ```bash
> npx prisma migrate resolve --applied 20260814000000_init
> npx prisma migrate resolve --applied 20260814000100_rls_cerrado
> ```

### Cómo se entra

El acceso es **por invitación**: no hay registro público.

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

### Registro en tres pasos (`/registro`)

Identidad → Contacto → Origen, sin perder lo escrito al avanzar o retroceder.
Obligatorios: nombres, apellidos, género, teléfono para llamadas y punto de
entrada; con invitador conocido hay que decir quién invitó.

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

## Lo que sigue

Panel del aprendiz, expediente completo con notas pastorales auditadas, panel
del mentor y del pastor, Alpha, Casa de Fe, Escuela Ser Líder y el envío real de
la cola de integración a GoHighLevel. Ver `design/ROADMAP_DESARROLLO.md`.
