import type { z } from "zod";
import type { UserRole, SalesPrivilege, LeadStatus, LeadPriority, LeadCategory } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfTodayUTC, endOfTodayUTC } from "@/lib/utils";
import { containsSearch, dateRange, listResult, pagination, type ListQuery } from "@/lib/query-builder";
import { ServiceError } from "@/lib/service-errors";
import { interactionActivitySchema, leadSchema } from "@/lib/validation";
import { activityEventService } from "@/services/activity-event.service";
import { duplicateService } from "@/services/duplicate.service";
import { can, Permission } from "@/lib/permissions";
import type { ExecutionFence } from "@/services/execution-fence";
import { assertExecutionFence } from "@/services/execution-fence";
import { followUpService } from "@/services/follow-up.service";

export type LeadInput = z.infer<typeof leadSchema>;
type InitialActivityInput = z.infer<typeof interactionActivitySchema>;
type CreateLeadInput = LeadInput & { initialActivity?: InitialActivityInput };
export type LeadActor = { id: string; role: UserRole; salesPrivilege?: SalesPrivilege | null };
type Actor = LeadActor;
export type PreparedLeadCreation = {
  assignedUserId: string | null;
  duplicateCandidates: unknown[];
};

export type LeadFieldChange = { field: string; from: unknown; to: unknown };

function comparableLeadValue(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toString();
  }
  if (Array.isArray(value)) return value.map(comparableLeadValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, comparableLeadValue(child)]));
  }
  return value;
}

function historyValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toString();
  return value;
}

