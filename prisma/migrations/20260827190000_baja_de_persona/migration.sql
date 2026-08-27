-- Historia de bajas y reactivaciones. Dar de baja a alguien deja registro del
-- motivo, la fecha y quién lo hizo; la reactivación también. No se borra a
-- nadie: el expediente se conserva, solo cambia de estado.

-- CreateTable
CREATE TABLE "learner_status_change" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "from_status" "LearnerStatus" NOT NULL,
    "to_status" "LearnerStatus" NOT NULL,
    "reason" TEXT,
    "decided_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_status_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learner_status_change_learner_id_created_at_idx" ON "learner_status_change"("learner_id", "created_at");

-- AddForeignKey
ALTER TABLE "learner_status_change" ADD CONSTRAINT "learner_status_change_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_status_change" ADD CONSTRAINT "learner_status_change_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
