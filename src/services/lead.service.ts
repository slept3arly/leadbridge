import type { z } from "zod";
import type { UserRole, SalesPrivilege, LeadStatus, LeadPriority, LeadCategory } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfTodayUTC, endOfTodayUTC } from "@/lib/utils";
import { containsSearch, dateRange, listResult, pagination, type ListQuery } from "@/lib/query-builder";
import { ServiceError } from "@/lib/service-errors";
import { leadSchema } from "@/lib/validation";
import { activityEventService } from "@/services/activity-event.service";
import { duplicateService } from "@/services/duplicate.service";
import { can, Permission } from "@/lib/permissions";

export type LeadInput = z.infer<typeof leadSchema>;
type Actor = { id: string; role: UserRole; salesPrivilege?: SalesPrivilege | null };

const leadListSelect = {
  id: true, leadNumber: true, displayName: true, company: true,
  email: true, phone: true, city: true, state: true,
  product: true, requirement: true,
  status: true, priority: true, category: true, createdAt: true, updatedAt: true,
  nextFollowUpAt: true, lastFollowUpAt: true,
  assignedUser: { select: { id: true, name: true } },
  source: { select: { id: true, name: true } },
  followUps: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { status: true, dueDate: true, completedAt: true },
  },
} as const;

const leadDetailSelect = {
  id: true, leadNumber: true, displayName: true, company: true,
  email: true, phone: true, alternatePhone: true, address: true,
  city: true, state: true, country: true, industry: true,
  website: true, jobTitle: true, budget: true, expectedValue: true,
  currency: true, campaign: true, campaignId: true,
  utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true,
  sourceReferenceId: true, sourceName: true, sourceType: true,
  parserVersion: true, receivedAt: true, importedAt: true,
  firstContactedAt: true, lastContactedAt: true, nextFollowUpAt: true,
  closedAt: true, lostReason: true, wonAmount: true,
  status: true, priority: true, category: true, product: true, requirement: true,
  lastFollowUpAt: true, isArchived: true, isDeleted: true,
  customFields: true, rawPayload: true,
  sourceId: true, connectorId: true,
  createdAt: true, updatedAt: true, deletedAt: true,
  assignedUser: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  deletedBy: { select: { id: true, name: true } },
  source: { select: { id: true, name: true, sourceType: true } },
  connector: { select: { id: true, name: true, type: true } },
} as const;

function toApiLead<T extends { displayName: string }>(lead: T) {
  return { ...lead, name: lead.displayName };
}

export type CreateLeadResult =
  | { status: "created"; lead: { id: string } }
  | { status: "skipped"; reason: string };

export class LeadService {
  private accessWhere(actor?: Actor) {
    return actor?.role === "SALES" ? { assignedUserId: actor.id } : {};
  }

  private async assertAssignableUser(assignedUserId: string | null | undefined, actor: Actor) {
    if (assignedUserId === undefined) return;
    if (actor.role !== "ADMIN") throw new ServiceError("Only admins can assign leads.", 403);
    if (assignedUserId === null) return;

    const assignee = await prisma.user.findFirst({
      where: { id: assignedUserId, role: "SALES", active: true, isDeleted: false },
      select: { id: true },
    });
    if (!assignee) throw new ServiceError("Assigned user is not an active sales user.", 400);
  }

  private async assertAccess(id: string, actor: Actor, includeDeleted = false) {
    const lead = await prisma.lead.findFirst({
      where: { id, ...(includeDeleted ? {} : { isDeleted: false }), ...this.accessWhere(actor) },
      select: { id: true, status: true, assignedUserId: true, nextFollowUpAt: true, isDeleted: true },
    });
    if (!lead) throw new ServiceError("Lead not found or access denied.", 404);
    return lead;
  }

  async getById(id: string, actor?: Actor) {
    const lead = await prisma.lead.findFirst({
      where: { id, isDeleted: false, ...this.accessWhere(actor) },
      select: leadDetailSelect,
    });
    if (!lead) throw new ServiceError("Lead not found or access denied.", 404);
    return toApiLead(lead);
  }

