-- CreateEnum
CREATE TYPE "LeadSubStatus" AS ENUM ('WON', 'LOST', 'DISQUALIFIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "LeadStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "noteId" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lastFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "subStatus" "LeadSubStatus";

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "whatCustomerSaid" TEXT,
ADD COLUMN     "whatIDid" TEXT;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;
