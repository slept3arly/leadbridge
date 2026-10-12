import { prisma } from "@/lib/prisma";
import { startOfTodayUTC, endOfTodayUTC } from "@/lib/utils";
import { reportService } from "./report.service";
import { attentionService } from "./attention.service";
import { salesFollowUpLeadScope } from "@/services/follow-up-policy";

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
      activityEntriesToday,
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
      prisma.activityEntry.findMany({
        where: {
          OR: [
            { type: "CALL", action: "CALL" },
            { type: "WHATSAPP", action: "WHATSAPP" },
          ],
          event: { occurredAt: { gte: today, lte: todayEnd } },
        },
        select: {
          type: true,
          action: true,
          response: true,
          event: { select: { leadId: true, actorId: true } },
        },
      }),
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
      workedLeadIds: new Set<string>(),
      calls: 0,
      whatsapp: 0,
      responses: 0,
    }]));
    let callsLogged = 0;
    let whatsappLogged = 0;
    let responseEntries = 0;
    const allWorkedLeadIds = new Set<string>();

    for (const entry of activityEntriesToday) {
      const isCall = entry.type === "CALL" && entry.action === "CALL";
      const isWhatsApp = entry.type === "WHATSAPP" && entry.action === "WHATSAPP";
      const isResponse = (isCall && entry.response === "PICKED_UP")
        || (isWhatsApp && entry.response === "REPLIED");

      allWorkedLeadIds.add(entry.event.leadId);
      if (isCall) callsLogged += 1;
      if (isWhatsApp) whatsappLogged += 1;
      if (isResponse) responseEntries += 1;

      const actorStats = entry.event.actorId ? salespersonActivity.get(entry.event.actorId) : undefined;
      if (!actorStats) continue;
      actorStats.workedLeadIds.add(entry.event.leadId);
      if (isCall) actorStats.calls += 1;
      if (isWhatsApp) actorStats.whatsapp += 1;
      if (isResponse) actorStats.responses += 1;
    }
    const workedLeads = allWorkedLeadIds.size;

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
          workedToday: activity.workedLeadIds.size,
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
