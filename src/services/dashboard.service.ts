import { prisma } from "@/lib/prisma";
import { reportService } from "./report.service";
import { attentionService } from "./attention.service";

export class DashboardService {
  async admin() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const now = new Date();

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
      prisma.leadActivity.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { id: true, name: true } }, lead: { select: { id: true, displayName: true, leadNumber: true } } } }),
      prisma.connectorSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 5, include: { connector: { select: { id: true, name: true } } } }),
      prisma.parserRequest.count({ where: { status: "OPEN" } }),
      prisma.unmatchedEmail.count({ where: { status: "UNMATCHED" } }),
      prisma.lead.groupBy({ by: ["assignedUserId"], where: { isDeleted: false, assignedUserId: { not: null } }, _count: { id: true } }),
    ]);

    const salesUserIds = bySalesperson.map((r) => r.assignedUserId!).filter(Boolean);
    const salesUsers = salesUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: salesUserIds } }, select: { id: true, name: true } })
      : [];

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
        message: a.message,
        actorName: a.actor?.name ?? "System",
        leadId: a.leadId,
        leadName: a.lead?.displayName ?? "Deleted",
        leadNumber: a.lead?.leadNumber ?? "",
        createdAt: a.createdAt.toISOString(),
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
    };
  }

  async sales(userId: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    const leadWhere = { assignedUserId: userId, isDeleted: false };

    const [
      leadStats,
      upcomingFollowUps,
      overdueFollowUpCount,
      todayFollowUpCount,
      newLeadCount,
      needsAttentionItems,
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ["status"],
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
      prisma.followUp.count({
        where: {
          status: "PENDING",
          dueDate: { not: null, lt: now },
          OR: [{ assignedUserId: userId }, { createdById: userId }],
        },
      }),
      prisma.followUp.count({
        where: {
          status: "PENDING",
          dueDate: { not: null, gte: startOfToday, lte: endOfToday },
          OR: [{ assignedUserId: userId }, { createdById: userId }],
        },
      }),
      prisma.lead.count({
        where: { ...leadWhere, notes: { none: {} }, followUps: { none: {} } },
      }),
      attentionService.getNeedsAttention(userId),
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
        newLeadCount,
        needsAttentionCount: needsAttentionItems.length,
      },
      pipeline: leadStats.map((s) => ({ status: s.status, count: s._count.id })),
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

    };
  }
}

export const dashboardService = new DashboardService();
