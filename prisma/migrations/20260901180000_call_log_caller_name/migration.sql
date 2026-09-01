-- Nombre de quien hizo/atendió la llamada, tal como lo manda HighLevel
-- («Phone Call User Name»). Permite mostrar en el tablero a cualquier persona
-- que llame dentro del CRM aunque no esté enlazada como personal del sistema.
ALTER TABLE "call_log" ADD COLUMN IF NOT EXISTS "caller_name" text;
CREATE INDEX IF NOT EXISTS "call_log_highlevel_user_id_idx" ON "call_log" ("highlevel_user_id");
