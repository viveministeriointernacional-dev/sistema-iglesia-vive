-- Guarda el id de HighLevel de cada usuario, para que el propietario del
-- contacto que llega del CRM quede como su consolidador.
ALTER TABLE "app_user" ADD COLUMN "highlevel_user_id" TEXT;
CREATE UNIQUE INDEX "app_user_highlevel_user_id_key" ON "app_user"("highlevel_user_id");
