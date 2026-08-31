-- Registro de llamadas de HighLevel para el tablero de administración.
-- Cada evento de llamada que envía el CRM por webhook se guarda aquí: quién
-- llamó (mapeado a app_user por highlevel_user_id), a qué contacto, la duración
-- y cómo terminó. La pareja (provider, external_id) evita duplicados en reintentos.

CREATE TABLE IF NOT EXISTS "call_log" (
  "id"               text PRIMARY KEY,
  "provider"         text NOT NULL DEFAULT 'highlevel',
  "external_id"      text NOT NULL,
  "location_id"      text,
  "highlevel_user_id" text,
  "app_user_id"      text,
  "contact_id"       text,
  "direction"        text,
  "status"           text,
  "answered"         boolean NOT NULL DEFAULT false,
  "duration_seconds" integer NOT NULL DEFAULT 0,
  "from_number"      text,
  "to_number"        text,
  "recording_url"    text,
  "started_at"       timestamp(3) NOT NULL,
  "metadata"         jsonb,
  "created_at"       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_log_app_user_id_fkey" FOREIGN KEY ("app_user_id")
    REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "call_log_provider_external_id_key"
  ON "call_log" ("provider", "external_id");
CREATE INDEX IF NOT EXISTS "call_log_app_user_id_started_at_idx"
  ON "call_log" ("app_user_id", "started_at");
CREATE INDEX IF NOT EXISTS "call_log_started_at_idx"
  ON "call_log" ("started_at");
