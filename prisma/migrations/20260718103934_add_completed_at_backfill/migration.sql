-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- Backfill completedAt for COMPLETED follow-ups (approximate from updatedAt)
UPDATE "FollowUp" SET "completedAt" = "updatedAt" WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;

-- Backfill lead.lastFollowUpAt from latest completed follow-up per lead
UPDATE "Lead" l
SET "lastFollowUpAt" = sub.latest_completed
FROM (
  SELECT "leadId" AS lid, MAX("completedAt") AS latest_completed
  FROM "FollowUp"
  WHERE "status" = 'COMPLETED' AND "completedAt" IS NOT NULL
  GROUP BY "leadId"
) sub
WHERE l."id" = sub.lid;

-- Backfill lead.nextFollowUpAt from earliest PENDING follow-up due date per lead
UPDATE "Lead" l
SET "nextFollowUpAt" = sub.earliest_due
FROM (
  SELECT "leadId" AS lid, MIN("dueDate") AS earliest_due
  FROM "FollowUp"
  WHERE "status" = 'PENDING' AND "dueDate" IS NOT NULL
  GROUP BY "leadId"
) sub
WHERE l."id" = sub.lid;