  async list(userId?: string) {
    const leads = await prisma.lead.findMany({
      where: { ...(userId ? { assignedUserId: userId } : {}), isDeleted: false },
      select: leadListSelect,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return leads.map(toApiLead);
  }

  async listPage(query: ListQuery, actor?: Actor) {
    const assignedUserFilter = actor?.role === "SALES"
      ? { assignedUserId: actor.id }
      : query.filters.assignedUserId?.length
        ? query.filters.assignedUserId.includes("unassigned")
          ? { assignedUserId: null }
          : { assignedUserId: { in: query.filters.assignedUserId.filter((v) => v !== "unassigned") } }
        : {};

    const archivedFilter = query.filters.archived?.includes("true")
      ? { isArchived: true }
      : { isArchived: false };

    const followUpFilter = query.filters.followUp?.length
      ? (() => {
          const now = new Date();
          const startOfToday = startOfTodayUTC();
          const endOfToday = endOfTodayUTC();
          const filterVal = query.filters.followUp[0];
          if (filterVal === "overdue") return { nextFollowUpAt: { not: null, lt: now } };
          if (filterVal === "today") return { nextFollowUpAt: { not: null, gte: startOfToday, lte: endOfToday } };
          if (filterVal === "upcoming") return { nextFollowUpAt: { not: null, gte: now } };
          if (filterVal === "new") return { notes: { none: {} }, followUps: { none: {} } };
          return {};
        })()
      : {};

    const activityDateVal = query.filters.activityDate?.[0];

    const activityFilterActive = Boolean(
      activityDateVal ||
      query.filters.activityAction?.length ||
      query.filters.activityResponse?.length ||
      query.filters.activityInterest?.length,
    );

    const activityDateWhere = (() => {
      if (activityDateVal === "today") {
        const startOfToday = startOfTodayUTC();
        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        return { gte: startOfToday, lt: startOfTomorrow };
      }
      if (activityDateVal === "yesterday") {
        const startOfToday = startOfTodayUTC();
        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        return { gte: startOfYesterday, lt: startOfToday };
      }
      if (activityDateVal === "custom" || (!activityDateVal && (query.dateFrom || query.dateTo))) {
        if (!query.dateFrom && !query.dateTo) return undefined;
        return {
          ...(query.dateFrom ? { gte: query.dateFrom } : {}),
          ...(query.dateTo ? { lte: query.dateTo } : {}),
        };
      }
      return undefined;
    })();

    const activityFilter = activityFilterActive
      ? {
          activityEvents: {
            some: {
              ...(activityDateWhere ? { occurredAt: activityDateWhere } : {}),
              entries: {
                some: {
                  type: { in: ["CALL", "WHATSAPP"] as ("CALL" | "WHATSAPP")[] },
                  ...(query.filters.activityAction?.length ? { action: { in: query.filters.activityAction as ("CALL" | "WHATSAPP")[] } } : {}),
                  ...(query.filters.activityResponse?.length ? { response: { in: query.filters.activityResponse as ("PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED")[] } } : {}),
                  ...(query.filters.activityInterest?.length ? { interest: { in: query.filters.activityInterest as ("INTERESTED" | "NOT_INTERESTED")[] } } : {}),
                },
              },
            },
          },
        }
      : {};

    const leadDateFilter = !activityDateVal && (query.dateFrom || query.dateTo)
      ? dateRange("createdAt", query)
      : {};

    const where = {
      isDeleted: query.filters.deleted?.includes("true") ?? false,
      ...archivedFilter,
      ...this.accessWhere(actor),
      ...(query.filters.status?.length ? { status: { in: query.filters.status as LeadStatus[] } } : {}),
      ...(query.filters.priority?.length ? { priority: { in: query.filters.priority as LeadPriority[] } } : {}),
      ...(query.filters.category?.length ? { category: { in: query.filters.category as LeadCategory[] } } : {}),
      ...(query.filters.source?.length ? { sourceId: { in: query.filters.source } } : {}),
      ...assignedUserFilter,
      ...followUpFilter,
      ...activityFilter,
      ...containsSearch(["displayName", "company", "email", "phone", "leadNumber"], query.search),
      ...leadDateFilter,
    };
    const orderBy = ["createdAt", "updatedAt", "displayName", "status", "priority", "category", "nextFollowUpAt"].includes(query.sortBy ?? "")
      ? { [query.sortBy!]: query.sortDirection }
      : { updatedAt: "desc" as const };
    const [data, total] = await Promise.all([
      prisma.lead.findMany({ where, select: leadListSelect, orderBy, ...pagination(query) }),
      prisma.lead.count({ where }),
    ]);

    const leadIds = data.map((l) => l.id);

    type LastActivityEntry = { type: string; action: string | null; response: string | null };
    type LastActivityResult = { occurredAt: Date; entries: LastActivityEntry[] } | null;
    const lastActivityMap = new Map<string, LastActivityResult>();

    if (leadIds.length > 0) {
      const latestEvents = await prisma.$queryRaw<{ leadId: string; eventId: string; occurredAt: Date }[]>`
        SELECT DISTINCT ON (e."leadId") e."leadId", e."id" AS "eventId", e."occurredAt"
        FROM "ActivityEvent" e
        INNER JOIN "ActivityEntry" en ON en."eventId" = e."id"
        WHERE e."leadId" IN (${Prisma.join(leadIds)})
          AND en."type" IN ('CALL', 'WHATSAPP', 'FOLLOW_UP_SCHEDULED', 'FOLLOW_UP_RESCHEDULED', 'FOLLOW_UP_COMPLETED', 'FOLLOW_UP_CANCELLED')
        ORDER BY e."leadId", e."occurredAt" DESC
      `;

      if (latestEvents.length > 0) {
        const eventIds = latestEvents.map((e) => e.eventId);

        const eventEntries = await prisma.$queryRaw<{ eventId: string; entryType: string; action: string | null; response: string | null }[]>`
          SELECT en."eventId", en."type" AS "entryType", en."action", en."response"
          FROM "ActivityEntry" en
          WHERE en."eventId" IN (${Prisma.join(eventIds)})
            AND en."type" IN ('CALL', 'WHATSAPP', 'FOLLOW_UP_SCHEDULED', 'FOLLOW_UP_RESCHEDULED', 'FOLLOW_UP_COMPLETED', 'FOLLOW_UP_CANCELLED')
        `;

        const entriesByEvent = new Map<string, LastActivityEntry[]>();
        for (const entry of eventEntries) {
          const list = entriesByEvent.get(entry.eventId) ?? [];
          list.push({ type: entry.entryType, action: entry.action, response: entry.response });
          entriesByEvent.set(entry.eventId, list);
        }

        for (const event of latestEvents) {
          lastActivityMap.set(event.leadId, {
            occurredAt: event.occurredAt,
            entries: entriesByEvent.get(event.eventId) ?? [],
          });
        }
      }
    }

    const enriched = data.map((lead) => ({
      ...toApiLead(lead),
      lastActivity: lastActivityMap.get(lead.id) ?? null,
    }));

    return listResult(enriched, total, query);
  }

  async stats(userId?: string) {
    const where = { ...(userId ? { assignedUserId: userId } : {}), isDeleted: false };
    const [total, active] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: { in: ["NEW", "ON_HOLD"] } } }),
    ]);
    return { total, active };
  }

  async listFollowUps(actor: Actor) {
    const leads = await prisma.lead.findMany({
      where: { isDeleted: false, nextFollowUpAt: { not: null }, ...this.accessWhere(actor) },
      select: leadListSelect,
      orderBy: { nextFollowUpAt: "asc" },
      take: 100,
    });
    return leads.map(toApiLead);
  }

  async create(data: LeadInput, actor: Actor): Promise<CreateLeadResult> {
    if (!can(actor, Permission.CREATE_LEAD)) {
      throw new ServiceError("You do not have permission to create leads.", 403);
    }
    if (actor.role === "SALES" && data.assignedUserId && data.assignedUserId !== actor.id) {
      throw new ServiceError("Only admins can assign leads.", 403);
    }
    await this.assertAssignableUser(data.assignedUserId, actor);

    const assignedUserId = actor.role === "SALES" ? (data.assignedUserId ?? actor.id) : data.assignedUserId;

    if (data.connectorId && data.sourceReferenceId) {
      const existing = await prisma.lead.findFirst({
        where: {
          connectorId: data.connectorId,
          sourceReferenceId: data.sourceReferenceId,
          isDeleted: false,
        },
        select: { id: true },
      });
      if (existing) {
        return { status: "skipped", reason: "Duplicate lead detected." };
      }
    }

    const duplicates = await duplicateService.findPotentialDuplicates(data);
    const { name, customFields, rawPayload, status, priority, category, ...rest } = data;
    return prisma.$transaction(async (tx) => {
      try {
        const lead = await tx.lead.create({
          data: {
            ...rest,
            displayName: name,
            status: status as LeadStatus,
            priority: (priority ?? "MEDIUM") as LeadPriority,
            category: (category ?? null) as LeadCategory | null,
            createdById: actor.id,
            assignedUserId: assignedUserId ?? null,
            ...(customFields === null ? { customFields: Prisma.JsonNull } : customFields === undefined ? {} : { customFields: customFields as Prisma.InputJsonValue }),
            ...(rawPayload === null ? { rawPayload: Prisma.JsonNull } : rawPayload === undefined ? {} : { rawPayload: rawPayload as Prisma.InputJsonValue }),
          },
          select: leadListSelect,
        });
        await activityEventService.createEvent({
          leadId: lead.id,
          type: "SYSTEM",
          actorId: actor.id,
          entries: [
            {
              type: "CREATED",
              message: "Lead created",
              metadata: duplicates.length ? { duplicateCandidates: duplicates } : undefined,
            },
          ],
        }, tx);
        return { status: "created", lead: toApiLead(lead) };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { status: "skipped", reason: "Duplicate lead detected (concurrent insert)." };
        }
        throw error;
      }
    });
  }

  async update(id: string, data: Partial<LeadInput>, actor: Actor) {
    const existing = await this.assertAccess(id, actor);
    if ("isArchived" in data && !can(actor, Permission.ARCHIVE_LEAD)) {
      throw new ServiceError("You do not have permission to archive leads.", 403);
    }
    await this.assertAssignableUser(data.assignedUserId, actor);
    const { name, customFields, rawPayload, status, priority, category, ...rest } = data;
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id },
        data: {
          ...rest,
          ...(name === undefined ? {} : { displayName: name }),
          ...(status === undefined ? {} : { status: status as LeadStatus }),
          ...(priority === undefined ? {} : { priority: priority as LeadPriority }),
          ...(category === undefined ? {} : { category: category as LeadCategory | null }),
          ...(customFields === null ? { customFields: Prisma.JsonNull } : customFields === undefined ? {} : { customFields: customFields as Prisma.InputJsonValue }),
          ...(rawPayload === null ? { rawPayload: Prisma.JsonNull } : rawPayload === undefined ? {} : { rawPayload: rawPayload as Prisma.InputJsonValue }),
          updatedById: actor.id,
        },
        select: leadListSelect,
      });
      const statusChanged = status && status !== existing.status;

      if (statusChanged) {
        await activityEventService.createEvent({
          leadId: id,
          type: "SYSTEM",
          actorId: actor.id,
          entries: [
            {
              type: "STATUS_CHANGED",
              message: `Status changed to ${status}`,
              metadata: { from: existing.status, to: status },
            },
          ],
        }, tx);
      } else {
        await activityEventService.createEvent({
          leadId: id,
          type: "SYSTEM",
          actorId: actor.id,
          entries: [
            {
              type: "UPDATED",
              message: "Lead updated",
            },
          ],
        }, tx);
      }

      if (data.nextFollowUpAt !== undefined) {
        await activityEventService.createEvent({
          leadId: id,
          type: "SYSTEM",
          actorId: actor.id,
          entries: [
            {
              type: "UPDATED",
              message: data.nextFollowUpAt ? "Follow-up scheduled" : "Follow-up cleared",
              metadata: { nextFollowUpAt: data.nextFollowUpAt?.toISOString() ?? null },
            },
          ],
        }, tx);
      }
      return toApiLead(lead);
    });
  }

  async assign(id: string, assignedUserId: string | null, actor: Actor) {
    await this.assertAccess(id, actor);
    await this.assertAssignableUser(assignedUserId, actor);
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id }, data: { assignedUserId, updatedById: actor.id }, select: leadListSelect });
      await activityEventService.createEvent({
        leadId: id,
        type: "SYSTEM",
        actorId: actor.id,
        entries: [
          {
            type: "ASSIGNED",
            message: assignedUserId ? "Lead assigned" : "Lead unassigned",
            metadata: { assignedUserId },
          },
        ],
      }, tx);
      return toApiLead(lead);
    });
  }

  async remove(id: string, actor: Actor) {
    if (!can(actor, Permission.DELETE_LEAD)) throw new ServiceError("You do not have permission to delete leads.", 403);
    await this.assertAccess(id, actor);
    await prisma.$transaction(async (tx) => {
      await tx.lead.delete({ where: { id } });
    });
  }


}

export const leadService = new LeadService();
