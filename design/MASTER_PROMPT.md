# MASTER_PROMPT.md
# Sistema de Transformación y Propósito — Iglesia Vive

## 1. Rol del agente de IA

Actúa como arquitecto de software, product engineer, UX engineer y desarrollador senior responsable de construir el Sistema de Transformación y Propósito de Iglesia Vive.

Tu trabajo no consiste en inventar una aplicación religiosa genérica ni un CRM tradicional. Debes construir una plataforma interna que documenta, acompaña, mide y hace visible el proceso de transformación de una persona desde su llegada a Iglesia Vive hasta su graduación como mentor capaz de formar a otros.

El sistema debe respetar la lógica pastoral definida en este documento. Si una regla de negocio está expresamente descrita aquí, no la reemplaces por una suposición técnica.

## 2. Propósito institucional

El propósito de Iglesia Vive es:

> Formar a Cristo en la vida de las personas.

El software es una herramienta de apoyo para medir, evaluar, documentar y acompañar el proceso de transformación de cada persona.

El software NO reemplaza:
- el discernimiento pastoral;
- el acompañamiento humano;
- la mentoría;
- la guía espiritual;
- la evaluación personal del líder.

El sistema documenta hechos, evidencias, hitos, seguimiento, notas y progreso. Las decisiones pastorales finales permanecen en manos de los líderes responsables.

## 3. Objetivo del producto

Construir una plataforma web interna, visual, inspiracional, clara y moderna que permita:

1. Registrar personas nuevas.
2. Crear un expediente único por aprendiz.
3. Asignar consolidadores automáticamente.
4. Ejecutar y medir Operación 72.
5. Entregar cada aprendiz a una línea de mentoría.
6. Acompañar las cuatro fases del proceso:
   - Ganar
   - Fortalecer
   - Entrenar
   - Multiplicar
7. Registrar hitos, asistencia, evaluaciones y evidencia pastoral.
8. Mostrar el progreso individual del aprendiz.
9. Entregar paneles distintos según el rol.
10. Mostrar la estructura de la iglesia como un árbol vivo de discipulado.
11. Integrar contenido de transformación, devocionales y eventos.
12. Integrar mensajería y automatizaciones con GoHighLevel/WhatsApp.
13. Mantener notas pastorales privadas.
14. Permitir que cada mentor vea únicamente su red descendente.
15. Permitir que el pastor principal y administradores autorizados vean la estructura completa.

## 4. Visión del recorrido humano

El sistema debe representar este ciclo:

Persona nueva
→ Ganar
→ Fortalecer
→ Entrenar
→ Multiplicar
→ Mentor
→ Gana y acompaña nuevas personas
→ El ciclo se repite.

El producto debe transmitir transformación y propósito. No debe parecer una base de datos fría.

## 5. Principio rector de UX

Toda decisión de interfaz debe responder una pregunta:

> ¿Puede un líder autorizado abrir el perfil de una persona y comprender, en pocos segundos, su historia, fase actual, responsable, hitos, riesgos, próximos pasos y recorrido de transformación?

La respuesta debe ser sí.

## 6. Terminología oficial

### Persona
Registro humano único dentro de Iglesia Vive.

### Aprendiz
Persona que está recorriendo el proceso de transformación.

### Consolidador
Miembro del equipo de consolidación. Atiende el inicio del proceso, especialmente Operación 72.

### Mentor
Líder que acompaña personalmente al aprendiz y valida pastoralmente su proceso.

### Multiplicador
Persona habilitada pastoralmente para liderar Alpha, Casa de Fe u otros procesos y comenzar a acompañar a otros.

### Equipo 12
Estructura relacional de liderazgo/discipulado. Un mentor puede tener un equipo de hasta 12 personas principales dentro de su línea.

### Línea
Cadena relacional de discipulado que vincula a una persona con quien la invitó, el mentor correspondiente y la estructura superior.

### Operación 72
Proceso de atención de una persona nueva durante las primeras 72 horas desde su registro.

### Alpha
Proceso evangelístico de aproximadamente 3 meses y 12 sesiones. Busca conexión con Dios y conexión con comunidad.

### Focus Day
Sesión de cierre de Alpha.

### Casa de Fe
Proceso de discipulado más profundo de 12 principios o temas. Los temas son obligatorios, pero el orden puede variar según la necesidad del aprendiz.

### Encuentro
Hito espiritual relevante dentro del proceso de Fortalecer.

### Escuela Ser Líder
Módulo de formación de liderazgo correspondiente a la fase Entrenar.

## 7. Regla crítica de privacidad

Las observaciones pastorales, evaluaciones internas y notas de mentoría:
- son privadas;
- no son visibles para el aprendiz;
- solo son visibles para usuarios autorizados según su rol y relación jerárquica;
- deben auditarse.

## 8. Reglas de producto que NO deben cambiarse sin autorización

1. El proceso tiene cuatro fases principales.
2. La promoción a mentor no es automática.
3. La aprobación final para multiplicar depende de una evaluación pastoral.
4. Las notas internas no son visibles al aprendiz.
5. La asignación de consolidadores respeta el género.
6. Las personas que llegan por una línea conocida deben conservar esa línea.
7. Si no existe una línea conocida, la asignación de mentor usa perfil y reglas definidas.
8. Alpha requiere mínimo 60 % de asistencia, Focus Day y validación del líder.
9. Casa de Fe contempla 12 temas obligatorios sin secuencia rígida.
10. Para cerrar Fortalecer deben quedar documentados, como mínimo:
    - temas requeridos;
    - bautismo;
    - al menos un Encuentro;
    - reconocimiento/graduación;
    - validación pastoral.
11. Un usuario en Entrenar no obtiene automáticamente acceso a datos de otros.
12. Solo un multiplicador/mentor habilitado puede recibir personas a su cargo.
13. Cada mentor ve su red descendente, no toda la iglesia.
14. El pastor principal puede ver la estructura completa.
15. El sistema debe guardar historial, no sobrescribir silenciosamente estados críticos.

## 9. Política de ejecución para agentes

Antes de implementar cualquier funcionalidad:
1. identifica la regla de negocio involucrada;
2. identifica los roles afectados;
3. identifica los permisos de lectura/escritura;
4. identifica el evento que crea el cambio de estado;
5. identifica si la acción requiere auditoría;
6. identifica cómo se verá en la línea de tiempo del aprendiz;
7. implementa pruebas.

No implementes una transición de fase únicamente porque se completó un porcentaje. Las transiciones que requieren validación humana deben conservar esa validación.

## 10. Criterios globales de calidad

- Mobile first.
- Responsive.
- Navegación simple.
- Accesibilidad razonable.
- Auditoría de acciones sensibles.
- Historial de cambios.
- Seguridad basada en roles y alcance de red.
- Separación entre datos públicos del aprendiz y notas pastorales privadas.
- Estados explícitos.
- Errores visibles y recuperables.
- Ninguna automatización debe eliminar el control humano donde la regla pastoral exija validación.

## 11. Entregables esperados del agente de desarrollo

El agente deberá construir de forma incremental:
1. base técnica;
2. autenticación;
3. roles y permisos;
4. modelo de datos;
5. árbol organizacional;
6. perfil único;
7. módulo Ganar;
8. módulo Fortalecer;
9. módulo Entrenar;
10. módulo Multiplicar;
11. contenido/devocionales;
12. eventos;
13. integración GoHighLevel/WhatsApp;
14. reportes;
15. auditoría;
16. QA;
17. despliegue.

Debe seguir `ROADMAP_DESARROLLO.md` y `ESPECIFICACION_PRODUCTO.md`.