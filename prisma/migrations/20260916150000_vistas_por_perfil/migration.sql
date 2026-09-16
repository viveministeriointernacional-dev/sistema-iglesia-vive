-- Vistas por perfil: qué menús ve cada rol, y las excepciones por cuenta.
--
-- Sin filas, manda el defecto del catálogo (lo que cada rol veía antes), así
-- que aplicar esta migración NO cambia el comportamiento de nadie.
--
-- Idempotente (regla del 4-sep-2026): se puede repetir sin romper.

CREATE TABLE IF NOT EXISTS "view_role_access" (
  "id"            TEXT NOT NULL,
  "view"          TEXT NOT NULL,
  "role"          "Role" NOT NULL,
  "enabled"       BOOLEAN NOT NULL,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  CONSTRAINT "view_role_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "view_user_access" (
  "id"            TEXT NOT NULL,
  "view"          TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "enabled"       BOOLEAN NOT NULL,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  CONSTRAINT "view_user_access_pkey" PRIMARY KEY ("id")
);

-- Una sola fila por (vista, rol) y por (vista, cuenta): la pantalla hace
-- upsert sobre estas claves, así que sin ellas se duplicarían los renglones.
CREATE UNIQUE INDEX IF NOT EXISTS "view_role_access_view_role_key"
  ON "view_role_access" ("view", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "view_user_access_view_user_id_key"
  ON "view_user_access" ("view", "user_id");
CREATE INDEX IF NOT EXISTS "view_user_access_user_id_idx"
  ON "view_user_access" ("user_id");

DO $$
BEGIN
  ALTER TABLE "view_role_access"
    ADD CONSTRAINT "view_role_access_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- La excepción muere con la cuenta: si se borra el usuario, su fila sobra.
  ALTER TABLE "view_user_access"
    ADD CONSTRAINT "view_user_access_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "view_user_access"
    ADD CONSTRAINT "view_user_access_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
