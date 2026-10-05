-- Cuestionario de Dominio para Líderes: los 12 temas que resuelve el líder
-- que va a DICTAR una Casa de Fe, para verificar que domina el contenido.
--
-- ⚠️ NO ES EL TALLER DE CASA DE FE, y confundirlos es el error grave de este
-- modelo. El documento del usuario lo dice en su primera línea: «Este
-- cuestionario NO es el mismo que aparece dentro del libro para los nuevos
-- creyentes». Son dos ejercicios con propósitos opuestos sobre los mismos 12
-- temas: `faith_house_topic_question` lo llena el DISCÍPULO para aplicar lo
-- aprendido a su vida; esto lo llena el LÍDER para demostrar que puede
-- enseñarlo. Por eso son tablas propias: una misma persona puede tener los
-- dos.
--
-- ⚠️ NO TOCA NINGUNA TABLA CALIENTE (la lección del 24-sep-2026): ni un ALTER
-- sobre `app_user`, `person` ni `learner_profile`, que son las que el sistema
-- lee en cada petición. Quien revisa se decide por ROL —pastores y
-- administración, decisión del usuario— así que no hizo falta ninguna columna
-- de permiso. Se puede fusionar a cualquier hora sin pelear por un candado.
--
-- Todo es idempotente (§5): se puede repetir sin romper.

