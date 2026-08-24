-- Identidad externa estable para que los reintentos del webhook y los envíos
-- repetidos de un mismo contacto nunca creen dos expedientes.
CREATE TABLE "highlevel_contact" (
  "id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "person_id" TEXT NOT NULL,
  "form_id" TEXT,
  "last_submission_id" TEXT,
  "last_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "highlevel_contact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "highlevel_contact_location_id_contact_id_key"
  ON "highlevel_contact"("location_id", "contact_id");
CREATE INDEX "highlevel_contact_person_id_idx"
  ON "highlevel_contact"("person_id");

ALTER TABLE "highlevel_contact"
  ADD CONSTRAINT "highlevel_contact_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "person"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "highlevel_contact" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."highlevel_contact" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public."highlevel_contact" FROM authenticated;
  END IF;
END
$$;
