-- GI · Generación Imparable: el movimiento juvenil de la iglesia.
--
-- Tres cosas, y ninguna toca la mentoría:
--   1. Dos permisos acumulables sobre la cuenta — llevar GI y coordinarlo.
--   2. A qué líder de GI está asignado cada joven (`gi_assignment`).
--   3. El devocional diario (`gi_devotional`) y lo que el líder escribe
--      (`gi_note`).
--
-- ⚠️ GI **NO cambia la línea de nadie**. Mariana Valentina Narváez es líder de
-- GI y sigue siendo discípula de Paola Viveros: son dos estructuras que
-- conviven. Por eso esto es una tabla aparte y no un campo en
-- `mentor_relationship`.
--
-- Idempotente de punta a punta (§5): se puede repetir sin romper.

ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "can_lead_gi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "app_user" ADD COLUMN IF NOT EXISTS "coordinates_gi" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "gi_assignment" (
    "id"             TEXT NOT NULL,
    "learner_id"     TEXT NOT NULL,
    "leader_id"      TEXT NOT NULL,
    "assigned_by_id" TEXT,
    "started_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Se cierra en vez de borrarse: quién acompañó a quién es historia, igual
    -- que en `mentor_relationship`.
    "ended_at"       TIMESTAMP(3),

    CONSTRAINT "gi_assignment_pkey" PRIMARY KEY ("id")
);

-- ⚠️ Un joven tiene UN solo líder de GI a la vez. Sin este índice, asignarlo
-- dos veces lo pintaría repetido en las dos pantallas y nadie sabría cuál de
-- los dos líderes responde por él. Es PARCIAL a propósito: las asignaciones ya
-- cerradas pueden repetirse cuantas veces haga falta (volver con el líder de
-- antes es normal).
CREATE UNIQUE INDEX IF NOT EXISTS "gi_assignment_learner_vivo_key"
    ON "gi_assignment"("learner_id") WHERE "ended_at" IS NULL;

CREATE INDEX IF NOT EXISTS "gi_assignment_leader_id_ended_at_idx"
    ON "gi_assignment"("leader_id", "ended_at");

CREATE TABLE IF NOT EXISTS "gi_devotional" (
    "id"           TEXT NOT NULL,
    "learner_id"   TEXT NOT NULL,
    -- ⚠️ `date`, no `timestamp`: «el devocional del martes 22» es un DÍA, no un
    -- instante. Guardarlo con hora obligaría a inventarse una y a convertirla
    -- en cada lectura, que es la trampa de las cinco horas del 11-sep-2026.
    "day"          DATE NOT NULL,
    "marked_by_id" TEXT NOT NULL,
    -- Cuándo se marcó, que SÍ es un instante real: sirve para saber si el
    -- líder va al día o marca la semana entera el domingo por la noche.
    "marked_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gi_devotional_pkey" PRIMARY KEY ("id")
);

-- Un día se marca una sola vez. Sin esto, dos toques seguidos dejarían dos
-- renglones y el conteo del mes diría 34 de 30.
CREATE UNIQUE INDEX IF NOT EXISTS "gi_devotional_learner_id_day_key"
    ON "gi_devotional"("learner_id", "day");

-- La semana de todo el movimiento, que es lo que abre la pantalla de los
-- pastores en cada carga.
CREATE INDEX IF NOT EXISTS "gi_devotional_day_idx"
    ON "gi_devotional"("day");

CREATE TABLE IF NOT EXISTS "gi_note" (
    "id"         TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "day"        DATE NOT NULL,
    "body"       TEXT NOT NULL,
    "author_id"  TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gi_note_pkey" PRIMARY KEY ("id")
);

-- ⚠️ La observación vive APARTE del devocional, y no como una columna suya.
-- El caso que lo obliga: un joven que esta semana no marcó ni un día y sobre
-- el que el líder sí tiene algo que decir («está en exámenes, retoma el
-- jueves»). Si la observación colgara de la marca, para escribirla habría que
-- marcar un devocional que no se hizo.
CREATE INDEX IF NOT EXISTS "gi_note_learner_id_day_idx"
    ON "gi_note"("learner_id", "day");

DO $$
BEGIN
    ALTER TABLE "gi_assignment"
        ADD CONSTRAINT "gi_assignment_learner_id_fkey"
        FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "gi_assignment"
        ADD CONSTRAINT "gi_assignment_leader_id_fkey"
        FOREIGN KEY ("leader_id") REFERENCES "app_user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "gi_assignment"
        ADD CONSTRAINT "gi_assignment_assigned_by_id_fkey"
        FOREIGN KEY ("assigned_by_id") REFERENCES "app_user"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "gi_devotional"
        ADD CONSTRAINT "gi_devotional_learner_id_fkey"
        FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "gi_devotional"
        ADD CONSTRAINT "gi_devotional_marked_by_id_fkey"
        FOREIGN KEY ("marked_by_id") REFERENCES "app_user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "gi_note"
        ADD CONSTRAINT "gi_note_learner_id_fkey"
        FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "gi_note"
        ADD CONSTRAINT "gi_note_author_id_fkey"
        FOREIGN KEY ("author_id") REFERENCES "app_user"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
