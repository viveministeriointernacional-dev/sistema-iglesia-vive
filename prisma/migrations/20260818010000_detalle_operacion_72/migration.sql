-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('CONTESTO_BIEN', 'CONTESTO_REPROGRAMO', 'CONTESTO_REGULAR', 'CONTESTO_MAL', 'NO_CONTESTO');

-- AlterTable
ALTER TABLE "contact_attempt" ADD COLUMN     "is_virtual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "outcome" "CallOutcome",
ADD COLUMN     "place" TEXT,
ADD COLUMN     "scheduled_at" TIMESTAMP(3);

