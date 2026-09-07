-- Índices para las consultas que se hacen por RANGO DE FECHAS y por
-- CONSOLIDADOR, que hoy resuelven con escaneo completo de la tabla.
--
-- ⚠️ Con el tamaño actual (la tabla más grande tiene 1 528 filas) Postgres va a
-- seguir prefiriendo el escaneo completo, y hace bien: la tabla entera cabe en
-- una docena de páginas. Estos índices **no** aceleran nada hoy — se miden 20 ms
-- en la consulta más pesada del informe, de los cuales 19 ms son de planificar.
-- Se crean porque el costo del escaneo crece en línea recta con la iglesia, y
-- `pg_stat_user_tables` ya muestra el patrón: `person` lleva 771 933 filas
-- leídas a punta de escaneo completo, `learner_profile` 615 938. Cuando esas
-- tablas pasen de unos pocos miles de filas, el planificador empieza a usar
-- estos índices solo, sin que haya que tocar nada.
--
-- Van sin CONCURRENTLY a propósito: `scripts/migrar.mjs` aplica cada migración
-- dentro de una transacción y CONCURRENTLY no se permite ahí. Con estos
-- tamaños el bloqueo de escritura dura milisegundos.

-- El informe cruza `contact_attempt` por fecha varias veces (efectividad,
-- actividad por día, «sin tocar»). El índice que ya existe empieza por
-- `operation72_id`, así que no sirve cuando se filtra solo por fecha.
CREATE INDEX IF NOT EXISTS "contact_attempt_occurred_at_idx"
  ON "contact_attempt"("occurred_at");

-- La cohorte del informe («quiénes entraron en el periodo») y el orden del
-- tablero por más reciente / más antiguo.
CREATE INDEX IF NOT EXISTS "operation72_started_at_idx"
  ON "operation72"("started_at");
CREATE INDEX IF NOT EXISTS "operation72_status_started_at_idx"
  ON "operation72"("status", "started_at");

-- El alcance del tablero para un consolidador («solo mis personas») y el
-- cálculo de carga del reparto automático. Es el que más se va a notar: hoy
-- `learner_profile` no tiene ningún índice por consolidador.
CREATE INDEX IF NOT EXISTS "learner_profile_consolidator_id_idx"
  ON "learner_profile"("consolidator_id");

-- Hitos alcanzados en el periodo.
CREATE INDEX IF NOT EXISTS "milestone_status_achieved_at_idx"
  ON "milestone"("status", "achieved_at");

-- Entregas a mentor del periodo.
CREATE INDEX IF NOT EXISTS "mentor_relationship_started_at_idx"
  ON "mentor_relationship"("started_at");

-- Bajas del periodo. El índice que existe empieza por `learner_id`, que no
-- ayuda cuando se cuentan todas las bajas de una semana.
CREATE INDEX IF NOT EXISTS "learner_status_change_to_status_created_at_idx"
  ON "learner_status_change"("to_status", "created_at");

-- Cambios de fase del periodo (el «neto» de cada fase en el informe).
CREATE INDEX IF NOT EXISTS "phase_change_decided_at_idx"
  ON "phase_change"("decided_at");

-- La pantalla de revisión de bajas cruza las marcaciones del discador por el
-- contacto de HighLevel.
CREATE INDEX IF NOT EXISTS "call_log_contact_id_idx"
  ON "call_log"("contact_id");
