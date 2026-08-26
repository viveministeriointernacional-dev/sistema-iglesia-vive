-- Permiso de coordinación de consolidación: un consolidador que revisa a todos.
ALTER TABLE "app_user"
  ADD COLUMN "coordinates_consolidation" BOOLEAN NOT NULL DEFAULT false;
