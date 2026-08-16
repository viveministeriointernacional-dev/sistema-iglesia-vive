-- Casa de Fe: cada tema guarda lo que pide el §6.2 de la especificación —
-- fecha, mentor, estado, evaluación breve, nota privada, tarea y evidencia.

ALTER TABLE "faith_house_progress"
  ADD COLUMN "assessment" TEXT,
  ADD COLUMN "task" TEXT,
  ADD COLUMN "evidence" TEXT,
  ADD COLUMN "recorded_by_id" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prisma escribe updated_at desde la aplicación (@updatedAt); el valor por
-- defecto solo hace falta para rellenar las filas que ya existen.
ALTER TABLE "faith_house_progress" ALTER COLUMN "updated_at" DROP DEFAULT;

ALTER TABLE "faith_house_progress"
  ADD CONSTRAINT "faith_house_progress_recorded_by_id_fkey"
  FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
