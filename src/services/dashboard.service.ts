import { prisma } from "@/lib/prisma";
import { startOfTodayUTC, endOfTodayUTC } from "@/lib/utils";
import { reportService } from "./report.service";
import { attentionService } from "./attention.service";
import { salesFollowUpLeadScope } from "@/services/follow-up-policy";

type ActivityMetricRow = {
  isTotal: boolean;
  actorId: string | null;
  workedLeads: bigint;
  calls: bigint;
  whatsapp: bigint;
  responses: bigint;
};

type SalesActivityMetricRow = {
  workedLeads: bigint;
  calls: bigint;
  whatsapp: bigint;
  responded: bigint;
  noResponse: bigint;
  interested: bigint;
  notInterested: bigint;
};

export class DashboardService {
  async admin() {
    const today = startOfTodayUTC();
    const todayEnd = endOfTodayUTC();
    const now = new Date();

    const [
      totalLeads,
      newToday,
      convertedLeads,
      unassigned,
      statusBreakdown,
      priorityBreakdown,
      activeSalesUsers,
      assignedLeadGroups,
      pendingFollowUps,
      overdueFollowUps,
      activityMetricsRows,
      connectorHealth,
      recentActivity,
      recentSyncs,
    ] = await Promise.all([
      prisma.lead.count({ where: { isDeleted: false } }),
      prisma.lead.count({ where: { createdAt: { gte: today }, isDeleted: false } }),
      prisma.lead.count({ where: { status: "CONVERTED", isDeleted: false } }),
      prisma.lead.count({ where: { assignedUserId: null, isDeleted: false } }),
      reportService.statusBreakdown(),
      prisma.lead.groupBy({ by: ["priority"], where: { isDeleted: false }, _count: { id: true } }),
      prisma.user.findMany({
        where: { role: "SALES", active: true, isDeleted: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.lead.groupBy({
        by: ["assignedUserId"],
        where: { isDeleted: false, assignedUserId: { not: null } },
        _count: { id: true },
      }),
      prisma.followUp.count({ where: { status: "PENDING" } }),
      prisma.followUp.count({ where: { status: "PENDING", dueDate: { lt: now } } }),
      prisma.$queryRaw<ActivityMetricRow[]>`
        SELECT
          GROUPING(event."actorId") = 1 AS "isTotal",
          event."actorId" AS "actorId",
          COUNT(DISTINCT event."leadId") AS "workedLeads",
          COUNT(*) FILTER (WHERE entry."type" = 'CALL' AND entry."action" = 'CALL') AS "calls",
          COUNT(*) FILTER (WHERE entry."type" = 'WHATSAPP' AND entry."action" = 'WHATSAPP') AS "whatsapp",
          COUNT(*) FILTER (
            WHERE (entry."type" = 'CALL' AND entry."action" = 'CALL' AND entry."response" = 'PICKED_UP')
               OR (entry."type" = 'WHATSAPP' AND entry."action" = 'WHATSAPP' AND entry."response" = 'REPLIED')
          ) AS "responses"
        FROM "ActivityEntry" entry
        INNER JOIN "ActivityEvent" event ON event."id" = entry."eventId"
        WHERE (
          (entry."type" = 'CALL' AND entry."action" = 'CALL')
          OR (entry."type" = 'WHATSAPP' AND entry."action" = 'WHATSAPP')
        )
          AND event."occurredAt" >= ${today}
          AND event."occurredAt" <= ${todayEnd}
        GROUP BY GROUPING SETS ((event."actorId"), ())
      `,
      prisma.connector.findMany({ select: { id: true, name: true, type: true, healthStatus: true, status: true, isRunning: true, enabled: true } }),
      prisma.activityEvent.findMany({
        orderBy: { occurredAt: "desc" },
        take: 10,
        include: {
          actor: { select: { id: true, name: true } },
          lead: { select: { id: true, displayName: true, leadNumber: true } },
          entries: { select: { type: true, message: true }, orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.connectorSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 5, include: { connector: { select: { id: true, name: true } } } }),
    ]);

    const salespersonActivity = new Map(activeSalesUsers.map((user) => [user.id, {
      workedLeads: 0,
      calls: 0,
      whatsapp: 0,
      responses: 0,
    }]));
    const toCount = (value: bigint) => Number(value);
    const totals = activityMetricsRows.find((row) => row.isTotal);
    const workedLeads = toCount(totals?.workedLeads ?? BigInt(0));
    const callsLogged = toCount(totals?.calls ?? BigInt(0));
    const whatsappLogged = toCount(totals?.whatsapp ?? BigInt(0));
    const responseEntries = toCount(totals?.responses ?? BigInt(0));
    for (const row of activityMetricsRows) {
      if (row.isTotal || !row.actorId) continue;
      const actorStats = salespersonActivity.get(row.actorId);
      if (!actorStats) continue;
      actorStats.workedLeads = toCount(row.workedLeads);
      actorStats.calls = toCount(row.calls);
      actorStats.whatsapp = toCount(row.whatsapp);
      actorStats.responses = toCount(row.responses);
    }

    const assignedLeadCounts = new Map(
      assignedLeadGroups.map(({ assignedUserId, _count }) => [assignedUserId, _count.id]),
    );
    return {
      cards: {
        totalLeads,
        newToday,
        convertedLeads,
        unassigned,
      },
      charts: {
        statusBreakdown: ["NEW", "ON_HOLD", "CONVERTED", "LOST", "SPAM"].map((status) => ({
          status,
          count: statusBreakdown.find((item) => item.status === status)?.count ?? 0,
        })),
        priorityBreakdown: ["URGENT", "HIGH", "MEDIUM", "LOW"].map((priority) => ({
          priority,
          count: priorityBreakdown.find((item) => item.priority === priority)?._count.id ?? 0,
        })),
      },
      workload: {
        assigned: totalLeads - unassigned,
        unassigned,
        activeSalesUsers: activeSalesUsers.length,
        pendingFollowUps,
        overdueFollowUps,
      },
      activity: { workedLeads, callsLogged, whatsappLogged, responseEntries },
      salespersonPerformance: activeSalesUsers.map((user) => {
        const activity = salespersonActivity.get(user.id)!;
        return {
          userId: user.id,
          name: user.name,
          assignedLeads: assignedLeadCounts.get(user.id) ?? 0,
          workedToday: activity.workedLeads,
          calls: activity.calls,
          whatsapp: activity.whatsapp,
          responses: activity.responses,
        };
      }),
      connectorHealth: connectorHealth.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        healthStatus: c.healthStatus,
        status: c.status,
        isRunning: c.isRunning,
        enabled: c.enabled,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.entries[0]?.message ?? a.type,
        actorName: a.actor?.name ?? "System",
        leadId: a.leadId,
        leadName: a.lead?.displayName ?? "Deleted",
        leadNumber: a.lead?.leadNumber ?? "",
        createdAt: a.occurredAt.toISOString(),
      })),
      recentSyncs: recentSyncs.map((s) => ({
        id: s.id,
        connectorName: s.connector.name,
        status: s.status,
        recordsSeen: s.recordsSeen,
        recordsCreated: s.recordsCreated,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
      })),
    };
  }

  async sales(userId: string) {
    const now = new Date();
    const startOfToday = startOfTodayUTC();
    const endOfToday = endOfTodayUTC();
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getUTCDay()));
    endOfWeek.setUTCHours(23, 59, 59, 999);
    const leadWhere = { assignedUserId: userId, isDeleted: false };

    const [
      leadStats,
      priorityStats,
      upcomingFollowUps,
      overdueFollowUpCount,
      todayFollowUpCount,
      weekFollowUpCount,
      newLeadCount,
      needsAttentionItems,
      activityMetrics,
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ["status"],
        where: leadWhere,
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["priority"],
        where: leadWhere,
        _count: { id: true },
      }),
      prisma.followUp.findMany({
        where: {
          status: "PENDING",
          dueDate: { not: null, gte: startOfToday },
          OR: [{ assignedUserId: userId }, { createdById: userId }],
          ...salesFollowUpLeadScope(userId),
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        select: {
          id: true, title: true, dueDate: true, dueTime: true,
          lead: { select: { id: true, displayName: true, company: true, leadNumber: true, priority: true, category: true } },
        },
      }),
      prisma.lead.count({
        where: {
          isDeleted: false,
          isArchived: false,
          assignedUserId: userId,
          nextFollowUpAt: { not: null, lt: now },
        },
      }),
      prisma.lead.count({
        where: {
          isDeleted: false,
          isArchived: false,
          assignedUserId: userId,
          nextFollowUpAt: { not: null, gte: startOfToday, lte: endOfToday },
        },
      }),
      prisma.followUp.count({
        where: {
          status: "PENDING",
          dueDate: { not: null, gte: startOfToday, lte: endOfWeek },
          OR: [{ assignedUserId: userId }, { createdById: userId }],
          ...salesFollowUpLeadScope(userId),
        },
      }),
      prisma.lead.count({
        where: { ...leadWhere, notes: { none: {} }, followUps: { none: {} } },
      }),
      attentionService.getNeedsAttention(userId),
      prisma.$queryRaw<SalesActivityMetricRow[]>`
        SELECT
          COUNT(DISTINCT event."leadId") FILTER (WHERE entry."type" IN ('CALL', 'WHATSAPP')) AS "workedLeads",
          COUNT(DISTINCT event."leadId") FILTER (WHERE entry."type" = 'CALL' AND entry."action" = 'CALL') AS "calls",
          COUNT(DISTINCT event."leadId") FILTER (WHERE entry."type" = 'WHATSAPP' AND entry."action" = 'WHATSAPP') AS "whatsapp",
          COUNT(DISTINCT event."leadId") FILTER (
            WHERE (entry."type" = 'CALL' AND entry."action" = 'CALL' AND entry."response" = 'PICKED_UP')
               OR (entry."type" = 'WHATSAPP' AND entry."action" = 'WHATSAPP' AND entry."response" = 'REPLIED')
          ) AS "responded",
          COUNT(DISTINCT event."leadId") FILTER (
            WHERE (entry."type" = 'CALL' AND entry."action" = 'CALL' AND entry."response" = 'NO_RESPONSE')
               OR (entry."type" = 'WHATSAPP' AND entry."action" = 'WHATSAPP' AND entry."response" = 'NO_RESPONSE')
          ) AS "noResponse",
          COUNT(DISTINCT event."leadId") FILTER (WHERE entry."interest" = 'INTERESTED') AS "interested",
          COUNT(DISTINCT event."leadId") FILTER (WHERE entry."interest" = 'NOT_INTERESTED') AS "notInterested"
        FROM "ActivityEntry" entry
        INNER JOIN "ActivityEvent" event ON event."id" = entry."eventId"
        INNER JOIN "Lead" lead ON lead."id" = event."leadId"
        WHERE lead."assignedUserId" = ${userId}
          AND event."occurredAt" >= ${startOfToday}
      `,
    ]);

    const [activityMetricsRow] = activityMetrics;
    const workedLeads = Number(activityMetricsRow?.workedLeads ?? BigInt(0));
    const calls = Number(activityMetricsRow?.calls ?? BigInt(0));
    const whatsapp = Number(activityMetricsRow?.whatsapp ?? BigInt(0));
    const responded = Number(activityMetricsRow?.responded ?? BigInt(0));
    const noResponse = Number(activityMetricsRow?.noResponse ?? BigInt(0));
    const interested = Number(activityMetricsRow?.interested ?? BigInt(0));
    const notInterested = Number(activityMetricsRow?.notInterested ?? BigInt(0));

    const myLeadsTotal = leadStats.reduce((sum, s) => sum + s._count.id, 0);
    const myOpenLeads = leadStats
      .filter((s) => ["NEW", "ON_HOLD"].includes(s.status))
      .reduce((sum, s) => sum + s._count.id, 0);
    const myClosedLeads = leadStats
      .filter((s) => ["CONVERTED", "LOST"].includes(s.status))
      .reduce((sum, s) => sum + s._count.id, 0);

    return {
      cards: {
        myLeads: myLeadsTotal,
        myOpenLeads,
        myClosedLeads,
      },
      attention: {
        todayFollowUpCount,
        overdueFollowUpCount,
        weekFollowUpCount,
        newLeadCount,
        needsAttentionCount: needsAttentionItems.length,
      },
      pipeline: leadStats.map((s) => ({ status: s.status, count: s._count.id })),
      priorities: priorityStats.map((s) => ({ priority: s.priority, count: s._count.id })),
      upcomingFollowUps: upcomingFollowUps.map((f) => ({
        id: f.id,
        title: f.title,
        dueDate: f.dueDate!.toISOString(),
        dueTime: f.dueTime,
        leadId: f.lead.id,
        leadName: f.lead.displayName,
        leadNumber: f.lead.leadNumber,
        company: f.lead.company,
        priority: f.lead.priority,
        category: f.lead.category,
      })),
      insights: {
        workedLeads,
        calls,
        whatsapp,
        responded,
        noResponse,
        interested,
        notInterested,
      },
    };

  }
}

export const dashboardService = new DashboardService();
