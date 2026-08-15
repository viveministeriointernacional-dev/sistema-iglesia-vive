# Handoff: Sistema de Transformación y Propósito — Iglesia Vive

## Overview

Plataforma web interna que documenta, acompaña y hace visible el proceso de transformación de una persona desde su llegada a Iglesia Vive hasta su graduación como mentor. Cuatro fases: **Ganar → Fortalecer → Entrenar → Multiplicar**.

Este paquete contiene el diseño de las cuatro pantallas núcleo ya validadas con el cliente:

1. **Panel del aprendiz** (móvil) — "esta semana", progreso, devocional, evento.
2. **Registro de persona nueva** — tres pasos guiados.
3. **Tablero Operación 72** — las primeras 72 horas de cada persona nueva.
4. **Expediente del aprendiz** — perfil único con hitos, línea de tiempo y notas pastorales.

## About the Design Files

Los archivos de `prototipo/` son **referencias de diseño escritas en HTML**: prototipos que muestran la apariencia y el comportamiento buscados, **no código de producción para copiar**.

La tarea es **recrear estos diseños en el entorno del proyecto real** con sus patrones y librerías. El repositorio `viveministeriointernacional-dev/sistema-iglesia-vive` está vacío (sin commits) al momento de este handoff, así que el stack está abierto. Recomendación coherente con `docs/ARQUITECTURA_VISUAL.md` §10: base de datos **relacional** (PostgreSQL), API con RBAC + alcance por red, background jobs para Operación 72 y webhooks de GoHighLevel. Un stack natural: **Next.js (App Router) + TypeScript + Prisma + PostgreSQL + Auth con roles**.

No usar el HTML tal cual en producción.

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografías, espaciados y estados son finales y deben reproducirse con precisión. El prototipo tiene interacciones reales (avanzar pasos del registro, mover estados en Operación 72, revelar notas) que definen el comportamiento esperado.

Los turnos 1–3 de `prototipo/Iglesia Vive.dc.html` son exploraciones descartadas; se incluyen solo como historial. **La verdad es `prototipo/Vive Prototipo.dc.html`.**

---

## Design Tokens

### Colores

| Token | Hex | Uso |
| --- | --- | --- |
| `azul-900` | `#0e2a4e` | Barra superior, botones primarios, bloque de notas privadas, chip de fase |
| `azul-700` | `#1b4a7a` | Enlaces y acciones secundarias de texto |
| `azul-100` | `#e7eef6` | Placeholder de foto |
| `azul-050` | `#eaf0f7` | Fondo de opción seleccionada (radio/chip) |
| `verde-700` | `#4f7038` | Texto de estado logrado |
| `verde-600` | `#4c7a5a` | Etiquetas del panel del aprendiz |
| `verde-500` | `#6e9a55` | Barra de progreso de fase activa, borde de ítem en curso |
| `verde-100` | `#eef4e8` | Fondo de hito completado |
| `verde-050` | `#f5f8f1` | Fondo de hito en curso |
| `savia` | `#c8e0a8` | Acento sobre azul/verde oscuro (avatares, CTA del aprendiz) |
| `bosque-900` | `#1f3b2b` | Cabecera del panel del aprendiz |
| `bosque-050` | `#eef1e8` | Fondo del panel del aprendiz |
| `bosque-100` | `#e6ebdd` | Barra de navegación inferior móvil |
| `papel` | `#f6f4ef` | Fondo de tarjetas/paneles de escritorio |
| `escritorio` | `#e9e6df` | Fondo de la app |
| `tinta` | `#131c24` | Texto principal |
| `ámbar-fondo` | `#fdf3e6` | Alertas / "requiere decisión humana" |
| `ámbar-texto` | `#a9691f` | Texto de alerta |
| `ámbar-barra` | `#c97b2c` | Barra de Operación 72 urgente (≤12 h) |
| `rojo-fondo` | `#fbe9e4` | Chip de Operación 72 vencida |
| `rojo` | `#b4462f` | Barra/borde de vencida |

Texto atenuado: `rgba(19,28,36,.55)` (secundario), `rgba(19,28,36,.42)` (etiquetas). Bordes: `rgba(19,28,36,.09)` (tarjeta), `rgba(19,28,36,.16–.18)` (control).

