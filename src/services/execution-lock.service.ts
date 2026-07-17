import { prisma } from "@/lib/prisma";

export class ExecutionLockError extends Error {
  constructor(connectorId: string, currentLockedBy?: string) {
    super(`Connector ${connectorId} is already running${currentLockedBy ? ` (locked by: ${currentLockedBy})` : ""}`);
    this.name = "ExecutionLockError";
  }
}

export class ExecutionLock {
  async acquire(
    connectorId: string,
    executionId: string,
  ): Promise<boolean> {
    const result = await prisma.connector.updateMany({
      where: {
        id: connectorId,
        isRunning: false,
      },
      data: {
        isRunning: true,
        lockedAt: new Date(),
        lockedBy: executionId,
      },
    });
    return result.count > 0;
  }

  async release(
    connectorId: string,
    executionId: string,
  ): Promise<void> {
    await prisma.connector.updateMany({
      where: {
        id: connectorId,
        lockedBy: executionId,
      },
      data: {
        isRunning: false,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async forceRelease(connectorId: string): Promise<void> {
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        isRunning: false,
        lockedAt: null,
        lockedBy: null,
      },
    });
  }

  async isLocked(connectorId: string): Promise<{ locked: boolean; lockedBy?: string; lockedAt?: Date }> {
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      select: { isRunning: true, lockedBy: true, lockedAt: true },
    });
    if (!connector || !connector.isRunning) return { locked: false };
    return { locked: true, lockedBy: connector.lockedBy ?? undefined, lockedAt: connector.lockedAt ?? undefined };
  }
}

export const executionLock = new ExecutionLock();
