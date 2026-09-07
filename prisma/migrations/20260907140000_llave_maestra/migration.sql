-- La llave maestra: un secreto propio del administrador que abre cualquier
-- perfil con el correo de esa persona. NO es la contraseña de nadie, para que
-- se pueda rotar sin cambiarle el ingreso a quien la administra.
--
-- Nunca se guarda el valor: solo su huella PBKDF2 con sal propia. Rotarla
-- marca `revoked_at` en la anterior, así queda el historial de cuándo cambió.
CREATE TABLE IF NOT EXISTS "master_key" (
  "id"            TEXT NOT NULL,
  "secret_hash"   TEXT NOT NULL,
  "salt"          TEXT NOT NULL,
  "iterations"    INTEGER NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at"  TIMESTAMP(3),
  "revoked_at"    TIMESTAMP(3),
  CONSTRAINT "master_key_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "master_key"
    ADD CONSTRAINT "master_key_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Una sola llave viva a la vez. La expresión es siempre `true` dentro del
-- filtro, así que el índice deja pasar como máximo una fila sin revocar.
CREATE UNIQUE INDEX IF NOT EXISTS "master_key_una_activa"
  ON "master_key"(("revoked_at" IS NULL)) WHERE "revoked_at" IS NULL;
