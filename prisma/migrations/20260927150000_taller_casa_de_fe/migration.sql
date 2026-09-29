-- Taller virtual de Casa de Fe, con un QR por tema.
--
-- ⚠️ TODO ES IDEMPOTENTE (§5 de CLAUDE.md): el build vuelve a correr esto si
-- una migración anterior falló, y repetirlo no puede romper nada.
--
-- ⚠️ NO TOCA NINGUNA TABLA CALIENTE. `app_user`, `person` y `learner_profile`
-- son las que el sistema lee en cada petición, y un ALTER sobre ellas pide un
-- candado EXCLUSIVO que a media tarde se queda esperando y mata el despliegue
-- (lección del 24-sep-2026). Aquí el único ALTER sobre una tabla existente es
-- sobre `faith_house_topic`, que tiene 12 filas y casi nadie lee.
--
-- El token de regreso de la persona vive en su PROPIA tabla
-- (`faith_house_taller_token`) justamente para no tocar `learner_profile`.

-- 1) El tema gana subtítulo, versículo y el código de su QR.
ALTER TABLE "faith_house_topic" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;
ALTER TABLE "faith_house_topic" ADD COLUMN IF NOT EXISTS "memory_verse" TEXT;
ALTER TABLE "faith_house_topic" ADD COLUMN IF NOT EXISTS "qr_code" TEXT;

-- ⚠️ El código del QR es una CREDENCIAL, no un identificador: es lo único que
-- autoriza a abrir el taller de ese tema. Por eso NO es el número del tema —
-- con `/taller/3` cualquiera adivinaría los otros once— y por eso es único.
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_topic_qr_code_key"
  ON "faith_house_topic" ("qr_code");

-- 2) Los 7 días de «Vive la lección». Son GUÍA: no se marcan (decisión del
--    usuario, 27-sep-2026), así que aquí no hay nada por persona.
CREATE TABLE IF NOT EXISTS "faith_house_topic_day" (
  "id"         TEXT NOT NULL,
  "topic_id"   TEXT NOT NULL,
  "number"     INTEGER NOT NULL,
  "action"     TEXT NOT NULL,
  CONSTRAINT "faith_house_topic_day_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_topic_day_topic_id_number_key"
  ON "faith_house_topic_day" ("topic_id", "number");

-- 3) Las preguntas del taller. `kind`: ABIERTA · OPCION · DIBUJO.
--    ⚠️ DIBUJO existe porque el punto 7 del tema 2 pide dibujar dentro de un
--    recuadro, y eso NO se puede hacer virtualmente hoy (no hay subida de
--    archivos). Se marca como tal para que la pantalla lo diga en vez de
--    fingir que se puede.
CREATE TABLE IF NOT EXISTS "faith_house_topic_question" (
  "id"       TEXT NOT NULL,
  "topic_id" TEXT NOT NULL,
  "number"   INTEGER NOT NULL,
  "kind"     TEXT NOT NULL DEFAULT 'ABIERTA',
  "prompt"   TEXT NOT NULL,
  "options"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "faith_house_topic_question_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_topic_question_topic_id_number_key"
  ON "faith_house_topic_question" ("topic_id", "number");

-- 4) El taller que llena una persona. Uno por persona y tema.
--    ⚠️ NO HAY COLUMNA DE ESTADO, y es a propósito: el estado se DERIVA de
--    `submitted_at` y de la última revisión (ver `taller-catalogo.ts`). Una
--    columna aparte se desincroniza del historial en cuanto alguien reenvía.
CREATE TABLE IF NOT EXISTS "faith_house_workshop" (
  "id"           TEXT NOT NULL,
  "learner_id"   TEXT NOT NULL,
  "topic_id"     TEXT NOT NULL,
  "started_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faith_house_workshop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_workshop_learner_id_topic_id_key"
  ON "faith_house_workshop" ("learner_id", "topic_id");
-- La cola de «por revisar» se ordena por cuándo se envió.
CREATE INDEX IF NOT EXISTS "faith_house_workshop_submitted_at_idx"
  ON "faith_house_workshop" ("submitted_at");

-- 5) Cada respuesta. `text` para las abiertas, `choice` (índice de la opción)
--    para las de marcar. Se guardan una por una mientras la persona escribe.
CREATE TABLE IF NOT EXISTS "faith_house_answer" (
  "id"          TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "question_id" TEXT NOT NULL,
  "text"        TEXT,
  "choice"      INTEGER,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faith_house_answer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_answer_workshop_id_question_id_key"
  ON "faith_house_answer" ("workshop_id", "question_id");

-- 6) Las revisiones. ⚠️ SE APILAN, NO SE PISAN (la regla del 10-sep-2026 con
--    las visitas reprogramadas): cuántas veces le devolvieron un taller a
--    alguien es justo la señal de que algo no va bien, y sobrescribir la
--    revisión anterior la borraría.
CREATE TABLE IF NOT EXISTS "faith_house_workshop_review" (
  "id"             TEXT NOT NULL,
  "workshop_id"    TEXT NOT NULL,
  "approved"       BOOLEAN NOT NULL,
  "note"           TEXT,
  "reviewed_by_id" TEXT,
  "reviewed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faith_house_workshop_review_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "faith_house_workshop_review_workshop_id_reviewed_at_idx"
  ON "faith_house_workshop_review" ("workshop_id", "reviewed_at");

-- 7) El token con el que la persona vuelve a su taller sin cuenta ni
--    contraseña. ⚠️ ES UNA CREDENCIAL, como el token del calendario: nace de
--    `crypto.getRandomValues`, nunca se audita y vive en tabla propia para no
--    pedir un candado sobre `learner_profile`.
CREATE TABLE IF NOT EXISTS "faith_house_taller_token" (
  "id"         TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "used_at"    TIMESTAMP(3),
  CONSTRAINT "faith_house_taller_token_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_taller_token_token_key"
  ON "faith_house_taller_token" ("token");
CREATE UNIQUE INDEX IF NOT EXISTS "faith_house_taller_token_learner_id_key"
  ON "faith_house_taller_token" ("learner_id");

-- 8) Las claves foráneas, envueltas para que repetir la migración no falle.
DO $$
BEGIN
  ALTER TABLE "faith_house_topic_day" ADD CONSTRAINT "faith_house_topic_day_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "faith_house_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_topic_question" ADD CONSTRAINT "faith_house_topic_question_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "faith_house_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_workshop" ADD CONSTRAINT "faith_house_workshop_learner_id_fkey"
    FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_workshop" ADD CONSTRAINT "faith_house_workshop_topic_id_fkey"
    FOREIGN KEY ("topic_id") REFERENCES "faith_house_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_answer" ADD CONSTRAINT "faith_house_answer_workshop_id_fkey"
    FOREIGN KEY ("workshop_id") REFERENCES "faith_house_workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_answer" ADD CONSTRAINT "faith_house_answer_question_id_fkey"
    FOREIGN KEY ("question_id") REFERENCES "faith_house_topic_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_workshop_review" ADD CONSTRAINT "faith_house_workshop_review_workshop_id_fkey"
    FOREIGN KEY ("workshop_id") REFERENCES "faith_house_workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_workshop_review" ADD CONSTRAINT "faith_house_workshop_review_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "faith_house_taller_token" ADD CONSTRAINT "faith_house_taller_token_learner_id_fkey"
    FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- SEMILLA: los 12 talleres, transcritos del libro de Casa de Fe.
--
-- ⚠️ NUNCA PISA LO QUE ALGUIEN HAYA EDITADO. Los textos entran solo donde no
-- hay nada (`ON CONFLICT DO NOTHING`, `WHERE … IS NULL`), así que repetir la
-- migración no deshace una corrección hecha desde la pantalla.
--
-- ⚠️ EL NOMBRE DEL TEMA NO SE TOCA AQUÍ. Los 12 nombres ya se pusieron el
-- 26-sep-2026 y el avance de cada persona apunta al NÚMERO del tema: escribir
-- el nombre desde la migración podría reetiquetar temas ya marcados.
-- ============================================================================

-- El código del QR: 32 hex de un uuid v4, solo donde falta.
UPDATE "faith_house_topic" SET "qr_code" = replace(gen_random_uuid()::text, '-', '')
  WHERE "qr_code" IS NULL;

-- Subtítulo y versículo para memorizar (solo donde está vacío).
UPDATE "faith_house_topic" AS t SET
  "subtitle"     = coalesce(t."subtitle", nullif(v.sub, '')),
  "memory_verse" = coalesce(t."memory_verse", nullif(v.ver, ''))
FROM (VALUES
  (1, 'La salvación', '2 Corintios 5:17'),
  (2, 'Su carácter, naturaleza y propósito', 'Isaías 46:9'),
  (3, 'Nuestra comunicación, intimidad y comunión con el Padre', 'Filipenses 4:6-7'),
  (4, 'Formación a la imagen de Cristo', 'Romanos 12:2'),
  (5, 'Vivir bajo la autoridad de Dios con libertad y gozo', '1 Samuel 15:22'),
  (6, 'La revelación escrita de Dios para la humanidad', 'Hebreos 4:12'),
  (7, '', 'Hebreos 4:12'),
  (8, 'En el Reino de Dios', 'Romanos 6:4'),
  (9, 'Promesa, persona y poder para el creyente', '1 Corintios 12:7'),
  (10, 'Administrar bajo la gracia', '1 Crónicas 29:14'),
  (11, 'Una verdad que libera', 'Colosenses 3:13'),
  (12, '¿Para qué estoy aquí?', 'Génesis 1:27')
) AS v(num, sub, ver) WHERE t."number" = v.num;

-- «Vive la lección»: los 7 días de cada tema, como guía.
INSERT INTO "faith_house_topic_day" ("id", "topic_id", "number", "action")
SELECT gen_random_uuid()::text, t."id", v.n, v.a
FROM "faith_house_topic" t JOIN (VALUES
  (1, 1, 'Lee Juan 3 y escribe qué entendiste del nuevo nacimiento.'),
  (1, 2, 'Ora 10 minutos agradeciendo el amor de Dios.'),
  (1, 3, 'Memoriza Efesios 2:8-9.'),
  (1, 4, 'Comparte tu testimonio con alguien cercano.'),
  (1, 5, 'Lee Romanos 5 y anota promesas de paz y gracia.'),
  (1, 6, 'Haz un acto de generosidad en secreto.'),
  (1, 7, 'Asiste a tu casa de fe.'),
  (2, 1, 'Lee Isaías 46:9-10 y escribe qué significa que Dios es único.'),
  (2, 2, 'Medita en la omnipresencia de Dios (Salmo 139). Piensa en un momento difícil que viviste y reconoce su presencia.'),
  (2, 3, 'Reflexiona en Hebreos 4:13 la omnisciencia de Dios.'),
  (2, 4, 'Entrega a Dios en oración una situación difícil (Jer. 32:17).'),
  (2, 5, 'Agradece la inmutabilidad de Dios: Él nunca cambia (Hebreos 13:8).'),
  (2, 6, 'Medita en su misericordia (Sal 103:13).'),
  (2, 7, 'Escribe una oración reconociendo a Dios como tu Padre, Rey y Señor.'),
  (3, 1, 'Día de adoración: lee un salmo y alaba.'),
  (3, 2, 'Confesión: pide al Espíritu que examine tu corazón.'),
  (3, 3, 'Acción de gracias: escribe 20 motivos.'),
  (3, 4, 'Petición: lista de necesidades propias.'),
  (3, 5, 'Intercesión: ora por 5 personas específicas.'),
  (3, 6, 'Lección divina: lee y medita en Mateo 6:9-13.'),
  (3, 7, 'Oración caminando 20 minutos, en silencio y con gratitud.'),
  (4, 1, 'Día del Amor: acto secreto de servicio.'),
  (4, 2, 'Día del Gozo: agradece 30 cosas.'),
  (4, 3, 'Día de la Paz: 15 min de silencio con Fil 4:6-7.'),
  (4, 4, 'Día de la Paciencia: cede tu “derecho a tener la razón”.'),
  (4, 5, 'Día de la Benignidad: anima a 3 personas.'),
  (4, 6, 'Día de la Fidelidad: cumple un compromiso pendiente.'),
  (4, 7, 'Día del Dominio Propio: ayuna de algo que te domina.'),
  (5, 1, 'Escucha: 15 min de lectura bíblica y silencio.'),
  (5, 2, 'Obedece en lo pequeño: cumple una promesa pendiente.'),
  (5, 3, 'Honra: escribe y expresa gratitud a una autoridad.'),
  (5, 4, 'Restituye: corrige un error y pide perdón.'),
  (5, 5, 'Sirve: acto de servicio anónimo.'),
  (5, 6, 'Discierne: consulta a un líder antes de decidir.'),
  (5, 7, 'Rinde cuentas: comparte avances con tu mentor.'),
  (6, 1, 'Lee 2 Tim 3:16-17 y escribe qué significa “inspirada por Dios”.'),
  (6, 2, 'Haz un esquema de los libros de la Biblia y su propósito.'),
  (6, 3, 'Memoriza un versículo clave y compártelo con alguien.'),
  (6, 4, 'Reflexiona cómo la Palabra ha transformado tu vida.'),
  (6, 5, 'Dedica 20 minutos a meditar en un Salmo.'),
  (6, 6, 'Aplica un principio bíblico en una decisión práctica.'),
  (6, 7, 'Escribe una oración de gratitud por la Palabra.'),
  (7, 1, 'Lee Hebreos 11 y subraya un ejemplo de fe que quieras imitar.'),
  (7, 2, 'Memoriza Romanos 10:17 y repítelo durante el día.'),
  (7, 3, 'Enlista las áreas de tu vida donde necesitas fe y entrégalas.'),
  (7, 4, 'Actúa y obedece en aquello que Dios te haya pedido.'),
  (7, 5, 'Escribe un testimonio donde tu fe fue probada.'),
  (7, 6, 'Siembra un acto de confianza (tiempo, servicio o recurso).'),
  (7, 7, 'Haz una oración de entrega renovada y declara que vives bajo el Reino.'),
  (8, 1, 'Lee Romanos 6:1-14 y escribe qué significa morir y resucitar con Cristo.'),
  (8, 2, 'Medita en Mateo 3:13-17: el ejemplo del bautismo de Jesús.'),
  (8, 3, 'Memoriza Gálatas 2:20.'),
  (8, 4, 'Escribe qué “viejo hombre” quieres dejar sepultado.'),
  (8, 5, 'Lee Hechos 2:38-41 y observa el orden: creer, arrepentirse, bautizarse.'),
  (8, 6, 'Comparte con alguien tu decisión de seguir a Cristo.'),
  (8, 7, 'Ora pidiendo ser lleno del Espíritu Santo para vivir tu nueva vida.'),
  (9, 1, 'Lee 1 Corintios 12:1-11 e identifica los dones y su propósito.'),
  (9, 2, 'Pide a Dios sabiduría para actuar correctamente ante una situación concreta (Santiago 3:17).'),
  (9, 3, 'Ora por fe para creer en lo que hoy parece imposible (Heb 11:6).'),
  (9, 4, 'Ora por la sanidad de alguien, confiando en el poder de Dios (Hechos 10:38).'),
  (9, 5, 'Lee 1 Corintios 14:1-3 y pide ser usado para edificar, exhortar y consolar a alguien esta semana.'),
  (9, 6, 'Identifica el don que fluye en ti, agradécelo y pide avivarlo (2 Tim 1:6).'),
  (9, 7, 'Ora para que el amor sea el fundamento de tus dones (1 Cor 13:1).'),
  (10, 1, 'Lee 1 Crónicas 29:10-14 y escribe qué significa que “todo es tuyo, Dios”.'),
  (10, 2, 'Examina tu corazón: ¿das esperando algo a cambio o por gratitud? Escríbelo con honestidad.'),
  (10, 3, 'Lee 1 Juan 4:19 y agradece a Dios por tres cosas que Él te dio antes de que tú dieras algo.'),
  (10, 4, 'Practica una ofrenda o un acto de generosidad sin esperar ningún resultado a cambio (2 Corintios 9:7).'),
  (10, 5, 'Lee la parábola de los talentos (Mateo 25:14-30) y pide a Dios sabiduría para administrar lo que te ha dado.'),
  (10, 6, 'Medita en 2 Corintios 9:8-10 y pide a Dios que aumente en ti el fruto de justicia, no solo la provisión.'),
  (10, 7, 'Ora entregando tus finanzas a Dios como un acto de adoración, no de expectativa.'),
  (11, 1, 'Lee Mateo 18:21-35 y reflexiona en la parábola del siervo sin misericordia.'),
  (11, 2, 'Haz una lista de personas a quienes necesitas perdonar y ora por ellas.'),
  (11, 3, 'Lee Colosenses 3:13 y escribe qué significa “perdonar como Cristo perdonó”.'),
  (11, 4, 'Practica un acto de bondad hacia alguien que te haya herido.'),
  (11, 5, 'Lee Génesis 50:20 y medita en la vida de José.'),
  (11, 6, 'Escribe una oración de entrega, soltando amargura y resentimiento.'),
  (11, 7, 'Comparte tu experiencia de perdón con un hermano en la fe o tu líder.'),
  (12, 1, 'Lee Génesis 1:26-28 y escribe cuál es el propósito de Dios con el hombre.'),
  (12, 2, 'Medita en la imagen de Dios en ti (Génesis 2:7; 2 Pedro 1:3-4).'),
  (12, 3, 'Reflexiona en qué significa “entrar en el reposo de Dios” (Hebreos 4:9-11).'),
  (12, 4, 'Identifica un área donde Dios te llama a “fructificar” y da un paso.'),
  (12, 5, 'Ora pidiendo dirección para “señorear” con sabiduría en tu casa y trabajo.'),
  (12, 6, 'Escribe una declaración de tu propósito según lo que has aprendido.'),
  (12, 7, 'Comparte con alguien para qué crees que Dios te creó.')
) AS v(tema, n, a) ON v.tema = t."number"
ON CONFLICT ("topic_id", "number") DO NOTHING;

-- Las 83 preguntas: 66 abiertas, 16 de marcar y 1 de dibujo.
INSERT INTO "faith_house_topic_question" ("id", "topic_id", "number", "kind", "prompt", "options")
SELECT gen_random_uuid()::text, t."id", v.n, v.k, v.p, v.o
FROM "faith_house_topic" t JOIN (VALUES
  (1, 1, 'ABIERTA', '¿Cómo explicarías con tus palabras que la salvación es por gracia y no por obras?', ARRAY[]::TEXT[]),
  (1, 2, 'ABIERTA', '¿Qué cambia en tu identidad cuando recibes a Cristo?', ARRAY[]::TEXT[]),
  (1, 3, 'ABIERTA', '¿Qué temores o culpas entregas hoy a Jesús?', ARRAY[]::TEXT[]),
  (1, 4, 'ABIERTA', 'Describe en 5 palabras tu antes y después de conocer a Cristo.', ARRAY[]::TEXT[]),
  (1, 5, 'ABIERTA', '¿Cuéntanos tu experiencia al compartir el regalo de Dios?', ARRAY[]::TEXT[]),
  (1, 6, 'OPCION', '¿Qué produce la gracia en nosotros según Tito 2:11-12?', ARRAY['Libertinaje','Santidad práctica','Orgullo','Aislamiento']::TEXT[]),
  (1, 7, 'OPCION', '¿Qué NO es evidencia de salvación?', ARRAY['Amor por Dios','Obediencia creciente','Fe viva','Vanagloria']::TEXT[]),
  (2, 1, 'ABIERTA', 'Con tus palabras, ¿quién es Dios?', ARRAY[]::TEXT[]),
  (2, 2, 'ABIERTA', 'De los siete atributos de la naturaleza de Dios, ¿cuál te impactó más y por qué?', ARRAY[]::TEXT[]),
  (2, 3, 'ABIERTA', 'Elige una palabra del carácter de Dios (compasivo, amoroso, lleno de gracia, paciente, fiel o generoso) y escribe un momento en que la hayas experimentado en tu propia vida.', ARRAY[]::TEXT[]),
  (2, 4, 'ABIERTA', '¿Cómo explicarías la Trinidad a alguien que no la conoce?', ARRAY[]::TEXT[]),
  (2, 5, 'OPCION', 'El atributo que permite a Dios estar en todas partes se llama:', ARRAY['Omnisciencia','Omnipotencia','Omnipresencia','Inmutabilidad']::TEXT[]),
  (2, 6, 'OPCION', 'Que Dios “nunca cambia” corresponde a su:', ARRAY['Eternidad','Inmutabilidad','Unicidad','Incorporeidad']::TEXT[]),
  (2, 7, 'DIBUJO', 'Representa dentro del recuadro con símbolos, colores o elementos aquello que refleje quién es Dios.', ARRAY[]::TEXT[]),
  (3, 1, 'ABIERTA', '¿Qué te impide orar con constancia? ¿Qué harás al respecto?', ARRAY[]::TEXT[]),
  (3, 2, 'ABIERTA', 'Redacta tu propia oración.', ARRAY[]::TEXT[]),
  (3, 3, 'ABIERTA', 'Escribe una respuesta a la oración que hayas hecho.', ARRAY[]::TEXT[]),
  (3, 4, 'ABIERTA', '¿Cuál es la diferencia entre comunión e intimidad?', ARRAY[]::TEXT[]),
  (3, 5, 'ABIERTA', '¿Cuáles son los fundamentos de la oración?', ARRAY[]::TEXT[]),
  (3, 6, 'ABIERTA', '¿Cuál de los obstáculos para orar (distracción, incredulidad, pecado no confesado, monotonía) es el que más enfrentas? ¿Qué harás para vencerlo?', ARRAY[]::TEXT[]),
  (3, 7, 'OPCION', 'Según Mateo 6:33, ¿qué debemos buscar primero?', ARRAY['Nuestras necesidades diarias','El Reino de Dios y su justicia','La aprobación de los demás','Resolver todos nuestros problemas']::TEXT[]),
  (4, 1, 'ABIERTA', '¿Qué diferencia notaste entre temperamento y carácter?', ARRAY[]::TEXT[]),
  (4, 2, 'ABIERTA', '¿Cuál fruto del Espíritu te está formando Dios actualmente?', ARRAY[]::TEXT[]),
  (4, 3, 'ABIERTA', 'Describe una prueba reciente y qué produjo en ti.', ARRAY[]::TEXT[]),
  (4, 4, 'ABIERTA', '¿Qué hábito espiritual necesitas fortalecer y cómo lo harás?', ARRAY[]::TEXT[]),
  (5, 1, 'ABIERTA', '¿Cómo entiendes la diferencia entre obediencia y sujeción?', ARRAY[]::TEXT[]),
  (5, 2, 'ABIERTA', 'Describe un caso donde obedecer a Dios implicó costo personal.', ARRAY[]::TEXT[]),
  (5, 3, 'ABIERTA', '¿Qué límites sanos debe tener la sujeción en la iglesia y la familia?', ARRAY[]::TEXT[]),
  (5, 4, 'ABIERTA', '¿Qué paso de obediencia darás esta semana?', ARRAY[]::TEXT[]),
  (5, 5, 'OPCION', 'La obediencia nace principalmente de:', ARRAY['Miedo','Costumbre','Amor a Dios','Interés']::TEXT[]),
  (5, 6, 'OPCION', '¿Cuándo desobedecer a la autoridad es bíblico?', ARRAY['Cuando no me gusta','Cuando contradice la voluntad de Dios','Nunca','Siempre']::TEXT[]),
  (6, 1, 'ABIERTA', '¿Qué significa que la Biblia es inspirada por Dios?', ARRAY[]::TEXT[]),
  (6, 2, 'ABIERTA', '¿Cuántos libros componen el Antiguo y el Nuevo Testamento?', ARRAY[]::TEXT[]),
  (6, 3, 'ABIERTA', '¿Por qué la Biblia es considerada una Palabra viva y eficaz?', ARRAY[]::TEXT[]),
  (6, 4, 'ABIERTA', 'Menciona tres ejemplos bíblicos donde la Palabra produjo transformación.', ARRAY[]::TEXT[]),
  (6, 5, 'ABIERTA', '¿Cuáles son los cinco pasos prácticos para el estudio de la Biblia?', ARRAY[]::TEXT[]),
  (6, 6, 'ABIERTA', '¿Qué obstáculos enfrentas personalmente al leer la Palabra?', ARRAY[]::TEXT[]),
  (6, 7, 'ABIERTA', '¿Cómo se relaciona el estudio bíblico con el crecimiento del carácter?', ARRAY[]::TEXT[]),
  (7, 1, 'ABIERTA', '¿Cómo define la Biblia la fe en Hebreos 11:1?', ARRAY[]::TEXT[]),
  (7, 2, 'ABIERTA', '¿Qué relación hay entre la fe y la justicia de Dios?', ARRAY[]::TEXT[]),
  (7, 3, 'ABIERTA', '¿Qué nos enseña Abraham acerca de la fe?', ARRAY[]::TEXT[]),
  (7, 4, 'ABIERTA', '¿Cuáles son los principales enemigos de la fe?', ARRAY[]::TEXT[]),
  (7, 5, 'ABIERTA', '¿Por qué se dice que la fe es la llave del Nuevo Pacto?', ARRAY[]::TEXT[]),
  (7, 6, 'ABIERTA', '¿Qué significa pelear la buena batalla de la fe?', ARRAY[]::TEXT[]),
  (7, 7, 'ABIERTA', '¿Cómo se expresa la fe en la práctica diaria (oración, finanzas, obediencia)?', ARRAY[]::TEXT[]),
  (7, 8, 'ABIERTA', '¿Qué compromiso personal puedes asumir esta semana para crecer en tu fe?', ARRAY[]::TEXT[]),
  (8, 1, 'ABIERTA', '¿Qué significa la palabra “bautismo” y qué simboliza?', ARRAY[]::TEXT[]),
  (8, 2, 'ABIERTA', '¿Cuáles son los requisitos bíblicos para bautizarse?', ARRAY[]::TEXT[]),
  (8, 3, 'ABIERTA', 'Explica los tres tipos de bautismo que menciona la Escritura.', ARRAY[]::TEXT[]),
  (8, 4, 'ABIERTA', '¿Qué declara el bautismo sobre tu nueva identidad?', ARRAY[]::TEXT[]),
  (8, 5, 'OPCION', 'El bautismo en agua simboliza principalmente:', ARRAY['Un requisito cultural','La muerte, sepultura y resurrección con Cristo','Una tradición familiar','Un mérito para ganar la salvación']::TEXT[]),
  (8, 6, 'OPCION', 'Según Hechos 2:38, ¿qué precede al bautismo?', ARRAY['La membresía','El arrepentimiento y la fe','La edad adulta','Una ofrenda']::TEXT[]),
  (9, 1, 'ABIERTA', '¿Qué significa la palabra “carisma” y qué relación tiene con los dones del Espíritu?', ARRAY[]::TEXT[]),
  (9, 2, 'ABIERTA', 'Menciona los tres grupos en que se clasifican los dones y un ejemplo de cada uno.', ARRAY[]::TEXT[]),
  (9, 3, 'ABIERTA', '¿Qué diferencia hay entre la palabra de sabiduría y la palabra de ciencia?', ARRAY[]::TEXT[]),
  (9, 4, 'ABIERTA', '¿Por qué el don de lenguas debe ir acompañado del don de interpretación cuando se usa en público?', ARRAY[]::TEXT[]),
  (9, 5, 'ABIERTA', 'De las cinco actitudes hacia los dones (no ser ignorantes, no ser descuidados, anhelarlos, avivarlos, ejercerlos con amor), ¿cuál necesitas trabajar más y por qué?', ARRAY[]::TEXT[]),
  (9, 6, 'OPCION', 'Los dones del Espíritu se nos dan principalmente para:', ARRAY['Beneficio personal','Impresionar a otros','El provecho de la iglesia','Ganar reconocimiento']::TEXT[]),
  (9, 7, 'OPCION', '¿Cuál de estos es un don de poder?', ARRAY['Profecía','Discernimiento de espíritus','Sanidad','Interpretación de lenguas']::TEXT[]),
  (10, 1, 'ABIERTA', '¿Por qué dar no debe entenderse como una inversión de la que espero un retorno?', ARRAY[]::TEXT[]),
  (10, 2, 'ABIERTA', 'Según 1 Juan 4:19 y Romanos 11:35-36, ¿por qué damos primero que Dios nos dio a nosotros?', ARRAY[]::TEXT[]),
  (10, 3, 'ABIERTA', '¿Qué diferencia notas entre dar por gratitud y dar por expectativa? ¿Cuál describe mejor tu actitud actual?', ARRAY[]::TEXT[]),
  (10, 4, 'ABIERTA', 'Según 2 Corintios 9:8-10, ¿qué le pide Dios que “aumente” además de la provisión material?', ARRAY[]::TEXT[]),
  (10, 5, 'ABIERTA', '¿Qué relación hay entre la fidelidad en dar y la capacidad de administrar (Mateo 25:21)?', ARRAY[]::TEXT[]),
  (10, 6, 'OPCION', 'El propósito principal de las finanzas en el Reino de Dios es:', ARRAY['Multiplicar el dinero','Obedecer, honrar y adorar a Dios','Asegurar el futuro','Demostrar madurez espiritual']::TEXT[]),
  (10, 7, 'OPCION', 'Dar por gratitud, en lugar de por expectativa, produce en el corazón:', ARRAY['Ansiedad','Estabilidad y paz','Incertidumbre','Orgullo']::TEXT[]),
  (11, 1, 'ABIERTA', '¿Qué significa que el perdón es un arma espiritual?', ARRAY[]::TEXT[]),
  (11, 2, 'ABIERTA', '¿Qué enseñó Jesús sobre la cantidad de veces que debemos perdonar?', ARRAY[]::TEXT[]),
  (11, 3, 'ABIERTA', '¿Por qué el perdón es esencial para la libertad interior del creyente?', ARRAY[]::TEXT[]),
  (11, 4, 'ABIERTA', '¿Cuál es la diferencia entre perdonar y justificar el pecado?', ARRAY[]::TEXT[]),
  (11, 5, 'ABIERTA', '¿Qué beneficios espirituales y emocionales trae el perdón?', ARRAY[]::TEXT[]),
  (11, 6, 'ABIERTA', 'Describe los pasos prácticos para perdonar a alguien que te ha herido.', ARRAY[]::TEXT[]),
  (11, 7, 'OPCION', '¿Cuál de las siguientes frases refleja una verdad bíblica sobre el perdón?', ARRAY['Perdonar significa olvidar todo automáticamente.','Perdonar es justificar el mal.','Perdonar es obedecer a Dios y soltar la amargura.','Perdonar solo es necesario si la otra persona pide perdón.']::TEXT[]),
  (11, 8, 'ABIERTA', 'Escribe el nombre de una persona (o una carga) que decides perdonar hoy, y una oración breve de entrega a Dios.', ARRAY[]::TEXT[]),
  (12, 1, 'ABIERTA', '¿Cuál es el origen y el propósito de la creación?', ARRAY[]::TEXT[]),
  (12, 2, 'ABIERTA', '¿Qué es el Reino de Dios?', ARRAY[]::TEXT[]),
  (12, 3, 'ABIERTA', '¿Cuál es el reposo de Dios y qué significa entrar en él?', ARRAY[]::TEXT[]),
  (12, 4, 'ABIERTA', '¿Cuál es el propósito de Dios con el hombre y en qué cita bíblica se encuentra?', ARRAY[]::TEXT[]),
  (12, 5, 'ABIERTA', 'Explica con tus palabras la diferencia entre imagen y semejanza de Dios.', ARRAY[]::TEXT[]),
  (12, 6, 'ABIERTA', 'De los cinco estamentos divinos, ¿cuál necesitas desarrollar más y por qué?', ARRAY[]::TEXT[]),
  (12, 7, 'OPCION', '“Hagamos al hombre” (Génesis 1:26) revela que la creación del hombre fue:', ARRAY['Un acuerdo de último minuto.','El propósito eterno de Dios.','Una idea de los ángeles.','Un accidente de la creación.']::TEXT[]),
  (12, 8, 'OPCION', 'Entrar en el reposo de Dios significa principalmente:', ARRAY['Dejar de trabajar para siempre.','Entrar en relación íntima y comunión con Dios.','Descansar solo los domingos.','No tener responsabilidades.']::TEXT[]),
  (12, 9, 'ABIERTA', 'Escribe una oración entregando tu vida al propósito eterno de Dios.', ARRAY[]::TEXT[])
) AS v(tema, n, k, p, o) ON v.tema = t."number"
ON CONFLICT ("topic_id", "number") DO NOTHING;
