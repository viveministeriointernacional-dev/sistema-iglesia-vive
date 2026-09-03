-- Acompañar como mentor pasa a ser un permiso acumulable (como liderar Alpha o
-- Casa de Fe): un consolidador puede tener discípulos sin dejar de serlo.
ALTER TABLE "app_user" ADD COLUMN "can_mentor" BOOLEAN NOT NULL DEFAULT false;
