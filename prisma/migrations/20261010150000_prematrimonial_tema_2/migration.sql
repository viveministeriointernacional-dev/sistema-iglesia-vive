-- Taller 2 del prematrimonial: «Creados a imagen y semejanza» (págs. 27-33).
--
-- ⚠️ TRAE UN TIPO DE PREGUNTA NUEVO, `SUBCAMPOS`: una sola pregunta con N
-- casillas rotuladas. El taller 2 lo necesita tres veces — la 1 es una tabla de
-- 7 áreas x 2 columnas (14 casillas), la 2 tiene una casilla por área y la 5
-- tres. Partirlas en preguntas sueltas habría roto la numeración del libro, y
-- el pastor buscaría «la 5» en un papel donde ya no existe.
--
-- `kind` es TEXTO y no un enum de Postgres, así que el tipo nuevo no necesita
-- ningún ALTER TYPE: entra como un valor más. No toca ninguna tabla caliente
-- (`app_user`, `person`, `learner_profile`), así que se puede fusionar a
-- cualquier hora.

ALTER TABLE "premarital_question" ADD COLUMN IF NOT EXISTS "fields" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "premarital_answer"   ADD COLUMN IF NOT EXISTS "texts"  text[] NOT NULL DEFAULT '{}';

-- El nombre real del tema, que hasta hoy decía «Tema 2 · pendiente».
UPDATE "premarital_topic" SET "name" = 'Creados a imagen y semejanza', "updated_at" = now()
WHERE "number" = 2;

INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 1, 'SUBCAMPOS', 'Escriba las diferencias y similitudes con su novio(a) en las siguientes áreas.', '{}'::text[], ARRAY['Espiritual · Similitudes', 'Espiritual · Diferencias', 'Física · Similitudes', 'Física · Diferencias', 'Emocional · Similitudes', 'Emocional · Diferencias', 'Financiera · Similitudes', 'Financiera · Diferencias', 'Temperamento · Similitudes', 'Temperamento · Diferencias', 'Familiar · Similitudes', 'Familiar · Diferencias', 'Intelectual · Similitudes', 'Intelectual · Diferencias']::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 1
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 2, 'SUBCAMPOS', 'De acuerdo a la pregunta anterior, ¿cómo piensa usted que las similitudes y diferencias pueden ser complemento o conflicto en cada área?', '{}'::text[], ARRAY['Espiritual', 'Física', 'Emocional', 'Financiero', 'Temperamento', 'Familiar', 'Intelectual']::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 2
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 3, 'ABIERTA', 'Dentro de las diferencias y similitudes encontradas, ¿en cuáles cree que necesita llegar a acuerdos, trabajar inmediatamente o establecer metas a largo plazo?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 3
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 4, 'ABIERTA', 'Según Efesios 4:2 ¿cómo su relación con Dios puede ayudarle en las diferencias que se puedan presentar en su matrimonio?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 4
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 5, 'SUBCAMPOS', 'Identifique los eventos que marcaron su niñez de manera positiva y negativa en las siguientes áreas:', '{}'::text[], ARRAY['Finanzas', 'Relación con sus padres', 'El colegio o la universidad']::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 5
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 6, 'ABIERTA', '¿Cómo se lleva con cada uno de sus padres?, ¿qué le gustaba y qué le disgustaba de ellos?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 6
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 7, 'ABIERTA', '¿Cuáles han sido sus pasatiempos y juegos favoritos?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 7
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 8, 'ABIERTA', '¿Cómo usted, por lo general, se veía involucrado en problemas?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 8
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 9, 'ABIERTA', '¿Cómo salía de ellos?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 9
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 10, 'ABIERTA', '¿Tuvo mascotas? ¿Le gustaría tenerlas hoy en día?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 10
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 11, 'ABIERTA', '¿Qué soñaba ser cuando grande?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 11
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 12, 'ABIERTA', '¿Estaba conforme con sí mismo cuando niño? Explique', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 12
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 13, 'ABIERTA', '¿Estaba conforme con sí mismo cuando adolescente? Explique', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 13
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 14, 'ABIERTA', '¿Cuáles eran sus talentos y habilidades especiales?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 14
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 15, 'ABIERTA', '¿Qué premios y logros obtuvo?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 15
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 16, 'ABIERTA', '¿Tenía algún apodo? ¿Por qué le decían así?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 16
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 17, 'ABIERTA', '¿Quiénes son sus amigos más cercanos?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 17
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 18, 'ABIERTA', 'Describa el entorno donde creció: las personas, el vecindario, etc.', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 18
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 19, 'ABIERTA', '¿En su familia se hablaba de Dios?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 19
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 20, 'ABIERTA', '¿Cómo era su relación con Dios cuando niño y adolescente?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 20
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 21, 'ABIERTA', '¿A que le temía?, ¿sigue teniendo alguno de esos temores hoy en día?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 21
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 22, 'ABIERTA', '¿Cómo se llevaba con sus hermanos o hermanas? Si es hijo único, ¿cuáles eran los familiares a los que se sentía más cercano?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 22
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 23, 'ABIERTA', '¿Qué parte de su niñez le gustaría volver a vivir? ¿Por qué?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 23
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 24, 'ABIERTA', '¿Cómo fue la experiencia de su primera cita romántica?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 24
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 25, 'ABIERTA', '¿Tuvo relaciones sentimentales anteriores? Describa cómo lo marcaron, positiva y negativamente.', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 25
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 26, 'ABIERTA', '¿Todavía se relaciona con esas personas? Explique (redes sociales, citas, llamadas, mensajes etc.).', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 26
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 27, 'ABIERTA', '¿Cómo se sentía cuando le gustaba alguien y esa persona no le correspondía?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 27
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 28, 'ABIERTA', '¿Cuáles han sido sus mayores desilusiones? ¿Cómo las ha manejado? ¿Qué ha aprendido de ellas?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 28
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 29, 'ABIERTA', '¿Tuvo suficiente dinero en su juventud?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 29
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 30, 'ABIERTA', '¿Ha tenido hijos? ¿Desea tener hijos?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 30
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 31, 'ABIERTA', 'Describa su experiencia en el colegio o en la universidad y cómo se vio reflejada en su experiencia laboral.', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 31
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 32, 'ABIERTA', '¿Cuáles son sus dones naturales?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 32
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 33, 'ABIERTA', '¿Cuáles son sus fortalezas?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 33
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 34, 'ABIERTA', '¿Cuáles cree que son sus debilidades?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 34
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 35, 'ABIERTA', '¿Cuál es su historial médico?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 35
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 36, 'ABIERTA', '¿Cuál es su definición de una pareja ideal?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 36
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 37, 'ABIERTA', 'Mencione quiénes son las cinco personas más importantes en su vida.', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 37
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 38, 'ABIERTA', 'Describa en dónde le gustaría vivir (país, ciudad, casa o apartamento, etc.)', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 38
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 39, 'ABIERTA', '¿En qué estrato le gustaría vivir?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 39
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 40, 'ABIERTA', '¿Qué concepto tiene de la vejez?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 40
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 41, 'ABIERTA', '¿Practica algún deporte?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 41
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 42, 'ABIERTA', '¿Cree en Jesús como su Salvador o le parece que solo es un personaje de moda? Explique.', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 42
  );
INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", 43, 'ABIERTA', '¿Considera que la iglesia es un simple pasatiempo?', '{}'::text[], '{}'::text[]
FROM "premarital_topic" t
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q WHERE q."topic_id" = t."id" AND q."number" = 43
  );