### Tipografía

- **Newsreader** (serif, Google Fonts), pesos 300/400 — títulos, nombres propios, títulos de contenido. Voz pastoral.
- **Manrope** (sans, Google Fonts), pesos 400/500/600/700 — UI, etiquetas, datos.

Escala usada: etiqueta `700 9.5–10px` + `letter-spacing:.14–.16em` mayúsculas · microcopy `500 11–12px` · cuerpo `500 12.5–13px` · dato/control `600 12.5–14px` · título de tarjeta `400 17–21px Newsreader` · título de pantalla `400 29–31px Newsreader` · titular móvil `300 31px/1.15 Newsreader`.

### Espaciado, radios, sombras

- Escala de espaciado: 4 / 6 / 8 / 9 / 12 / 14 / 16 / 18 / 20 / 22 / 26 / 30 px.
- Radios: 6–7 (chip pequeño), 8–9 (control), 11–14 (tarjeta escritorio), 18 (panel), 20–22 (tarjeta móvil), 26–30 (cabecera móvil / contenedor), 20px pill.
- Sombras: tarjeta `0 20px 44px -22px rgba(14,42,78,.35)`; móvil `0 20px 44px -20px rgba(20,40,28,.45)`. Sin sombras internas.
- Anchos: contenedor de escritorio `max-width:1240px`; riel derecho del expediente `flex:0 1 340px` con `box-sizing:border-box`; panel móvil `390px`.

---

## Screens / Views

### 1. Panel del aprendiz (móvil, 390px)

**Propósito.** El aprendiz ve *una sola cosa que hacer esta semana*, dónde va y su devocional. Nunca ve evaluaciones ni notas internas.

**Layout.** Columna única. Cabecera `#1f3b2b` con `border-radius:0 0 30px 30px`, padding `22px 22px 26px`. Debajo, contenido en `padding:22px` sobre `#eef1e8`. Barra inferior de 4 ítems sobre `#e6ebdd`, padding `14px 0 22px`.

**Cabecera.**
- Fila: cuadro de logo 24×24 `radius 7` blanco con texto `LOGO` (placeholder) + "IGLESIA VIVE" (`600 11px`, `letter-spacing .16em`, opacidad .6); a la derecha avatar 30×30 `radius 10` `rgba(238,241,232,.14)` con iniciales.
- Etiqueta `ESTA SEMANA` — `600 10px`, `letter-spacing .18em`, color `#c8e0a8`.
- Titular: `300 31px/1.15 Newsreader` — "Tema 9 con Felipe: el perdón que libera."
- Fila mentor: cuadro 36×36 `radius 12` con iniciales + "Jueves 6:30 pm" (`600 12.5px`) y "Casa de Felipe · Laureles" (`500 11.5px`, opacidad .6).
- CTAs: **Confirmar** (`flex:1`, `padding 13px`, `radius 13`, fondo `#c8e0a8`, texto `#1f3b2b`, `700 13px`) y **Preparar** (fondo `rgba(238,241,232,.14)`, texto claro). Al confirmar: el botón pasa a "Confirmado ✓" con fondo `rgba(238,241,232,.2)` y texto `#eef1e8`.
- **Barra de fases** (4 columnas, `gap:6px`): barra de 5px `radius 3`. Ganar = `#c8e0a8` lleno; Fortalecer = `linear-gradient(90deg,#c8e0a8 66%,rgba(238,241,232,.2) 66%)`; Entrenar y Multiplicar = `rgba(238,241,232,.2)`. Etiquetas `600 9.5px`, `letter-spacing .1em`, opacidad .75 / 1 / .4 / .4.

