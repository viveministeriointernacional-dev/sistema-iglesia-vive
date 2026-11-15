-- Testimonios de milagros: lo que llega por el enlace público /milagros
-- («Cuéntanos tu milagro»), con nombre, celular, edad y el testimonio.
--
-- No se enlaza a ninguna ficha (decisión del usuario, 15-nov-2026): se guarda
-- tal cual lo escribieron.
--
-- ⚠️ Tabla NUEVA: no toca ninguna tabla caliente salvo la clave ajena hacia
-- `app_user`, que solo pide un candado corto para crearse. Todo se puede repetir
-- sin romper (§12.3).
CREATE TABLE IF NOT EXISTS "testimony" (
  "id"              TEXT         NOT NULL,
  "name"            TEXT         NOT NULL,
  "phone"           TEXT         NOT NULL,
  "age"             INTEGER      NOT NULL,
  "text"            TEXT         NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contacted_at"    TIMESTAMP(3),
  "contacted_by_id" TEXT,
  CONSTRAINT "testimony_pkey" PRIMARY KEY ("id")
);

-- Sin CHECK que exija «fecha y autor juntos»: con el SET NULL de abajo haría
-- imborrable cualquier cuenta que hubiera marcado un testimonio (§12.3).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'testimony_contacted_by_id_fkey'
  ) THEN
    ALTER TABLE "testimony"
      ADD CONSTRAINT "testimony_contacted_by_id_fkey"
      FOREIGN KEY ("contacted_by_id") REFERENCES "app_user"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "testimony_created_at_idx" ON "testimony"("created_at");
CREATE INDEX IF NOT EXISTS "testimony_contacted_at_idx" ON "testimony"("contacted_at");
