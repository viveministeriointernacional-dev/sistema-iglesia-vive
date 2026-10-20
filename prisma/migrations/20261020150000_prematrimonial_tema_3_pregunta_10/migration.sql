-- Taller 3, pregunta 10: pasa de escribir a MARCAR.
--
-- El libro la plantea abierta («¿Qué expectativas tiene de vivienda?
-- ¿Apartamento, casa, urbana, rural?») y así entró el 16-oct. El usuario pidió
-- que fuera de marcar, y tiene sentido: es la única del taller 3 cuya respuesta
-- cabe en una lista cerrada, y en lista cerrada **el sistema puede decir solo
-- si los dos quieren lo mismo**, sin que un pastor tenga que leer dos párrafos
-- y juzgar. Es lo mismo que hacen la 14 y la 21 del taller 1.
--
-- `OPCION` es de UNA sola marca, a propósito. Con `MULTIPLE` alguien podría
-- marcar «apartamento» y «casa» a la vez, que es una contradicción; las cuatro
-- combinaciones cubren el espacio entero sin dejarla posible.
--
-- La quinta opción no está en el libro y se añade adrede: el libro daba
-- renglones en blanco, donde «todavía no lo hemos pensado» era una respuesta
-- legítima. Sin ella, una lista cerrada obligaría a inventar una preferencia —
-- y dos «todavía no lo hemos hablado» que coinciden son justamente la
-- conversación que el curso quiere provocar.
--
-- **El enunciado NO se toca**: es el del libro, y el pastor tiene que poder
-- buscar «la 10» en el papel y encontrar la misma frase.
--
-- Medido antes de escribirla (20-oct-2026): el tema 3 tiene **1 taller
-- abierto y 0 respuestas** en las trece preguntas, así que no hay nada escrito
-- que esto pueda dejar sin enseñar. El `UPDATE` es incondicional —y por tanto
-- repetible— a propósito: un guarda del tipo «solo si no hay respuestas» se
-- quedaría en nada para siempre si alguien contestara entre el merge y el
-- despliegue, y sin avisar. Si llegara a pasar, el texto escrito **no se
-- borra**: sigue en su fila, solo deja de pintarse, y la persona marca su
-- opción.
--
-- No toca ninguna tabla caliente, así que se puede fusionar a cualquier hora.

UPDATE "premarital_question" q
SET "kind" = 'OPCION',
    "options" = ARRAY[
      'Apartamento, en zona urbana',
      'Apartamento, en zona rural',
      'Casa, en zona urbana',
      'Casa, en zona rural',
      'Todavía no lo hemos hablado'
    ]::TEXT[]
FROM "premarital_topic" t
WHERE t."id" = q."topic_id"
  AND t."number" = 3
  AND q."number" = 10;
