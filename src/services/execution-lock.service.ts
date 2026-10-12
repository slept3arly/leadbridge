import { prisma } from "@/lib/prisma";

export class ExecutionLockError extends Error {
  constructor(connectorId: string, currentLockedBy?: string) {
    super(`Connector ${connectorId} is already running${currentLockedBy ? ` (locked by: ${currentLockedBy})` : ""}`);
    this.name = "ExecutionLockError";
  }
}

export const EXECUTION_LOCK_LEASE_MS = 90_000;
type ExecutionLockDatabase = typeof prisma;

export class ExecutionLock {
  constructor(private readonly db: ExecutionLockDatabase = prisma) {}

  async acquire(
    connectorId: string,
    executionId: string,
  ): Promise<bigint | null> {
    return this.db.$transaction(async (tx) => {
      const acquired = await tx.$queryRaw<Array<{ lockGeneration: bigint }>>`
        UPDATE "Connector"
        SET "isRunning" = TRUE, "lockedAt" = clock_timestamp(), "lockedBy" = ${executionId},
            "lockGeneration" = "lockGeneration" + 1
        WHERE "id" = ${connectorId}
          AND ("isRunning" = FALSE OR "lockedAt" IS NULL OR
               "lockedAt" < clock_timestamp() - (${EXECUTION_LOCK_LEASE_MS} * interval '1 millisecond'))
        RETURNING "lockGeneration"
      `;
      if (!acquired.length) return null;
      const now = new Date();
      await tx.connectorSyncRun.updateMany({
        where: { connectorId, status: "ACTIVE" },
        data: { status: "ERROR", completedAt: now, errorMessage: "Interrupted: execution lease expired." },
      });
      await tx.connector.update({
        where: { id: connectorId },
        data: { status: "ERROR", healthStatus: "WARNING", consecutiveFailures: { increment: 1 }, lastFailureAt: now, lastError: "Interrupted: previous execution lease expired." },
      });
      return acquired[0].lockGeneration;
    });
  }

  async renew(connectorId: string, executionId: string, generation: bigint): Promise<boolean> {
    const result = await this.db.$executeRaw`
      UPDATE "Connector" SET "lockedAt" = clock_timestamp()
      WHERE "id" = ${connectorId} AND "isRunning" = TRUE AND "lockedBy" = ${executionId}
        AND "lockGeneration" = ${generation}
        AND "lockedAt" >= clock_timestamp() - (${EXECUTION_LOCK_LEASE_MS} * interval '1 millisecond')
    `;
    return result === 1;
  }

  async owns(connectorId: string, executionId: string, generation: bigint): Promise<boolean> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Connector"
      WHERE "id" = ${connectorId} AND "isRunning" = TRUE AND "lockedBy" = ${executionId}
        AND "lockGeneration" = ${generation}
        AND "lockedAt" >= clock_timestamp() - (${EXECUTION_LOCK_LEASE_MS} * interval '1 millisecond')
    `;
    return rows.length === 1;
  }

  startHeartbeat(connectorId: string, executionId: string, generation: bigint): { stop: () => void; assertOwned: () => Promise<void> } {
    let stopped = false;
    let lost = false;
    let renewing = false;
    const timer = setInterval(() => {
      if (stopped || renewing || lost) return;
      renewing = true;
      void this.renew(connectorId, executionId, generation).then((owned) => { if (!owned) lost = true; }).catch(() => { lost = true; }).finally(() => { renewing = false; });
    }, 20_000);
    timer.unref?.();
    return {
      stop: () => { stopped = true; clearInterval(timer); },
      assertOwned: async () => {
        if (lost || !(await this.renew(connectorId, executionId, generation))) {
          lost = true;
          throw new ExecutionLockError(connectorId, "lease lost");
        }
      },
    };
  }

  async release(
    connectorId: string,
    executionId: string,
    generation: bigint,
  ): Promise<void> {
    await this.db.connector.updateMany({
      where: {
        id: connectorId,
        lockedBy: executionId,
        lockGeneration: generation,
      },
      data: {
        isRunning: false,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async forceRelease(connectorId: string): Promise<void> {
    await this.db.connector.update({
      where: { id: connectorId },
      data: {
        isRunning: false,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async isLocked(connectorId: string): Promise<{ locked: boolean; lockedBy?: string; lockedAt?: Date }> {
    const connector = await this.db.connector.findUnique({
      where: { id: connectorId },
      select: { isRunning: true, lockedBy: true, lockedAt: true },
    });
    if (!connector || !connector.isRunning) return { locked: false };
    return { locked: true, lockedBy: connector.lockedBy ?? undefined, lockedAt: connector.lockedAt ?? undefined };
  }
}

export const executionLock = new ExecutionLock();
