-- Encuentros de los grupos: cuándo se dio, qué tema se llevó y quién vino.
-- Vale para los CUATRO procesos (Alpha, Casa de Fe, Restaurados y Mentorías),
-- por eso hay dos claves ajenas de las que viaja exactamente una.
--
-- Repetible de punta a punta: si el build se reintenta, no rompe nada.

CREATE TABLE IF NOT EXISTS "group_meeting" (
  "id"             TEXT        NOT NULL,
  "program_id"     TEXT,
  "group_id"       TEXT,
  "number"         INTEGER     NOT NULL,
  "date"           DATE        NOT NULL,
  "topic"          TEXT,
  "topic_number"   INTEGER,
  "happened"       BOOLEAN     NOT NULL DEFAULT true,
  "note"           TEXT,
  "recorded_by_id" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "group_meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "group_attendance" (
  "id"         TEXT        NOT NULL,
  "meeting_id" TEXT        NOT NULL,
  "learner_id" TEXT        NOT NULL,
  "present"    BOOLEAN     NOT NULL DEFAULT true,
  "note"       TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "group_attendance_pkey" PRIMARY KEY ("id")
);

-- ⚠️ UNO de los dos, nunca los dos ni ninguno. Sin este CHECK una fila suelta
-- no pertenecería a ningún grupo y ninguna consulta la encontraría nunca: no
-- daría error, se perdería en silencio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_meeting_un_solo_grupo'
  ) THEN
    ALTER TABLE "group_meeting"
      ADD CONSTRAINT "group_meeting_un_solo_grupo"
      CHECK (("program_id" IS NULL) <> ("group_id" IS NULL));
  END IF;
END
$$;

-- Los dos índices únicos numeran las casillas. En Postgres los NULL son
-- distintos entre sí, así que el de `program_id` no estorba a las filas de
-- Casa de Fe ni al revés.
CREATE UNIQUE INDEX IF NOT EXISTS "group_meeting_program_id_number_key"
  ON "group_meeting" ("program_id", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "group_meeting_group_id_number_key"
  ON "group_meeting" ("group_id", "number");
CREATE INDEX IF NOT EXISTS "group_meeting_group_id_date_idx"
  ON "group_meeting" ("group_id", "date");
CREATE INDEX IF NOT EXISTS "group_meeting_program_id_date_idx"
  ON "group_meeting" ("program_id", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "group_attendance_meeting_id_learner_id_key"
  ON "group_attendance" ("meeting_id", "learner_id");
CREATE INDEX IF NOT EXISTS "group_attendance_learner_id_idx"
  ON "group_attendance" ("learner_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_meeting_program_id_fkey') THEN
    ALTER TABLE "group_meeting" ADD CONSTRAINT "group_meeting_program_id_fkey"
      FOREIGN KEY ("program_id") REFERENCES "alpha_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_meeting_group_id_fkey') THEN
    ALTER TABLE "group_meeting" ADD CONSTRAINT "group_meeting_group_id_fkey"
      FOREIGN KEY ("group_id") REFERENCES "faith_house_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- ⚠️ SET NULL y no CASCADE: borrar la cuenta de quien lo apuntó no puede
  -- borrar el encuentro. Y la columna es anulable a propósito, que es lo que
  -- impide la trampa del 13-oct (un CHECK sobre una columna con SET NULL deja
  -- la fila referenciada imborrable).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_meeting_recorded_by_id_fkey') THEN
    ALTER TABLE "group_meeting" ADD CONSTRAINT "group_meeting_recorded_by_id_fkey"
      FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_attendance_meeting_id_fkey') THEN
    ALTER TABLE "group_attendance" ADD CONSTRAINT "group_attendance_meeting_id_fkey"
      FOREIGN KEY ("meeting_id") REFERENCES "group_meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_attendance_learner_id_fkey') THEN
    ALTER TABLE "group_attendance" ADD CONSTRAINT "group_attendance_learner_id_fkey"
      FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
