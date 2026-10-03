-- Prematrimonial: los 12 temas que una pareja responde POR SEPARADO y que su
-- pastor compara lado a lado.
--
-- ⚠️ NO TOCA NINGUNA TABLA CALIENTE, y es a propósito (la lección del
-- 24-sep-2026): no hay un solo ALTER sobre `app_user`, `person` ni
-- `learner_profile`, que son las que el sistema lee en cada petición. Quien
-- lleva el prematrimonial se decide por ROL (pastor o administración), así que
-- no hizo falta ninguna columna de permiso. Esta migración se puede fusionar a
-- cualquier hora sin pelear por un candado.
--
-- Todo es idempotente (§5): se puede repetir sin romper.

-- ---------------------------------------------------------------------------
-- El contenido del curso
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "premarital_topic" (
  "id"         TEXT NOT NULL,
  "number"     INTEGER NOT NULL,
  "name"       TEXT NOT NULL,
  -- El codigo del enlace de este tema. Es una CREDENCIAL, no el numero: con
  -- `/prematrimonial/3` cualquiera adivinaria los otros once.
  "code"       TEXT NOT NULL,
  -- Un tema sin preguntas todavia no se puede llenar. Los temas 2 a 12 nacen
  -- asi, y se van sembrando a medida que llega el material del libro.
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "premarital_topic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_topic_number_key" ON "premarital_topic" ("number");
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_topic_code_key" ON "premarital_topic" ("code");

CREATE TABLE IF NOT EXISTS "premarital_question" (
  "id"       TEXT NOT NULL,
  "topic_id" TEXT NOT NULL,
  "number"   INTEGER NOT NULL,
  -- ABIERTA · SI_NO · OPCION · MULTIPLE · ORDEN.
  -- MULTIPLE y ORDEN no existen en Casa de Fe: son los que hacen comparable el
  -- taller sin que nadie tenga que juzgar.
  "kind"     TEXT NOT NULL DEFAULT 'ABIERTA',
  "prompt"   TEXT NOT NULL,
  "options"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "premarital_question_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_question_topic_number_key"
  ON "premarital_question" ("topic_id", "number");

-- ---------------------------------------------------------------------------
-- La pareja
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "premarital_couple" (
  "id"            TEXT NOT NULL,
  -- Los dos son fichas del sistema (decision del usuario, 3-oct-2026). Se
  -- apunta al EXPEDIENTE y no a la persona, porque el taller es parte del
  -- recorrido y es lo que ya usa Casa de Fe.
  "learner_a_id"  TEXT NOT NULL,
  "learner_b_id"  TEXT NOT NULL,
  "leader_id"     TEXT,
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at"     TIMESTAMP(3),
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "premarital_couple_pkey" PRIMARY KEY ("id"),
  -- Nadie es pareja de si mismo.
  CONSTRAINT "premarital_couple_distintos" CHECK ("learner_a_id" <> "learner_b_id")
);
CREATE INDEX IF NOT EXISTS "premarital_couple_learner_a_idx" ON "premarital_couple" ("learner_a_id");
CREATE INDEX IF NOT EXISTS "premarital_couple_learner_b_idx" ON "premarital_couple" ("learner_b_id");
CREATE INDEX IF NOT EXISTS "premarital_couple_leader_idx" ON "premarital_couple" ("leader_id");

-- ⚠️ Nadie puede estar en DOS prematrimoniales abiertos a la vez, por ninguno
-- de los dos lados. Sin esto, inscribir a alguien dos veces le partiria el
-- avance en dos y su pantalla mostraria temas de dos parejas mezclados.
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_couple_a_abierta_key"
  ON "premarital_couple" ("learner_a_id") WHERE "closed_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_couple_b_abierta_key"
  ON "premarital_couple" ("learner_b_id") WHERE "closed_at" IS NULL;

-- ---------------------------------------------------------------------------
-- El taller de cada persona
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "premarital_workshop" (
  "id"           TEXT NOT NULL,
  "couple_id"    TEXT NOT NULL,
  "learner_id"   TEXT NOT NULL,
  "topic_id"     TEXT NOT NULL,
  -- NO hay columna de estado, igual que en Casa de Fe: el estado se DERIVA de
  -- `submitted_at` y de la ultima revision. Una columna aparte se desincroniza
  -- en cuanto alguien reenvia un taller devuelto.
  "submitted_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "premarital_workshop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_workshop_couple_learner_topic_key"
  ON "premarital_workshop" ("couple_id", "learner_id", "topic_id");
CREATE INDEX IF NOT EXISTS "premarital_workshop_learner_idx" ON "premarital_workshop" ("learner_id");
CREATE INDEX IF NOT EXISTS "premarital_workshop_enviados_idx"
  ON "premarital_workshop" ("submitted_at") WHERE "submitted_at" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "premarital_answer" (
  "id"          TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "text"        TEXT,
  -- OPCION y SI_NO.
  "choice"      INTEGER,
  -- MULTIPLE: los indices marcados. Vacio es una respuesta valida (no
  -- considerar correcta ninguna opcion es una respuesta, no un campo vacio).
  "choices"     INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  -- ORDEN: las opciones en el orden que puso la persona. El primero es su 1.
  "ordering"    INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "premarital_answer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_answer_workshop_question_key"
  ON "premarital_answer" ("workshop_id", "question_id");

-- ---------------------------------------------------------------------------
-- La revision del pastor y el destape
-- ---------------------------------------------------------------------------

-- ⚠️ LAS REVISIONES SE APILAN, NO SE PISAN (la regla del 10-sep con las
-- visitas): cuantas veces le devolvieron un tema a una pareja es la señal de
-- que algo no va bien.
CREATE TABLE IF NOT EXISTS "premarital_review" (
  "id"                     TEXT NOT NULL,
  "couple_id"              TEXT NOT NULL,
  "topic_id"               TEXT NOT NULL,
  "approved"               BOOLEAN NOT NULL,
  "note"                   TEXT,
  -- A quien se le devolvio. NULO cuando se aprueba: aprobar es del TEMA, o sea
  -- de los dos; devolver es de uno solo, porque el otro pudo responder bien.
  "returned_to_learner_id" TEXT,
  "reviewed_by_id"         TEXT,
  "reviewed_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "premarital_review_pkey" PRIMARY KEY ("id"),
  -- Al aprobar no se devuelve a nadie.
  CONSTRAINT "premarital_review_devolucion_coherente"
    CHECK (NOT ("approved" AND "returned_to_learner_id" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "premarital_review_couple_topic_idx"
  ON "premarital_review" ("couple_id", "topic_id", "reviewed_at");

-- Destapar = mostrarle la comparacion A LA PAREJA. El pastor la ve en cuanto
-- los dos envian; esto es el permiso para que ellos la vean.
CREATE TABLE IF NOT EXISTS "premarital_reveal" (
  "id"             TEXT NOT NULL,
  "couple_id"      TEXT NOT NULL,
  "topic_id"       TEXT NOT NULL,
  "revealed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revealed_by_id" TEXT,
  CONSTRAINT "premarital_reveal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "premarital_reveal_couple_topic_key"
  ON "premarital_reveal" ("couple_id", "topic_id");

-- ---------------------------------------------------------------------------
-- Claves foraneas
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "premarital_question" ADD CONSTRAINT "premarital_question_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "premarital_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_couple" ADD CONSTRAINT "premarital_couple_learner_a_id_fkey"
    FOREIGN KEY ("learner_a_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_couple" ADD CONSTRAINT "premarital_couple_learner_b_id_fkey"
    FOREIGN KEY ("learner_b_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_couple" ADD CONSTRAINT "premarital_couple_leader_id_fkey"
    FOREIGN KEY ("leader_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_couple" ADD CONSTRAINT "premarital_couple_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_workshop" ADD CONSTRAINT "premarital_workshop_couple_id_fkey"
    FOREIGN KEY ("couple_id") REFERENCES "premarital_couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_workshop" ADD CONSTRAINT "premarital_workshop_learner_id_fkey"
    FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_workshop" ADD CONSTRAINT "premarital_workshop_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "premarital_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_answer" ADD CONSTRAINT "premarital_answer_workshop_id_fkey"
    FOREIGN KEY ("workshop_id") REFERENCES "premarital_workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_answer" ADD CONSTRAINT "premarital_answer_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "premarital_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_review" ADD CONSTRAINT "premarital_review_couple_id_fkey"
    FOREIGN KEY ("couple_id") REFERENCES "premarital_couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_review" ADD CONSTRAINT "premarital_review_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "premarital_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_review" ADD CONSTRAINT "premarital_review_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_reveal" ADD CONSTRAINT "premarital_reveal_couple_id_fkey"
    FOREIGN KEY ("couple_id") REFERENCES "premarital_couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_reveal" ADD CONSTRAINT "premarital_reveal_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "premarital_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "premarital_reveal" ADD CONSTRAINT "premarital_reveal_revealed_by_id_fkey"
    FOREIGN KEY ("revealed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- El hito del recorrido
-- ---------------------------------------------------------------------------
-- ⚠️ `ALTER TYPE … ADD VALUE` SI corre dentro de la transaccion de
-- `migrar.mjs` en PG 17.6 **mientras el valor no se USE en la misma
-- transaccion** (comprobado el 9-sep-2026 con ASISTENTE). Aqui solo se añade;
-- quien lo escribe es el codigo, despues del despliegue.
ALTER TYPE "MilestoneKind" ADD VALUE IF NOT EXISTS 'PREMATRIMONIAL' AFTER 'CASA_DE_FE';

-- ---------------------------------------------------------------------------
-- Los 12 temas
-- ---------------------------------------------------------------------------
-- Solo el 1 trae su contenido: es el unico del que tenemos el libro. Los otros
-- once nacen SIN preguntas, y un tema sin preguntas no se puede llenar — la
-- pantalla lo dice. Se van sembrando a medida que llegue el material, sin
-- tocar nada de lo ya respondido.

INSERT INTO "premarital_topic" ("id", "number", "name", "code")
SELECT gen_random_uuid()::text, n,
       CASE n WHEN 1 THEN 'El matrimonio es un diseño de Dios'
              ELSE 'Tema ' || n || ' · pendiente' END,
       replace(gen_random_uuid()::text, '-', '')
FROM generate_series(1, 12) AS n
WHERE NOT EXISTS (SELECT 1 FROM "premarital_topic" t WHERE t."number" = n);

-- Las 21 preguntas del TALLER 1, transcritas del libro
-- («Curso Prematrimonial · El Lugar de Su Presencia», paginas 13 a 16).
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options"
FROM "premarital_topic" t
CROSS JOIN (VALUES
  (1,  'ABIERTA', '¿Qué es el matrimonio para usted? Comparta la respuesta con su novio(a).', ARRAY[]::TEXT[]),
  (2,  'ABIERTA', '¿Qué concepto del matrimonio le dejaron sus padres?', ARRAY[]::TEXT[]),
  (3,  'ABIERTA', '¿Qué concepto del matrimonio le ha dejado la sociedad?', ARRAY[]::TEXT[]),
  (4,  'ABIERTA', '¿Qué es el noviazgo?', ARRAY[]::TEXT[]),
  (5,  'ABIERTA', 'Responda honestamente, ¿cuál es su motivación para casarse?', ARRAY[]::TEXT[]),
  (6,  'ABIERTA', '¿Por qué casarse y no en unión libre?', ARRAY[]::TEXT[]),
  (7,  'ABIERTA', 'De su vida actual como persona independiente, dé ejemplos de aquello a lo que debe morir o que debe abandonar antes de casarse.', ARRAY[]::TEXT[]),
  -- El libro pone un encabezado sobre las preguntas 8 a 13; se conserva dentro
  -- de la 8 para que no se pierda la instruccion de leer el pasaje.
  (8,  'ABIERTA', 'Lea Génesis 2:18-25 y conteste las siguientes preguntas. ¿Quién creó el matrimonio?', ARRAY[]::TEXT[]),
  (9,  'ABIERTA', '¿Cuáles son los propósitos del matrimonio? (Ver Génesis 1:28, 2:18; Efesios 5:22-23).', ARRAY[]::TEXT[]),
  (10, 'ABIERTA', 'Explique con sus palabras qué significa dejar a papá y mamá.', ARRAY[]::TEXT[]),
  (11, 'ABIERTA', 'Explique con sus palabras qué significa para usted «dejar para unirse».', ARRAY[]::TEXT[]),
  (12, 'ABIERTA', '¿Qué significa para usted el término «ser una sola carne»?', ARRAY[]::TEXT[]),
  (13, 'ABIERTA', '¿Qué significa ser ayuda idónea?', ARRAY[]::TEXT[]),
  (14, 'MULTIPLE', 'De acuerdo con su concepto de «unidad en el matrimonio», marque las respuestas que considere correctas.',
       ARRAY['Dormir juntos.','Vivir bajo un mismo techo.','Orar juntos.','Cada uno toma sus decisiones.','Luchar por sus propios sueños.','Tener una visión conjunta.','Cada uno maneja su dinero.','Cada uno tiene su espacio.']::TEXT[]),
  (15, 'ABIERTA', '¿Por qué cree usted que su novio(a) es la voluntad de Dios?', ARRAY[]::TEXT[]),
  (16, 'ABIERTA', '¿Qué temores tiene frente al matrimonio?', ARRAY[]::TEXT[]),
  (17, 'ABIERTA', '¿Es el matrimonio un pacto o un contrato? Explique por qué.', ARRAY[]::TEXT[]),
  (18, 'ABIERTA', 'Enumere tres razones por las cuales cree que su matrimonio durará toda la vida.', ARRAY[]::TEXT[]),
  (19, 'SI_NO', 'Encuentra en la Palabra de Dios un versículo que diga que el matrimonio es para ser feliz.',
       ARRAY['Sí','No']::TEXT[]),
  (20, 'ABIERTA', 'Compare su respuesta con Génesis 2:15 y escriba a qué nos manda Dios en el matrimonio.', ARRAY[]::TEXT[]),
  (21, 'ORDEN', '¿Cuál es el orden de las prioridades en el matrimonio? Ordene del 1 al 6, siendo 1 el más importante.',
       ARRAY['Esposo.','Hijos.','Dios.','Familia extendida (papá, mamá y hermanos).','Iglesia.','Trabajo.']::TEXT[])
) AS p("number", "kind", "prompt", "options")
WHERE t."number" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );
