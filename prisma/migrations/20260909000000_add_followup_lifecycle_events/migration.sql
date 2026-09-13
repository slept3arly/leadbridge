-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_SCHEDULED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_RESCHEDULED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'FOLLOW_UP_CANCELLED';

-- AlterTable: Add followUpId column to LeadActivity
ALTER TABLE "LeadActivity" ADD COLUMN "followUpId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LeadActivity_followUpId_idx" ON "LeadActivity"("followUpId");
