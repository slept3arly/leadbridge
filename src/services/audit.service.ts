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

  async listPage(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    action?: string;
    entityType?: string;
    actorId?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: "insensitive" } },
        { entityType: { contains: query.search, mode: "insensitive" } },
        { entityId: { contains: query.search, mode: "insensitive" } },
        { actor: { name: { contains: query.search, mode: "insensitive" } } },
      ];
    }
    if (query.action) where.action = query.action;
    if (query.entityType) where.entityType = query.entityType;
    if (query.actorId) where.actorId = query.actorId;

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

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}

export const auditService = new AuditService();
