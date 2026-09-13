-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('INTERACTION', 'FOLLOW_UP', 'NOTE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityEntryType" AS ENUM ('CREATED', 'UPDATED', 'ASSIGNED', 'NOTE_ADDED', 'NOTE_EDITED', 'IMPORTED', 'STATUS_CHANGED', 'FOLLOW_UP_SCHEDULED', 'FOLLOW_UP_RESCHEDULED', 'FOLLOW_UP_COMPLETED', 'FOLLOW_UP_CANCELLED', 'DELETED', 'RESTORED', 'ATTACHMENT_ADDED', 'CALL', 'WHATSAPP');

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "type" "ActivityEventType" NOT NULL,
    "leadId" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" "ActivityEntryType" NOT NULL,
    "action" "ActionType",
    "response" "ResponseType",
    "interest" "InterestType",
    "message" TEXT,
    "metadata" JSONB,
    "followUpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_leadId_occurredAt_idx" ON "ActivityEvent"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_leadId_type_occurredAt_idx" ON "ActivityEvent"("leadId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEntry_eventId_idx" ON "ActivityEntry"("eventId");

-- CreateIndex
CREATE INDEX "ActivityEntry_followUpId_idx" ON "ActivityEntry"("followUpId");

-- CreateIndex
CREATE INDEX "ActivityEntry_type_createdAt_idx" ON "ActivityEntry"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ActivityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEntry" ADD CONSTRAINT "ActivityEntry_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
