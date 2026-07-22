import { prisma } from "@/lib/prisma";

export type PendingFollowUpItem = {
  followUpId: string;
  followUpTitle: string;
  dueDate: string;
  dueTime: string | null;
  daysOverdue: number;
  lead: {
    id: string;
    displayName: string;
    company: string | null;
    phone: string | null;
    category: string | null;
    priority: string;
  };
};

export type TodayFollowUpItem = {
  followUpId: string;
  followUpTitle: string;
  dueDate: string;
  dueTime: string | null;
  lead: {
    id: string;
    displayName: string;
    company: string | null;
    phone: string | null;
    category: string | null;
    priority: string;
  };
};

export type NewLeadItem = {
  id: string;
  displayName: string;
  company: string | null;
  phone: string | null;
  category: string | null;
  priority: string;
  createdAt: string;
  source: { name: string } | null;
  createdBy: { name: string } | null;
};

export type NeedsAttentionItem = {
  id: string;
  displayName: string;
  company: string | null;
  phone: string | null;
  category: string | null;
  priority: string;
  lastActivityDate: string;
  daysSinceActivity: number;
  source: { name: string } | null;
};

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export class AttentionService {
  async getPendingFollowUps(userId: string): Promise<PendingFollowUpItem[]> {
    const now = new Date();
    const followUps = await prisma.followUp.findMany({
      where: {
        status: "PENDING",
        dueDate: { lt: now },
        OR: [
          { assignedUserId: userId },
          { createdById: userId },
        ],
      },
      orderBy: { dueDate: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        dueDate: true,
        dueTime: true,
        lead: {
          select: {
            id: true,
            displayName: true,
            company: true,
            phone: true,
            category: true,
            priority: true,
          },
        },
      },
    });
    return followUps.map((f) => ({
      followUpId: f.id,
      followUpTitle: f.title,
      dueDate: f.dueDate!.toISOString(),
      dueTime: f.dueTime,
      daysOverdue: daysSince(f.dueDate!),
      lead: f.lead,
    }));
  }

  async getTodayFollowUps(userId: string): Promise<TodayFollowUpItem[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const followUps = await prisma.followUp.findMany({
      where: {
        status: "PENDING",
        dueDate: { gte: todayStart, lte: todayEnd },
        OR: [
          { assignedUserId: userId },
          { createdById: userId },
        ],
      },
      orderBy: { dueDate: "asc" },
      take: 50,
      select: {
        id: true,
        title: true,
        dueDate: true,
        dueTime: true,
        lead: {
          select: {
            id: true,
            displayName: true,
            company: true,
            phone: true,
            category: true,
            priority: true,
          },
        },
      },
    });
    return followUps.map((f) => ({
      followUpId: f.id,
      followUpTitle: f.title,
      dueDate: f.dueDate!.toISOString(),
      dueTime: f.dueTime,
      lead: f.lead,
    }));
  }

  async getNewLeads(userId: string): Promise<NewLeadItem[]> {
    return prisma.lead.findMany({
      where: {
        assignedUserId: userId,
        isDeleted: false,
        notes: { none: {} },
        followUps: { none: {} },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        displayName: true,
        company: true,
        phone: true,
        category: true,
        priority: true,
        createdAt: true,
        source: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }).then((leads) => leads.map((lead) => ({
      id: lead.id,
      displayName: lead.displayName,
      company: lead.company,
      phone: lead.phone,
      category: lead.category,
      priority: lead.priority,
      createdAt: lead.createdAt.toISOString(),
      source: lead.source,
      createdBy: lead.createdBy,
    })));
  }

  async getNeedsAttention(userId: string): Promise<NeedsAttentionItem[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const raw = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      company: string | null;
      phone: string | null;
      category: string | null;
      priority: string;
      lastActivityDate: Date;
      sourceName: string | null;
    }>>`
      SELECT
        l."id",
        l."name",
        l."company",
        l."phone",
        l."category",
        l."priority",
        GREATEST(
          l."updatedAt",
          COALESCE((SELECT MAX(n."createdAt") FROM "Note" n WHERE n."leadId" = l."id"), '1970-01-01'::timestamp),
          COALESCE((SELECT MAX(f."completedAt") FROM "FollowUp" f WHERE f."leadId" = l."id" AND f."status" = 'COMPLETED'), '1970-01-01'::timestamp),
          COALESCE((SELECT MAX(a."createdAt") FROM "LeadActivity" a WHERE a."leadId" = l."id"), '1970-01-01'::timestamp)
        ) as "lastActivityDate",
        s."name" as "sourceName"
      FROM "Lead" l
      LEFT JOIN "LeadSource" s ON s."id" = l."sourceId"
      WHERE l."assignedUserId" = ${userId}
        AND l."isDeleted" = false
      ORDER BY "lastActivityDate" ASC
      LIMIT 20
    `;

    return raw
      .filter((l) => l.lastActivityDate < sevenDaysAgo)
      .map((l) => ({
        id: l.id,
        displayName: l.name,
        company: l.company,
        phone: l.phone,
        category: l.category,
        priority: l.priority,
        lastActivityDate: l.lastActivityDate.toISOString(),
        daysSinceActivity: daysSince(l.lastActivityDate),
        source: l.sourceName ? { name: l.sourceName } : null,
      }));
  }
}

export const attentionService = new AttentionService();
