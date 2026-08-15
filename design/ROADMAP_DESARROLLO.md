# ROADMAP_DESARROLLO.md
# Hoja de Ruta de Construcción

## Regla de avance

Una fase técnica solo se considera terminada cuando:
- las funciones están implementadas;
- los permisos están probados;
- existen pruebas mínimas;
- no quedan errores bloqueantes;
- el flujo puede demostrarse de punta a punta;
- el criterio de aceptación está cumplido.

---

## FASE 0 — Descubrimiento congelado y documentación
Estado: LISTO PARA INICIAR

- [x] Definir propósito
- [x] Definir cuatro fases
- [x] Definir rol de consolidador
- [x] Definir mentor como responsable del acompañamiento
- [x] Definir Operación 72
- [x] Definir Alpha
- [x] Definir Casa de Fe
- [x] Definir Entrenar
- [x] Definir Multiplicar
- [x] Definir árbol de red
- [x] Definir privacidad básica
- [x] Definir integración futura con GoHighLevel
- [ ] Validar nombres finales de algunos submódulos y contenidos cuando la iglesia los entregue
- [ ] Inventariar materiales reales: videos, temas, clases, devocionales y eventos

Criterio de cierre:
Documentación suficiente para comenzar base técnica sin inventar reglas pastorales.

---

## FASE 1 — Fundación técnica
Objetivo: crear la base estable del software.

- [ ] Repositorio
- [ ] Entornos dev/staging/prod
- [ ] Base de datos
- [ ] Autenticación
- [ ] Recuperación de acceso
- [ ] Roles
- [ ] Permisos
- [ ] Auditoría base
- [ ] Logging
- [ ] Manejo de errores
- [ ] Diseño responsive
- [ ] Layout principal
- [ ] Navegación por rol
- [ ] CI/CD

Criterio de cierre:
Un usuario puede iniciar sesión y recibe una interfaz según su rol.

---

## FASE 2 — Personas, perfiles y red
Objetivo: crear el corazón de identidad y relaciones.

- [ ] CRUD de personas
- [ ] Detección de posibles duplicados
- [ ] Perfil único
- [ ] Datos personales
- [ ] Origen
- [ ] Quién invitó
- [ ] Línea
- [ ] Mentor
- [ ] Consolidador
- [ ] Historial
- [ ] Línea de tiempo
- [ ] Equipo 12
- [ ] Árbol de discipulado
- [ ] Alcance de lectura por red

Criterio de cierre:
El pastor puede ver el árbol completo. Un mentor ve únicamente su rama. El perfil conserva relaciones e historial.

---

## FASE 3 — Módulo GANAR
Objetivo: operar el ingreso de una persona nueva.

- [ ] Formulario de registro
- [ ] Género
- [ ] Teléfonos separados
- [ ] Horario de contacto
- [ ] Dirección
- [ ] Petición de oración
- [ ] Origen
- [ ] Invitador
- [ ] Asignación automática de consolidador
- [ ] Balance de carga
- [ ] Operación 72
- [ ] Contador
- [ ] Alertas
- [ ] Registro de llamada
- [ ] Registro de visita
- [ ] Notas
- [ ] Entrega a mentor
- [ ] Asignación por línea
- [ ] Asignación por perfil cuando no hay línea
- [ ] Alpha
- [ ] 12 sesiones
- [ ] Asistencia
- [ ] Notas privadas
- [ ] Focus Day
- [ ] Validación final
- [ ] Regla 60 %

Criterio de cierre:
Una persona puede entrar desde cero, pasar Operación 72, recibir mentor y completar Alpha con las reglas definidas.

---

## FASE 4 — Módulo FORTALECER
Objetivo: documentar discipulado y transformación.

- [ ] Crear programa Casa de Fe
- [ ] 12 temas configurados
- [ ] Orden flexible
- [ ] Seguimiento por tema
- [ ] Evaluación
- [ ] Notas privadas
- [ ] Tareas
- [ ] Evidencias
- [ ] Bautismo
- [ ] Encuentro
- [ ] Evaluación final
- [ ] Reconocimiento/graduación
- [ ] Validación pastoral
- [ ] Cambio de fase auditado

Criterio de cierre:
Un mentor puede llevar a una persona por los 12 temas en cualquier orden y documentar todos los hitos de cierre.

---

## FASE 5 — Módulo ENTRENAR
Objetivo: formar líderes.

