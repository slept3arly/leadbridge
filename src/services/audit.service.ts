import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export class AuditService {
  async log(
    action: string,
    entityType: string,
    entityId?: string,
    actorId?: string,
    metadata?: object,
  ) {
    logger.info({ action, entityType, entityId, actorId }, "audit log");

    return prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        actorId,
        metadata,
      },
    });
  }
}

export const auditService = new AuditService();
