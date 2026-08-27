-- Casa de Fe como grupo: alguien la lleva (permiso `can_lead_faith_house`) y
-- tiene personas inscritas, igual que un grupo de Alpha. El avance de los 12
-- temas sigue en cada expediente (faith_house_progress); esto solo agrupa quién
-- la lleva y con quiénes.

-- CreateTable
CREATE TABLE "faith_house_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "leader_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "team_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faith_house_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faith_house_group_member" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faith_house_group_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faith_house_group_leader_id_closed_at_idx" ON "faith_house_group"("leader_id", "closed_at");

-- CreateIndex
CREATE UNIQUE INDEX "faith_house_group_member_group_id_learner_id_key" ON "faith_house_group_member"("group_id", "learner_id");

-- AddForeignKey
ALTER TABLE "faith_house_group" ADD CONSTRAINT "faith_house_group_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faith_house_group" ADD CONSTRAINT "faith_house_group_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faith_house_group" ADD CONSTRAINT "faith_house_group_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faith_house_group_member" ADD CONSTRAINT "faith_house_group_member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "faith_house_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faith_house_group_member" ADD CONSTRAINT "faith_house_group_member_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
