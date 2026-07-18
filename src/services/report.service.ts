import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface DateRange {
  from: Date;
  to: Date;
}

function dateWhere(field: string, range?: DateRange) {
  if (!range) return {};
  return { [field]: { gte: range.from, lte: range.to } };
}

export class ReportService {
  async leadSummary(range?: DateRange) {
    const where = { ...dateWhere("createdAt", range), isDeleted: false };
    const deletedWhere = { ...dateWhere("createdAt", range), isDeleted: true };

    const [total, open, won, lost, deleted] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: { in: ["NEW", "ON_HOLD"] } } }),
      prisma.lead.count({ where: { ...where, status: "CONVERTED" } }),
      prisma.lead.count({ where: { ...where, status: "LOST" } }),
      prisma.lead.count({ where: deletedWhere }),
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

  async leadSources(range?: DateRange) {
    const dateFilter = dateWhere("createdAt", range);

    const [byProvider, byConnector, byParser] = await Promise.all([
      prisma.lead.groupBy({
        by: ["sourceId"],
        where: { ...dateFilter, isDeleted: false, sourceId: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["connectorId"],
        where: { ...dateFilter, isDeleted: false, connectorId: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["parserVersion"],
        where: { ...dateFilter, isDeleted: false, parserVersion: { not: null } },
        _count: { id: true },
      }),
    ]);

    const providerIds = byProvider.map((r) => r.sourceId!).filter(Boolean);
    const connectorIds = byConnector.map((r) => r.connectorId!).filter(Boolean);

    const [providers, connectors] = await Promise.all([
      prisma.leadSource.findMany({ where: { id: { in: providerIds } }, select: { id: true, name: true } }),
      prisma.connector.findMany({ where: { id: { in: connectorIds } }, select: { id: true, name: true, type: true } }),
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

  async assignments(range?: DateRange) {
    const dateFilter = dateWhere("createdAt", range);

    const [bySalesperson, unassigned] = await Promise.all([
      prisma.lead.groupBy({
        by: ["assignedUserId"],
        where: { ...dateFilter, isDeleted: false, assignedUserId: { not: null } },
        _count: { id: true },
      }),
      prisma.lead.count({
        where: { ...dateFilter, isDeleted: false, assignedUserId: null },
      }),
    ]);

    const userIds = bySalesperson.map((r) => r.assignedUserId!).filter(Boolean);
    const users = await prisma.user.findMany({
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

  async activity() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [today, thisWeek, thisMonth] = await Promise.all([
      prisma.leadActivity.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.leadActivity.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.leadActivity.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    return {
      today,
      thisWeek,
      thisMonth,
    };
  }

  async statusBreakdown(range?: DateRange) {
    const dateFilter = dateWhere("createdAt", range);
    const results = await prisma.lead.groupBy({
      by: ["status"],
      where: { ...dateFilter, isDeleted: false },
      _count: { id: true },
    });
    return results.map((r) => ({ status: r.status, count: r._count.id }));
  }

  async monthlyTrends() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const results = await prisma.$queryRaw<Array<{ month: string; total: bigint; won: bigint; lost: bigint }>>(Prisma.sql`
      SELECT
        to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "status" = 'CONVERTED')::bigint AS won,
        COUNT(*) FILTER (WHERE "status" = 'LOST')::bigint AS lost
      FROM "Lead"
      WHERE "createdAt" >= ${sixMonthsAgo} AND "isDeleted" = false
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
