-- Encargados de un grupo: quien lo lleva JUNTO al líder.
--
-- Hasta hoy un Alpha o una Casa de Fe tenía UN solo dueño (`leader_id`), y por
-- eso el equipo venía metiendo al segundo dentro del NOMBRE del grupo: «Casa de
-- Fe Joiner & Maria Isabel», «Oscar & Dana», «Jaime & Geraldine». Seis grupos
-- nombrados en pareja porque el modelo no daba para más.
--
-- El líder sigue siendo uno (`leader_id` NO cambia): es quien responde por el
-- grupo. Los encargados lo administran igual que él.
--
-- Idempotente de punta a punta (§5): se puede repetir sin romper.

CREATE TABLE IF NOT EXISTS "alpha_co_leader" (
    "id"         TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    -- Quién lo puso de encargado. Nulo si esa cuenta se borrara; el renglón
    -- sobrevive porque lo que importa es que la persona lleva el grupo.
    "added_by_id" TEXT,
    "added_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alpha_co_leader_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "faith_house_co_leader" (
    "id"       TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id"  TEXT NOT NULL,
    "added_by_id" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faith_house_co_leader_pkey" PRIMARY KEY ("id")
);

-- ⚠️ La misma cuenta NO puede figurar dos veces como encargada del mismo grupo.
-- Sin esto, pulsar «Añadir» dos veces la pintaría repetida en la ficha y
-- quitarla una vez la dejaría dentro.
CREATE UNIQUE INDEX IF NOT EXISTS "alpha_co_leader_program_id_user_id_key"
    ON "alpha_co_leader"("program_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_co_leader_group_id_user_id_key"
    ON "faith_house_co_leader"("group_id", "user_id");

-- Por cuenta: es la consulta de «qué grupos llevo», que corren la lista de
-- Alpha y Casa de Fe y el feed del calendario en CADA carga.
CREATE INDEX IF NOT EXISTS "alpha_co_leader_user_id_idx"
    ON "alpha_co_leader"("user_id");
CREATE INDEX IF NOT EXISTS "faith_house_co_leader_user_id_idx"
    ON "faith_house_co_leader"("user_id");

DO $$
BEGIN
    ALTER TABLE "alpha_co_leader"
        ADD CONSTRAINT "alpha_co_leader_program_id_fkey"
        FOREIGN KEY ("program_id") REFERENCES "alpha_program"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "alpha_co_leader"
        ADD CONSTRAINT "alpha_co_leader_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "alpha_co_leader"
        ADD CONSTRAINT "alpha_co_leader_added_by_id_fkey"
        FOREIGN KEY ("added_by_id") REFERENCES "app_user"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "faith_house_co_leader"
        ADD CONSTRAINT "faith_house_co_leader_group_id_fkey"
        FOREIGN KEY ("group_id") REFERENCES "faith_house_group"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "faith_house_co_leader"
        ADD CONSTRAINT "faith_house_co_leader_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "app_user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "faith_house_co_leader"
        ADD CONSTRAINT "faith_house_co_leader_added_by_id_fkey"
        FOREIGN KEY ("added_by_id") REFERENCES "app_user"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
