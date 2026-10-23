-- Taller 4 del prematrimonial: «Amor, el mandamiento que sostiene el pacto»
-- («Curso Prematrimonial · El Lugar de Su Presencia», páginas 56 a 60).
--
-- Diez preguntas, transcritas del libro con su numeración. Cinco son tablas o
-- listas de casillas (`SUBCAMPOS`) y cinco son abiertas, como en el libro.
-- **Una pregunta con casillas sigue siendo UNA pregunta**: partirlas rompería
-- la numeración y el pastor buscaría «la 3» en un papel donde ya no existe.
--
-- Las cuatro de casillas grandes:
--   · la 1 es la rejilla de 3 columnas (para usted / según la sociedad / según
--     mi contexto familiar),
--   · la 2 son los 15 versículos, uno por casilla,
--   · la 3 son los 12 comportamientos de 1 Corintios 13:4-7, de la a a la l,
--   · la 7 son las 5 situaciones difíciles, de la a a la e,
--   · la 10 son las 7 líneas de «¿cumple lo que promete?».
--
-- ⚠️ **LA 10 ES LA ÚNICA DECISIÓN DE VERDAD, Y VA FIEL AL LIBRO.** En el papel
-- es una pregunta Sí/No con seis sub-líneas, de las que cinco son Sí/No y una
-- —«¿Cuántas tarjetas de crédito tiene?»— es un número. El modelo tiene un solo
-- `kind` por pregunta, así que o es fiel o es comparable, no las dos:
--   · `SUBCAMPOS` (lo que se hace aquí): conserva las SIETE líneas, incluida la
--     de las tarjetas, y conserva el número 10. El pastor lee las dos columnas.
--   · `MULTIPLE` con las seis de Sí/No: el sistema diría solo si los dos novios
--     marcaron lo mismo, pero **habría que tirar la pregunta de las tarjetas**.
-- Se eligió no perder contenido del libro. Medido antes: el taller 2 tiene
-- **0 preguntas comparables** de 22 y el taller 3 solo 1 de 13, así que un
-- taller que se lee en paralelo es lo normal aquí, no la excepción.
--
-- Se puede repetir sin romper: el `UPDATE` es idempotente y el `INSERT` lleva
-- su `NOT EXISTS`. No toca ninguna tabla caliente (`app_user`, `person`,
-- `learner_profile`), así que se puede fusionar a cualquier hora.
--
-- Medido antes de escribirla: el tema 4 existe desde el 3-oct con el nombre
-- «Tema 4 · pendiente», **0 preguntas, 0 talleres empezados y 0 respuestas**.
-- No hay nada que esto pueda pisar. Y como el sistema marca `disponible` solo
-- cuando el tema tiene preguntas, el taller aparece justo al aplicarse esto.

UPDATE "premarital_topic"
SET "name" = 'Amor, el mandamiento que sostiene el pacto', "updated_at" = now()
WHERE "number" = 4;

INSERT INTO "premarital_question" ("id", "topic_id", "number", "kind", "prompt", "options", "fields")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."fields"
FROM "premarital_topic" t
CROSS JOIN (VALUES
  (1,  'SUBCAMPOS',
       'Definición de amor.',
       ARRAY[]::TEXT[],
       ARRAY[
         'Para usted',
         'Según la sociedad (pregúntele a sus amigos, compañeros, personas separadas)',
         'Según mi contexto familiar'
       ]::TEXT[]),
  (2,  'SUBCAMPOS',
       'De acuerdo con cada versículo, escriba una característica del amor.',
       ARRAY[]::TEXT[],
       ARRAY[
         'Mateo 22:37-39',
         'Lucas 6:27-35',
         'Lucas 10:25-37',
         'Juan 3:16',
         'Juan 13:34',
         'Romanos 13:8-10',
         'Romanos 14:15',
         'Gálatas 2:20',
         '1 Pedro 3:7',
         'Colosenses 3:18-19',
         'Efesios 5:2',
         'Efesios 5:25',
         'Tito 2:3-5',
         '1 Pedro 4:8',
         '1 Juan 3:16-18'
       ]::TEXT[]),
  (3,  'SUBCAMPOS',
       'Teniendo en cuenta la definición bíblica del amor (1 Corintios 13:4-7), describa diferentes situaciones de su noviazgo en las que ha experimentado:',
       ARRAY[]::TEXT[],
       ARRAY[
         'a. Impaciencia, ofensas, toma de decisiones a la ligera sin consultar a Dios',
         'b. Egoísmo, desconsideración, indiferencia, rencor, falta de ternura',
         'c. Envidia, celos, competencia',
         'd. Arrogancia, orgullo, altanería, insumisión',
         'e. Lucirse, impresionar o ser el centro de atracción',
         'f. Grosería, irrespeto',
         'g. Venganza, ira, tacañería',
         'h. Imprudencia, injusticia, exponer defectos de otros',
         'i. Rebeldía, cobardía, temor',
         'j. Desconfianza, crítica, inseguridad, cinismo',
         'k. Desánimo, falta de fe',
         'l. Derrota ante circunstancias adversas'
       ]::TEXT[]),
  (4,  'ABIERTA',
       'El mundo dice que el amor que sostiene debe ser el erótico. ¿Qué piensan acerca de este razonamiento?',
       ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (5,  'ABIERTA',
       '¿Cómo se imagina a su novio(a) después de veinte años de matrimonio? ¿Lo amaría?',
       ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (6,  'ABIERTA',
       '¿La amistad con sus compañeros de oficina o universidad podrían desplazar a su pareja?',
       ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (7,  'SUBCAMPOS',
       'En el matrimonio se presentarán situaciones difíciles que ponen a prueba el amor. ¿Qué sucedería si…?',
       ARRAY[]::TEXT[],
       ARRAY[
         'a. Su pareja se queda sin trabajo',
         'b. Su esposo(a) gana más que usted',
         'c. Su esposo(a) tiene problemas para tener hijos',
         'd. Él (ella) se aleja de Dios',
         'e. Descubre reacciones en su esposo(a) que no conocía'
       ]::TEXT[]),
  (8,  'ABIERTA',
       '¿Los votos matrimoniales son una declaración de amor o un compromiso ante Dios? Explique.',
       ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (9,  'ABIERTA',
       'Comparta con su novio(a) Eclesiastés 5:1-7 y explíquelo con sus propias palabras.',
       ARRAY[]::TEXT[], ARRAY[]::TEXT[]),
  (10, 'SUBCAMPOS',
       '¿Ha notado que su novio(a) cumple lo que promete?',
       ARRAY[]::TEXT[],
       ARRAY[
         '¿Cumple lo que promete? (sí / no)',
         '¿Cumple en el trabajo? (sí / no)',
         '¿Cumple sus compromisos financieros? (sí / no)',
         '¿Les cumple a sus padres o familiares? (sí / no)',
         '¿Es comprometido en la iglesia? (sí / no)',
         '¿Cuántas tarjetas de crédito tiene?',
         'Si es incumplido, ¿demuestra que quiere cambiar? (sí / no)'
       ]::TEXT[])
) AS p("number", "kind", "prompt", "options", "fields")
WHERE t."number" = 4
  AND NOT EXISTS (
    SELECT 1 FROM "premarital_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );
