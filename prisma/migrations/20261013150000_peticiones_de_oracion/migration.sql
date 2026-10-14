-- Peticiones de oración: tabla propia, para el módulo del líder de intercesión.
--
-- ⚠️ POR QUÉ UNA TABLA Y NO LA COLUMNA QUE YA EXISTE.
-- `person.prayer_request` es UN SOLO TEXTO por persona, y cuando llegaba una
-- segunda petición se APILABA con un salto de línea. Así no se puede saber
-- quién pidió qué ni cuándo — que es justo lo que el módulo tiene que mostrar.
-- Medido antes de escribir esto: 217 personas con petición, 2 ya con varias
-- apiladas. La columna vieja NO se toca: la ficha la sigue enseñando.
--
-- ⚠️ NO TOCA NINGUNA TABLA CALIENTE (la lección del 24-sep): ni un ALTER sobre
-- `app_user`, `person` ni `learner_profile`, y ningún ALTER TYPE. Quién ve el
-- módulo se decide con el configurador de vistas, que ya existe. Se puede
-- fusionar a cualquier hora.
--
-- Idempotente: se puede repetir sin romper.

CREATE TABLE IF NOT EXISTS "prayer_request" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "person_id"      TEXT NOT NULL,
  "text"           TEXT NOT NULL,
  "origin"         TEXT NOT NULL DEFAULT 'PERSONA',
  "reserved"       BOOLEAN NOT NULL DEFAULT false,
  "recorded_by_id" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "prayed_at"      TIMESTAMP(3),
  "prayed_by_id"   TEXT,
  "prayed_note"    TEXT,

  CONSTRAINT "prayer_request_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "person"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "prayer_request_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "prayer_request_prayed_by_id_fkey"
    FOREIGN KEY ("prayed_by_id") REFERENCES "app_user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,

  -- El origen es una lista cerrada: si mañana entra un valor que la pantalla
  -- no sabe pintar, saldría un renglón sin distintivo y nadie se enteraría.
  CONSTRAINT "prayer_request_origen_valido" CHECK (
    "origin" IN ('REGISTRO', 'PERSONA', 'EQUIPO', 'HISTORICO')
  ),

  -- ⚠️ EL CHECK VA EN UNA SOLA DIRECCIÓN, Y NO ES DESCUIDO: quién oró obliga a
  -- que haya fecha, pero la fecha SÍ puede quedarse sin quién.
  -- Con la versión simétrica (`(prayed_at IS NULL) = (prayed_by_id IS NULL)`)
  -- la base se NIEGA A BORRAR una cuenta que haya marcado alguna petición:
  -- el `ON DELETE SET NULL` intenta vaciar `prayed_by_id` y choca contra el
  -- propio CHECK. Probado: «new row violates check constraint» al borrar la
  -- cuenta. Y el estado que quedaba prohibido es LEGÍTIMO — si se borra la
  -- cuenta, por esa petición **sí se oró**; lo único que se pierde es quién.
  -- Perder el autor es aceptable; perder el hecho, no.
  CONSTRAINT "prayer_request_orada_coherente" CHECK (
    "prayed_by_id" IS NULL OR "prayed_at" IS NOT NULL
  ),

  -- Una nota de oración sin oración no significa nada.
  CONSTRAINT "prayer_request_nota_con_oracion" CHECK (
    "prayed_note" IS NULL OR "prayed_at" IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS "prayer_request_created_at_idx" ON "prayer_request" ("created_at");
CREATE INDEX IF NOT EXISTS "prayer_request_prayed_at_idx"  ON "prayer_request" ("prayed_at");
CREATE INDEX IF NOT EXISTS "prayer_request_person_id_idx"  ON "prayer_request" ("person_id");

-- ---------------------------------------------------------------------------
-- Las 217 peticiones que ya existen se trasladan, SIN BORRAR NADA.
-- ---------------------------------------------------------------------------
-- ⚠️ ORIGEN «HISTORICO», no «REGISTRO», y es una decisión de honestidad: la
-- columna vieja no guarda de dónde salió cada texto. La mayoría vino del
-- formulario de registro, pero otras las escribió el equipo desde el tablero o
-- desde el expediente, y no hay forma de distinguirlas. Marcarlas todas como
-- «REGISTRO» pondría en la pantalla un dato inventado.
--
-- ⚠️ LAS APILADAS SE PARTEN. Dos personas tienen varias peticiones metidas en
-- el mismo texto, separadas por una línea en blanco: entran como renglones
-- distintos, que es justo lo que esta tabla viene a arreglar.
--
-- ⚠️ LA FECHA ES LA DE LA FICHA, no la de hoy. Poner `now()` haría que 217
-- peticiones viejas aparecieran como si hubieran entrado todas esta mañana, y
-- el módulo nacería con la lista inservible.
--
-- El `NOT EXISTS` lo hace repetible: si la migración corre dos veces, no
-- duplica.
INSERT INTO "prayer_request" ("person_id", "text", "origin", "created_at")
SELECT p."id", trim(x."parte"), 'HISTORICO', p."created_at"
FROM "person" p
CROSS JOIN LATERAL unnest(string_to_array(p."prayer_request", E'\n\n')) AS x("parte")
WHERE coalesce(trim(p."prayer_request"), '') <> ''
  AND coalesce(trim(x."parte"), '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "prayer_request" r
    WHERE r."person_id" = p."id" AND r."text" = trim(x."parte")
  );
