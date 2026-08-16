
-- CreateTable
CREATE TABLE "alpha_program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "leader_id" TEXT NOT NULL,
    "team_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alpha_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alpha_session" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "topic" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alpha_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alpha_enrollment" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "focus_day_at" TIMESTAMP(3),
    "validated_at" TIMESTAMP(3),
    "validated_by_id" TEXT,
    "validation_note" TEXT,

    CONSTRAINT "alpha_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alpha_attendance" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alpha_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alpha_program_leader_id_closed_at_idx" ON "alpha_program"("leader_id", "closed_at");

-- CreateIndex
CREATE UNIQUE INDEX "alpha_session_program_id_number_key" ON "alpha_session"("program_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "alpha_enrollment_program_id_learner_id_key" ON "alpha_enrollment"("program_id", "learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "alpha_attendance_session_id_enrollment_id_key" ON "alpha_attendance"("session_id", "enrollment_id");

-- AddForeignKey
ALTER TABLE "alpha_program" ADD CONSTRAINT "alpha_program_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_program" ADD CONSTRAINT "alpha_program_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_session" ADD CONSTRAINT "alpha_session_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "alpha_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_enrollment" ADD CONSTRAINT "alpha_enrollment_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "alpha_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_enrollment" ADD CONSTRAINT "alpha_enrollment_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_enrollment" ADD CONSTRAINT "alpha_enrollment_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_attendance" ADD CONSTRAINT "alpha_attendance_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "alpha_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_attendance" ADD CONSTRAINT "alpha_attendance_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "alpha_enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alpha_attendance" ADD CONSTRAINT "alpha_attendance_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Las tablas nuevas se cierran igual que el resto: el acceso pasa por la API.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alpha_program','alpha_session','alpha_enrollment','alpha_attendance']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END
$$;
