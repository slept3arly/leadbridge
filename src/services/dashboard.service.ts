import { prisma } from "@/lib/prisma";
import { reportService } from "./report.service";

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [myLeads, myOpenLeads, myClosedLeads, todayFollowUps, recentNotes, myActivity] = await Promise.all([
      prisma.lead.count({ where: { assignedUserId: userId, isDeleted: false } }),
      prisma.lead.count({ where: { assignedUserId: userId, isDeleted: false, status: { in: ["NEW", "ON_HOLD"] } } }),
      prisma.lead.count({ where: { assignedUserId: userId, isDeleted: false, status: { in: ["CONVERTED", "LOST"] } } }),
      prisma.lead.findMany({
        where: { assignedUserId: userId, isDeleted: false, nextFollowUpAt: { not: null, lte: new Date(new Date().setHours(23, 59, 59, 999)) } },
        select: { id: true, displayName: true, leadNumber: true, nextFollowUpAt: true },
        orderBy: { nextFollowUpAt: "asc" },
        take: 20,
      }),
      prisma.note.findMany({
        where: { authorId: userId, lead: { isDeleted: false } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { lead: { select: { id: true, displayName: true, leadNumber: true } } },
      }),
      prisma.leadActivity.findMany({
        where: { actorId: userId, createdAt: { gte: weekAgo } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { lead: { select: { id: true, displayName: true, leadNumber: true } } },
      }),
    ]);

    return {
      cards: {
        myLeads,
        myOpenLeads,
        myClosedLeads,
      },
      todayFollowUps: todayFollowUps.map((f) => ({
        id: f.id,
        leadName: f.displayName,
        leadNumber: f.leadNumber,
        nextFollowUpAt: f.nextFollowUpAt!.toISOString(),
      })),
      recentNotes: recentNotes.map((n) => ({
        id: n.id,
        content: n.content.slice(0, 200),
        leadName: n.lead.displayName,
        leadNumber: n.lead.leadNumber,
        createdAt: n.createdAt.toISOString(),
      })),
      myActivity: myActivity.map((a) => ({
        id: a.id,
        type: a.type,
        message: a.message,
        leadName: a.lead?.displayName ?? "Deleted",
        leadNumber: a.lead?.leadNumber ?? "",
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}

export const dashboardService = new DashboardService();
