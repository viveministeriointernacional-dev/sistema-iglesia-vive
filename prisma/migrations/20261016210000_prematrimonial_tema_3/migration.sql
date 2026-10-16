-- Taller 3 del prematrimonial: «Sus expectativas para el matrimonio»
-- («Curso Prematrimonial · El Lugar de Su Presencia», páginas 44 a 46).
--
-- Trece preguntas, transcritas del libro con su numeración. Dos son tablas
-- (`SUBCAMPOS`): la 1 es la rejilla de 6 áreas x 2 columnas y la 9 pide un día
-- laboral y un fin de semana. **Una pregunta con casillas sigue siendo UNA
-- pregunta**: partirlas rompería la numeración y el pastor buscaría «la 9» en
-- un papel donde ya no existe.
--
-- Todas las demás son ABIERTAS, como en el libro. El taller 1 usa `MULTIPLE` y
-- `ORDEN` —los tipos que el sistema puede comparar sin juicio— solo donde el
-- libro mismo manda marcar u ordenar; el taller 3 no trae ninguna así, y
-- convertir una pregunta abierta en lista cerrada cambiaría el ejercicio.
--
-- Se puede repetir sin romper: el `UPDATE` es idempotente y cada `INSERT` lleva
-- su `NOT EXISTS`. No toca ninguna tabla caliente (`app_user`, `person`,
-- `learner_profile`), así que se puede fusionar a cualquier hora.
--
-- Medido antes de escribirla: el tema 3 existe desde el 3-oct con el nombre
-- «Tema 3 · pendiente», **0 preguntas y 0 talleres empezados**. Nadie tiene
-- respuestas que esto pueda pisar.

UPDATE "premarital_topic"
SET "name" = 'Sus expectativas para el matrimonio', "updated_at" = now()
WHERE "number" = 3;

INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."fields"
FROM "premarital_topic" t
CROSS JOIN (VALUES
  (1,  'SUBCAMPOS',
       'Enumere las expectativas que tiene de su novio(a) para el matrimonio y las que cree que él (ella) tiene de usted.',
       ARRAY[]::TEXT[],
       ARRAY[
         'Financiera · Lo que espero de mi esposo(a)',
         'Financiera · Lo que creo que espera de mí',
         'Emocional · Lo que espero de mi esposo(a)',
         'Emocional · Lo que creo que espera de mí',
         'Física · Lo que espero de mi esposo(a)',
         'Física · Lo que creo que espera de mí',
         'Espiritual · Lo que espero de mi esposo(a)',
         'Espiritual · Lo que creo que espera de mí',
         'Familiar · Lo que espero de mi esposo(a)',
         'Familiar · Lo que creo que espera de mí',
         'Laboral · Lo que espero de mi esposo(a)',
         'Laboral · Lo que creo que espera de mí'
       ]::TEXT[]),
  (2,  'ABIERTA', '¿Cuáles son sus hábitos, después de sus actividades diarias?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (3,  'ABIERTA', '¿Tiene alguna rutina deportiva o práctica cultural fuera de las de la iglesia? ¿Cuáles son?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (4,  'ABIERTA', '¿Hace oficio en su casa? ¿Qué hace? ¿Cuál es el oficio que menos le gusta hacer?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (5,  'ABIERTA', '¿Qué oficios hacía cuando era niño y quién le ordenaba que los hiciera?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (6,  'ABIERTA', '¿Usted va a todos los planes familiares y/o sociales? Cuando se case, ¿también lo hará?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (7,  'ABIERTA', '¿Qué le gusta cenar y a qué hora?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (8,  'ABIERTA', 'De acuerdo a las anteriores respuestas, hable con su novio(a) acerca de sus costumbres, hábitos, forma de vivir, la forma en que fue criado, entre otras. ¿Cómo estos hábitos pueden afectar o enriquecer su matrimonio?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (9,  'SUBCAMPOS',
       'Imagínese y describa cómo sería un día de casados en un día laboral y en un fin de semana.',
       ARRAY[]::TEXT[],
       ARRAY['Un día laboral', 'Un fin de semana']::TEXT[]),
  (10, 'ABIERTA', '¿Qué expectativas tiene de vivienda? ¿Apartamento, casa, urbana, rural?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (11, 'ABIERTA', '¿Qué compraría en su primer mercado de casados?', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (12, 'ABIERTA', 'En sus propias palabras, explique qué entiende por la siguiente frase: «En el noviazgo abra los ojos y en el matrimonio ciérrelos».', ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (13, 'ABIERTA', 'Enumere tres desilusiones que ha tenido en su vida y cómo las afrontó.', ARRAY[]::TEXT[], ARRAY[]::TEXT[])
) AS p("number", "kind", "prompt", "options", "fields")
WHERE t."number" = 3
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );
