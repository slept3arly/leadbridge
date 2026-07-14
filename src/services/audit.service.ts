import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

type DbClient = Pick<typeof prisma, "auditLog">;

export class AuditService {
  async log(
    action: string,
    entityType: string,
    entityId?: string,
    actorId?: string,
    metadata?: object,
    details?: { oldData?: object; newData?: object; ipAddress?: string; userAgent?: string; requestId?: string },
    client: DbClient = prisma,
  ) {
    logger.info({ action, entityType, entityId, actorId }, "audit log");

    return client.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        actorId,
        metadata,
        ...details,
      },
    });
  }
}

export const auditService = new AuditService();