**Cuerpo.**
- Tarjeta *Casa de Fe* (blanca, `radius 22`, `padding 20`): etiqueta `CASA DE FE` verde + "8 de 12"; rejilla de 12 columnas `gap 4`, celdas de 30px `radius 5`: 8 en `#4c7a5a`, 1 en `#c8e0a8` (en curso), 3 en `rgba(28,42,32,.1)`; pie "Cuatro temas para cerrar. El orden lo decide tu mentor."
- Tarjeta *Devocional*: banda superior de 104px como placeholder de imagen (`repeating-linear-gradient(135deg,#dfe6d5 0 12px,#d6dfca 12px 24px)`, texto `IMAGEN DEVOCIONAL`) + etiqueta, título `400 20px Newsreader`, referencia bíblica. **Sustituir por imagen real.**
- Fila *Tu recorrido completo* (fondo `rgba(31,59,43,.06)`, chevron `›`) → abre la historia completa.
- Fila *Encuentro de marzo* (fondo `#1f3b2b`, pill `#c8e0a8` "Inscribirme").

**Barra inferior.** Esta semana (activo, `700 11px`, `#1f3b2b`) · Mi historia · Contenido · Perfil.

### 2. Registro de persona nueva (3 pasos)

**Propósito.** Registrar en la puerta, de pie, en menos de un minuto. Contenedor `max-width:740px`, `radius 18`, fondo `#f6f4ef`, padding `26px 28px 32px`.

**Barra de pasos.** Tres columnas iguales, barra de 6px `radius 3`: pasos alcanzados en `#0e2a4e`, paso 3 activo en `#6e9a55`, pendientes `rgba(19,28,36,.14)`. Etiquetas `700 10px`, `letter-spacing .1em`: IDENTIDAD / CONTACTO / ORIGEN.

**Título por paso** (`400 29px Newsreader`) + subtítulo (`500 13px`, atenuado):
1. "¿A quién acabas de conocer?" — "Solo lo esencial ahora. El expediente se completa con el acompañamiento."
2. "¿Cómo la contactamos?" — "El horario y el número correcto son lo que hace posible Operación 72."
3. "¿Cómo llegó?" — "El origen define la línea y, con ella, el mentor que la acompaña."

**Paso 1 — Identidad.** Tarjeta blanca `radius 14`, borde `rgba(19,28,36,.09)`, padding 22. Rejilla 2×2, `gap 16`: Nombres*, Apellidos*, Género* (dos botones Mujer/Hombre; el activo lleva borde `1.5px #0e2a4e` y fondo `#eaf0f7`; nota "Define la asignación de consolidador"), Fecha de nacimiento. Inputs: `padding 12px 13px`, `radius 9`, borde `1px rgba(19,28,36,.18)`, `600 13.5px`.

**Paso 2 — Contacto.** Teléfono para llamadas* · WhatsApp (borde discontinuo, placeholder "Mismo número") · Horario preferido (tres botones Mañana/Tarde/Noche, mismo patrón de selección) · Dirección/barrio · Petición de oración.

**Paso 3 — Origen.**
- *Punto de entrada*: rejilla 3×2 de botones (`padding 15px 12px`, `radius 11`): Servicio dominical · Servicio miércoles · Redes sociales · Alpha / Casa de Fe · Evento o brigada · Uno a uno.
- *¿Alguien la invitó?*: tres botones — **Sí, una persona** · **No, llegó por redes** · **No sabe**.
  - Con invitador: buscador ("Buscar por nombre o teléfono…") y resultado seleccionado en tarjeta con borde `1.5px #6e9a55` y fondo `#f5f8f1`: "Marta Solís — Se conserva su línea: Alejandro Ruiz → Marta".
  - Sin invitador: aviso ámbar `SIN LÍNEA CONOCIDA` — "El mentor se asignará por perfil: género, edad, tipo de población, disponibilidad y carga. La decisión final la confirma un líder."

**Pie.** Izquierda: "Cancelar" (paso 1) / "Atrás". Derecha: "Continuar" o, en el paso 3, **"Guardar e iniciar Operación 72"** (fondo `#0e2a4e`, `700 13px`).

### 3. Tablero Operación 72

**Propósito.** El consolidador ve el reloj de cada persona nueva y registra contacto, visita y entrega.

**Layout.** Contenedor `max-width:1240px`. Cabecera: título `400 30px Newsreader` "Operación 72" + "Las primeras 72 horas de cada persona nueva · N en curso"; a la derecha botón "+ Registrar persona" → pantalla de registro. Debajo, rejilla de 4 columnas `gap 12`.

