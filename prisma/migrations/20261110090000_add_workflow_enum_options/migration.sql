-- Add approved workflow options while retaining all historical enum values.
ALTER TYPE "ResponseType" ADD VALUE IF NOT EXISTS 'NOT_PICKED_UP';
ALTER TYPE "ResponseType" ADD VALUE IF NOT EXISTS 'SWITCHED_OFF';
ALTER TYPE "ResponseType" ADD VALUE IF NOT EXISTS 'NOT_REPLIED';
ALTER TYPE "LeadPriority" ADD VALUE IF NOT EXISTS 'COLD';
ALTER TYPE "FollowUpPriority" ADD VALUE IF NOT EXISTS 'COLD';
