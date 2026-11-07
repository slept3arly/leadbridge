import type { FollowUpPriority, UserRole } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-errors";
import { parseFollowUpDate } from "@/lib/follow-up-date";
import { activityEventService } from "@/services/activity-event.service";
import { resolveFollowUpAssignee, salesFollowUpLeadScope } from "@/services/follow-up-policy";

type Actor = { id: string; role: UserRole };

export class FollowUpService {
  private async assertAssignee(assignedUserId: string | null | undefined, actor: Actor) {
    const resolved = resolveFollowUpAssignee(actor, assignedUserId);
    if (actor.role === "SALES") return resolved;
    if (resolved && resolved !== actor.id) {
      const user = await prisma.user.findFirst({
        where: { id: resolved, role: "SALES", active: true, isDeleted: false },
        select: { id: true },
      });
      if (!user) throw new ServiceError("Follow-ups can be assigned only to active sales users.", 400);
    }
    return resolved;
  }
  private async assertLeadAccess(leadId: string, actor: Actor, client: Pick<typeof prisma, "lead"> = prisma) {
    const lead = await client.lead.findFirst({
      where: { id: leadId, isDeleted: false, ...(actor.role === "SALES" ? { assignedUserId: actor.id } : {}) },
      select: { id: true, assignedUserId: true },
    });
    if (!lead) throw new ServiceError("Lead not found or access denied.", 404);
    return lead;
  }

  async recalculateLeadFollowUpFields(
    leadId: string,
    client?: Pick<typeof prisma, "followUp" | "lead">,
  ) {
    const db = client ?? prisma;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [latestCompleted, earliestPending, lead] = await Promise.all([
        db.followUp.findFirst({
          where: { leadId, status: "COMPLETED", completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          select: { completedAt: true },
        }),
        db.followUp.findFirst({
          where: { leadId, status: "PENDING", dueDate: { not: null } },
          orderBy: { dueDate: "asc" },
          select: { dueDate: true },
        }),
        db.lead.findUnique({ where: { id: leadId }, select: { nextFollowUpAt: true, lastFollowUpAt: true } }),
      ]);
      if (!lead) return;

      const lastFollowUpAt = latestCompleted?.completedAt ?? null;
      const nextFollowUpAt = earliestPending?.dueDate ?? null;
      const lastChanged = lead.lastFollowUpAt?.getTime() !== lastFollowUpAt?.getTime();
      const nextChanged = lead.nextFollowUpAt?.getTime() !== nextFollowUpAt?.getTime();
      if (!lastChanged && !nextChanged) return;

      const updated = await db.lead.updateMany({
        where: {
          id: leadId,
          lastFollowUpAt: lead.lastFollowUpAt,
          nextFollowUpAt: lead.nextFollowUpAt,
        },
        data: {
          ...(lastChanged ? { lastFollowUpAt } : {}),
          ...(nextChanged ? { nextFollowUpAt } : {}),
        },
      });
      if (updated.count === 1) return;
    }
    throw new ServiceError("Follow-up dates changed concurrently. Retry the operation.", 409);
  }

