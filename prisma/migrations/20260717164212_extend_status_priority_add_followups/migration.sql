-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FollowUpPriority" AS ENUM ('VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'URGENT', 'CRITICAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadPriority" ADD VALUE 'VERY_LOW';
ALTER TYPE "LeadPriority" ADD VALUE 'VERY_HIGH';
ALTER TYPE "LeadPriority" ADD VALUE 'CRITICAL';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'OPEN';
ALTER TYPE "LeadStatus" ADD VALUE 'ATTEMPTED_CONTACT';
ALTER TYPE "LeadStatus" ADD VALUE 'FOLLOW_UP_SCHEDULED';
ALTER TYPE "LeadStatus" ADD VALUE 'INTERESTED';
ALTER TYPE "LeadStatus" ADD VALUE 'PROPOSAL_SENT';
ALTER TYPE "LeadStatus" ADD VALUE 'NEGOTIATION';
ALTER TYPE "LeadStatus" ADD VALUE 'WAITING_FOR_CUSTOMER';
ALTER TYPE "LeadStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "LeadStatus" ADD VALUE 'DISQUALIFIED';
ALTER TYPE "LeadStatus" ADD VALUE 'SPAM';
ALTER TYPE "LeadStatus" ADD VALUE 'ARCHIVED';

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "dueTime" TEXT,
    "priority" "FollowUpPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUp_leadId_dueDate_status_idx" ON "FollowUp"("leadId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "FollowUp_assignedUserId_status_dueDate_idx" ON "FollowUp"("assignedUserId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FollowUp_leadId_createdAt_idx" ON "FollowUp"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
