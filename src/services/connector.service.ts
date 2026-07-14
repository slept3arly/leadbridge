import type { Connector as ConnectorContract } from "@/connectors/types";
import { prisma } from "@/lib/prisma";
import { containsSearch, listResult, pagination, type ListQuery } from "@/lib/query-builder";

export class ConnectorService {
  async list() {
    return prisma.connector.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        status: true,
        source: { select: { id: true, name: true } },
        parser: { select: { id: true, name: true, version: true } },
        lastSyncedAt: true,
      },
    });
  }

  async listPage(query: ListQuery) {
    const where = {
      ...(query.filters.status?.length ? { status: { in: query.filters.status as ("INACTIVE" | "ACTIVE" | "ERROR")[] } } : {}),
      ...(query.filters.enabled?.length ? { enabled: query.filters.enabled.includes("true") } : {}),
      ...containsSearch(["name", "type"], query.search),
    };
    const [data, total] = await Promise.all([
      prisma.connector.findMany({ where, orderBy: { createdAt: "desc" }, ...pagination(query), include: { source: { select: { id: true, name: true } }, parser: { select: { id: true, name: true, version: true } } } }),
      prisma.connector.count({ where }),
    ]);
    return listResult(data, total, query);
  }

  async recordSyncRun(connectorId: string, status: "INACTIVE" | "ACTIVE" | "ERROR", counts: { recordsSeen?: number; recordsCreated?: number; recordsUpdated?: number; recordsSkipped?: number; errorMessage?: string }) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const run = await tx.connectorSyncRun.create({ data: { connectorId, status, completedAt: now, ...counts } });
      await tx.connector.update({ where: { id: connectorId }, data: { status, lastSyncedAt: now, ...(status === "ACTIVE" ? { lastSuccessAt: now, lastError: null } : { lastFailureAt: now, lastError: counts.errorMessage }) } });
      return run;
    });
  }

  async sync(connector: ConnectorContract) {
    await connector.authenticate();
    return connector.sync();
  }
}

export const connectorService = new ConnectorService();
