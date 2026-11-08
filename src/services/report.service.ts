import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfTodayUTC } from "@/lib/utils";
import type { ReportExportFilters } from "@/lib/export/filters";
import { resolveExportDateRange } from "@/lib/export/dates";
import { andLeadWhere, buildReportActivityLeadWhere, buildReportLeadWhere } from "@/services/export/query-builders";

export interface DateRange {
  from: Date;
  to: Date;
}

type ReportClient = Prisma.TransactionClient;

function dateWhere(field: string, range?: DateRange) {
  if (!range) return {};
  return { [field]: { gte: range.from, lte: range.to } };
}

export class ReportService {
  async leadSummary(range?: DateRange, filters?: ReportExportFilters, client: ReportClient = prisma) {
    const where = filters ? buildReportLeadWhere({ ...filters, dateRange: undefined }) : { ...dateWhere("createdAt", range), isDeleted: false };
    const selectedDate = filters?.dateRange ? resolveExportDateRange(filters.dateRange) : undefined;
    if (selectedDate?.from || selectedDate?.toExclusive) Object.assign(where, { createdAt: { ...(selectedDate.from ? { gte: selectedDate.from } : {}), ...(selectedDate.toExclusive ? { lt: selectedDate.toExclusive } : {}) } });
    const deletedWhere = filters ? buildReportLeadWhere({ ...filters, dateRange: undefined }, true) : { ...dateWhere("createdAt", range), isDeleted: true };
    if (selectedDate?.from || selectedDate?.toExclusive) Object.assign(deletedWhere, { createdAt: { ...(selectedDate.from ? { gte: selectedDate.from } : {}), ...(selectedDate.toExclusive ? { lt: selectedDate.toExclusive } : {}) } });

    const [total, open, won, lost, deleted] = await Promise.all([
      client.lead.count({ where }),
      client.lead.count({ where: { AND: [where, { status: { in: ["NEW", "ON_HOLD"] } }] } }),
      client.lead.count({ where: { AND: [where, { status: "CONVERTED" }] } }),
      client.lead.count({ where: { AND: [where, { status: "LOST" }] } }),
      client.lead.count({ where: deletedWhere }),
    ]);

    return {
      total,
      active: open,
      closed: won + lost,
      won,
      lost,
      deleted,
      conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
      lostRate: total > 0 ? Math.round((lost / total) * 100) : 0,
      openRate: total > 0 ? Math.round((open / total) * 100) : 0,
    };
  }

  async leadSources(range?: DateRange, filters?: ReportExportFilters, client: ReportClient = prisma) {
    const dateFilter = filters ? buildReportLeadWhere({ ...filters, dateRange: undefined }) : dateWhere("createdAt", range);
    const selectedDate = filters?.dateRange ? resolveExportDateRange(filters.dateRange) : undefined;
    if (selectedDate?.from || selectedDate?.toExclusive) Object.assign(dateFilter, { createdAt: { ...(selectedDate.from ? { gte: selectedDate.from } : {}), ...(selectedDate.toExclusive ? { lt: selectedDate.toExclusive } : {}) } });

    const [byProvider, byConnector, byParser] = await Promise.all([
      client.lead.groupBy({
        by: ["sourceId"],
        where: andLeadWhere(dateFilter, { isDeleted: false }, { sourceId: { not: null } }),
        _count: { id: true },
      }),
      client.lead.groupBy({
        by: ["connectorId"],
        where: andLeadWhere(dateFilter, { isDeleted: false }, { connectorId: { not: null } }),
        _count: { id: true },
      }),
      client.lead.groupBy({
        by: ["parserVersion"],
        where: andLeadWhere(dateFilter, { isDeleted: false }, { parserVersion: { not: null } }),
        _count: { id: true },
      }),
    ]);

    const providerIds = byProvider.map((r) => r.sourceId!).filter(Boolean);
    const connectorIds = byConnector.map((r) => r.connectorId!).filter(Boolean);

    const [providers, connectors] = await Promise.all([
      client.leadSource.findMany({ where: { id: { in: providerIds } }, select: { id: true, name: true } }),
      client.connector.findMany({ where: { id: { in: connectorIds } }, select: { id: true, name: true, type: true } }),
    ]);

    return {
      byProvider: byProvider.map((r) => ({
        providerId: r.sourceId,
        providerName: providers.find((p) => p.id === r.sourceId)?.name ?? "Unknown",
        count: r._count.id,
      })),
      byConnector: byConnector.map((r) => ({
        connectorId: r.connectorId,
        connectorName: connectors.find((c) => c.id === r.connectorId)?.name ?? "Unknown",
        connectorType: connectors.find((c) => c.id === r.connectorId)?.type ?? "unknown",
        count: r._count.id,
      })),
      byParser: byParser.map((r) => ({
        parserVersion: r.parserVersion ?? "unknown",
        count: r._count.id,
      })),
    };
  }