const leadListSelect = {
  id: true, leadNumber: true, displayName: true, company: true,
  email: true, phone: true, city: true, state: true,
  requirement: true,
  status: true, priority: true, category: true, createdAt: true, updatedAt: true,
  nextFollowUpAt: true, lastFollowUpAt: true, isArchived: true,
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
  status: true, priority: true, category: true, requirement: true,
  lastFollowUpAt: true, isArchived: true, isDeleted: true,
  customFields: true,
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
  | { status: "created"; lead: { id: string }; interactionEventId: string | null; followUp: unknown | null; affectedUserIds: string[] }
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

  /** Apply a normalized patch with optimistic concurrency inside the caller's transaction. */
  async updateFieldsInTransaction(
    tx: Prisma.TransactionClient,
    existing: Prisma.LeadGetPayload<Record<string, never>>,
    data: Partial<LeadInput>,
    actorId: string,
  ) {
    const updateData: Record<string, unknown> = {};
    const changes: LeadFieldChange[] = [];

    for (const [field, value] of Object.entries(data)) {
      const persistedField = field === "name" ? "displayName" : field;
      const previous = (existing as unknown as Record<string, unknown>)[persistedField];
      if (JSON.stringify(comparableLeadValue(previous)) === JSON.stringify(comparableLeadValue(value))) continue;
      changes.push({ field, from: historyValue(previous), to: historyValue(value) });

      if (field === "customFields" || field === "rawPayload") {
        updateData[field] = value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
      } else {
        updateData[persistedField] = value;
      }
    }

    if (changes.length === 0) return { lead: existing, changes };

    const result = await tx.lead.updateMany({
      where: { id: existing.id, isDeleted: false, updatedAt: existing.updatedAt },
      data: { ...updateData, updatedById: actorId } as Prisma.LeadUpdateManyMutationInput,
    });
    if (result.count !== 1) {
      throw new ServiceError("Lead changed while this request was being processed. Reload and try again.", 409);
    }

    const lead = await tx.lead.findUniqueOrThrow({ where: { id: existing.id } });
    return { lead, changes };
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

  async create(data: CreateLeadInput, actor: Actor, executionFence?: ExecutionFence): Promise<CreateLeadResult> {
    const prepared = await this.prepareCreate(data, actor);
    if ("status" in prepared) return prepared;
    try {
      return await prisma.$transaction((tx) => this.createInTransaction(tx, data, actor, prepared, executionFence));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: "skipped", reason: "Duplicate lead detected (concurrent insert)." };
      }
      throw error;
    }
  }

  async prepareCreate(data: CreateLeadInput, actor: Actor): Promise<PreparedLeadCreation | Extract<CreateLeadResult, { status: "skipped" }>> {
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

    const duplicateCandidates = await duplicateService.findPotentialDuplicates(data);
    return { assignedUserId: assignedUserId ?? null, duplicateCandidates };
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    data: CreateLeadInput,
    actor: Actor,
    prepared: PreparedLeadCreation,
    executionFence?: ExecutionFence,
  ): Promise<CreateLeadResult> {
    const { assignedUserId, duplicateCandidates } = prepared;
    const { name, customFields, rawPayload, status, priority, category, initialActivity, ...rest } = data;
    if (executionFence) await assertExecutionFence(tx, executionFence);
    const lead = await tx.lead.create({
      data: {
        ...rest,
        displayName: name,
        status: status as LeadStatus,
        priority: (priority ?? "MEDIUM") as LeadPriority,
        category: (category ?? null) as LeadCategory | null,
        createdById: actor.id === "system" ? null : actor.id,
        assignedUserId: assignedUserId ?? null,
        ...(customFields === null ? { customFields: Prisma.JsonNull } : customFields === undefined ? {} : { customFields: customFields as Prisma.InputJsonValue }),
        ...(rawPayload === null ? { rawPayload: Prisma.JsonNull } : rawPayload === undefined ? {} : { rawPayload: rawPayload as Prisma.InputJsonValue }),
      },
      select: leadListSelect,
    });
    await activityEventService.createEvent({
      leadId: lead.id,
      type: "SYSTEM",
      actorId: actor.id === "system" ? null : actor.id,
      entries: [{
        type: "CREATED",
        message: "Lead created",
        metadata: duplicateCandidates.length ? { duplicateCandidates } : undefined,
      }],
    }, tx);

    let interactionEventId: string | null = null;
    let createdFollowUp: unknown | null = null;
    if (initialActivity) {
      const entries: import("@/services/activity-event.service").ActivityEntryInput[] = [{
        type: initialActivity.action,
        action: initialActivity.action,
        response: initialActivity.response,
        interest: initialActivity.interest,
        message: initialActivity.notes || `${initialActivity.action} - ${initialActivity.response.replaceAll("_", " ")}${initialActivity.interest ? ` (${initialActivity.interest.replaceAll("_", " ")})` : ""}`,
        metadata: initialActivity.notes ? { notes: initialActivity.notes } : undefined,
      }];

      if (initialActivity.scheduleFollowUp && initialActivity.followUpDate) {
        const followUpResult = await followUpService.create({
          leadId: lead.id,
          title: `${initialActivity.action === "CALL" ? "Call" : "WhatsApp"} follow-up`,
          description: null,
          dueDate: initialActivity.followUpDate,
          dueTime: initialActivity.followUpTime,
          assignedUserId: assignedUserId ?? actor.id,
        }, actor, tx, false);

        createdFollowUp = followUpResult.followUp;
        entries.push({
          type: "FOLLOW_UP_SCHEDULED",
          followUpId: followUpResult.followUp.id,
          message: "Follow-up scheduled",
          metadata: { dueDate: initialActivity.followUpDate, dueTime: initialActivity.followUpTime ?? null },
        });
      }

      const interactionEvent = await activityEventService.createEvent({
        leadId: lead.id,
        type: "INTERACTION",
        actorId: actor.id,
        entries,
      }, tx);
      interactionEventId = interactionEvent.id;
    }

    const createdLead = createdFollowUp
      ? await tx.lead.findUniqueOrThrow({ where: { id: lead.id }, select: leadListSelect })
      : lead;
    return {
      status: "created",
      lead: toApiLead(createdLead),
      interactionEventId,
      followUp: createdFollowUp,
      affectedUserIds: assignedUserId ? [assignedUserId] : [],
    };
  }

  async update(id: string, data: Partial<LeadInput>, actor: Actor) {
    if (data.nextFollowUpAt !== undefined) {
      throw new ServiceError("Follow-up dates must be changed through follow-up operations.", 400);
    }
    return prisma.$transaction(async (tx) => {
      const existing = await tx.lead.findFirst({
        where: { id, isDeleted: false, ...this.accessWhere(actor) },
      });
      if (!existing) throw new ServiceError("Lead not found or access denied.", 404);
      if ("isArchived" in data && !can(actor, Permission.ARCHIVE_LEAD)) {
        throw new ServiceError("You do not have permission to archive leads.", 403);
      }
      await this.assertAssignableUser(data.assignedUserId, actor);

      const { changes } = await this.updateFieldsInTransaction(tx, existing, data, actor.id);
      const lead = await tx.lead.findUniqueOrThrow({ where: { id }, select: leadListSelect });
      if (changes.length > 0) {
        const statusChange = changes.find((change) => change.field === "status");
        const otherChanges = changes.filter((change) => change.field !== "status");
        const entries: import("@/services/activity-event.service").ActivityEntryInput[] = [];
        if (statusChange) {
          entries.push({
            type: "STATUS_CHANGED",
            message: `Status changed to ${String(statusChange.to)}`,
            metadata: { from: statusChange.from, to: statusChange.to },
          });
        }
        if (otherChanges.length > 0) {
          entries.push({
            type: "UPDATED",
            message: "Lead updated",
            metadata: { changes: otherChanges },
          });
        }
        await activityEventService.createEvent({ leadId: id, type: "SYSTEM", actorId: actor.id, entries }, tx);
      }

      return {
        lead: toApiLead(lead),
        changed: changes.length > 0,
        affectedUserIds: Array.from(new Set([existing.assignedUserId, lead.assignedUser?.id].filter((id): id is string => Boolean(id)))),
      };
    });
  }

  async assign(id: string, assignedUserId: string | null, actor: Actor) {
    const existing = await this.assertAccess(id, actor);
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
      return {
        lead: toApiLead(lead),
        affectedUserIds: Array.from(new Set([existing.assignedUserId, assignedUserId].filter((userId): userId is string => Boolean(userId)))),
      };
    });
  }

  async remove(id: string, actor: Actor) {
    if (!can(actor, Permission.DELETE_LEAD)) throw new ServiceError("You do not have permission to delete leads.", 403);
    const existing = await this.assertAccess(id, actor);
    await prisma.$transaction(async (tx) => {
      await tx.lead.delete({ where: { id } });
    });
    return { affectedUserIds: existing.assignedUserId ? [existing.assignedUserId] : [] };
  }


}

export const leadService = new LeadService();
