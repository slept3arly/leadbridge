import type { FollowUpPriority, FollowUpStatus, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/service-errors";

type Actor = { id: string; role: UserRole };

export class FollowUpService {
  private async assertLeadAccess(leadId: string, actor: Actor) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, isDeleted: false, ...(actor.role === "SALES" ? { assignedUserId: actor.id } : {}) },
      select: { id: true },
    });
    if (!lead) throw new ServiceError("Lead not found or access denied.", 404);
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
          ? { OR: [{ assignedUserId: actor.id }, { createdById: actor.id }] }
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
  }, actor: Actor) {
    await this.assertLeadAccess(data.leadId, actor);
    const followUp = await prisma.followUp.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        dueTime: data.dueTime ?? null,
        priority: (data.priority as FollowUpPriority) ?? "MEDIUM",
        status: "PENDING",
        assignedUserId: data.assignedUserId ?? actor.id,
        leadId: data.leadId,
        createdById: actor.id,
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    return followUp;
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
      select: { id: true, leadId: true, createdById: true },
    });
    if (!followUp) throw new ServiceError("Follow-up not found.", 404);
    await this.assertLeadAccess(followUp.leadId, actor);
    return prisma.followUp.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.dueDate !== undefined && data.dueDate !== null ? { dueDate: new Date(data.dueDate) } : data.dueDate === null ? { dueDate: null } : {}),
        ...(data.dueTime !== undefined ? { dueTime: data.dueTime } : {}),
        ...(data.priority !== undefined ? { priority: data.priority as FollowUpPriority } : {}),
        ...(data.status !== undefined ? { status: data.status as FollowUpStatus } : {}),
        ...(data.assignedUserId !== undefined ? { assignedUserId: data.assignedUserId } : {}),
      },
      include: {
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, actor: Actor) {
    const followUp = await prisma.followUp.findUnique({
      where: { id },
      select: { id: true, leadId: true, createdById: true },
    });
    if (!followUp) throw new ServiceError("Follow-up not found.", 404);
    await this.assertLeadAccess(followUp.leadId, actor);
    if (followUp.createdById !== actor.id && actor.role !== "ADMIN") {
      throw new ServiceError("You can only delete your own follow-ups.", 403);
    }
    await prisma.followUp.delete({ where: { id } });
  }
}

export const followUpService = new FollowUpService();
