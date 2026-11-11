import { Prisma, type UserRole, type SalesPrivilege } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-errors";
import { createLeadRequestSchema, leadProgressRequestSchema } from "@/lib/validation";
import { activityEventService, type ActivityEntryInput } from "@/services/activity-event.service";
import { followUpService } from "@/services/follow-up.service";
import { leadService } from "@/services/lead.service";
import { can, Permission } from "@/lib/permissions";

type Actor = { id: string; role: UserRole; salesPrivilege?: SalesPrivilege | null };

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: { flatten(): unknown } }): T {
  if (!result.success) throw new ServiceError("Invalid request.", 400);
  return result.data;
}

function interactionEntry(input: {
  action: "CALL" | "WHATSAPP";
  response: string;
  interest: "INTERESTED" | "NOT_INTERESTED" | null;
  notes: string | null;
}): ActivityEntryInput {
  const interestLabel = input.interest ? ` (${input.interest.replaceAll("_", " ")})` : "";
  return {
    type: input.action,
    action: input.action,
    response: input.response as ActivityEntryInput["response"],
    interest: input.interest,
    message: input.notes || `${input.action} - ${input.response.replaceAll("_", " ")}${interestLabel}`,
    metadata: input.notes ? { notes: input.notes } : undefined,
  };
}

function asEntries(changes: Array<{ field: string; from: unknown; to: unknown }>): ActivityEntryInput[] {
  const status = changes.find((change) => change.field === "status");
  const otherChanges = changes.filter((change) => change.field !== "status");
  const entries: ActivityEntryInput[] = [];
  if (status) {
    entries.push({
      type: "STATUS_CHANGED",
      message: `Status changed to ${String(status.to)}`,
      metadata: { from: status.from, to: status.to },
    });
  }
  if (otherChanges.length > 0) {
    entries.push({
      type: "UPDATED",
      message: "Lead updated",
      metadata: { changes: otherChanges },
    });
  }
  return entries;
}

export class LeadWorkflowService {
  /** Manual creation requires one real interaction; LeadService.create remains the import path. */
  async createLeadWithInitialActivity(input: unknown, actor: Actor) {
    if (!can(actor, Permission.CREATE_LEAD)) {
      throw new ServiceError("You do not have permission to create leads.", 403);
    }
    const data = parseOrThrow(createLeadRequestSchema.safeParse(input));
    const prepared = await leadService.prepareCreate(data, actor);
    if ("status" in prepared) return prepared;
    let result: Awaited<ReturnType<typeof leadService.createInTransaction>>;
    try {
      result = await prisma.$transaction((tx) => leadService.createInTransaction(tx, data, actor, prepared));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { status: "skipped" as const, reason: "Duplicate lead detected (concurrent insert)." };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ServiceError("Lead or follow-up data changed concurrently. Refresh and retry the operation.", 409);
      }
      throw error;
    }
    if (result.status === "skipped") return result;
    return {
      ...result,
      interactionEventId: result.interactionEventId,
      followUp: result.followUp,
    };
  }

  async recordLeadProgress(leadId: string, input: unknown, actor: Actor) {
    const data = parseOrThrow(leadProgressRequestSchema.safeParse(input));

    try {
      return await prisma.$transaction(async (tx) => {
      const { pending } = await followUpService.lockLeadForLifecycle(tx, leadId, actor);
      const lead = await tx.lead.findFirst({
        where: {
          id: leadId,
          isDeleted: false,
          ...(actor.role === "SALES" ? { assignedUserId: actor.id } : {}),
        },
      });
      if (!lead) throw new ServiceError("Lead not found or access denied.", 404);
      let selectedFollowUp: {
        id: string;
        title: string;
        dueDate: Date | null;
        dueTime: string | null;
        assignedUserId: string | null;
      } | null = null;
      let completedFollowUp: unknown | null = null;
      let completionEntry: ActivityEntryInput | null = null;

      const followUpIdToComplete = data.completeFollowUpId ?? pending[0]?.id;
      if (followUpIdToComplete) {
        const transition = await followUpService.completePendingInTransaction(tx, followUpIdToComplete, leadId);
        selectedFollowUp = transition.followUp;
        completedFollowUp = transition.completedFollowUp;
      }

      const patch = {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.requirement !== undefined ? { requirement: data.requirement } : {}),
      };
      const { changes } = await leadService.updateFieldsInTransaction(tx, lead, patch, actor.id);

      let nextFollowUp: unknown | null = null;
      const entries: ActivityEntryInput[] = [interactionEntry(data)];
      if (selectedFollowUp && completedFollowUp) {
        completionEntry = {
          type: "FOLLOW_UP_COMPLETED",
          followUpId: selectedFollowUp.id,
          message: "Follow-up completed",
          metadata: {
            followUpTitle: selectedFollowUp.title,
            scheduledDate: selectedFollowUp.dueDate?.toISOString() ?? null,
            scheduledTime: selectedFollowUp.dueTime,
            ...(data.completeFollowUpId ? {} : {
              autoCompleted: true,
              completionReason: data.scheduleFollowUp ? "SUPERSEDED_BY_NEW_FOLLOW_UP" : "RECORD_PROGRESS",
            }),
          },
        };
        entries.push(completionEntry);
      }

      if (data.scheduleFollowUp && data.followUpDate) {
        const created = await followUpService.scheduleInTransaction(tx, {
          leadId,
          title: `${data.action === "CALL" ? "Call" : "WhatsApp"} follow-up`,
          description: null,
          dueDate: data.followUpDate,
          dueTime: data.followUpTime ?? null,
        }, actor);
        nextFollowUp = created.followUp;
        if (completionEntry) {
          completionEntry.metadata = {
            ...completionEntry.metadata,
            supersededByFollowUpId: created.followUp.id,
          };
        }
        entries.push(...created.entries);
      }

      entries.push(...asEntries(changes));
      const event = await activityEventService.createEvent({
        leadId,
        type: "INTERACTION",
        actorId: actor.id,
        entries,
      }, tx);

      if (selectedFollowUp || nextFollowUp) {
        await followUpService.recalculateLeadFollowUpFields(leadId, tx);
      }

      const updatedLead = await tx.lead.findUniqueOrThrow({
        where: { id: leadId },
        select: {
          id: true,
          leadNumber: true,
          displayName: true,
          status: true,
          priority: true,
          category: true,
          nextFollowUpAt: true,
          lastFollowUpAt: true,
          updatedAt: true,
          assignedUserId: true,
          assignedUser: { select: { id: true, name: true } },
        },
      });
      const interaction = await tx.activityEvent.findUniqueOrThrow({
        where: { id: event.id },
        include: { entries: { orderBy: { createdAt: "asc" } } },
      });

      return {
        lead: { ...updatedLead, name: updatedLead.displayName },
        interaction,
        completedFollowUp,
        nextFollowUp,
        affectedUserIds: Array.from(new Set([
          actor.id,
          lead.assignedUserId,
          selectedFollowUp?.assignedUserId,
          (nextFollowUp as { assignedUserId?: string | null } | null)?.assignedUserId,
        ].filter((id): id is string => Boolean(id)))),
      };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ServiceError("Lead or follow-up data changed concurrently. Refresh and retry the operation.", 409);
      }
      throw error;
    }
  }
}

export const leadWorkflowService = new LeadWorkflowService();
