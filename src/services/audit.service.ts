import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { settingsService } from "@/services/settings.service";

type DbClient = Pick<typeof prisma, "auditLog">;

export class AuditService {
  private async getRetentionLimit(): Promise<number> {
    try {
      const limit = await settingsService.get<number>("audit_log_retention_limit");
      return typeof limit === "number" && limit > 0 ? limit : 1000;
    } catch {
      return 1000;
    }
  }

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

    const entry = await client.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        actorId,
        metadata,
        ...details,
      },
    });

    try {
      const maxLogCount = await this.getRetentionLimit();
      const total = await prisma.auditLog.count();
      if (total > maxLogCount) {
        const overflow = total - maxLogCount;
        const oldest = await prisma.auditLog.findMany({
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: overflow,
        });
        if (oldest.length > 0) {
          await prisma.auditLog.deleteMany({
            where: { id: { in: oldest.map((o) => o.id) } },
          });
        }
      }
    } catch (e) {
      logger.error(e, "audit retention cleanup failed");
    }

    return entry;
  }

  async listPage(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    action?: string;
    entityType?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: "insensitive" } },
        { entityType: { contains: query.search, mode: "insensitive" } },
        { actor: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.actorId) where.actorId = query.actorId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const distinctActions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    });

    const distinctEntityTypes = await prisma.auditLog.findMany({
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    });

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filters: {
        actions: distinctActions.map((a) => a.action),
        entityTypes: distinctEntityTypes.map((e) => e.entityType),
      },
    };
  }
}

export const auditService = new AuditService();