  async list(leadId: string, actor: Actor) {
    await this.assertLeadAccess(leadId, actor);
    return prisma.followUp.findMany({
      where: { leadId },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async listForTasks(actor: Actor) {
    return prisma.followUp.findMany({
      where: {
        status: "PENDING",
        ...(actor.role === "SALES"
          ? { OR: [{ assignedUserId: actor.id }, { createdById: actor.id }], ...salesFollowUpLeadScope(actor.id) }
          : {}),
      },
      orderBy: { dueDate: "asc" },
      take: 100,
      include: {
        lead: { select: { id: true, displayName: true, leadNumber: true } },
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async create(data: {
    title: string;
    description?: string | null;
    dueDate?: Date | string | null;
    dueTime?: string | null;
    priority?: string;
    status?: string;
    assignedUserId?: string | null;
    leadId: string;
  }, actor: Actor, client?: Pick<typeof prisma, "followUp" | "lead" | "activityEvent" | "activityEntry" | "$transaction">, recordLifecycleEvent = true, recalculate = true) {
    const db = client ?? prisma;
    const lead = await this.assertLeadAccess(data.leadId, actor, client ?? prisma);
    const assignedUserId = await this.assertAssignee(data.assignedUserId, actor);

    const followUp = await db.followUp.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        dueDate: data.dueDate ? parseFollowUpDate(data.dueDate) : null,
        dueTime: data.dueTime ?? null,
        priority: (data.priority as FollowUpPriority) ?? "MEDIUM",
        status: "PENDING",
        assignedUserId,
        leadId: data.leadId,
        createdById: actor.id,
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (recordLifecycleEvent && followUp.dueDate) {
      await activityEventService.createEvent({
        leadId: data.leadId,
        type: "FOLLOW_UP",
        actorId: actor.id,
        entries: [
          {
            type: "FOLLOW_UP_SCHEDULED",
            followUpId: followUp.id,
            message: "Follow-up scheduled",
            metadata: {
              dueDate: data.dueDate instanceof Date
                ? data.dueDate.toISOString()
                : data.dueDate,
              dueTime: data.dueTime ?? null,
            },
          },
        ],
      }, db);
    }

    if (followUp.dueDate && recalculate) {
      await this.recalculateLeadFollowUpFields(data.leadId, client);
    }

    return { followUp, affectedUserIds: [lead.assignedUserId, assignedUserId] };
  }

  async createScheduled(data: {
    leadId: string;
    dueDate: string;
    dueTime?: string | null;
    actorId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.create({
        data: {
          title: "Follow-up",
          dueDate: parseFollowUpDate(data.dueDate),
          dueTime: data.dueTime ?? null,
          priority: "MEDIUM",
          status: "PENDING",
          assignedUserId: data.actorId,
          leadId: data.leadId,
          createdById: data.actorId,
        },
        include: {
          assignedUser: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      await activityEventService.createEvent({
        leadId: data.leadId,
        type: "FOLLOW_UP",
        actorId: data.actorId,
        entries: [
          {
            type: "FOLLOW_UP_SCHEDULED",
            followUpId: followUp.id,
            message: "Follow-up scheduled",
            metadata: { dueDate: data.dueDate, dueTime: data.dueTime ?? null },
          },
        ],
      }, tx);

      await this.recalculateLeadFollowUpFields(data.leadId, tx);
      return followUp;
    });
  }

  async update(id: string, data: {
    title?: string;
    description?: string | null;
    dueDate?: Date | string | null;
    dueTime?: string | null;
    priority?: string;
    status?: string;
    assignedUserId?: string | null;
  }, actor: Actor) {
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      select: { id: true, leadId: true, createdById: true, assignedUserId: true, status: true, dueDate: true, dueTime: true },
    });
    if (!followUp) throw new ServiceError("Follow-up not found.", 404);
    const lead = await this.assertLeadAccess(followUp.leadId, actor);
    const assignedUserId = data.assignedUserId === undefined
      ? undefined
      : await this.assertAssignee(data.assignedUserId, actor);

    if (data.status !== undefined && data.status !== followUp.status) {
      throw new ServiceError(
        "Status transitions are not allowed through update. Use the complete or cancel endpoints instead.",
        400,
      );
    }

    let combinedDueDate: Date | null | undefined = undefined;
    if (data.dueDate !== undefined) {
      if (data.dueDate === null) {
        combinedDueDate = null;
      } else {
        combinedDueDate = parseFollowUpDate(data.dueDate);
      }
    }

    const leadFieldsChanged = data.dueDate !== undefined;
    if (leadFieldsChanged) {
      const updated = await prisma.$transaction(async (tx) => {
        const updated = await tx.followUp.update({
          where: { id },
          data: {
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(combinedDueDate !== undefined ? { dueDate: combinedDueDate } : {}),
            ...(data.dueTime !== undefined ? { dueTime: data.dueTime } : {}),
            ...(data.priority !== undefined ? { priority: data.priority as FollowUpPriority } : {}),
            ...(assignedUserId !== undefined ? { assignedUserId } : {}),
          },
          include: {
            assignedUser: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
        });
        await this.recalculateLeadFollowUpFields(followUp.leadId, tx);
        return updated;
      });
      return { followUp: updated, affectedUserIds: [lead.assignedUserId, followUp.assignedUserId, assignedUserId ?? followUp.assignedUserId] };
    }

    const updated = await prisma.followUp.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(combinedDueDate !== undefined ? { dueDate: combinedDueDate } : {}),
        ...(data.dueTime !== undefined ? { dueTime: data.dueTime } : {}),
        ...(data.priority !== undefined ? { priority: data.priority as FollowUpPriority } : {}),
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return { followUp: updated, affectedUserIds: [lead.assignedUserId, followUp.assignedUserId, assignedUserId ?? followUp.assignedUserId] };
  }

  async reschedule(id: string, data: {
    dueDate: string;
    dueTime?: string | null;
  }, actor: Actor) {
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      select: { id: true, leadId: true, assignedUserId: true, status: true, dueDate: true, dueTime: true },
    });
    if (!followUp) throw new ServiceError("Follow-up not found.", 404);
    const lead = await this.assertLeadAccess(followUp.leadId, actor);

    if (followUp.status !== "PENDING") {
      throw new ServiceError("Only pending follow-ups can be rescheduled.", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const previousDueDate = followUp.dueDate?.toISOString() ?? null;
      const previousDueTime = followUp.dueTime ?? null;

      const updated = await tx.followUp.update({
        where: { id },
        data: {
          dueDate: parseFollowUpDate(data.dueDate),
          dueTime: data.dueTime ?? null,
        },
        include: {
          assignedUser: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      await activityEventService.createEvent({
        leadId: followUp.leadId,
        type: "FOLLOW_UP",
        actorId: actor.id,
        entries: [
          {
            type: "FOLLOW_UP_RESCHEDULED",
            followUpId: id,
            message: "Follow-up rescheduled",
            metadata: {
              previousDueDate,
              previousDueTime,
              newDueDate: data.dueDate,
              newDueTime: data.dueTime ?? null,
            },
          },
        ],
      }, tx);

      await this.recalculateLeadFollowUpFields(followUp.leadId, tx);
      return updated;
    });
    return { followUp: updated, affectedUserIds: [lead.assignedUserId, followUp.assignedUserId] };
  }

  async completePendingInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    leadId: string,
    options: { description?: string | null } = {},
  ) {
    const followUp = await tx.followUp.findFirst({
      where: { id, leadId },
      select: { id: true, leadId: true, assignedUserId: true, status: true, title: true, dueDate: true, dueTime: true },
    });
    if (!followUp) throw new ServiceError("Follow-up not found for this lead.", 404);
    if (followUp.status !== "PENDING") throw new ServiceError("Follow-up is no longer pending.", 409);

    const transition = await tx.followUp.updateMany({
      where: { id, leadId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        ...(options.description !== undefined ? { description: options.description } : {}),
      },
    });
    if (transition.count !== 1) throw new ServiceError("Follow-up is no longer pending.", 409);

    const completedFollowUp = await tx.followUp.findUniqueOrThrow({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return { followUp, completedFollowUp };
  }

  async complete(id: string, data: {
    note?: string | null;
    nextFollowUp?: {
      dueDate: Date | string;
      dueTime?: string | null;
    } | null;
    activity?: {
      action: "CALL" | "WHATSAPP";
      response: "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED";
      interest?: "INTERESTED" | "NOT_INTERESTED" | null;
      notes?: string | null;
    } | null;
  }, actor: Actor) {
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      select: { id: true, leadId: true, assignedUserId: true, status: true, createdById: true, title: true, dueDate: true, dueTime: true },
    });
    if (!followUp) throw new ServiceError("Follow-up not found.", 404);
    const lead = await this.assertLeadAccess(followUp.leadId, actor);

    if (followUp.status !== "PENDING") {
      throw new ServiceError("Follow-up is no longer pending.", 409);
    }

    return prisma.$transaction(async (tx) => {
      const transition = await this.completePendingInTransaction(tx, id, followUp.leadId, { description: data.note });
      const completedFollowUp = transition.completedFollowUp;

      // Create one grouped ActivityEvent with all related entries
      const entries: import("@/services/activity-event.service").ActivityEntryInput[] = [
        {
          type: "FOLLOW_UP_COMPLETED",
          followUpId: id,
          message: "Follow-up completed",
          metadata: {
            followUpTitle: transition.followUp.title,
            scheduledDate: transition.followUp.dueDate?.toISOString() ?? null,
            scheduledTime: transition.followUp.dueTime ?? null,
          },
        },
      ];

      if (data.activity) {
        entries.push({
          type: data.activity.action === "CALL" ? "CALL" : "WHATSAPP",
          action: data.activity.action,
          response: data.activity.response,
          interest: data.activity.interest ?? null,
          message: data.activity.notes || `${data.activity.action} - ${data.activity.response.replaceAll("_", " ")}${data.activity.interest ? ` (${data.activity.interest.replaceAll("_", " ")})` : ""}`,
          metadata: data.activity.notes ? { notes: data.activity.notes } : undefined,
        });
      }

      if (data.note) {
        entries.push({
          type: "NOTE_ADDED",
          message: data.note,
          metadata: { noteType: "completion_note" },
        });
      }

      let nextFollowUp: Awaited<ReturnType<FollowUpService["create"]>> | null = null;
      if (data.nextFollowUp?.dueDate) {
        nextFollowUp = await this.create({
          leadId: followUp.leadId,
          title: "Follow-up",
          description: null,
          dueDate: data.nextFollowUp.dueDate,
          dueTime: data.nextFollowUp.dueTime ?? null,
          assignedUserId: actor.id,
        }, actor, tx, false);

        entries.push({
          type: "FOLLOW_UP_SCHEDULED",
          followUpId: nextFollowUp.followUp.id,
          message: "Follow-up scheduled",
          metadata: {
            dueDate: data.nextFollowUp.dueDate instanceof Date
              ? data.nextFollowUp.dueDate.toISOString()
              : data.nextFollowUp.dueDate,
            dueTime: data.nextFollowUp.dueTime ?? null,
          },
        });
      }

      await activityEventService.createEvent({
        leadId: followUp.leadId,
        type: "FOLLOW_UP",
        actorId: actor.id,
        entries,
      }, tx);

      if (!data.nextFollowUp?.dueDate) {
        await this.recalculateLeadFollowUpFields(followUp.leadId, tx);
      }

      return {
        completedFollowUp,
        nextFollowUp: nextFollowUp?.followUp ?? null,
        affectedUserIds: [lead.assignedUserId, followUp.assignedUserId, nextFollowUp?.followUp.assignedUserId],
      };
    });
  }

  async remove(id: string, actor: Actor) {
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      select: { id: true, leadId: true, assignedUserId: true, createdById: true, status: true, dueDate: true, dueTime: true, title: true },
    });
    if (!followUp) throw new ServiceError("Follow-up not found.", 404);
    const lead = await this.assertLeadAccess(followUp.leadId, actor);
    if (followUp.createdById !== actor.id && actor.role !== "ADMIN") {
      throw new ServiceError("You can only delete your own follow-ups.", 403);
    }

    await prisma.$transaction(async (tx) => {
      if (followUp.status === "PENDING") {
        await activityEventService.createEvent({
          leadId: followUp.leadId,
          type: "FOLLOW_UP",
          actorId: actor.id,
          entries: [
            {
              type: "FOLLOW_UP_CANCELLED",
              followUpId: id,
              message: "Follow-up cancelled",
              metadata: {
                followUpTitle: followUp.title,
                scheduledDate: followUp.dueDate?.toISOString() ?? null,
                scheduledTime: followUp.dueTime ?? null,
              },
            },
          ],
        }, tx);
      }

      await tx.followUp.delete({ where: { id } });
      await this.recalculateLeadFollowUpFields(followUp.leadId, tx);
    });
    return { leadId: followUp.leadId, affectedUserIds: [lead.assignedUserId, followUp.assignedUserId] };
  }
}

export const followUpService = new FollowUpService();