- [ ] Escuela Ser Líder
- [ ] Cursos
- [ ] Sesiones
- [ ] Talleres
- [ ] Asistencia
- [ ] Evaluaciones
- [ ] Recursos
- [ ] Eventos presenciales
- [ ] Eventos virtuales
- [ ] Encuentros programados
- [ ] Registro de servicio
- [ ] Ministerio
- [ ] Responsable
- [ ] Evidencia de participación
- [ ] Estado de mentor en formación

Criterio de cierre:
La persona puede completar su formación de liderazgo sin acceso indebido a expedientes ajenos.

---

## FASE 6 — Módulo MULTIPLICAR
Objetivo: convertir al aprendiz formado en mentor habilitado.

- [ ] Solicitud/recomendación de promoción
- [ ] Revisión pastoral
- [ ] Aprobación explícita
- [ ] Auditoría
- [ ] Graduación
- [ ] Cambio de rol
- [ ] Permisos de mentor
- [ ] Creación/asignación de equipo
- [ ] Recepción de aprendices
- [ ] Visibilidad de red
- [ ] Alpha bajo su liderazgo cuando esté autorizado
- [ ] Casa de Fe bajo su liderazgo cuando esté autorizado

Criterio de cierre:
Un pastor puede habilitar un mentor y, desde ese momento, el nuevo mentor puede recibir y acompañar personas sin acceso fuera de su red.

---

## FASE 7 — Devocionales y contenidos
- [ ] Biblioteca
- [ ] Contenido por fase
- [ ] Video
- [ ] Audio
- [ ] Texto
- [ ] Pregunta
- [ ] Respuesta
- [ ] Programación
- [ ] Asignación diaria
- [ ] Historial
- [ ] Segmentación por fase
- [ ] Vista del aprendiz

Criterio de cierre:
Cada aprendiz recibe contenido coherente con su fase y el sistema registra interacción cuando aplique.

---

## FASE 8 — Eventos
- [ ] Gestión de eventos
- [ ] Segmentación
- [ ] Inscripción
- [ ] Confirmación
- [ ] Asistencia
- [ ] Recordatorios
- [ ] Eventos destacados en panel
- [ ] Relación con hitos

Criterio de cierre:
La iglesia publica un evento, segmenta audiencia, registra asistencia y lo conecta al expediente cuando corresponda.

---

## FASE 9 — GoHighLevel / WhatsApp
- [ ] Diseñar contrato de integración
- [ ] Webhooks/API
- [ ] Bienvenida
- [ ] Operación 72
- [ ] Recordatorios a consolidadores
- [ ] Devocionales
- [ ] Eventos
- [ ] Alertas
- [ ] Registro de entregas
- [ ] Manejo de fallos
- [ ] Reintentos
- [ ] Idempotencia

Criterio de cierre:
Los eventos del sistema pueden disparar mensajes sin duplicar envíos y con trazabilidad.

---

## FASE 10 — Analítica y salud de la red
- [ ] Embudo por fases
- [ ] Personas por mentor
- [ ] Personas por línea
- [ ] Operaciones 72
- [ ] Alpha
- [ ] Bautismos
- [ ] Encuentros
- [ ] Casa de Fe
- [ ] Entrenamiento
- [ ] Multiplicadores
- [ ] Retención
- [ ] Estancamientos
- [ ] Exportaciones autorizadas

Criterio de cierre:
El pastor puede comprender el estado de la iglesia sin abrir expedientes uno a uno.

---

## FASE 11 — Seguridad, QA y lanzamiento
- [ ] Pruebas unitarias
- [ ] Pruebas de integración
- [ ] E2E
- [ ] Pruebas por rol
- [ ] Pruebas de privacidad
- [ ] Auditoría
- [ ] Backups
- [ ] Restauración
- [ ] Política de retención
- [ ] Revisión de datos sensibles
- [ ] Performance
- [ ] Monitoreo
- [ ] Capacitación
- [ ] Piloto
- [ ] Correcciones
- [ ] Lanzamiento

Criterio de cierre:
La plataforma está lista para operación real en Iglesia Vive.

---

## Métrica global de avance sugerida

0. Documentación: 5 %
1. Fundación: 10 %
2. Personas y red: 15 %
3. Ganar: 15 %
4. Fortalecer: 15 %
5. Entrenar: 10 %
6. Multiplicar: 10 %
7. Contenidos: 5 %
8. Eventos: 5 %
9. Integraciones: 5 %
10. Analítica: 3 %
11. QA/lanzamiento: 2 %

Total: 100 %