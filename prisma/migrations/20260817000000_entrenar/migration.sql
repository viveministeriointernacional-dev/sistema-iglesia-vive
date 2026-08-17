-- CreateEnum
CREATE TYPE "TrainingSessionKind" AS ENUM ('PRESENCIAL', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('PROPUESTO', 'ACTIVO', 'PAUSADO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "training_program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "leader_id" TEXT NOT NULL,
    "team_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_session" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "kind" "TrainingSessionKind" NOT NULL DEFAULT 'VIRTUAL',
    "topic" TEXT NOT NULL,
    "resource" TEXT,
    "task" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_enrollment" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "completion_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_attendance" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "task_delivered" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_assignment" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "ministry" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'PROPUESTO',
    "started_at" DATE NOT NULL,
    "ended_at" DATE,
    "responsible_id" TEXT,
    "notes" TEXT,
    "evidence" TEXT,
    "registered_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_program_leader_id_closed_at_idx" ON "training_program"("leader_id", "closed_at");

-- CreateIndex
CREATE UNIQUE INDEX "training_session_program_id_number_key" ON "training_session"("program_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "training_enrollment_program_id_learner_id_key" ON "training_enrollment"("program_id", "learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_attendance_session_id_enrollment_id_key" ON "training_attendance"("session_id", "enrollment_id");

-- CreateIndex
CREATE INDEX "service_assignment_learner_id_status_idx" ON "service_assignment"("learner_id", "status");

-- AddForeignKey
ALTER TABLE "training_program" ADD CONSTRAINT "training_program_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_program" ADD CONSTRAINT "training_program_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session" ADD CONSTRAINT "training_session_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "training_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "training_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "training_enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_attendance" ADD CONSTRAINT "training_attendance_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_assignment" ADD CONSTRAINT "service_assignment_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Mismo cierre que el resto de las tablas: RLS activo sin políticas y sin
-- permisos para los roles públicos.
ALTER TABLE "training_program" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_assignment" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "training_program", "training_session", "training_enrollment",
      "training_attendance", "service_assignment" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "training_program", "training_session", "training_enrollment",
      "training_attendance", "service_assignment" FROM authenticated;
  END IF;
END $$;
