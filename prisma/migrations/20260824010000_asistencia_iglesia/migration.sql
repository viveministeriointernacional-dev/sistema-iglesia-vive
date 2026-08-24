DO $$
BEGIN
  CREATE TYPE "ChurchAttendance" AS ENUM (
    'IGLESIA_VIVE',
    'OTRA_IGLESIA',
    'NUEVO',
    'ASISTIA_ANTES'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "learner_profile"
ADD COLUMN IF NOT EXISTS "church_attendance" "ChurchAttendance";
