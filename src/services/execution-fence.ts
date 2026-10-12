import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { EXECUTION_LOCK_LEASE_MS } from "./execution-lock.service";

export interface ExecutionFence {
  connectorId: string;
  executionId: string;
  generation: bigint;
}

export class ExecutionFenceError extends Error {
  constructor() {
    super("Sync execution lease is no longer current.");
    this.name = "ExecutionLockError";
  }
}

export async function assertExecutionFence(
  tx: Prisma.TransactionClient,
  fence: ExecutionFence,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ lockGeneration: bigint }>>`
    SELECT "lockGeneration" FROM "Connector"
    WHERE "id" = ${fence.connectorId}
      AND "isRunning" = TRUE
      AND "lockedBy" = ${fence.executionId}
      AND "lockGeneration" = ${fence.generation}
      AND "lockedAt" >= clock_timestamp() - (${EXECUTION_LOCK_LEASE_MS} * interval '1 millisecond')
    FOR UPDATE
  `;
  if (rows.length !== 1) throw new ExecutionFenceError();
}

export async function withExecutionFence<T>(
  fence: ExecutionFence,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await assertExecutionFence(tx, fence);
    return operation(tx);
  });
}
