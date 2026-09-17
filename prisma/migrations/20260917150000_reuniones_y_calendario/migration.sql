-- Hora, día, duración y dirección de los grupos, y el enlace de calendario.
--
-- La hora va como TEXTO «HH:mm» en hora de Colombia, no como timestamp: «los
-- miércoles a las 7 p. m.» es una regla que se repite, no un instante. Así se
-- esquiva la trampa de las cinco horas del 11-sep-2026.
--
-- Todo nace nulo o con su valor por defecto, así que los 18 grupos que ya
-- existen siguen funcionando igual; simplemente no salen en ningún calendario
-- hasta que alguien les ponga el día y la hora.
--
-- Idempotente (regla del 4-sep-2026).

ALTER TABLE "faith_house_group"
  ADD COLUMN IF NOT EXISTS "weekday"          INTEGER,
  ADD COLUMN IF NOT EXISTS "meeting_time"     TEXT,
  ADD COLUMN IF NOT EXISTS "every_n_weeks"    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "address"          TEXT;

ALTER TABLE "alpha_program"
  ADD COLUMN IF NOT EXISTS "weekday"          INTEGER,
  ADD COLUMN IF NOT EXISTS "meeting_time"     TEXT,
  ADD COLUMN IF NOT EXISTS "every_n_weeks"    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS "address"          TEXT;

ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "calendar_token" TEXT;

-- El token es lo único que autoriza el feed, así que no puede repetirse: dos
-- cuentas con el mismo código verían el calendario de la otra.
CREATE UNIQUE INDEX IF NOT EXISTS "app_user_calendar_token_key"
  ON "app_user" ("calendar_token");
