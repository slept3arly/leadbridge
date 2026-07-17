import { prisma } from "@/lib/prisma";

type HealthStatus = "HEALTHY" | "WARNING" | "ERROR";
type ConnectorResultStatus = "success" | "failed" | "skipped" | "retry" | "cancelled";

export class ConnectorHealthService {
  async recordCompletion(
    connectorId: string,
    status: ConnectorResultStatus,
    durationMs: number,
    errorMessage?: string,
  ): Promise<void> {
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      select: { consecutiveFailures: true, averageDurationMs: true, lastDurationMs: true },
    });
    if (!connector) return;

    const isSuccess = status === "success" || status === "skipped";
    const consecutiveFailures = isSuccess ? 0 : (connector.consecutiveFailures ?? 0) + 1;
    const lastDurationMs = durationMs;

    const oldAvg = connector.averageDurationMs ?? durationMs;
    const averageDurationMs = Math.round((oldAvg + durationMs) / 2);

    let healthStatus: HealthStatus = "HEALTHY";
    if (consecutiveFailures >= 3) {
      healthStatus = "ERROR";
    } else if (consecutiveFailures >= 1) {
      healthStatus = "WARNING";
    }

    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        consecutiveFailures,
        averageDurationMs,
        lastDurationMs,
        healthStatus,
        ...(isSuccess
          ? { lastSuccessAt: new Date(), lastError: null, status: "ACTIVE" as const }
          : { lastFailureAt: new Date(), lastError: errorMessage ?? "Unknown error", status: "ERROR" as const }),
      },
    });
  }

  async getHealth(connectorId: string): Promise<{
    healthStatus: HealthStatus;
    consecutiveFailures: number;
    averageDurationMs: number | null;
    lastDurationMs: number | null;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
    lastError: string | null;
    isRunning: boolean;
  } | null> {
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      select: {
        healthStatus: true,
        consecutiveFailures: true,
        averageDurationMs: true,
        lastDurationMs: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        lastError: true,
        isRunning: true,
      },
    });
    if (!connector) return null;
    return connector;
  }
}

export const connectorHealthService = new ConnectorHealthService();
