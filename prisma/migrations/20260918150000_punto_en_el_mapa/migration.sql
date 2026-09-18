-- El punto exacto de la reunión, marcado con el pin en el mapa.
--
-- Es un EXTRA sobre la dirección escrita, no su reemplazo: la dirección es la
-- que se dicta por teléfono y la que sale en el calendario; el punto es lo que
-- hace que «Cómo llegar» lleve a la casa y no a la mitad de la cuadra. En
-- muchos barrios de Neiva la dirección escrita no existe en el mapa como se
-- dice, y por eso el punto no se puede deducir de ella.
--
-- Nulos los dos mientras nadie lo marque, que es como quedan los 19 grupos que
-- ya existen. Van juntos o no van: media coordenada no ubica nada.
--
-- `double precision` y no `numeric`: son coordenadas, se calculan distancias
-- con ellas, y el error del doble está muy por debajo del metro.
-- Idempotente (regla de §5): el build repite las migraciones que falten.

ALTER TABLE "faith_house_group" ADD COLUMN IF NOT EXISTS "latitude"  double precision;
ALTER TABLE "faith_house_group" ADD COLUMN IF NOT EXISTS "longitude" double precision;

ALTER TABLE "alpha_program" ADD COLUMN IF NOT EXISTS "latitude"  double precision;
ALTER TABLE "alpha_program" ADD COLUMN IF NOT EXISTS "longitude" double precision;

-- Una coordenada fuera de rango no es un punto: sería un pin en ninguna parte,
-- y el enlace de Google lo abriría igual sin que nadie note el error.
DO $$
BEGIN
  ALTER TABLE "faith_house_group" ADD CONSTRAINT "faith_house_group_punto_valido"
    CHECK (
      ("latitude" IS NULL) = ("longitude" IS NULL)
      AND ("latitude"  IS NULL OR ("latitude"  BETWEEN -90  AND 90))
      AND ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "alpha_program" ADD CONSTRAINT "alpha_program_punto_valido"
    CHECK (
      ("latitude" IS NULL) = ("longitude" IS NULL)
      AND ("latitude"  IS NULL OR ("latitude"  BETWEEN -90  AND 90))
      AND ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
