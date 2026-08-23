-- Liderar Alpha deja de ser un rol y pasa a ser un permiso: así un mentor o un
-- consolidador puede llevar un grupo sin dejar de ser lo que es en la iglesia.
ALTER TABLE "app_user" ADD COLUMN "can_lead_alpha" BOOLEAN NOT NULL DEFAULT false;

-- Quien ya lideraba Alpha conserva el permiso.
UPDATE "app_user" SET "can_lead_alpha" = true WHERE "role" = 'LIDER_ALPHA';

-- Y quien ya tiene un grupo asignado también, aunque su rol fuera otro.
UPDATE "app_user"
   SET "can_lead_alpha" = true
 WHERE "id" IN (SELECT DISTINCT "leader_id" FROM "alpha_program");

-- Quién abrió el grupo, aparte de quién lo lleva.
ALTER TABLE "alpha_program" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "alpha_program"
  ADD CONSTRAINT "alpha_program_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
