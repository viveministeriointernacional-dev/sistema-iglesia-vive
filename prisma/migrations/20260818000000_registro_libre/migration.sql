-- El registro deja de exigir campos que en la puerta de un domingo no siempre
-- se alcanzan a preguntar. Un dato en blanco es mejor que un dato inventado.

-- «Otro» como punto de entrada: la lista de seis nunca cubre todo.
ALTER TYPE "EntryPoint" ADD VALUE IF NOT EXISTS 'OTRO';

-- Origen opcional, con espacio para detallar el «otro».
ALTER TABLE "learner_profile"
  ADD COLUMN "entry_point_other" TEXT,
  ALTER COLUMN "entry_point" DROP NOT NULL,
  ALTER COLUMN "invitation_kind" DROP NOT NULL;

-- Identidad: apellido y género dejan de ser obligatorios.
ALTER TABLE "person"
  ALTER COLUMN "last_name" DROP NOT NULL,
  ALTER COLUMN "gender" DROP NOT NULL;

-- El horario de llamada pasa de una franja única a varias, más un texto libre
-- para lo que ninguna franja cubre («después de las 7»).
ALTER TABLE "person"
  ADD COLUMN "call_schedules" "CallSchedule"[] NOT NULL DEFAULT '{}',
  ADD COLUMN "call_schedule_note" TEXT;

-- La franja que ya estaba registrada se conserva como primer elemento.
UPDATE "person"
   SET "call_schedules" = ARRAY["call_schedule"]
 WHERE "call_schedule" IS NOT NULL;

ALTER TABLE "person" DROP COLUMN "call_schedule";
ALTER TABLE "person" ALTER COLUMN "call_schedules" DROP DEFAULT;