**Columnas** (título `700 10px`, `letter-spacing .14em`, y contador a la derecha): `INICIADA` · `CONTACTADA` · `VISITA PENDIENTE` · `LISTA PARA ENTREGA`.

**Tarjeta de persona.** Blanca, `radius 13`, `padding 16`. Borde según urgencia: vencida `1px rgba(180,70,47,.45)`; ≤12 h `1px rgba(201,123,44,.45)`; normal `1px rgba(19,28,36,.1)`.
- Nombre `600 14px` + origen/edad `500 11.5px` atenuado.
- Chip de reloj (pill, `700 9.5px`): vencida → `VENCIDA` sobre `#fbe9e4`/`#b4462f`; ≤12 h → `"9 H"` sobre `#fdf1e3`/`#a9691f`; resto → `"37 H"` sobre `#eef4e8`/`#4f7038`.
- Barra de avance: pista `rgba(19,28,36,.1)`, 6px `radius 4`; relleno = `(72 − horas restantes)/72`, mínimo 6%; color según urgencia (`#b4462f` / `#c97b2c` / `#6e9a55`).
- Detalle `500 11.5px/1.5` (p. ej. "Llamada de 12 min · quiere visita en casa").
- Botón de acción a ancho completo (`#0e2a4e`, `600 11.5px`) según estado: `Registrar llamada` → contactada · `Agendar visita` → visita · `Cerrar visita y preparar entrega` → entrega · `Entregar a mentor` → sale del tablero.
- En estado *entrega*, bloque `#f5f8f1` con borde verde: título `LÍNEA CONOCIDA · SE CONSERVA` o `SIN LÍNEA · ASIGNAR POR PERFIL`, mentor propuesto y carga ("Equipo 12 Norte · carga 7 de 12" / "2 mentores con capacidad · confirma un líder").

### 4. Expediente del aprendiz

**Propósito.** Que un líder autorizado entienda en segundos historia, fase, responsable, hitos, riesgos y próximos pasos.

**Layout.** Contenedor `max-width:1240px`, `radius 18`, `display:flex; flex-wrap:wrap`. Columna principal `flex:1 1 620px; min-width:0`, padding `26px 26px 32px`. Riel derecho `flex:0 1 340px; box-sizing:border-box`, fondo blanco, `border-left 1px rgba(19,28,36,.1)`, padding `26px 22px 32px`. **Por debajo de ~960px el riel se apila debajo** (no se recorta).

**Columna principal.**
- Identidad: placeholder de foto 62×62 `radius 20` `#e7eef6`; nombre `400 31px Newsreader`; fila de metadatos `600 12px` con chip `FORTALECER` (`#0e2a4e`, texto blanco) + "día 96 · Mentor: … · Línea: … · Equipo 12 Norte".
- Barra de fases: 4 barras de 10px `radius 3` — completada `#0e2a4e`, activa `linear-gradient(90deg,#6e9a55 66%,rgba(19,28,36,.12) 66%)`, pendientes `rgba(19,28,36,.12)`; etiquetas `700 9.5px`, la activa en `#4f7038`.
- **Hitos** (tarjeta blanca): rejilla de 4 columnas, celdas `padding 14`, `radius 11`. Completado: fondo `#eef4e8`, etiqueta `✓ NOMBRE` en `#4f7038` + fecha `600 13.5px`. En curso: `#f5f8f1` + borde `1.5px #6e9a55` ("CASA DE FE · 8 / 12"). Pendiente: borde discontinuo `rgba(19,28,36,.22)` y texto atenuado (GRADUACIÓN, VALIDACIÓN). Encabezado: "6 de 8 requeridos para cerrar Fortalecer".
- **Casa de Fe · 12 temas** (media columna): rejilla 3×4 de píldoras `600 11.5px`, `radius 8`: completados `#eef4e8`; en proceso blanco con borde `1.5px #6e9a55`; requiere seguimiento `#fdf3e6` con texto `#a9691f`; pendientes `rgba(19,28,36,.045)`. Etiqueta "orden flexible".
- **Línea de tiempo** (media columna): rejilla `58px 16px 1fr` — fecha `600 11.5px` atenuada, riel vertical de 1px `rgba(19,28,36,.13)` con punto de 9px (verde `#6e9a55` para el hito más reciente, `#0e2a4e` para el resto), y evento: título `600 13px` + detalle `500 12px/1.5` con autor y consecuencias ("1 nota privada", "Evidencia registrada por Felipe", "validado por Ana Torres").

