import { prisma } from "@/lib/prisma";
import type { ExecutionContext, ConnectorExecutionResult } from "./runtime-types";
import type { ExecutionFence } from "@/services/execution-fence";
import { withExecutionFence } from "@/services/execution-fence";
import type { Prisma } from "@/generated/prisma/client";

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
  constructor(private readonly fence?: ExecutionFence) {}

  async recordStart(context: ExecutionContext): Promise<string> {
    const createRun = (db: Prisma.TransactionClient | typeof prisma) => db.connectorSyncRun.create({
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
    const run = this.fence ? await withExecutionFence(this.fence, createRun) : await createRun(prisma);
    return run.id;
  }

  async recordCompletion(
    syncRunId: string,
    connectorId: string,
    result: ConnectorExecutionResult,
    breakdown?: SyncBreakdown,
  ): Promise<void> {
    const { status, errorMessage } = this.mapResult(result);

    const updateRun = (db: Prisma.TransactionClient | typeof prisma) => db.connectorSyncRun.update({
      where: { id: syncRunId },
      data: {
        status,
        completedAt: new Date(),
        recordsSeen: result.rawPayloadCount,
        recordsCreated: result.leadCount,
        recordsUpdated: 0,
        recordsSkipped: breakdown?.duplicatesSkipped ?? 0,
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
    if (this.fence) {
      await withExecutionFence(this.fence, async (tx) => {
        await updateRun(tx);
        await this.updateConnectorStatus(connectorId, result, tx);
      });
    } else {
      await updateRun(prisma);
      await this.updateConnectorStatus(connectorId, result);
    }
  }

  private async updateConnectorStatus(
    connectorId: string,
    result: ConnectorExecutionResult,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<void> {
    const isSuccess = result.status === "success";
    await db.connector.update({
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
