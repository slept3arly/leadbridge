-- CreateEnum
CREATE TYPE "ConnectorScheduleType" AS ENUM ('MANUAL', 'EVERY_5_MIN', 'EVERY_15_MIN', 'EVERY_30_MIN', 'HOURLY', 'DAILY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ConnectorHealthStatus" AS ENUM ('HEALTHY', 'WARNING', 'ERROR');

-- AlterTable
ALTER TABLE "Connector" ADD COLUMN     "averageDurationMs" INTEGER,
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "healthStatus" "ConnectorHealthStatus" NOT NULL DEFAULT 'HEALTHY',
ADD COLUMN     "isRunning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastDurationMs" INTEGER,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT,
ADD COLUMN     "nextScheduledRun" TIMESTAMP(3),
ADD COLUMN     "scheduleConfig" JSONB,
ADD COLUMN     "scheduleType" "ConnectorScheduleType" NOT NULL DEFAULT 'MANUAL';
