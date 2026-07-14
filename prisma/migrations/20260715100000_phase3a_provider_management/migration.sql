CREATE TYPE "UnmatchedEmailStatus" AS ENUM ('UNMATCHED', 'ASSIGNED', 'IGNORED', 'SPAM', 'PARSER_REQUESTED');
CREATE TYPE "ParserRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DECLINED');

ALTER TABLE "Connector" ADD COLUMN "environmentKey" TEXT;

CREATE TABLE "RoutingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipientGmailAccount" TEXT,
    "senderEmail" TEXT,
    "senderDomain" TEXT,
    "subjectContains" TEXT,
    "gmailLabel" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "providerId" TEXT NOT NULL,
    "parserId" TEXT NOT NULL,
    "connectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoutingRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnmatchedEmail" (
    "id" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "subject" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "rawPreview" TEXT,
    "status" "UnmatchedEmailStatus" NOT NULL DEFAULT 'UNMATCHED',
    "connectorId" TEXT,
    "providerId" TEXT,
    "rawPayload" JSONB,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "parserRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnmatchedEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParserRequest" (
    "id" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "sampleSubject" TEXT,
    "samplePreview" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ParserRequestStatus" NOT NULL DEFAULT 'OPEN',
    "developerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParserRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Connector_environmentKey_key" ON "Connector"("environmentKey");
CREATE INDEX "RoutingRule_active_priority_idx" ON "RoutingRule"("active", "priority");
CREATE INDEX "RoutingRule_recipientGmailAccount_active_priority_idx" ON "RoutingRule"("recipientGmailAccount", "active", "priority");
CREATE INDEX "RoutingRule_providerId_idx" ON "RoutingRule"("providerId");
CREATE INDEX "UnmatchedEmail_status_receivedAt_idx" ON "UnmatchedEmail"("status", "receivedAt");
CREATE INDEX "UnmatchedEmail_connectorId_receivedAt_idx" ON "UnmatchedEmail"("connectorId", "receivedAt");
CREATE INDEX "UnmatchedEmail_senderEmail_idx" ON "UnmatchedEmail"("senderEmail");
CREATE INDEX "ParserRequest_status_requestedAt_idx" ON "ParserRequest"("status", "requestedAt");
CREATE INDEX "ParserRequest_requestedById_requestedAt_idx" ON "ParserRequest"("requestedById", "requestedAt");

ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LeadSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_parserId_fkey" FOREIGN KEY ("parserId") REFERENCES "Parser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoutingRule" ADD CONSTRAINT "RoutingRule_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnmatchedEmail" ADD CONSTRAINT "UnmatchedEmail_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnmatchedEmail" ADD CONSTRAINT "UnmatchedEmail_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnmatchedEmail" ADD CONSTRAINT "UnmatchedEmail_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParserRequest" ADD CONSTRAINT "ParserRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
