-- Copia de cada correo que envía el sistema, para poder previsualizarlo
-- después desde la actividad del día. Aplica desde que se activa: los
-- correos anteriores no se pueden reconstruir.
CREATE TABLE "email_sent" (
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
CREATE INDEX "email_sent_created_at_idx" ON "email_sent"("created_at");
CREATE INDEX "email_sent_learner_id_created_at_idx" ON "email_sent"("learner_id", "created_at");
