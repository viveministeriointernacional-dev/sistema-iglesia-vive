-- CreateTable
CREATE TABLE "phase_change" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "from_phase" "Phase" NOT NULL,
    "to_phase" "Phase" NOT NULL,
    "decided_by_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phase_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phase_change_learner_id_decided_at_idx" ON "phase_change"("learner_id", "decided_at");

-- AddForeignKey
ALTER TABLE "phase_change" ADD CONSTRAINT "phase_change_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase_change" ADD CONSTRAINT "phase_change_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Mismo cierre que el resto de las tablas.
ALTER TABLE "phase_change" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "phase_change" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "phase_change" FROM authenticated;
  END IF;
END $$;
