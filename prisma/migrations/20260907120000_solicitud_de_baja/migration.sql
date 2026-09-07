-- Nadie sale del sistema sin que un administrador lo autorice. Cuando el
-- equipo de consolidación pide una baja, la persona NO se retira: queda aquí
-- una solicitud PENDIENTE hasta que un administrador la resuelva.
--
-- `resolution_note` es la observación con la que el administrador devuelve a
-- la persona a consolidación: le dice al consolidador qué hacer con ella.
CREATE TABLE IF NOT EXISTS "baja_request" (
  "id"              TEXT NOT NULL,
  "learner_id"      TEXT NOT NULL,
  "reason"          TEXT NOT NULL,
  "note"            TEXT,
  "requested_by_id" TEXT NOT NULL,
  -- PENDIENTE · AUTORIZADA · RECHAZADA · RETIRADA
  "status"          TEXT NOT NULL DEFAULT 'PENDIENTE',
  "resolved_by_id"  TEXT,
  "resolved_at"     TIMESTAMP(3),
  "resolution_note" TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "baja_request_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "baja_request"
    ADD CONSTRAINT "baja_request_learner_id_fkey"
    FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "baja_request"
    ADD CONSTRAINT "baja_request_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "baja_request"
    ADD CONSTRAINT "baja_request_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "app_user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "baja_request_status_created_at_idx"
  ON "baja_request"("status", "created_at");
CREATE INDEX IF NOT EXISTS "baja_request_learner_id_created_at_idx"
  ON "baja_request"("learner_id", "created_at");

-- Una sola solicitud pendiente por persona: el segundo clic no abre otra cola.
CREATE UNIQUE INDEX IF NOT EXISTS "baja_request_una_pendiente_por_persona"
  ON "baja_request"("learner_id") WHERE "status" = 'PENDIENTE';
