-- Cada cosa que la persona declaró pasa a ser un renglón propio, que se
-- confirma o se descarta por separado. Antes la declaración entera se aceptaba
-- o se rechazaba de un golpe, así que un rol cierto y uno falso no se podían
-- separar; y los hitos ni siquiera pasaban por aquí: se escribían solos en el
-- expediente sin que nadie los revisara.
--
-- Idempotente a propósito (regla del 4-sep): el build la puede repetir.
CREATE TABLE IF NOT EXISTS "leadership_declaration_item" (
  "id"             TEXT PRIMARY KEY,
  "declaration_id" TEXT NOT NULL,
  -- ROL · ETAPA · HITO
  "kind"           TEXT NOT NULL,
  -- El valor del catálogo: el rol, la fase o el tipo de hito.
  "value"          TEXT NOT NULL,
  -- Solo para los hitos, y puede faltar: mucha gente no recuerda la fecha.
  "achieved_at"    TIMESTAMP(3),
  -- PENDIENTE · CONFIRMADO · DESCARTADO
  "status"         TEXT NOT NULL DEFAULT 'PENDIENTE',
  "resolved_by_id" TEXT,
  "resolved_at"    TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leadership_declaration_item_declaration_id_fkey"
    FOREIGN KEY ("declaration_id") REFERENCES "leadership_declaration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "leadership_declaration_item_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "app_user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "leadership_declaration_item_declaration_id_idx"
  ON "leadership_declaration_item" ("declaration_id");
CREATE INDEX IF NOT EXISTS "leadership_declaration_item_status_idx"
  ON "leadership_declaration_item" ("status");

-- La misma cosa no se declara dos veces dentro de una declaración. Es lo que
-- hace que el relleno de abajo se pueda repetir sin duplicar renglones.
CREATE UNIQUE INDEX IF NOT EXISTS "leadership_declaration_item_unico"
  ON "leadership_declaration_item" ("declaration_id", "kind", "value");

-- Una persona que llenó el formulario dos veces dejó dos declaraciones
-- pendientes, y la pantalla solo mostraba la más reciente: la vieja se quedaba
-- esperando para siempre, invisible. Se marcan como reemplazadas antes de
-- repartir renglones, para no partir en pedazos algo que ya nadie iba a ver.
UPDATE "leadership_declaration" d
SET "status" = 'REEMPLAZADA'
WHERE d."status" = 'PENDIENTE'
  AND EXISTS (
    SELECT 1 FROM "leadership_declaration" nueva
    WHERE nueva."person_id" = d."person_id"
      AND nueva."status" = 'PENDIENTE'
      AND (nueva."created_at", nueva."id") > (d."created_at", d."id")
  );

-- Las declaraciones que siguen esperando se parten en renglones. No se pierde
-- ninguna: las 26 personas que tienen algo pendiente lo conservan, solo que
-- ahora una cosa por renglón.
INSERT INTO "leadership_declaration_item" ("id", "declaration_id", "kind", "value", "created_at")
SELECT gen_random_uuid()::text, d."id", 'ROL', rol, d."created_at"
FROM "leadership_declaration" d, unnest(d."roles") AS rol
WHERE d."status" = 'PENDIENTE'
ON CONFLICT DO NOTHING;

INSERT INTO "leadership_declaration_item" ("id", "declaration_id", "kind", "value", "created_at")
SELECT gen_random_uuid()::text, d."id", 'ETAPA', d."declared_phase"::text, d."created_at"
FROM "leadership_declaration" d
WHERE d."status" = 'PENDIENTE' AND d."declared_phase" IS NOT NULL
ON CONFLICT DO NOTHING;
