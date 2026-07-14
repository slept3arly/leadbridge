ALTER TABLE "Connector" ADD COLUMN "parserId" TEXT;

CREATE TABLE "ConnectorSyncRun" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "status" "ConnectorStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsSeen" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ConnectorSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Connector_sourceId_enabled_idx" ON "Connector"("sourceId", "enabled");
CREATE INDEX "Connector_parserId_idx" ON "Connector"("parserId");
CREATE INDEX "ConnectorSyncRun_connectorId_startedAt_idx" ON "ConnectorSyncRun"("connectorId", "startedAt");
CREATE INDEX "ConnectorSyncRun_status_startedAt_idx" ON "ConnectorSyncRun"("status", "startedAt");

ALTER TABLE "Connector" ADD CONSTRAINT "Connector_parserId_fkey" FOREIGN KEY ("parserId") REFERENCES "Parser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConnectorSyncRun" ADD CONSTRAINT "ConnectorSyncRun_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
