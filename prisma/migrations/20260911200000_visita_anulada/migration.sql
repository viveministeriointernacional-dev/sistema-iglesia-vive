-- Deshacer una visita que se le agendó a la persona equivocada.
--
-- No se borra el registro: se ANULA. Así deja de pintar en la tarjeta y de
-- ordenar la columna, pero en el expediente sigue visible —tachado— con quién
-- lo deshizo y por qué. Borrarlo dejaría el expediente sin explicación de por
-- qué la tarjeta se movió y volvió.
ALTER TABLE "contact_attempt" ADD COLUMN IF NOT EXISTS "annulled_at" TIMESTAMP(3);
ALTER TABLE "contact_attempt" ADD COLUMN IF NOT EXISTS "annulled_by_id" TEXT;
ALTER TABLE "contact_attempt" ADD COLUMN IF NOT EXISTS "annulled_reason" TEXT;

-- Las consultas que pintan la visita acordada filtran por «no anulada», y el
-- índice existente empieza por operation72_id, así que este las cubre.
CREATE INDEX IF NOT EXISTS "contact_attempt_annulled_at_idx"
  ON "contact_attempt" ("annulled_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contact_attempt_annulled_by_id_fkey'
  ) THEN
    ALTER TABLE "contact_attempt"
      ADD CONSTRAINT "contact_attempt_annulled_by_id_fkey"
      FOREIGN KEY ("annulled_by_id") REFERENCES "app_user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
