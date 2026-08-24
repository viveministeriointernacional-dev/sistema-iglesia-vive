CREATE TYPE "ChurchAttendance" AS ENUM (
  'IGLESIA_VIVE',
  'OTRA_IGLESIA',
  'NUEVO',
  'ASISTIA_ANTES'
);

ALTER TABLE "learner_profile"
ADD COLUMN "church_attendance" "ChurchAttendance";
