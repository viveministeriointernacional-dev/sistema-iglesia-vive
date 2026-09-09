-- Asistentes de la iglesia: vienen, pero hoy no quieren entrar a ningún proceso.
--
-- No es una baja. Sale del tablero de Operación 72 y de la carga de su
-- consolidador, pero conserva expediente, acceso y todo lo que ya alcanzó.
-- Por eso es un estado propio y no se reutiliza RETIRADO (que apaga el acceso)
-- ni PAUSADO (que en el modelo significa otra cosa y hoy no lo usa nadie).
ALTER TYPE "LearnerStatus" ADD VALUE IF NOT EXISTS 'ASISTENTE' AFTER 'ACTIVO';

-- Desde cuándo y por qué. Se guardan aparte del historial de estados porque
-- el listado los muestra en cada renglón: sacarlos de learner_status_change
-- obligaría a una consulta más por persona.
ALTER TABLE "learner_profile" ADD COLUMN IF NOT EXISTS "attendee_since" TIMESTAMP(3);
ALTER TABLE "learner_profile" ADD COLUMN IF NOT EXISTS "attendee_reason" TEXT;
ALTER TABLE "learner_profile" ADD COLUMN IF NOT EXISTS "attendee_note" TEXT;

-- El listado ordena por «hace cuánto es asistente» sobre esta sola columna.
CREATE INDEX IF NOT EXISTS "learner_profile_attendee_since_idx"
  ON "learner_profile" ("attendee_since");
