import { prisma } from "@/lib/prisma";
import type { ExecutionContext, ConnectorExecutionResult } from "./runtime-types";

type ConnectorStatus = "INACTIVE" | "ACTIVE" | "ERROR";

export interface SyncBreakdown {
  duplicatesSkipped: number;
  routingFailures: number;
  parserFailures: number;
  validationFailures: number;
  connectorFailures: number;
  warnings: number;
}

export class SyncHistory {
  async recordStart(context: ExecutionContext): Promise<string> {
    const run = await prisma.connectorSyncRun.create({
      data: {
        connectorId: context.connectorId,
        status: "ACTIVE",
        startedAt: context.startedAt,
        recordsSeen: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        metadata: {
          executionId: context.executionId,
          connectorType: context.connectorType,
          providerId: context.providerId,
          breakdown: {
            duplicatesSkipped: 0,
            routingFailures: 0,
            parserFailures: 0,
            validationFailures: 0,
            connectorFailures: 0,
          },
        } as object,
      },
    });
    return run.id;
  }

  async recordCompletion(
    syncRunId: string,
    connectorId: string,
    result: ConnectorExecutionResult,
    breakdown?: SyncBreakdown,
  ): Promise<void> {
    const { status, errorMessage } = this.mapResult(result);

    await prisma.connectorSyncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        completedAt: new Date(),
        recordsSeen: result.rawPayloadCount,
        recordsCreated: result.leadCount,
        recordsUpdated: 0,
        recordsSkipped: result.warnings.length,
        errorMessage,
        metadata: {
          ...(result.metadata as object),
          durationMs: result.durationMs,
          breakdown: breakdown ?? {
            duplicatesSkipped: 0,
            routingFailures: 0,
            parserFailures: 0,
            validationFailures: 0,
            connectorFailures: 0,
          },
        } as object,
      },
    });

    await this.updateConnectorStatus(connectorId, result);
  }

  private async updateConnectorStatus(
    connectorId: string,
    result: ConnectorExecutionResult,
  ): Promise<void> {
    const isSuccess = result.status === "success";
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        lastSyncedAt: new Date(),
        ...(isSuccess
          ? { lastSuccessAt: new Date(), lastError: null, status: "ACTIVE" as const }
          : {
              lastFailureAt: new Date(),
              lastError: result.errors[0]?.message ?? "Unknown error",
              status: "ERROR" as const,
            }),
      },
    });
  }

  private mapResult(result: ConnectorExecutionResult): {
    status: ConnectorStatus;
    errorMessage?: string;
  } {
    switch (result.status) {
      case "success":
        return { status: "ACTIVE" };
      case "failed":
      case "retry":
        return { status: "ERROR", errorMessage: result.errors[0]?.message };
      case "skipped":
      case "cancelled":
        return { status: "ACTIVE", errorMessage: result.warnings[0] };
      default:
        return { status: "ERROR", errorMessage: "Unknown execution status" };
    }
  }
}
