CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALES');
CREATE TYPE "ConnectorStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'ERROR');

ALTER TYPE "ActivityType" ADD VALUE 'NOTE_EDITED';
ALTER TYPE "ActivityType" ADD VALUE 'FOLLOW_UP';
ALTER TYPE "ActivityType" ADD VALUE 'DELETED';
ALTER TYPE "ActivityType" ADD VALUE 'RESTORED';
ALTER TYPE "ActivityType" ADD VALUE 'ATTACHMENT_ADDED';

ALTER TABLE "users"
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "designation" TEXT,
  ADD COLUMN "employeeCode" TEXT,
  ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "role_new" "UserRole" NOT NULL DEFAULT 'SALES';
UPDATE "users" SET "role_new" = CASE WHEN "role" = 'ADMIN' THEN 'ADMIN'::"UserRole" ELSE 'SALES'::"UserRole" END;
ALTER TABLE "users" DROP COLUMN "role";
ALTER TABLE "users" RENAME COLUMN "role_new" TO "role";

ALTER TABLE "LeadSource"
  ADD COLUMN "color" TEXT,
  ADD COLUMN "icon" TEXT,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "slug" TEXT;
UPDATE "LeadSource" SET "slug" = lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')) WHERE "slug" IS NULL;
UPDATE "LeadSource" SET "slug" = 'source-' || "id" WHERE "slug" IS NULL OR "slug" = '';
ALTER TABLE "LeadSource" ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "Lead"
  ADD COLUMN "budget" DECIMAL(14,2),
  ADD COLUMN "campaign" TEXT,
  ADD COLUMN "campaignId" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "currency" VARCHAR(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "expectedValue" DECIMAL(14,2),
  ADD COLUMN "firstContactedAt" TIMESTAMP(3),
  ADD COLUMN "importedAt" TIMESTAMP(3),
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "jobTitle" TEXT,
  ADD COLUMN "lastContactedAt" TIMESTAMP(3),
  ADD COLUMN "leadNumber" TEXT,
  ADD COLUMN "lostReason" TEXT,
  ADD COLUMN "nextFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "parserVersion" TEXT,
  ADD COLUMN "rawPayload" JSONB,
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "sourceName" TEXT,
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "updatedById" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmContent" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "wonAmount" DECIMAL(14,2);
UPDATE "Lead" SET "leadNumber" = 'lead-' || "id" WHERE "leadNumber" IS NULL;
ALTER TABLE "Lead" ALTER COLUMN "leadNumber" SET NOT NULL;

ALTER TABLE "Note" RENAME COLUMN "updatedAt" TO "editedAt";
ALTER TABLE "Note"
  ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'INTERNAL';

ALTER TABLE "Attachment"
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "uploadedById" TEXT;
ALTER TABLE "Connector"
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "lastFailureAt" TIMESTAMP(3),
  ADD COLUMN "lastSuccessAt" TIMESTAMP(3),
  ADD COLUMN "pollInterval" INTEGER,
  ADD COLUMN "runtimeMetadata" JSONB,
  ADD COLUMN "status" "ConnectorStatus" NOT NULL DEFAULT 'INACTIVE';
ALTER TABLE "Parser" ADD COLUMN "description" TEXT, ADD COLUMN "version" TEXT;
ALTER TABLE "AuditLog"
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "newData" JSONB,
  ADD COLUMN "oldData" JSONB,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "userAgent" TEXT;
ALTER TABLE "Setting" ADD COLUMN "category" TEXT, ADD COLUMN "description" TEXT, ADD COLUMN "updatedById" TEXT;

CREATE UNIQUE INDEX "users_employeeCode_key" ON "users"("employeeCode");
CREATE INDEX "users_role_active_isDeleted_idx" ON "users"("role", "active", "isDeleted");
CREATE INDEX "users_isDeleted_deletedAt_idx" ON "users"("isDeleted", "deletedAt");
CREATE INDEX "accounts_userId_providerId_idx" ON "accounts"("userId", "providerId");
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");
CREATE UNIQUE INDEX "LeadSource_slug_key" ON "LeadSource"("slug");
CREATE INDEX "LeadSource_active_priority_idx" ON "LeadSource"("active", "priority");
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");
DROP INDEX "Lead_assignedUserId_status_idx";
CREATE INDEX "Lead_assignedUserId_status_isDeleted_idx" ON "Lead"("assignedUserId", "status", "isDeleted");
CREATE INDEX "Lead_status_isArchived_isDeleted_idx" ON "Lead"("status", "isArchived", "isDeleted");
CREATE INDEX "Lead_nextFollowUpAt_isDeleted_idx" ON "Lead"("nextFollowUpAt", "isDeleted");
CREATE INDEX "Lead_connectorId_sourceReferenceId_idx" ON "Lead"("connectorId", "sourceReferenceId");
CREATE INDEX "Lead_createdById_createdAt_idx" ON "Lead"("createdById", "createdAt");
CREATE INDEX "LeadActivity_leadId_type_createdAt_idx" ON "LeadActivity"("leadId", "type", "createdAt");
CREATE INDEX "Note_leadId_createdAt_idx" ON "Note"("leadId", "createdAt");
CREATE INDEX "Note_leadId_isPinned_idx" ON "Note"("leadId", "isPinned");
CREATE INDEX "Attachment_leadId_createdAt_idx" ON "Attachment"("leadId", "createdAt");
CREATE INDEX "Attachment_checksum_idx" ON "Attachment"("checksum");
CREATE INDEX "Connector_enabled_status_idx" ON "Connector"("enabled", "status");
CREATE INDEX "Parser_type_active_idx" ON "Parser"("type", "active");
CREATE INDEX "FieldMapping_connectorId_targetField_idx" ON "FieldMapping"("connectorId", "targetField");
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "Setting_category_idx" ON "Setting"("category");

ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
