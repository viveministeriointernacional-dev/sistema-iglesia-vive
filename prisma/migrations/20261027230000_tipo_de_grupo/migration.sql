-- **Restaurados y Mentorías: el tipo de grupo.**
--
-- El usuario pidió el 27-oct-2026 poder crear dos procesos más además de Alpha
-- y Casa de Fe: «Restaurados», que es discipulado para parejas, y «Mentorías»,
-- que es discipulado personalizado.
--
-- No llevan tabla propia, y el dato es lo que lo decidió: **el equipo ya los
-- lleva**, escribiendo la palabra dentro del nombre de una Casa de Fe —
-- `JHONATAN TRUJILLO (MENTORIA)`, `SERGIO Y NORA (MENTORIA)`,
-- `FREDY Y NINI (MENTORIA)`, cinco personas en total. Es el mismo apaño de las
-- parejas metidas en el nombre del grupo (21-sep-2026), y la señal de que la
-- forma del grupo ya servía: líder, encargados, miembros, día, hora,
-- dirección, punto en el mapa, calendario y recordatorio son idénticos. Lo
-- único que cambia entre los tres es el contenido.
--
-- Repetible (§12.3): el tipo se crea solo si no existe, la columna lleva
-- `IF NOT EXISTS`, el índice también, y la conversión de abajo deja de
-- encontrar filas en cuanto se aplica una vez.
--
-- ⚠️ Toca `faith_house_group`, que NO es de las calientes (`app_user`,
-- `person`, `learner_profile`): son 55 filas y el `ADD COLUMN` con DEFAULT no
-- reescribe la tabla en Postgres 11 en adelante, así que no pide el candado
-- largo que obliga a fusionar de noche.

-- 1. El tipo. Postgres no tiene `CREATE TYPE IF NOT EXISTS`, así que va dentro
--    de un bloque que mira primero. Sin `raise notice`, que es lo que cuelga el
--    conector del MCP (§12.8); aquí además lo ejecuta `scripts/migrar.mjs`, que
--    manda el archivo entero en una sola consulta.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupKind') THEN
    CREATE TYPE "GroupKind" AS ENUM ('CASA_DE_FE', 'RESTAURADOS', 'MENTORIA');
  END IF;
END
$$;

-- 2. La columna. **Con DEFAULT**, que es lo que deja quietas las 55 filas que
--    ya existían: todas son Casas de Fe y lo siguen siendo.
ALTER TABLE "faith_house_group"
  ADD COLUMN IF NOT EXISTS "kind" "GroupKind" NOT NULL DEFAULT 'CASA_DE_FE';

-- 3. La pantalla pinta un bloque por tipo y el calendario filtra por tipo.
CREATE INDEX IF NOT EXISTS "faith_house_group_kind_closed_at_idx"
  ON "faith_house_group" ("kind", "closed_at");

-- 4. **Las tres mentorías que ya existen pasan a serlo de verdad**, y se les
--    quita la palabra del nombre, que es lo que el equipo escribía por no
--    tener dónde ponerla.
--
--    Va **incondicional** (§12.3): un guarda del tipo «solo si nadie ha creado
--    todavía una mentoría» convertiría esto en un no-op permanente y silencioso
--    si alguien crea una entre el merge y el despliegue. Como está, en cuanto
--    se aplica una vez el `WHERE` deja de encontrar filas por sí solo, porque
--    el nombre ya no lleva el paréntesis.
--
--    ⚠️ El `WHERE` pide **las dos cosas**: que el nombre lleve la marca y que
--    el grupo siga siendo una Casa de Fe. Sin la segunda, una casa que alguien
--    hubiera corregido a mano se volvería a pisar.
UPDATE "faith_house_group"
SET
  "kind" = 'MENTORIA',
  "name" = btrim(regexp_replace("name", '\s*\(\s*MENTOR[IÍ]A\s*\)\s*$', '', 'i'))
WHERE
  "kind" = 'CASA_DE_FE'
  AND "name" ~* '\(\s*MENTOR[IÍ]A\s*\)\s*$'
  -- Y que quede un nombre: ninguna de las tres se llama solo «(MENTORIA)»,
  -- pero un grupo sin nombre sería peor que el paréntesis.
  AND btrim(regexp_replace("name", '\s*\(\s*MENTOR[IÍ]A\s*\)\s*$', '', 'i')) <> '';