**Riel derecho (de arriba a abajo).**
1. Acciones: **Proponer cierre de fase** (`#0e2a4e`), *Registrar hito*, *Añadir nota pastoral* (contorno).
2. `PRÓXIMO PASO` sobre `#f6f4ef`: "Tema 9 · El perdón que libera" (`400 18px Newsreader`) + "Jueves 6:30 pm".
3. `ALERTAS · 2` sobre `#fdf3e6` con borde ámbar: "Evaluación de cierre pendiente" / "Sin evidencia de servicio este mes".
4. **Notas pastorales** sobre `#0e2a4e`: icono de candado (trazo `#cfe3bc`), etiqueta `NOTAS PASTORALES · 4`, botón *Revelar (4)* / *Ocultar*. Oculto: dos barras de 24px con `repeating-linear-gradient` (texto ilegible, no borroso). Revelado: notas con "fecha · autor · tipo" y cuerpo `500 12px/1.55`. Pie permanente: **"Privadas frente al aprendiz. Visibles para su mentor, su consolidador y el líder responsable de la línea. Cada apertura queda auditada."**
5. `ORIGEN`: entrada, invitado por, contacto con horario.

---

## Interactions & Behavior

| Disparador | Efecto |
| --- | --- |
| Tabs de la barra superior | Cambian de pantalla; la pestaña activa lleva fondo `rgba(255,255,255,.18)`. El usuario mostrado arriba a la derecha cambia con el rol de la pantalla (Aprendiz / Consolidador / Mentor) — en producción esto lo define la sesión, no la pantalla. |
| Aprendiz → Confirmar | Alterna a "Confirmado ✓". En producción: crea confirmación de sesión + notifica al mentor. |
| Registro → Continuar | Avanza de paso (1→2→3), sin perder lo escrito. |
| Registro → Atrás | Retrocede; en el paso 1 equivale a Cancelar y vuelve al tablero. |
| Registro → Guardar | Crea la persona con 72 h completas, la inserta al inicio de `INICIADA` con detalle "Consolidador asignado · bienvenida por WhatsApp enviada", limpia el formulario y navega a Operación 72. |
| "No, llegó por redes" / "No sabe" | Oculta el buscador de invitador y muestra el aviso de asignación por perfil. |
| Op72 → botón de tarjeta | Avanza el estado y reescribe el detalle; "Entregar a mentor" retira la tarjeta del tablero. |
| Expediente → Revelar | Muestra las notas y cambia el botón a "Ocultar". En producción: registra en auditoría usuario, fecha y motivo **antes** de mostrar. |

Sin animaciones más allá de los cambios de estado inmediatos. El prototipo no tiene estados de carga ni de error: en producción hacen falta para guardar registro, mover Operación 72 y revelar notas.

**Validación mínima del registro.** Obligatorios: nombres, apellidos, género, teléfono de llamadas, punto de entrada. Detectar duplicados por teléfono/correo **antes** de crear expediente y exigir revisión humana (no crear un segundo expediente en silencio).

**Responsive.** Diseñado para móvil y escritorio por igual. Móvil: el panel del aprendiz es la referencia (ancho 390, objetivos táctiles ≥44px). Escritorio: rejillas de 4 columnas → 2 → 1; el riel del expediente se apila; el tablero de Operación 72 pasa a columnas apilables o desplazamiento horizontal con encabezados fijos.

## State Management

Estado del prototipo (referencia; en producción viene del servidor):

- `pantalla`: `aprendiz | registro | op72 | perfil`.
- Aprendiz: `confirmado`.
- Expediente: `notas` (visible/oculto).
- Registro: `paso` (1–3), `nombres`, `apellidos`, `genero`, `nacimiento`, `telefono`, `whatsapp`, `horario`, `direccion`, `oracion`, `entrada`, `invitacion` (`persona | redes | desconocido`).
- Operación 72: `personas[]` con `id`, `nombre`, `origen`, `estado` (`iniciada | contactada | visita | entrega`), `horas` (restantes; negativo = vencida), `detalle`, `linea` (bool), `mentor`, `mentorDetalle`.

