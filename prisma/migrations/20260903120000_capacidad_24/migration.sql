-- El tope de acompañamiento pasa de 12 a 24. El 24 es la regla de la MENTORÍA
-- (un mentor acompaña hasta 24 discípulos en fase de multiplicación); en
-- consolidación la capacidad es solo referencia, no bloquea el reparto.
ALTER TABLE "app_user" ALTER COLUMN "capacity" SET DEFAULT 24;
UPDATE "app_user" SET "capacity" = 24 WHERE "capacity" = 12;
