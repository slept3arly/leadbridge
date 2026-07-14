import type { Connector as ConnectorContract } from "@/connectors/types";
import { prisma } from "@/lib/prisma";
import { containsSearch, listResult, pagination, type ListQuery } from "@/lib/query-builder";
import { discoverGmailAccounts } from "@/connectors/environment";
import { createConfiguredRuntime, createGmailRuntime } from "@/connectors/platform";
import type { ConnectorKind } from "@/connectors/types";

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

  async listGmailAccounts() {
    const accounts = discoverGmailAccounts();
    const connectors = await prisma.connector.findMany({ where: { environmentKey: { in: accounts.map((account) => account.key) } }, select: { environmentKey: true, lastSyncedAt: true, sourceId: true } });
    return accounts.map((account) => ({ ...account, lastSyncedAt: connectors.find((connector) => connector.environmentKey === account.key)?.lastSyncedAt ?? null, providerCount: connectors.filter((connector) => connector.environmentKey === account.key && connector.sourceId).length }));
  }

  async listSyncRuns(connectorId?: string) {
    return prisma.connectorSyncRun.findMany({ where: connectorId ? { connectorId } : undefined, orderBy: { startedAt: "desc" }, take: 100, include: { connector: { select: { id: true, name: true, environmentKey: true } } } });
  }

  async testConnection(key: string, kind: ConnectorKind) {
    const runtime = kind === "GMAIL" ? createGmailRuntime(key) : createConfiguredRuntime(key, kind);
    const validation = runtime.validate();
    if (!validation.valid) return { success: false, reason: validation.reason ?? "Connector configuration is invalid." };
    return { success: true, reason: "Environment configuration is valid. Network authentication will be enabled with the provider adapter." };
  }

  async sync(connector: ConnectorContract) {
    await connector.authenticate();
    return connector.sync();
  }
}

export const connectorService = new ConnectorService();
