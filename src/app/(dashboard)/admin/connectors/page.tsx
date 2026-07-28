import { prisma } from "@/lib/prisma";
import { ConnectorsPageContent } from "@/components/connectors/connectors-page-content";

export type SerializedConnector = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  status: string;
  healthStatus: string;
  consecutiveFailures: number;
  lastSyncedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  nextScheduledRun: string | null;
  scheduleType: string;
  isRunning: boolean;
  averageDurationMs: number | null;
  lastDurationMs: number | null;
  runtimeMetadata: Record<string, unknown> | null;
};

export type KpiMetrics = {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  running: number;
};

export default async function AdminConnectorsPage() {
  const connectors = await prisma.connector.findMany({
    orderBy: { createdAt: "desc" },
  });

  const serialized: SerializedConnector[] = connectors.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    enabled: c.enabled,
    status: c.status,
    healthStatus: c.healthStatus,
    consecutiveFailures: c.consecutiveFailures,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    lastSuccessAt: c.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: c.lastFailureAt?.toISOString() ?? null,
    lastError: c.lastError,
    nextScheduledRun: c.nextScheduledRun?.toISOString() ?? null,
    scheduleType: c.scheduleType,
    isRunning: c.isRunning,
    averageDurationMs: c.averageDurationMs,
    lastDurationMs: c.lastDurationMs,
    runtimeMetadata: c.runtimeMetadata as Record<string, unknown> | null,
  }));

  const kpi: KpiMetrics = {
    total: connectors.length,
    healthy: connectors.filter((c) => c.healthStatus === "HEALTHY").length,
    warning: connectors.filter((c) => c.healthStatus === "WARNING").length,
    error: connectors.filter((c) => c.healthStatus === "ERROR").length,
    running: connectors.filter((c) => c.isRunning).length,
  };

  return (
    <ConnectorsPageContent
      connectors={serialized}
      kpi={kpi}
    />
  );
}