  async assignments(range?: DateRange, filters?: ReportExportFilters, client: ReportClient = prisma) {
    const dateFilter = filters ? buildReportLeadWhere({ ...filters, dateRange: undefined }) : dateWhere("createdAt", range);
    const selectedDate = filters?.dateRange ? resolveExportDateRange(filters.dateRange) : undefined;
    if (selectedDate?.from || selectedDate?.toExclusive) Object.assign(dateFilter, { createdAt: { ...(selectedDate.from ? { gte: selectedDate.from } : {}), ...(selectedDate.toExclusive ? { lt: selectedDate.toExclusive } : {}) } });

    const [bySalesperson, unassigned] = await Promise.all([
      client.lead.groupBy({
        by: ["assignedUserId"],
        where: andLeadWhere(dateFilter, { isDeleted: false }, { assignedUserId: { not: null } }),
        _count: { id: true },
      }),
      client.lead.count({
        where: andLeadWhere(dateFilter, { isDeleted: false }, { assignedUserId: null }),
      }),
    ]);

    const userIds = bySalesperson.map((r) => r.assignedUserId!).filter(Boolean);
    const users = await client.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    return {
      bySalesperson: bySalesperson.map((r) => ({
        userId: r.assignedUserId,
        userName: users.find((u) => u.id === r.assignedUserId)?.name ?? "Unknown",
        leadCount: r._count.id,
      })),
      unassigned,
    };
  }

  async activity(filters?: ReportExportFilters, client: ReportClient = prisma) {
    const startOfDay = startOfTodayUTC();
    const sevenDaysAgo = new Date();
    const thirtyDaysAgo = new Date();
    if (filters) {
      const now = new Date();
      sevenDaysAgo.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      thirtyDaysAgo.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    }

    // These are fixed-window operational metrics. The report's selected lead
    // creation date range does not replace their explicit today/7/30-day windows.
    const leadScope = filters ? { lead: { is: buildReportActivityLeadWhere(filters) } } : {};
    // Count interaction entries (CALL/WHATSAPP) from ActivityEntry
    const [today, thisWeek, thisMonth] = await Promise.all([
      client.activityEntry.count({
        where: { type: { in: ["CALL", "WHATSAPP"] }, event: { is: { occurredAt: { gte: startOfDay }, ...leadScope } } },
      }),
      client.activityEntry.count({
        where: { type: { in: ["CALL", "WHATSAPP"] }, event: { is: { occurredAt: { gte: sevenDaysAgo }, ...leadScope } } },
      }),
      client.activityEntry.count({
        where: { type: { in: ["CALL", "WHATSAPP"] }, event: { is: { occurredAt: { gte: thirtyDaysAgo }, ...leadScope } } },
      }),
    ]);

    return {
      today,
      thisWeek,
      thisMonth,
    };
  }

  async statusBreakdown(range?: DateRange, filters?: ReportExportFilters, client: ReportClient = prisma) {
    const dateFilter = filters ? buildReportLeadWhere({ ...filters, dateRange: undefined }) : dateWhere("createdAt", range);
    const selectedDate = filters?.dateRange ? resolveExportDateRange(filters.dateRange) : undefined;
    if (selectedDate?.from || selectedDate?.toExclusive) Object.assign(dateFilter, { createdAt: { ...(selectedDate.from ? { gte: selectedDate.from } : {}), ...(selectedDate.toExclusive ? { lt: selectedDate.toExclusive } : {}) } });
    const results = await client.lead.groupBy({
      by: ["status"],
      where: { ...dateFilter, isDeleted: false },
      _count: { id: true },
    });
    return results.map((r) => ({ status: r.status, count: r._count.id }));
  }

  async monthlyTrends(filters?: ReportExportFilters, client: ReportClient = prisma) {
    const resolved = filters?.dateRange ? resolveExportDateRange(filters.dateRange) : undefined;
    const conditions = [Prisma.sql`"isDeleted" = false`];
    if (resolved?.from) conditions.push(Prisma.sql`"createdAt" >= ${resolved.from}`);
    if (resolved?.toExclusive) conditions.push(Prisma.sql`"createdAt" < ${resolved.toExclusive}`);
    if (filters === undefined) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      conditions.push(Prisma.sql`"createdAt" >= ${sixMonthsAgo}`);
    }
    if (filters?.sourceIds?.length) conditions.push(Prisma.sql`"sourceId" IN (${Prisma.join(filters.sourceIds)})`);
    if (filters?.ownerIds?.length) conditions.push(Prisma.sql`"assignedUserId" IN (${Prisma.join(filters.ownerIds)})`);
    if (filters?.statuses?.length) conditions.push(Prisma.sql`"status" IN (${Prisma.join(filters.statuses)})`);
    const results = await client.$queryRaw<Array<{ month: string; total: bigint; won: bigint; lost: bigint }>>(Prisma.sql`
      SELECT
        to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "status" = 'CONVERTED')::bigint AS won,
        COUNT(*) FILTER (WHERE "status" = 'LOST')::bigint AS lost
      FROM "Lead"
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return results.map((row) => ({
      month: row.month,
      total: Number(row.total),
      won: Number(row.won),
      lost: Number(row.lost),
    }));
  }
}

export const reportService = new ReportService();
