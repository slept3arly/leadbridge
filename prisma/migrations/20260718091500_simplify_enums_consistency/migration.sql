-- Simplify LeadStatus: migrate old values to new simplified enum
CREATE TYPE "LeadStatus_new" AS ENUM ('NEW', 'CONVERTED', 'LOST', 'SPAM', 'ON_HOLD');
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING (
  CASE "status"::text
    WHEN 'ON_HOLD' THEN 'ON_HOLD'::"LeadStatus_new"
    WHEN 'WAITING_FOR_CUSTOMER' THEN 'ON_HOLD'::"LeadStatus_new"
    WHEN 'ARCHIVED' THEN 'ON_HOLD'::"LeadStatus_new"
    WHEN 'WON' THEN 'CONVERTED'::"LeadStatus_new"
    WHEN 'CLOSED' THEN 'CONVERTED'::"LeadStatus_new"
    WHEN 'CONVERTED' THEN 'CONVERTED'::"LeadStatus_new"
    WHEN 'LOST' THEN 'LOST'::"LeadStatus_new"
    WHEN 'DISQUALIFIED' THEN 'LOST'::"LeadStatus_new"
    WHEN 'SPAM' THEN 'SPAM'::"LeadStatus_new"
    ELSE 'NEW'::"LeadStatus_new"
  END
);
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW'::"LeadStatus_new";
DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";

-- Drop subStatus column and LeadSubStatus type
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "subStatus";
DROP TYPE IF EXISTS "LeadSubStatus";

-- Simplify LeadPriority: migrate old values
CREATE TYPE "LeadPriority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
ALTER TABLE "Lead" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "priority" TYPE "LeadPriority_new" USING (
  CASE "priority"::text
    WHEN 'LOW' THEN 'LOW'::"LeadPriority_new"
    WHEN 'VERY_LOW' THEN 'LOW'::"LeadPriority_new"
    WHEN 'MEDIUM' THEN 'MEDIUM'::"LeadPriority_new"
    WHEN 'HIGH' THEN 'HIGH'::"LeadPriority_new"
    WHEN 'VERY_HIGH' THEN 'HIGH'::"LeadPriority_new"
    WHEN 'URGENT' THEN 'URGENT'::"LeadPriority_new"
    WHEN 'CRITICAL' THEN 'HIGH'::"LeadPriority_new"
    ELSE 'MEDIUM'::"LeadPriority_new"
  END
);
ALTER TABLE "Lead" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'::"LeadPriority_new";
DROP TYPE "LeadPriority";
ALTER TYPE "LeadPriority_new" RENAME TO "LeadPriority";

-- Simplify FollowUpPriority
CREATE TYPE "FollowUpPriority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
ALTER TABLE "FollowUp" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "FollowUp" ALTER COLUMN "priority" TYPE "FollowUpPriority_new" USING (
  CASE "priority"::text
    WHEN 'LOW' THEN 'LOW'::"FollowUpPriority_new"
    WHEN 'VERY_LOW' THEN 'LOW'::"FollowUpPriority_new"
    WHEN 'MEDIUM' THEN 'MEDIUM'::"FollowUpPriority_new"
    WHEN 'HIGH' THEN 'HIGH'::"FollowUpPriority_new"
    WHEN 'VERY_HIGH' THEN 'HIGH'::"FollowUpPriority_new"
    WHEN 'URGENT' THEN 'URGENT'::"FollowUpPriority_new"
    WHEN 'CRITICAL' THEN 'HIGH'::"FollowUpPriority_new"
    ELSE 'MEDIUM'::"FollowUpPriority_new"
  END
);
ALTER TABLE "FollowUp" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM'::"FollowUpPriority_new";
DROP TYPE "FollowUpPriority";
ALTER TYPE "FollowUpPriority_new" RENAME TO "FollowUpPriority";
