import { prisma } from "@/lib/prisma";
import { ConnectorRuntime } from "@/runtime/connector-runtime";
import { parserRegistry } from "@/parsers/registry";
import { createConnector } from "@/connectors/registry";
import { executionLock } from "./execution-lock.service";
import { connectorHealthService } from "./connector-health.service";
import { randomUUID } from "crypto";

type ScheduleType = "MANUAL" | "EVERY_5_MIN" | "EVERY_15_MIN" | "EVERY_30_MIN" | "HOURLY" | "DAILY" | "CUSTOM";

const SYSTEM_ACTOR = { id: "system", role: "ADMIN" as const };

const SCHEDULE_INTERVALS: Record<ScheduleType, number | null> = {
  MANUAL: null,
  EVERY_5_MIN: 5 * 60 * 1000,
  EVERY_15_MIN: 15 * 60 * 1000,
  EVERY_30_MIN: 30 * 60 * 1000,
  HOURLY: 60 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
  CUSTOM: null,
};

function computeNextRun(scheduleType: ScheduleType): Date | null {
  if (scheduleType === "MANUAL") return null;
  if (scheduleType === "CUSTOM") {
    return null;
  }
  const interval = SCHEDULE_INTERVALS[scheduleType];
  if (!interval) return null;
  return new Date(Date.now() + interval);
}

function buildConnectorRegistry(config: Record<string, unknown>) {
  return {
    get(t: string) {
      return createConnector(t, config);
    },
  };
}

const parserRegistryAdapter = {
  get(key: string) {
    return parserRegistry.get(key);
  },
};

export interface SchedulerResult {
  connectorId: string;
  connectorName: string;
  status: "executed" | "skipped_locked" | "skipped_not_due" | "error";
  executionResult?: {
    status: string;
    leadCount: number;
    rawPayloadCount: number;
    errors: Array<{ message: string }>;
    warnings: string[];
    durationMs: number;
  };
  reason?: string;
}

export class ConnectorScheduler {
  async discoverDue(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    scheduleType: ScheduleType;
    scheduleConfig: Record<string, unknown> | null;
    nextScheduledRun: Date | null;
    environmentKey: string | null;
    configuration: Record<string, unknown> | null;
    runtimeMetadata: Record<string, unknown> | null;
  }>> {
    const connectors = await prisma.connector.findMany({
      where: {
        enabled: true,
        scheduleType: { not: "MANUAL" },
      },
      select: {
        id: true,
        name: true,
        type: true,
        scheduleType: true,
        scheduleConfig: true,
        nextScheduledRun: true,
        environmentKey: true,
        configuration: true,
        runtimeMetadata: true,
      },
    });

    const now = new Date();
    return connectors.filter((c) => {
      if (!c.nextScheduledRun) return true;
      return c.nextScheduledRun <= now;
    }).map((c) => ({
      ...c,
      scheduleType: c.scheduleType as ScheduleType,
      scheduleConfig: c.scheduleConfig as Record<string, unknown> | null,
      configuration: c.configuration as Record<string, unknown> | null,
      runtimeMetadata: c.runtimeMetadata as Record<string, unknown> | null,
    }));
  }

  async runDue(): Promise<SchedulerResult[]> {
    const due = await this.discoverDue();
    const results: SchedulerResult[] = [];

    for (const connector of due) {
      const result = await this.runConnector(connector);
      results.push(result);
    }

    return results;
  }

  async runConnector(connector: {
    id: string;
    name: string;
    type: string;
    scheduleType: ScheduleType;
    scheduleConfig: Record<string, unknown> | null;
    environmentKey: string | null;
    configuration: Record<string, unknown> | null;
    runtimeMetadata: Record<string, unknown> | null;
  }): Promise<SchedulerResult> {
    const executionId = randomUUID();

    const acquired = await executionLock.acquire(connector.id, executionId);
    if (!acquired) {
      return {
        connectorId: connector.id,
        connectorName: connector.name,
        status: "skipped_locked",
        reason: "Connector is already running",
      };
    }

    const config = connector.configuration ?? {};
    const runtimeMeta = connector.runtimeMetadata ?? {};

    try {
      const connectorRegistry = buildConnectorRegistry({ ...config, environmentKey: connector.environmentKey ?? "MAIN", runtimeMetadata: runtimeMeta });

      const runtime = new ConnectorRuntime({
        connectorRegistry,
        parserRegistry: parserRegistryAdapter,
      });

      const result = await runtime.execute(
        connector.id,
        connector.type,
        SYSTEM_ACTOR,
        {
          configuration: config,
        },
      );

      await connectorHealthService.recordCompletion(
        connector.id,
        result.status,
        result.durationMs,
        result.errors[0]?.message,
      );

      const nextRun = computeNextRun(connector.scheduleType);
      await prisma.connector.update({
        where: { id: connector.id },
        data: {
          nextScheduledRun: nextRun,
          lastSyncedAt: new Date(),
          ...(result.status === "success" || result.status === "skipped"
            ? { lastError: null, status: "ACTIVE" as const }
            : { lastError: result.errors[0]?.message ?? "Unknown error", status: "ERROR" as const }),
        },
      });

      return {
        connectorId: connector.id,
        connectorName: connector.name,
        status: "executed",
        executionResult: {
          status: result.status,
          leadCount: result.leadCount,
          rawPayloadCount: result.rawPayloadCount,
          errors: result.errors,
          warnings: result.warnings,
          durationMs: result.durationMs,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown scheduler error";

      await connectorHealthService.recordCompletion(
        connector.id,
        "failed",
        0,
        errorMessage,
      );

      const nextRun = computeNextRun(connector.scheduleType);
      await prisma.connector.update({
        where: { id: connector.id },
        data: {
          nextScheduledRun: nextRun,
          lastSyncedAt: new Date(),
          lastError: errorMessage,
          status: "ERROR" as const,
        },
      });

      return {
        connectorId: connector.id,
        connectorName: connector.name,
        status: "error",
        reason: errorMessage,
      };
    } finally {
      await executionLock.release(connector.id, executionId);
    }
  }

  async runConnectorById(connectorId: string): Promise<SchedulerResult> {
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId, enabled: true },
      select: {
        id: true,
        name: true,
        type: true,
        scheduleType: true,
        scheduleConfig: true,
        environmentKey: true,
        configuration: true,
        runtimeMetadata: true,
      },
    });

    if (!connector) {
      return {
        connectorId,
        connectorName: "unknown",
        status: "error",
        reason: "Connector not found or not enabled",
      };
    }

    return this.runConnector({
      ...connector,
      scheduleType: connector.scheduleType as ScheduleType,
      scheduleConfig: connector.scheduleConfig as Record<string, unknown> | null,
      configuration: connector.configuration as Record<string, unknown> | null,
      runtimeMetadata: connector.runtimeMetadata as Record<string, unknown> | null,
    });
  }
}

export const connectorScheduler = new ConnectorScheduler();
