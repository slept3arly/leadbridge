import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { activityService } from "@/services/activity.service";
import { auditService } from "@/services/audit.service";
import { ServiceError } from "@/lib/service-errors";

type Actor = { id: string; role: UserRole };

export class NoteService {
  private async assertAccess(leadId: string, actor: Actor) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, isDeleted: false, ...(actor.role === "SALES" ? { assignedUserId: actor.id } : {}) },
      select: { id: true },
    });
    if (!lead) throw new ServiceError("Lead not found or access denied.", 404);
  }

  async list(leadId: string, actor: Actor) {
    await this.assertAccess(leadId, actor);
    return prisma.note.findMany({
      where: { leadId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        author: { select: { id: true, name: true } },
        followUps: {
          select: { id: true, dueDate: true, dueTime: true, status: true, completedAt: true },
          take: 1,
        },
      },
    });
  }

  async create(leadId: string, data: {
    content?: string | null;
    whatIDid?: string | null;
    whatCustomerSaid?: string | null;
    scheduleFollowUp?: boolean;
    followUpDate?: string | null;
    followUpTime?: string | null;
  }, actor: Actor) {
    await this.assertAccess(leadId, actor);

    const content = [data.whatIDid, data.whatCustomerSaid, data.content]
      .filter(Boolean)
      .join("\n\n") || "Note";

    return prisma.$transaction(async (tx) => {
      const note = await tx.note.create({
        data: {
          leadId,
          content,
          whatIDid: data.whatIDid ?? null,
          whatCustomerSaid: data.whatCustomerSaid ?? null,
          authorId: actor.id,
        },
        include: {
          author: { select: { id: true, name: true } },
          followUps: {
            select: { id: true, dueDate: true, dueTime: true, status: true, completedAt: true },
          },
        },
      });

      await activityService.record(leadId, "NOTE_ADDED", "Note added", actor.id, { noteId: note.id }, tx);
      await auditService.log("note.created", "Note", note.id, actor.id, { leadId }, undefined, tx);

      if (data.scheduleFollowUp && data.followUpDate) {
        const due = new Date(data.followUpDate);
        if (data.followUpTime) {
          const [h, m] = data.followUpTime.split(":").map(Number);
          due.setHours(h, m, 0, 0);
        }

        const followUp = await tx.followUp.create({
          data: {
            title: `Follow-up: ${(data.whatIDid ?? "Note").slice(0, 80)}`,
            description: data.whatCustomerSaid?.slice(0, 500) ?? null,
            dueDate: due,
            dueTime: data.followUpTime ?? null,
            priority: "MEDIUM" as const,
            status: "PENDING",
            assignedUserId: actor.id,
            leadId,
            noteId: note.id,
            createdById: actor.id,
          },
        });

        const currentLead = await tx.lead.findUnique({
          where: { id: leadId },
          select: { nextFollowUpAt: true },
        });
        if (!currentLead?.nextFollowUpAt || due < currentLead.nextFollowUpAt) {
          await tx.lead.update({
            where: { id: leadId },
            data: { nextFollowUpAt: due },
          });
        }

        await activityService.record(leadId, "FOLLOW_UP", "Follow-up scheduled", actor.id, { followUpId: followUp.id, dueDate: data.followUpDate }, tx);
      }

      return note;
    });
  }

  async update(id: string, data: { content?: string | null; whatIDid?: string | null; whatCustomerSaid?: string | null }, actor: Actor) {
    const note = await prisma.note.findUnique({
      where: { id },
      select: { id: true, leadId: true, authorId: true, content: true, createdAt: true, whatIDid: true, whatCustomerSaid: true },
    });
    if (!note) throw new ServiceError("Note not found.", 404);
    await this.assertAccess(note.leadId, actor);
    if (note.authorId !== actor.id && actor.role !== "ADMIN") {
      throw new ServiceError("You can only edit your own notes.", 403);
    }

    const now = new Date();
    const createdDate = new Date(note.createdAt);
    const isSameDay =
      createdDate.getFullYear() === now.getFullYear() &&
      createdDate.getMonth() === now.getMonth() &&
      createdDate.getDate() === now.getDate();

    if (!isSameDay && actor.role !== "ADMIN") {
      throw new ServiceError("Notes can only be edited on the day they were created.", 403);
    }

    const newWhatIDid = data.whatIDid !== undefined ? data.whatIDid : note.whatIDid;
    const newWhatCustomerSaid = data.whatCustomerSaid !== undefined ? data.whatCustomerSaid : note.whatCustomerSaid;
    const newContent = [newWhatIDid, newWhatCustomerSaid, data.content].filter(Boolean).join("\n\n") || note.content;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.note.update({
        where: { id },
        data: { content: newContent, whatIDid: newWhatIDid, whatCustomerSaid: newWhatCustomerSaid },
        include: {
          author: { select: { id: true, name: true } },
          followUps: {
            select: { id: true, dueDate: true, dueTime: true, status: true, completedAt: true },
          },
        },
      });
      await activityService.record(note.leadId, "NOTE_EDITED", "Note edited", actor.id, {
        noteId: id, oldContent: note.content, newContent,
      }, tx);
      await auditService.log("note.updated", "Note", id, actor.id, { leadId: note.leadId }, undefined, tx);
      return updated;
    });
  }

  async remove(id: string, actor: Actor) {
    const note = await prisma.note.findUnique({
      where: { id },
      select: { id: true, leadId: true, authorId: true, createdAt: true },
    });
    if (!note) throw new ServiceError("Note not found.", 404);
    await this.assertAccess(note.leadId, actor);
    if (note.authorId !== actor.id && actor.role !== "ADMIN") {
      throw new ServiceError("You can only delete your own notes.", 403);
    }

    const now = new Date();
    const createdDate = new Date(note.createdAt);
    const isSameDay =
      createdDate.getFullYear() === now.getFullYear() &&
      createdDate.getMonth() === now.getMonth() &&
      createdDate.getDate() === now.getDate();

    if (!isSameDay && actor.role !== "ADMIN") {
      throw new ServiceError("Notes can only be deleted on the day they were created.", 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.note.delete({ where: { id } });
      await auditService.log("note.deleted", "Note", id, actor.id, { leadId: note.leadId }, undefined, tx);
    });
  }
}

export const noteService = new NoteService();