**Datos que hay que traer del servidor:** persona + expediente; fase actual y su historial; hitos; progreso de Casa de Fe (12 temas con estado); línea de tiempo de eventos; notas pastorales (con control de acceso por rol y relación); cola de Operación 72 con horas restantes calculadas en servidor; carga por mentor y consolidador; devocional del día por fase; próximos eventos.

## Reglas de negocio que el diseño asume (no cambiar sin autorización pastoral)

De `docs/ESPECIFICACION_PRODUCTO.md` y `docs/MASTER_PROMPT.md`:

1. Cuatro fases: Ganar, Fortalecer, Entrenar, Multiplicar.
2. Ninguna transición de fase es automática por porcentaje: requiere validación humana explícita, con responsable y fecha.
3. Alpha cierra con ≥60% de asistencia + Focus Day + validación del líder.
4. Casa de Fe: 12 temas obligatorios, **orden flexible** decidido por el mentor.
5. Cierre de Fortalecer documenta: 12 temas, bautismo, al menos un Encuentro, evaluación de cierre, reconocimiento/graduación y validación pastoral.
6. Asignación de consolidador: automática, **respeta el género**, balancea carga; toda reasignación queda auditada.
7. Con invitador conocido se **conserva la línea**; sin invitador se asigna mentor por perfil (género, edad, población, disponibilidad, carga) y lo confirma un líder.
8. Notas y evaluaciones: **privadas frente al aprendiz**; visibles para su mentor, su consolidador y el líder responsable de la línea; toda apertura se audita.
9. Cada mentor ve solo su red descendente; el pastor principal ve la estructura completa.
10. La relación de discipulado **no** es un campo `mentor_id`: es una entidad con historial (desde/hasta, motivo, quién autorizó).
11. El historial es acumulativo; nunca se sobrescriben estados críticos en silencio.

## Assets

- **Logo:** pendiente. En el prototipo hay un placeholder cuadrado con el texto `LOGO` (blanco sobre azul `#0e2a4e`, y su inverso sobre `#1f3b2b`). El cliente tiene imagotipo blanco sobre fondo azul: sustituir el placeholder por el SVG real.
- **Foto de perfil:** placeholder `FOTO` sobre `#e7eef6`.
- **Imagen de devocional:** placeholder rayado con el texto `IMAGEN DEVOCIONAL`.
- **Iconos:** solo uno, el candado de notas privadas, en SVG inline (trazo 1.8, color `#cfe3bc`). Sin librería de iconos; si el proyecto adopta una, mantener el trazo fino.
- **Tipografías:** Newsreader y Manrope desde Google Fonts.

## Files

```
prototipo/
  Vive Prototipo.dc.html    ← FUENTE DE VERDAD: las 4 pantallas con interacciones
  index-standalone.html     ← el mismo prototipo en un solo archivo, listo para abrir/desplegar
  Iglesia Vive.dc.html      ← historial de exploraciones (turnos 1–3), solo referencia
  support.js                ← runtime del prototipo, no es código de producción
docs/
  MASTER_PROMPT.md          ← rol, propósito institucional y reglas inamovibles
  ESPECIFICACION_PRODUCTO.md← roles, permisos, módulos, modelo de datos, estados
  ARQUITECTURA_VISUAL.md    ← flujos, árbol de red, eventos de dominio, arquitectura
  ROADMAP_DESARROLLO.md     ← fases de construcción y criterios de cierre
github.md                   ← repo asociado y mapa de pantallas
```

Para ver el prototipo: abre `prototipo/index-standalone.html` en el navegador.

## Qué falta diseñar (siguiente ronda)

Panel del mentor (mi red, alertas, evaluaciones pendientes) · árbol de discipulado interactivo con alcance por rol · panel del pastor con embudo y métricas · Alpha (12 sesiones y asistencia) · Escuela Ser Líder · flujo de aprobación de Multiplicar · biblioteca de devocionales y eventos · vistas de auditoría.
