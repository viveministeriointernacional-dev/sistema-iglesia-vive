-- Permiso acumulable: ver TODAS las Casas de Fe y todos los Alpha de la
-- iglesia, sin llevar ninguno y sin que cuelgue nadie de la propia rama.
--
-- Nace del liderazgo de intercesión: quien ora por los grupos necesita saber
-- dónde se reúne cada uno, y desde el 12-sep la pantalla solo enseña lo propio
-- y lo de la rama, así que a quien no acompaña a nadie le quedaba vacía.
--
-- SOLO MIRAR: administrar un grupo sigue dependiendo de `leader_id`,
-- `created_by_id`, la administración o la rama.
ALTER TABLE "app_user"
  ADD COLUMN IF NOT EXISTS "can_see_all_groups" BOOLEAN NOT NULL DEFAULT false;
