-- Copia de cada correo que envía el sistema, para poder previsualizarlo
-- después desde la actividad del día. Aplica desde que se activa: los
-- correos anteriores no se pueden reconstruir.
--
-- Va con IF NOT EXISTS porque esta tabla se creó a mano en Supabase antes de
-- que existiera `scripts/migrar.mjs`: sin eso, el primer build con migraciones
-- automáticas fallaría con «relation already exists». Regla para las
-- migraciones nuevas: escribirlas de forma que se puedan repetir sin romper.
CREATE TABLE IF NOT EXISTS "email_sent" (
  "id"          TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "to"          TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "html"        TEXT NOT NULL,
  "sent"        BOOLEAN NOT NULL,
  "failure"     TEXT,
  "person_id"   TEXT,
  "learner_id"  TEXT,
  "actor_id"    TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_sent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_sent_created_at_idx" ON "email_sent"("created_at");
CREATE INDEX IF NOT EXISTS "email_sent_learner_id_created_at_idx" ON "email_sent"("learner_id", "created_at");