-- ---------------------------------------------------------------------------
-- El contenido del cuestionario
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "leader_quiz_topic" (
  "id"          TEXT NOT NULL,
  "number"      INTEGER NOT NULL,
  "name"        TEXT NOT NULL,
  "subtitle"    TEXT,
  -- La «Nota para el líder» del documento. SÍ se le muestra al líder mientras
  -- responde: no es la solución del examen, es material de enseñanza, y el
  -- propio documento pide leerla y conversarla en equipo antes del ciclo.
  "leader_note" TEXT,
  -- El código del enlace. Es una CREDENCIAL, no el número del tema: con
  -- `/taller/lider/3` cualquiera adivinaría los otros once.
  "code"        TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leader_quiz_topic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "leader_quiz_topic_number_key" ON "leader_quiz_topic" ("number");
CREATE UNIQUE INDEX IF NOT EXISTS "leader_quiz_topic_code_key" ON "leader_quiz_topic" ("code");

CREATE TABLE IF NOT EXISTS "leader_quiz_question" (
  "id"             TEXT NOT NULL,
  "topic_id"       TEXT NOT NULL,
  -- El número del documento, y PUEDE TENER HUECOS: el tema 2 salta de la 4 a
  -- la 6 en el original. Renumerar aquí dejaría al líder buscando «la 5» en un
  -- papel donde no existe.
  "number"         INTEGER NOT NULL,
  -- ABIERTA (se explica con sus palabras) · OPCION (se marca una de cuatro).
  "kind"           TEXT NOT NULL DEFAULT 'ABIERTA',
  "prompt"         TEXT NOT NULL,
  "options"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- La respuesta correcta, SOLO en las de OPCION: 25 de las 63. Las otras 38
  -- son abiertas y el sistema NO las juzga — eso es trabajo del coordinador.
  "correct_choice" INTEGER,
  -- La explicación doctrinal del documento. Es lo que convierte la
  -- calificación en enseñanza en vez de en un simple «mal».
  "explanation"    TEXT,
  CONSTRAINT "leader_quiz_question_pkey" PRIMARY KEY ("id"),
  -- Una abierta no puede traer respuesta correcta, y una de opción tiene que
  -- traerla dentro del rango de sus opciones. Sin esto, un día una abierta
  -- aparecería «calificada» y el líder vería un «mal» que nadie decidió.
  CONSTRAINT "leader_quiz_question_correcta_coherente" CHECK (
    ("kind" = 'OPCION' AND "correct_choice" IS NOT NULL
      AND "correct_choice" >= 0 AND "correct_choice" < array_length("options", 1))
    OR ("kind" <> 'OPCION' AND "correct_choice" IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS "leader_quiz_question_topic_number_key"
  ON "leader_quiz_question" ("topic_id", "number");

-- ---------------------------------------------------------------------------
-- El cuestionario de una persona
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "leader_quiz" (
  "id"           TEXT NOT NULL,
  -- Apunta al EXPEDIENTE, no a la cuenta: el líder no entra a la plataforma
  -- (§6), llena esto desde su celular con su código de miembro.
  "learner_id"   TEXT NOT NULL,
  "topic_id"     TEXT NOT NULL,
  "started_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- NO hay columna de estado: se deriva de aquí y de la última revisión.
  "submitted_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leader_quiz_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "leader_quiz_learner_topic_key"
  ON "leader_quiz" ("learner_id", "topic_id");
CREATE INDEX IF NOT EXISTS "leader_quiz_submitted_at_idx" ON "leader_quiz" ("submitted_at");

CREATE TABLE IF NOT EXISTS "leader_quiz_answer" (
  "id"          TEXT NOT NULL,
  "quiz_id"     TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "text"        TEXT,
  "choice"      INTEGER,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leader_quiz_answer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "leader_quiz_answer_quiz_question_key"
  ON "leader_quiz_answer" ("quiz_id", "question_id");

CREATE TABLE IF NOT EXISTS "leader_quiz_review" (
  "id"              TEXT NOT NULL,
  "quiz_id"         TEXT NOT NULL,
  "approved"        BOOLEAN NOT NULL,
  "note"            TEXT,
  "reviewed_by_id"  TEXT,
  "reviewed_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leader_quiz_review_pkey" PRIMARY KEY ("id")
);
-- SE APILAN, NO SE PISAN (decisión del usuario: «se apila, queda cada
-- vuelta»): cuántas veces le devolvieron un tema a un líder es la señal de que
-- todavía no está listo para dictarlo.
CREATE INDEX IF NOT EXISTS "leader_quiz_review_quiz_at_idx"
  ON "leader_quiz_review" ("quiz_id", "reviewed_at");

-- ---------------------------------------------------------------------------
-- Claves foraneas
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "leader_quiz_question" ADD CONSTRAINT "leader_quiz_question_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "leader_quiz_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leader_quiz" ADD CONSTRAINT "leader_quiz_learner_id_fkey"
    FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leader_quiz" ADD CONSTRAINT "leader_quiz_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "leader_quiz_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leader_quiz_answer" ADD CONSTRAINT "leader_quiz_answer_quiz_id_fkey"
    FOREIGN KEY ("quiz_id") REFERENCES "leader_quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leader_quiz_answer" ADD CONSTRAINT "leader_quiz_answer_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "leader_quiz_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leader_quiz_review" ADD CONSTRAINT "leader_quiz_review_quiz_id_fkey"
    FOREIGN KEY ("quiz_id") REFERENCES "leader_quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leader_quiz_review" ADD CONSTRAINT "leader_quiz_review_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Los 12 temas, con su «Nota para el líder»
-- ---------------------------------------------------------------------------
-- Transcritos del «Cuestionario de Dominio para Líderes» que entregó el
-- usuario. Los nombres y el orden son los mismos 12 temas del libro «Vive la
-- Palabra», pero se guardan aparte a propósito: renombrar un tema de Casa de
-- Fe NO debe reetiquetar un examen ya respondido (la trampa del 27-sep-2026).

INSERT INTO "leader_quiz_topic" ("id", "number", "name", "subtitle", "leader_note", "code")
SELECT gen_random_uuid()::text, t."number", t."name", t."subtitle", t."leader_note",
       replace(gen_random_uuid()::text, '-', '')
FROM (VALUES
  (1, 'Regalo de Dios', 'La salvación', 'Cuando expliques «religión vs. evangelio», evita dar a entender que las buenas obras no importan. El texto es claro: las obras son el fruto de la salvación, no su raíz. Un nuevo creyente necesita esa distinción bien afirmada para no caer ni en el legalismo ni en la indiferencia.'),
  (2, '¿Quién es Dios?', 'Su carácter, naturaleza y propósito', 'Este es uno de los temas más densos del recorrido. Al enseñar la Trinidad, usa la ilustración del agua (H₂O) que ofrece el material, pero acláralo siempre como una ayuda limitada, no como una explicación perfecta del misterio.'),
  (3, 'La Oración', 'Nuestra comunicación, intimidad y comunión con el Padre', 'Evita presentar la oración como una técnica o fórmula. El énfasis del material es relacional: la oración nace del amor, no de una obligación religiosa.'),
  (4, 'Dios moldea mi carácter', 'Formación a la imagen de Cristo', 'Este tema tiene el cuestionario complementario de «Vive la Palabra» ya ajustado para que no resulte demasiado obvio para el asistente; aun así, como líder debes poder explicar CADA fruto del Espíritu con un ejemplo bíblico propio, no solo el que trae el libro.'),
  (5, 'Obediencia y sujeción', 'Vivir bajo la autoridad de Dios con libertad y gozo', 'Este es un tema pastoralmente delicado, especialmente en el punto de sujeción familiar. Ten a mano 1 Pedro 3:7 y Efesios 5:21-25 completos para responder con equilibrio si surgen preguntas sobre abuso o desigualdad; nunca uses este tema para justificar maltrato o control.'),
  (6, 'La Palabra de Dios: La Biblia', 'La revelación escrita de Dios para la humanidad', 'Al enseñar este tema evita convertirlo en una clase puramente académica de «introducción bíblica». El objetivo es que el discípulo ame la Palabra como alimento diario, no solo que memorice datos sobre su composición.'),
  (7, 'La Fe en el Reino de Dios', NULL, 'Este tema toca la enseñanza sobre «la justicia de Dios se revela por fe», cercana a la tradición de la Palabra de Fe. Al enseñarlo, evita dar a entender que toda dificultad o enfermedad se debe a falta de fe: el propio material reconoce que hay pruebas cuya razón nunca llegamos a entender del todo, y ahí la fe se sostiene en el carácter de Dios, no en explicaciones.'),
  (8, 'El Bautismo', 'Mi nueva versión', 'Ten clara la distinción entre el bautismo en agua (una vez, acto de obediencia) y el bautismo en el Espíritu Santo (que se desarrolla en el tema 9), para no mezclarlos al responder preguntas.'),
  (9, 'El Espíritu Santo', 'Promesa, persona y poder para el creyente', 'Al dictar este tema, cuida el equilibrio: ni reduzcas al Espíritu Santo a «los dones» (Él es ante todo una Persona con quien se tiene comunión, como enseña la primera mitad del capítulo), ni evites hablar de los dones por temor a la controversia.'),
  (10, 'Finanzas en el Reino', 'Administrando bajo la gracia', 'Este capítulo fue reformulado específicamente para alejarse de una mentalidad de «inversión» o «siembra con retorno garantizado». Al enseñarlo, cuida mucho tu propio lenguaje: evita frases como «da y Dios te lo va a devolver multiplicado», porque contradicen directamente el énfasis del propio material.'),
  (11, 'El Perdón', 'Una verdad que libera', 'El punto (e), agregado especialmente a este capítulo, es clave: muchos creyentes confunden decir «ya perdoné» con haber perdonado de verdad. Prepárate para dar espacio a testimonios honestos sin generar culpa en quien todavía está procesando el dolor.'),
  (12, 'El Propósito Eterno de Dios', '¿Para qué estoy aquí?', 'Este es el capítulo de cierre del recorrido: conecta con el propósito personal de cada discípulo. Procura relacionarlo, al dictarlo, con la introducción del libro y con el énfasis en «descubrir el propósito de Dios para tu vida», para que el ciclo de los doce temas se sienta como una unidad.')
) AS t("number", "name", "subtitle", "leader_note")
WHERE NOT EXISTS (
  SELECT 1 FROM "leader_quiz_topic" x WHERE x."number" = t."number"
);

-- ---------------------------------------------------------------------------
-- Las 63 preguntas: 38 abiertas y 25 de opción
-- ---------------------------------------------------------------------------
-- ⚠️ Las abiertas van SIN respuesta correcta a propósito, y son la mayoría
-- (38 de 63). El documento es explícito: «no hay una única correcta, pero sí
-- deben reflejar comprensión real y capacidad de explicarlo a otros». El
-- sistema las pone lado a lado y se calla; juzgar un párrafo es el trabajo
-- pastoral para el que existe la pantalla de revisión.

-- Tema 1 · Regalo de Dios
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica con tus propias palabras la diferencia entre religión y evangelio. ¿Por qué es importante que un nuevo creyente entienda esta diferencia desde el primer día?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'La salvación se recibe por gracia y no por obras, pero las obras sí tienen un lugar en la vida cristiana. ¿Cuál es ese lugar, según Tito 2:11-12?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', 'Si alguien en tu Casa de Fe dice «yo ya soy bueno, no necesito salvación», ¿qué le explicarías usando Romanos 3:23 y 6:23?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'ABIERTA', '¿En qué se diferencia el remordimiento y el arrepentimiento?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT)
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 2 · ¿Quién es Dios?
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica la diferencia entre la naturaleza de Dios, su carácter y su propósito, tal como los distingue el capítulo.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Elige dos de los siete atributos de la naturaleza de Dios y explica cómo los enseñarías con un ejemplo cotidiano (no solo la definición teológica).',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', '¿Por qué el capítulo afirma que el propósito de Dios no está «fuera de Él», sino en «ser plenamente quien es»? ¿Cómo evitarías que esto suene a que Dios es indiferente hacia nosotros?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'ABIERTA', '¿Cuál es la diferencia correcta entre omnisciencia y omnipresencia?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (6, 'OPCION', 'Según el capítulo, la Trinidad significa que:',
   ARRAY['Hay tres dioses distintos que actúan de acuerdo','Dios tiene tres «versiones» según el momento','Un solo Dios existe eternamente como tres personas: Padre, Hijo y Espíritu Santo','Solo el Padre es completamente Dios']::TEXT[], 2, 'Es un punto doctrinal sensible: cuida no comunicar triteísmo (tres dioses) ni modalismo (un Dios que cambia de «forma»).')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 2
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 3 · La Oración
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica con tus palabras la diferencia entre comunión e intimidad con Dios, y da un ejemplo bíblico de cada una.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'El capítulo dice que la oración «no es principalmente pedir cosas». ¿Cómo le explicarías esto a alguien nuevo en la fe sin que sienta que pedir a Dios está mal?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', 'Menciona los cuatro obstáculos para la oración que señala el material y una estrategia práctica para cada uno.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', '¿Cuál de estos NO es uno de los cinco roles de Dios que se descubren en la oración enseñada por Jesús?',
   ARRAY['Padre','Rey','Juez','Espectador']::TEXT[], 3, 'El capítulo enumera Padre, Rey, Proveedor, Protector y Juez; «espectador» contradice la cercanía activa de Dios.'),
  (5, 'OPCION', 'La intimidad con Dios, según el capítulo, se compara con la postura de:',
   ARRAY['Moisés ante la zarza ardiente','Juan recostado en el pecho de Jesús','Los fariseos orando en la plaza','Jonás huyendo a Tarsis']::TEXT[], 1, 'Juan 13:23 ilustra la cercanía, confianza y vulnerabilidad propias de la intimidad.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 3
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 4 · Dios moldea mi carácter
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica la diferencia entre temperamento y carácter, y por qué esta distinción es clave para que un nuevo creyente no se desanime consigo mismo.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Menciona tres de los siete medios que usa Dios para moldear el carácter, con un ejemplo bíblico de cada uno (distinto a los ejemplos de la lista de «evidencias»).',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', 'Elige tres frutos del Espíritu (Gálatas 5:22-23) y explica, en tus palabras, cómo se distingue cada uno de un simple buen comportamiento o buena educación.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', 'Según el capítulo, ¿qué interesa más a Dios: nuestro ser o nuestro hacer?',
   ARRAY['Solo el hacer: servir mucho en la iglesia basta','Solo el ser: el servicio no importa','El ser: sin un carácter que refleje a Cristo, el servicio se vuelve incoherente','Ambos son irrelevantes frente a la salvación']::TEXT[], 2, 'El capítulo advierte que servir mucho sin carácter transformado produce una vida incoherente.'),
  (5, 'OPCION', '¿Cuál de las siguientes palabras NO aparece en la lista del fruto del Espíritu de Gálatas 5:22-23?',
   ARRAY['Benignidad','Templanza','Humildad','Mansedumbre']::TEXT[], 2, 'La lista es: amor, gozo, paz, paciencia, benignidad, bondad, fe, mansedumbre y templanza. «Humildad» no aparece en este pasaje, aunque es una virtud bíblica en otros textos.'),
  (6, 'OPCION', 'El ejemplo de Moisés en el desierto durante 40 años ilustra principalmente que:',
   ARRAY['Dios llama primero y forma el carácter después, sin importar el proceso','Dios suele formar el carácter de un líder antes de darle la misión completa','El liderazgo no requiere preparación de carácter','Moisés fue elegido por su elocuencia']::TEXT[], 1, 'El material usa a Moisés, Pedro y José como ejemplos de formación de carácter previa o simultánea al llamado.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 4
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 5 · Obediencia y sujeción
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica la diferencia entre obediencia y sujeción según el capítulo.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'El material enseña que la sujeción del esposo, la esposa y los hijos dentro de la familia es un llamado mutuo (Efesios 5:21), no de una sola vía. Explica cómo comunicarías esto de forma equilibrada, evitando que suene a control o desigualdad de valor.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', '¿Cuál es el único caso en que la Biblia autoriza desobedecer una autoridad humana, según Hechos 5:29, y cómo evitarías que alguien use este principio como excusa para la rebeldía?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', 'La obediencia cristiana, según el capítulo, nace principalmente de:',
   ARRAY['El temor al castigo','La costumbre religiosa','El amor a Dios','La presión social']::TEXT[], 2, 'El versículo base (Juan 14:15) conecta amor y obediencia, no temor.'),
  (5, 'OPCION', 'Según Efesios 5:25, el liderazgo del esposo en el hogar debe ejercerse con:',
   ARRAY['Imposición y autoridad absoluta','Entrega y amor sacrificial, como Cristo amó a la iglesia','Indiferencia hacia las decisiones familiares','Total independencia de la autoridad de Cristo']::TEXT[], 1, 'El material es explícito: el liderazgo del esposo no es autónomo ni impositivo, sino de entrega.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 5
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 6 · La Palabra de Dios: La Biblia
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica qué significa «inspiración verbal» y por qué esto distingue a la Biblia de cualquier otro libro religioso.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Describe brevemente las cinco secciones del Antiguo Testamento (Ley, históricos, poéticos/sapienciales, profetas mayores y menores) y el Nuevo Testamento, con la función de cada una.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', 'Menciona los cinco pasos prácticos que el capítulo propone para acercarse a la Palabra, y cuál sueles descuidar más en tu propia vida devocional.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', '¿Cuántos libros componen el Antiguo y el Nuevo Testamento respectivamente?',
   ARRAY['39 y 27','27 y 39','40 y 30','35 y 25']::TEXT[], 0, '39 libros en el Antiguo Testamento y 27 en el Nuevo Testamento.'),
  (5, 'OPCION', 'La antigua traducción griega del Antiguo Testamento, mencionada en el capítulo como parte de la historia de las traducciones bíblicas, se llama:',
   ARRAY['La Vulgata','La Septuaginta','La Peshitta','El Targum']::TEXT[], 1, 'Se llama Septuaginta (LXX). Si ves el libro impreso, ten presente que allí aparece incorrectamente como «la setenta y cinco»; usa el término correcto al enseñar y repórtalo para la corrección editorial.'),
  (6, 'OPCION', 'Según 2 Timoteo 3:16-17, la Escritura es útil para:',
   ARRAY['Enseñar, redargüir, corregir e instruir en justicia','Solo consuelo emocional','Únicamente historia antigua','Solo un grupo de eruditos, no para todo creyente']::TEXT[], 0, 'Es el fundamento bíblico central del capítulo sobre la autoridad y utilidad de la Palabra.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 6
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 7 · La Fe en el Reino de Dios
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica con tus palabras la diferencia entre «ser justo» y «ser justificado», tal como la distingue el capítulo. ¿Por qué esta distinción evita que alguien piense que debe ganarse la aceptación de Dios?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'El capítulo describe tres niveles de problemas en la batalla de la fe (cuando entendemos la razón, cuando la entendemos después, y cuando nunca la entendemos). Explica el tercer nivel y cómo acompañarías pastoralmente a alguien que está ahí, sin darle respuestas fáciles ni insinuar que le falta fe.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', '¿Cuáles son los tres enemigos principales de la fe mencionados en el capítulo, y cómo se «activa» la fe en la práctica diaria?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', 'Según Romanos 8:1, la persona que está en Cristo:',
   ARRAY['Debe sentir culpa constante por sus errores pasados','No tiene ninguna condenación','Solo está libre de condenación si ora suficiente','Necesita méritos adicionales para acercarse a Dios']::TEXT[], 1, 'Es clave para explicar la justicia de Dios: no hay condenación para quienes están en Cristo, independientemente de la voz acusadora interior.'),
  (5, 'OPCION', 'La palabra griega «dikaiosýne», traducida como «justicia» en Romanos, describe principalmente:',
   ARRAY['Un logro moral que el creyente alcanza con esfuerzo','Una condición dada por gracia en la que ya no le debemos nada a Dios','Un estado emocional pasajero','Un premio reservado solo para líderes espirituales']::TEXT[], 1, 'Es un regalo (justificación), no un mérito (ser justo por conducta propia).')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 7
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 8 · El Bautismo
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica el significado de la palabra griega «baptizo» y cómo se relaciona con los tres elementos simbólicos del bautismo: muerte, sepultura y resurrección.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Describe los tres tipos de bautismo que menciona el capítulo (agua, Espíritu Santo, fuego) y en qué se diferencia cada uno.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', 'Un asistente pregunta: «¿Si no me bautizo, no soy salvo?». ¿Cómo responderías usando lo que enseña el capítulo sobre bautismo y salvación?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', 'Según el modelo bíblico que describe el capítulo, el bautismo debe practicarse:',
   ARRAY['Por rociamiento, antes de la fe personal','Por inmersión completa, después de creer','Solo en la infancia','De cualquier forma, pues el método no importa']::TEXT[], 1, 'El capítulo lo contrasta explícitamente: inmersión (no rociamiento) y después de creer (no antes).'),
  (5, 'OPCION', '¿Cuál es el orden correcto que muestra Hechos 2:38-41 antes del bautismo?',
   ARRAY['Bautizarse y luego arrepentirse','Creer, arrepentirse y luego bautizarse','Solo asistir a la iglesia por un año','Ser mayor de edad únicamente']::TEXT[], 1, 'Creer y arrepentirse preceden al bautismo; es una decisión consciente, no un rito social.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 8
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 9 · El Espíritu Santo
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica con tres argumentos bíblicos por qué el Espíritu Santo es una Persona y no una fuerza o energía impersonal.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Describe las tres familias de dones espirituales (revelación, poder, inspiración) y menciona los dones que incluye cada una.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', '¿Por qué el capítulo insiste en que los dones son «para el provecho de la iglesia» y no para lucirse? Da un ejemplo de cómo esto cambia la actitud con la que se ministra un don en público.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', 'La palabra griega «charisma», de donde viene «carisma» o don espiritual, significa:',
   ARRAY['Talento natural','Gracia, regalo, favor','Título eclesiástico','Experiencia emocional']::TEXT[], 1, 'Charis = gracia; los dones son un regalo inmerecido de Dios para servir, no un logro personal.'),
  (5, 'OPCION', '¿Cuál de estos es un don de revelación, y no de poder ni de inspiración?',
   ARRAY['Don de sanidades','Don de lenguas','Discernimiento de espíritus','Don de profecía']::TEXT[], 2, 'Discernimiento de espíritus pertenece a los dones de revelación, junto con palabra de sabiduría y palabra de ciencia.'),
  (6, 'OPCION', 'Según 1 Corintios 14:27 y 14:5, cuando alguien habla en lenguas en una reunión pública, ¿qué debe procurarse?',
   ARRAY['Que nadie lo escuche','La interpretación, para que la congregación reciba edificación','Repetirlo varias veces sin explicación','Que se haga en privado únicamente y nunca en público']::TEXT[], 1, 'El don de lenguas en público debe ir acompañado de interpretación para edificar a todos, no solo a quien lo ejerce.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 9
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 10 · Finanzas en el Reino
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica, sin usar la palabra «inversión», por qué damos según este capítulo. ¿Cuál es la diferencia entre dar por gratitud y dar por expectativa?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Define con tus propias palabras diezmo, ofrenda y primicia, señalando en qué se parecen y en qué se diferencian.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', 'Un asistente pregunta: «¿Si diezmo, Dios me va a devolver el doble?». Usando el contenido del capítulo (incluyendo 2 Corintios 9:8-10 y Mateo 25:21), ¿cómo responderías sin caer en una promesa transaccional que el texto mismo rechaza?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', 'Según el capítulo, el diezmo es:',
   ARRAY['Un porcentaje negociable según la conveniencia de cada quien','La décima parte de los ingresos, ya establecida por Dios desde antes de la Ley','Lo mismo que la ofrenda, solo con otro nombre','Una práctica exclusiva del Nuevo Testamento']::TEXT[], 1, 'El diezmo («maaser») antecede a la Ley: Abraham lo entregó a Melquisedec y Jacob se comprometió a darlo, antes del Sinaí.'),
  (5, 'OPCION', '¿Cuál es la diferencia principal entre el diezmo y la ofrenda, según el capítulo?',
   ARRAY['No hay ninguna diferencia real','El diezmo tiene un porcentaje establecido; la ofrenda es libre y sin medida fija','La ofrenda es obligatoria y el diezmo es voluntario','El diezmo se da en dinero y la ofrenda solo en especie']::TEXT[], 1, 'El diezmo tiene una medida fija (la décima parte); la ofrenda nace libremente del corazón, sin techo.'),
  (6, 'OPCION', 'Según 1 Juan 4:19 y Romanos 11:35-36, ¿por qué damos?',
   ARRAY['Para obligar a Dios a bendecirnos','Porque Dios ya nos dio primero; damos como respuesta, no como origen de la relación','Porque la ley religiosa lo exige','Para demostrar públicamente nuestra fe a otros']::TEXT[], 1, '«El principio de dar» del capítulo es explícito: el punto de partida es Dios, no nuestro esfuerzo ni nuestra necesidad de aprobación.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 10
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 11 · El Perdón
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'El capítulo enumera cinco cosas que el perdón NO es. Menciónalas y explica, con tus palabras, la quinta (decir «ya perdoné» pero seguir atado al dolor).',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Explica la diferencia entre perdón y reconciliación según el capítulo. ¿Por qué el perdón es unilateral y la reconciliación bilateral?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', 'Un asistente dice: «Ya perdoné a esa persona, pero cada vez que la veo, revivo todo y se lo reclamo». Usando el punto (e) del capítulo, ¿cómo lo acompañarías pastoralmente?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', 'Según el capítulo, perdonar significa:',
   ARRAY['Olvidar automáticamente lo sucedido','Justificar lo que la otra persona hizo','Renunciar al derecho de venganza y entregar la justicia a Dios','Esperar a que la otra persona pida perdón para actuar']::TEXT[], 2, 'El perdón bíblico no depende de que el ofensor lo pida ni implica minimizar la ofensa; es una decisión de renunciar a la venganza.'),
  (5, 'OPCION', '¿Cuántas veces enseñó Jesús que debemos perdonar, según Mateo 18:21-22?',
   ARRAY['Siete veces','Setenta veces siete (es decir, sin límite)','Solo una vez por persona','Nunca, si la ofensa es grave']::TEXT[], 1, 'Jesús responde a Pedro con un número que expresa perdón ilimitado, no una cifra literal a contar.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 11
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

-- Tema 12 · El Propósito Eterno de Dios
INSERT INTO "leader_quiz_question" ("id", "topic_id", "number", "kind", "prompt", "options", "correct_choice", "explanation")
SELECT gen_random_uuid()::text, t."id", p."number", p."kind", p."prompt", p."options", p."correct_choice", p."explanation"
FROM "leader_quiz_topic" t
CROSS JOIN (VALUES
  (1, 'ABIERTA', 'Explica la diferencia entre «imagen» y «semejanza» de Dios en el hombre, según el capítulo.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (2, 'ABIERTA', 'Describe los cinco estamentos divinos (fructificad, multiplicaos, llenad la tierra, sojuzgad, señoread) con una frase breve para cada uno.',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (3, 'ABIERTA', '¿Qué significa «entrar en el reposo de Dios», según el capítulo, y por qué no debe confundirse con simplemente dejar de trabajar?',
   ARRAY[]::TEXT[], NULL::INTEGER, NULL::TEXT),
  (4, 'OPCION', '«Hagamos al hombre» (Génesis 1:26), según el capítulo, revela que la creación del hombre fue:',
   ARRAY['Un acuerdo improvisado de la Deidad','El propósito eterno de Dios, no una decisión de último momento','Una idea sugerida por los ángeles','Un plan secundario tras el fracaso de la creación angelical']::TEXT[], 1, 'El capítulo es explícito: no es un acuerdo de último minuto, sino el propósito eterno de Dios.'),
  (5, 'OPCION', 'Entrar en el reposo de Dios significa principalmente:',
   ARRAY['Dejar de trabajar para siempre','Entrar en relación íntima y comunión con Dios','Descansar únicamente los domingos','No tener ninguna responsabilidad en la tierra']::TEXT[], 1, 'El reposo del séptimo día no es inactividad, sino el marco para la comunión íntima entre Adán y Dios.')
) AS p("number", "kind", "prompt", "options", "correct_choice", "explanation")
WHERE t."number" = 12
  AND NOT EXISTS (
    SELECT 1 FROM "leader_quiz_question" q
    WHERE q."topic_id" = t."id" AND q."number" = p."number"
  );

