import type { z } from "zod";
import type { UserRole, LeadStatus, LeadPriority, LeadCategory } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { containsSearch, dateRange, listResult, pagination, type ListQuery } from "@/lib/query-builder";
import { ServiceError } from "@/lib/service-errors";
import { leadSchema } from "@/lib/validation";
import { activityService } from "@/services/activity.service";
import { auditService } from "@/services/audit.service";
import { duplicateService } from "@/services/duplicate.service";

export type LeadInput = z.infer<typeof leadSchema>;
type Actor = { id: string; role: UserRole };

const leadListSelect = {
  id: true, leadNumber: true, displayName: true, company: true,
  email: true, phone: true, city: true, state: true,
  status: true, priority: true, category: true, createdAt: true, updatedAt: true,
  nextFollowUpAt: true, lastFollowUpAt: true,
  assignedUser: { select: { id: true, name: true } },
  source: { select: { id: true, name: true } },
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
        ? { assignedUserId: { in: query.filters.assignedUserId } }
        : {};

    const archivedFilter = query.filters.archived?.includes("true")
      ? { isArchived: true }
      : { isArchived: false };

    const where = {
      isDeleted: query.filters.deleted?.includes("true") ?? false,
      ...archivedFilter,
      ...this.accessWhere(actor),
      ...(query.filters.status?.length ? { status: { in: query.filters.status as LeadStatus[] } } : {}),
      ...(query.filters.priority?.length ? { priority: { in: query.filters.priority as LeadPriority[] } } : {}),
      ...(query.filters.category?.length ? { category: { in: query.filters.category as LeadCategory[] } } : {}),
      ...assignedUserFilter,
      ...containsSearch(["displayName", "company", "email", "phone", "leadNumber"], query.search),
      ...dateRange("createdAt", query),
    };
    const orderBy = ["createdAt", "updatedAt", "displayName", "status", "priority", "category"].includes(query.sortBy ?? "")
      ? { [query.sortBy!]: query.sortDirection }
      : { updatedAt: "desc" as const };
    const [data, total] = await Promise.all([
      prisma.lead.findMany({ where, select: leadListSelect, orderBy, ...pagination(query) }),
      prisma.lead.count({ where }),
    ]);
    return listResult(data.map(toApiLead), total, query);
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

  async create(data: LeadInput, actor: Actor) {
    await this.assertAssignableUser(data.assignedUserId, actor);
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
            ...(customFields === null ? { customFields: Prisma.JsonNull } : customFields === undefined ? {} : { customFields: customFields as Prisma.InputJsonValue }),
            ...(rawPayload === null ? { rawPayload: Prisma.JsonNull } : rawPayload === undefined ? {} : { rawPayload: rawPayload as Prisma.InputJsonValue }),
          },
          select: leadListSelect,
        });
        await activityService.record(lead.id, "CREATED", "Lead created", actor.id, duplicates.length ? { duplicateCandidates: duplicates } : undefined, tx);
        await auditService.log("lead.created", "Lead", lead.id, actor.id, { duplicateCandidates: duplicates.length }, undefined, tx);
        return toApiLead(lead);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ServiceError("Duplicate lead detected.", 409);
        }
        throw error;
      }
    });
  }

  async update(id: string, data: Partial<LeadInput>, actor: Actor) {
    const existing = await this.assertAccess(id, actor);
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
      await activityService.record(id, statusChanged ? "STATUS_CHANGED" : "UPDATED", statusChanged ? `Status changed to ${status}` : "Lead updated", actor.id, statusChanged ? { from: existing.status, to: status } : undefined, tx);
      if (data.nextFollowUpAt !== undefined) {
        await activityService.record(id, "FOLLOW_UP", data.nextFollowUpAt ? "Follow-up scheduled" : "Follow-up cleared", actor.id, { nextFollowUpAt: data.nextFollowUpAt }, tx);
      }
      await auditService.log("lead.updated", "Lead", id, actor.id, undefined, { oldData: existing, newData: data }, tx);
      return toApiLead(lead);
    });
  }

  async assign(id: string, assignedUserId: string | null, actor: Actor) {
    await this.assertAccess(id, actor);
    await this.assertAssignableUser(assignedUserId, actor);
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id }, data: { assignedUserId, updatedById: actor.id }, select: leadListSelect });
      await activityService.record(id, "ASSIGNED", assignedUserId ? "Lead assigned" : "Lead unassigned", actor.id, { assignedUserId }, tx);
      await auditService.log("lead.assigned", "Lead", id, actor.id, { assignedUserId }, undefined, tx);
      return toApiLead(lead);
    });
  }

  async remove(id: string, actor: Actor) {
    if (actor.role !== "ADMIN") throw new ServiceError("Only admins can delete leads.", 403);
    await this.assertAccess(id, actor);
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date(), deletedById: actor.id } });
      await activityService.record(id, "DELETED", "Lead deleted", actor.id, undefined, tx);
      await auditService.log("lead.deleted", "Lead", id, actor.id, undefined, undefined, tx);
    });
  }

  async restore(id: string, actor: Actor) {
    if (actor.role !== "ADMIN") throw new ServiceError("Only admins can restore leads.", 403);
    await this.assertAccess(id, actor, true);
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { isDeleted: false, deletedAt: null, deletedById: null, updatedById: actor.id } });
      await activityService.record(id, "RESTORED", "Lead restored", actor.id, undefined, tx);
      await auditService.log("lead.restored", "Lead", id, actor.id, undefined, undefined, tx);
    });
  }

  async permanentlyDelete(id: string, actor: Actor) {
    if (actor.role !== "ADMIN") throw new ServiceError("Only admins can permanently delete leads.", 403);
    const lead = await this.assertAccess(id, actor, true);
    if (!lead.isDeleted) throw new ServiceError("Only soft-deleted leads can be permanently deleted.", 400);
    return prisma.lead.delete({ where: { id } });
  }
}

export const leadService = new LeadService();
