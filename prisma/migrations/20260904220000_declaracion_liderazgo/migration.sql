-- Lo que una persona del liderazgo declara sobre sí misma desde el formulario
-- público. NO otorga permisos: queda pendiente hasta que un administrador la
-- confirme o la descarte desde el expediente.
CREATE TABLE IF NOT EXISTS "leadership_declaration" (
  "id"             TEXT NOT NULL,
  "person_id"      TEXT NOT NULL,
  "roles"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "declared_phase" "Phase",
  "note"           TEXT,
  "status"         TEXT NOT NULL DEFAULT 'PENDIENTE',
  "reviewed_by_id" TEXT,
  "reviewed_at"    TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leadership_declaration_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "leadership_declaration"
    ADD CONSTRAINT "leadership_declaration_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "person"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leadership_declaration"
    ADD CONSTRAINT "leadership_declaration_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "leadership_declaration_status_created_at_idx"
  ON "leadership_declaration"("status", "created_at");
CREATE INDEX IF NOT EXISTS "leadership_declaration_person_id_idx"
  ON "leadership_declaration"("person_id");
