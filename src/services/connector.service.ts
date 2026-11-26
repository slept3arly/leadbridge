import { prisma } from "@/lib/prisma";
import { sanitizeSyncErrorDiagnostic } from "@/lib/sync-error";
import { containsSearch, listResult, pagination, type ListQuery } from "@/lib/query-builder";
import { discoverGmailAccounts } from "@/connectors/environment";
import type { SyncHistoryExportFilters } from "@/lib/export/filters";
import { buildSyncHistoryExportWhere, buildSyncHistoryOrderBy, type ExportDateBounds } from "@/services/export/query-builders";

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

  // Legacy compatibility for smoke scripts. Sync history is persisted by the runtime.
  async recordSyncRun(connectorId: string, status: "INACTIVE" | "ACTIVE" | "ERROR", counts: { recordsSeen?: number; recordsCreated?: number; recordsUpdated?: number; recordsSkipped?: number; errorMessage?: string }) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const run = await tx.connectorSyncRun.create({ data: { connectorId, status, completedAt: now, ...counts } });
      await tx.connector.update({ where: { id: connectorId }, data: { status, lastSyncedAt: now, ...(status === "ACTIVE" ? { lastSuccessAt: now, lastError: null } : { lastFailureAt: now, lastError: counts.errorMessage }) } });
      return run;
    });
  }

  async listGmailAccounts() {
    const accounts = discoverGmailAccounts();
    const connectors = await prisma.connector.findMany({ where: { environmentKey: { in: accounts.map((account) => account.key) } }, select: { environmentKey: true, lastSyncedAt: true, sourceId: true } });
    return accounts.map((account) => ({ ...account, lastSyncedAt: connectors.find((connector) => connector.environmentKey === account.key)?.lastSyncedAt ?? null, providerCount: connectors.filter((connector) => connector.environmentKey === account.key && connector.sourceId).length }));
  }

  async listSyncRuns(connectorId?: string) {
    const runs = await prisma.connectorSyncRun.findMany({
      where: connectorId ? { connectorId } : undefined,
      orderBy: buildSyncHistoryOrderBy(),
      take: 100,
      include: { connector: { select: { id: true, name: true, environmentKey: true } } },
    });
    return runs.map((run) => ({
      ...run,
      errorMessage: run.errorMessage ? sanitizeSyncErrorDiagnostic(run.errorMessage) : null,
    }));
  }

  async listSyncRunsPage(options: {
    filters?: SyncHistoryExportFilters;
    bounds?: ExportDateBounds;
    limit?: number;
    offset?: number;
  } = {}) {
    const limit = Math.min(100, Math.max(1, options.limit ?? 100));
    const offset = Math.max(0, options.offset ?? 0);
    const where = buildSyncHistoryExportWhere(
      options.filters ?? { dateField: "startedAt", errorOutcome: "any" },
      options.bounds,
    );
    const [runs, total] = await Promise.all([
      prisma.connectorSyncRun.findMany({
        where,
        orderBy: buildSyncHistoryOrderBy(),
        take: limit,
        skip: offset,
        include: { connector: { select: { id: true, name: true, type: true, environmentKey: true } } },
      }),
      prisma.connectorSyncRun.count({ where }),
    ]);
    const data = runs.map((run) => ({
      ...run,
      errorMessage: run.errorMessage ? sanitizeSyncErrorDiagnostic(run.errorMessage) : null,
    }));
    return { data, total, limit, offset, hasMore: offset + data.length < total };
  }
}

export const connectorService = new ConnectorService();
