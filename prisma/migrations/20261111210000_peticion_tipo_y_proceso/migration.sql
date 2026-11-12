-- Las peticiones pasan a tener TIPO (oración / consejería) y una marca de
-- «quiero iniciar un proceso».
--
-- Pedido del usuario el 11-nov: un solo link público donde la persona dice qué
-- necesita, y una sola pantalla en el administrador para atenderlo.
--
-- ⚠️ **Por qué `types` es un ARREGLO y `wants_process` una columna aparte.**
-- Son tres cosas distintas, no tres valores de lo mismo:
--   · Oración y consejería son **lo que se pide**, y la persona puede marcar
--     las dos a la vez («oren por mi matrimonio y quiero hablar con alguien»).
--     Partirlo en dos filas duplicaría el texto y haría que atender una dejara
--     la otra colgando.
--   · «Quiero iniciar un proceso» **no es una petición**: es lo que dispara
--     `crearRegistroEnTransaccion` y pone a la persona en Operación 72 con su
--     consolidador. Mezclarlo con los tipos haría que la lista de intercesión
--     se llenara de filas que no son para orar.
--
-- Las 271 filas que ya existen quedan como ORACION, que es lo que eran: 219
-- migradas de las fichas y 52 que llegaron por el formulario de registro.
--
-- Se puede repetir sin romper: las tres instrucciones llevan IF NOT EXISTS y el
-- UPDATE está acotado a las filas que todavía tengan el arreglo vacío.
-- `prayer_request` no es una tabla caliente (543 personas, 271 peticiones), así
-- que se puede fusionar a cualquier hora.

ALTER TABLE "prayer_request"
  ADD COLUMN IF NOT EXISTS "types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "prayer_request"
  ADD COLUMN IF NOT EXISTS "wants_process" BOOLEAN NOT NULL DEFAULT false;

-- Lo que ya había era oración. Acotado al arreglo vacío para que repetir la
-- migración no pise un tipo que alguien haya cambiado después.
UPDATE "prayer_request"
SET "types" = ARRAY['ORACION']::TEXT[]
WHERE cardinality("types") = 0;

-- El índice que usa la pestaña de «quieren iniciar proceso», que es la única
-- que filtra por esta columna y la que mirará consolidación todos los días.
CREATE INDEX IF NOT EXISTS "prayer_request_wants_process_idx"
  ON "prayer_request" ("wants_process")
  WHERE "wants_process" = true;
