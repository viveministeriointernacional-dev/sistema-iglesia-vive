-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('APRENDIZ', 'CONSOLIDADOR', 'LIDER_ALPHA', 'MENTOR', 'PASTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MUJER', 'HOMBRE');

-- CreateEnum
CREATE TYPE "EntryPoint" AS ENUM ('SERVICIO_DOMINICAL', 'SERVICIO_MIERCOLES', 'REDES_SOCIALES', 'ALPHA_CASA_DE_FE', 'EVENTO_O_BRIGADA', 'UNO_A_UNO');

-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('PERSONA', 'REDES', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "CallSchedule" AS ENUM ('MANANA', 'TARDE', 'NOCHE');

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('GANAR', 'FORTALECER', 'ENTRENAR', 'MULTIPLICAR');

-- CreateEnum
CREATE TYPE "LearnerStatus" AS ENUM ('ACTIVO', 'PAUSADO', 'RETIRADO', 'GRADUADO');

-- CreateEnum
CREATE TYPE "Operation72Status" AS ENUM ('INICIADA', 'CONTACTADA', 'VISITA_PENDIENTE', 'LISTA_PARA_ENTREGA', 'ENTREGADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('LLAMADA', 'INTENTO_LLAMADA', 'MENSAJE', 'CONVERSACION', 'VISITA', 'INTENTO_VISITA');

-- CreateEnum
CREATE TYPE "MilestoneKind" AS ENUM ('REGISTRO', 'OPERACION_72', 'ALPHA', 'FOCUS_DAY', 'CASA_DE_FE', 'BAUTISMO', 'ENCUENTRO', 'EVALUACION_CIERRE', 'GRADUACION', 'VALIDACION_PASTORAL', 'ENTRADA_ESCUELA', 'SERVICIO', 'MULTIPLICACION');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADO');

-- CreateEnum
CREATE TYPE "FaithHouseStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'REQUIERE_SEGUIMIENTO');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR');

-- CreateTable
CREATE TABLE "app_user" (
    "id" TEXT NOT NULL,
    "auth_user_id" UUID,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL DEFAULT 12,
    "person_id" TEXT,
    "team_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "birth_date" DATE,
    "call_phone" TEXT,
    "whatsapp_phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "prayer_request" TEXT,
    "photo_url" TEXT,
    "call_schedule" "CallSchedule",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_profile" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "phase" "Phase" NOT NULL DEFAULT 'GANAR',
    "status" "LearnerStatus" NOT NULL DEFAULT 'ACTIVO',
    "phase_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entry_point" "EntryPoint" NOT NULL,
    "invitation_kind" "InvitationKind" NOT NULL,
    "invited_by_person_id" TEXT,
    "line_of_origin" TEXT,
    "origin_notes" TEXT,
    "consolidator_id" TEXT,
    "team_id" TEXT,
    "registered_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_relationship" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "reason" TEXT,
    "authorized_by_id" TEXT,
    "keeps_line" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation72" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "status" "Operation72Status" NOT NULL DEFAULT 'INICIADA',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "detail" TEXT NOT NULL,
    "line_known" BOOLEAN NOT NULL DEFAULT false,
    "proposed_mentor_id" TEXT,
    "proposed_mentor_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation72_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_attempt" (
    "id" TEXT NOT NULL,
    "operation72_id" TEXT NOT NULL,
    "type" "ContactType" NOT NULL,
    "result" TEXT,
    "note" TEXT,
    "next_action" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "kind" "MilestoneKind" NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDIENTE',
    "achieved_at" TIMESTAMP(3),
    "detail" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_note" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faith_house_topic" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "faith_house_topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faith_house_progress" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "status" "FaithHouseStatus" NOT NULL DEFAULT 'PENDIENTE',
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "faith_house_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_event" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_auth_user_id_key" ON "app_user"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_person_id_key" ON "app_user"("person_id");

-- CreateIndex
CREATE INDEX "app_user_role_active_idx" ON "app_user"("role", "active");

-- CreateIndex
CREATE UNIQUE INDEX "team_name_key" ON "team"("name");

-- CreateIndex
CREATE INDEX "person_call_phone_idx" ON "person"("call_phone");

-- CreateIndex
CREATE INDEX "person_whatsapp_phone_idx" ON "person"("whatsapp_phone");

-- CreateIndex
CREATE INDEX "person_email_idx" ON "person"("email");

-- CreateIndex
CREATE UNIQUE INDEX "learner_profile_person_id_key" ON "learner_profile"("person_id");

-- CreateIndex
CREATE INDEX "learner_profile_phase_status_idx" ON "learner_profile"("phase", "status");

-- CreateIndex
CREATE INDEX "mentor_relationship_learner_id_ended_at_idx" ON "mentor_relationship"("learner_id", "ended_at");

-- CreateIndex
CREATE INDEX "mentor_relationship_mentor_id_ended_at_idx" ON "mentor_relationship"("mentor_id", "ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "operation72_learner_id_key" ON "operation72"("learner_id");

-- CreateIndex
CREATE INDEX "operation72_status_deadline_at_idx" ON "operation72"("status", "deadline_at");

-- CreateIndex
CREATE INDEX "contact_attempt_operation72_id_occurred_at_idx" ON "contact_attempt"("operation72_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_learner_id_kind_key" ON "milestone"("learner_id", "kind");

-- CreateIndex
CREATE INDEX "private_note_learner_id_created_at_idx" ON "private_note"("learner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "faith_house_topic_number_key" ON "faith_house_topic"("number");

-- CreateIndex
CREATE UNIQUE INDEX "faith_house_progress_learner_id_topic_id_key" ON "faith_house_progress"("learner_id", "topic_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "integration_event_status_created_at_idx" ON "integration_event"("status", "created_at");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_invited_by_person_id_fkey" FOREIGN KEY ("invited_by_person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_consolidator_id_fkey" FOREIGN KEY ("consolidator_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_relationship" ADD CONSTRAINT "mentor_relationship_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_relationship" ADD CONSTRAINT "mentor_relationship_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_relationship" ADD CONSTRAINT "mentor_relationship_authorized_by_id_fkey" FOREIGN KEY ("authorized_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation72" ADD CONSTRAINT "operation72_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation72" ADD CONSTRAINT "operation72_proposed_mentor_id_fkey" FOREIGN KEY ("proposed_mentor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attempt" ADD CONSTRAINT "contact_attempt_operation72_id_fkey" FOREIGN KEY ("operation72_id") REFERENCES "operation72"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_attempt" ADD CONSTRAINT "contact_attempt_by_user_id_fkey" FOREIGN KEY ("by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_note" ADD CONSTRAINT "private_note_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_note" ADD CONSTRAINT "private_note_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faith_house_progress" ADD CONSTRAINT "faith_house_progress_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faith_house_progress" ADD CONSTRAINT "faith_house_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "faith_house_topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
