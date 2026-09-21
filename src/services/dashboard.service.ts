import { prisma } from "@/lib/prisma";
import { startOfTodayUTC, endOfTodayUTC } from "@/lib/utils";
import { reportService } from "./report.service";
import { attentionService } from "./attention.service";

export class DashboardService {
  async admin() {
    const today = startOfTodayUTC();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const now = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      totalLeads,
      activeLeads,
      newToday,
      won,
      lost,
      unassigned,
      statusBreakdown,
      leadSources,
      connectorHealth,
      recentActivity,
      recentSyncs,
      pendingParserRequests,
      unmatchedCount,
      bySalesperson,
      inactiveConnectors,
      recentFailedSyncs,
      duplicateEmails,
      inactiveUsers,
    ] = await Promise.all([
      prisma.lead.count({ where: { isDeleted: false } }),
      prisma.lead.count({ where: { isDeleted: false, status: { in: ["NEW", "ON_HOLD"] } } }),
      prisma.lead.count({ where: { createdAt: { gte: today }, isDeleted: false } }),
      prisma.lead.count({ where: { status: "CONVERTED", isDeleted: false } }),
      prisma.lead.count({ where: { status: "LOST", isDeleted: false } }),
      prisma.lead.count({ where: { assignedUserId: null, isDeleted: false } }),
      reportService.statusBreakdown(),
      reportService.leadSources({ from: thirtyDaysAgo, to: now }),
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
      prisma.parserRequest.count({ where: { status: "OPEN" } }),
      prisma.unmatchedEmail.count({ where: { status: "UNMATCHED" } }),
      prisma.lead.groupBy({ by: ["assignedUserId"], where: { isDeleted: false, assignedUserId: { not: null } }, _count: { id: true } }),
      prisma.connector.count({ where: { enabled: false } }),
      prisma.connectorSyncRun.count({ where: { status: "ERROR", startedAt: { gte: yesterday } } }),
      prisma.lead.groupBy({ by: ["email"], where: { email: { not: null }, isDeleted: false }, _count: { id: true }, having: { id: { _count: { gt: 1 } } } }),
      prisma.user.count({ where: { active: false } }),
    ]);

    const salesUserIds = bySalesperson.map((r) => r.assignedUserId!).filter(Boolean);
    const salesUsers = salesUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: salesUserIds } }, select: { id: true, name: true } })
      : [];

    const yesterdayNew = await prisma.lead.count({ where: { createdAt: { gte: yesterday, lt: today }, isDeleted: false } });
    const trend = newToday - yesterdayNew;

    return {
      cards: {
        totalLeads,
        activeLeads,
        newToday,
        won,
        lost,
        unassigned,
      },
      charts: {
        statusBreakdown,
        leadSources: {
          byProvider: leadSources.byProvider,
          byConnector: leadSources.byConnector,
        },
        salespersonLoad: bySalesperson.map((r) => ({
          userId: r.assignedUserId,
          userName: salesUsers.find((u) => u.id === r.assignedUserId)?.name ?? "Unknown",
          leadCount: r._count.id,
        })),
      },
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
      pending: {
        parserRequests: pendingParserRequests,
        unmatchedEmails: unmatchedCount,
      },
      insights: {
        newToday,
        trend,
        unassigned,
        inactiveConnectors,
        recentFailedSyncs,
        duplicateEmails: duplicateEmails.length,
        inactiveUsers,
        unhealthyConnectors: connectorHealth.filter((c) => c.healthStatus !== "HEALTHY").length,
      },
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

    const activityTodayWhere = { event: { lead: { assignedUserId: userId }, occurredAt: { gte: startOfToday } } };

    const countDistinctLeads = async (where: Record<string, unknown>): Promise<number> => {
      const entries = await prisma.activityEntry.findMany({
        where,
        select: { event: { select: { leadId: true } } },
      });
      return new Set(entries.map((e) => e.event.leadId)).size;
    };

    const [
      leadStats,
      priorityStats,
      upcomingFollowUps,
      overdueFollowUpCount,
      todayFollowUpCount,
      weekFollowUpCount,
      newLeadCount,
      needsAttentionItems,
      workedLeads,
      calls,
      whatsapp,
      responded,
      noResponse,
      interested,
      notInterested,
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
        },
      }),
      prisma.lead.count({
        where: { ...leadWhere, notes: { none: {} }, followUps: { none: {} } },
      }),
      attentionService.getNeedsAttention(userId),
      countDistinctLeads({
        type: { in: ["CALL", "WHATSAPP"] },
        ...activityTodayWhere,
      }),
      countDistinctLeads({
        type: "CALL",
        action: "CALL",
        ...activityTodayWhere,
      }),
      countDistinctLeads({
        type: "WHATSAPP",
        action: "WHATSAPP",
        ...activityTodayWhere,
      }),
      countDistinctLeads({
        OR: [
          { type: "CALL", action: "CALL", response: "PICKED_UP" },
          { type: "WHATSAPP", action: "WHATSAPP", response: "REPLIED" },
        ],
        ...activityTodayWhere,
      }),
      countDistinctLeads({
        OR: [
          { type: "CALL", action: "CALL", response: "NO_RESPONSE" },
          { type: "WHATSAPP", action: "WHATSAPP", response: "NO_RESPONSE" },
        ],
        ...activityTodayWhere,
      }),
      countDistinctLeads({
        interest: "INTERESTED",
        ...activityTodayWhere,
      }),
      countDistinctLeads({
        interest: "NOT_INTERESTED",
        ...activityTodayWhere,
      }),
    ]);

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
