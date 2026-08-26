-- Permiso para liderar Casa de Fe (paralelo a can_lead_alpha).
ALTER TABLE "app_user"
  ADD COLUMN "can_lead_faith_house" BOOLEAN NOT NULL DEFAULT false;
