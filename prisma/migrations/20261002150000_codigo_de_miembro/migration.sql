-- El código único de cada persona: su «carné» para entrar al taller sin
-- celular ni correo.
--
-- Nace del caso de Juanita Chávez (2-oct-2026): una menor sin celular propio.
-- Si escribe el de su papá, el taller la confundiría con él —o, si los dos
-- están registrados con ese número, el sistema se detiene y **los bloquea a
-- los dos**. El código rompe el empate: es de la persona, no del teléfono.
--
-- ⚠️ VIVE EN TABLA PROPIA, NO COMO COLUMNA DE `person`, y no es un capricho:
-- `person` es una de las tablas que el sistema lee en cada petición, y un
-- `ALTER TABLE` sobre ella pide un candado EXCLUSIVO que a media tarde se
-- encola detrás del tráfico vivo y mata el despliegue (lección del
-- 24-sep-2026). Esta tabla nace vacía y nadie la está leyendo.

CREATE TABLE IF NOT EXISTS "member_code" (
  "id"         TEXT NOT NULL,
  "person_id"  TEXT NOT NULL,
  -- Seis dígitos. NO es secreto: se dicta en voz alta y se escribe en el
  -- cuaderno. Lo que autoriza de verdad es que el líder revise el taller.
  "code"       TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "used_at"    TIMESTAMP(3),
  CONSTRAINT "member_code_pkey" PRIMARY KEY ("id")
);

-- Uno por persona, y ningún código repetido en toda la iglesia. Sin estos dos
-- índices, dos personas podrían acabar con el mismo código y cada una vería el
-- taller de la otra.
CREATE UNIQUE INDEX IF NOT EXISTS "member_code_person_id_key" ON "member_code" ("person_id");
CREATE UNIQUE INDEX IF NOT EXISTS "member_code_code_key" ON "member_code" ("code");

-- Solo dígitos, exactamente seis, y nunca empezando por 0: un cero a la
-- izquierda se pierde al pegarlo en Excel y al dictarlo por teléfono.
DO $$
BEGIN
  ALTER TABLE "member_code" ADD CONSTRAINT "member_code_formato"
    CHECK ("code" ~ '^[1-9][0-9]{5}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER TABLE "member_code" ADD CONSTRAINT "member_code_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Reparto inicial: un código para cada persona que ya tiene expediente.
--
-- ⚠️ ALEATORIO, NO CORRELATIVO. Con 1, 2, 3… cualquiera adivinaría el del
-- vecino escribiendo el número siguiente, y el taller de otro se abre solo.
--
-- ⚠️ IDEMPOTENTE: solo reparte a quien no tiene (`NOT EXISTS`), así que
-- repetir la migración no le cambia el código a nadie — y un código que ya se
-- dictó y se escribió en un cuaderno no puede cambiar.
--
-- El bucle existe porque dos sorteos pueden coincidir: en ese caso el índice
-- único rechaza la fila y se vuelve a intentar. Con 463 personas sobre 900 000
-- combinaciones la colisión es rarísima, pero «rarísimo» no es «imposible».
DO $$
DECLARE
  faltan INTEGER;
  vuelta INTEGER := 0;
BEGIN
  LOOP
    INSERT INTO "member_code" ("id", "person_id", "code")
    SELECT gen_random_uuid()::text, p."id",
           (100000 + floor(random() * 900000))::int::text
    FROM "person" p
    WHERE EXISTS (SELECT 1 FROM "learner_profile" lp WHERE lp."person_id" = p."id")
      AND NOT EXISTS (SELECT 1 FROM "member_code" mc WHERE mc."person_id" = p."id")
    ON CONFLICT DO NOTHING;

    SELECT count(*) INTO faltan
    FROM "person" p
    WHERE EXISTS (SELECT 1 FROM "learner_profile" lp WHERE lp."person_id" = p."id")
      AND NOT EXISTS (SELECT 1 FROM "member_code" mc WHERE mc."person_id" = p."id");

    EXIT WHEN faltan = 0;

    vuelta := vuelta + 1;
    -- Tope de seguridad: si algo va mal, la migración falla con un mensaje
    -- claro en vez de girar para siempre y colgar el despliegue.
    IF vuelta > 50 THEN
      RAISE EXCEPTION 'No se pudo repartir el código a % personas tras 50 vueltas', faltan;
    END IF;
  END LOOP;
END $$;
