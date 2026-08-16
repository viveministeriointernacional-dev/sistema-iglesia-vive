-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('SERVICIO', 'ALPHA', 'FOCUS_DAY', 'ENCUENTRO', 'BAUTISMO', 'CUMBRE', 'ESCUELA', 'TALLER', 'REUNION', 'ACTIVIDAD');

-- CreateEnum
CREATE TYPE "EventRegistrationStatus" AS ENUM ('INSCRITO', 'CONFIRMADO', 'ASISTIO', 'NO_ASISTIO', 'CANCELADO');

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "location" TEXT,
    "capacity" INTEGER,
    "phases" "Phase"[],
    "team_id" TEXT,
    "published_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registration" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'INSCRITO',
    "note" TEXT,
    "registered_by_id" TEXT,
    "attended_by_id" TEXT,
    "attended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_starts_at_idx" ON "event"("starts_at");

-- CreateIndex
CREATE INDEX "event_kind_starts_at_idx" ON "event"("kind", "starts_at");

-- CreateIndex
CREATE INDEX "event_registration_learner_id_idx" ON "event_registration"("learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registration_event_id_learner_id_key" ON "event_registration"("event_id", "learner_id");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_attended_by_id_fkey" FOREIGN KEY ("attended_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Mismo cierre que el resto de las tablas: RLS activo sin políticas y sin
-- permisos para los roles públicos. Todo el acceso pasa por la aplicación,
-- que autoriza por rol antes de consultar.
ALTER TABLE "event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "event_registration" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "event", "event_registration" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "event", "event_registration" FROM authenticated;
  END IF;
END $$;
