import type { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { activityEventService } from "@/services/activity-event.service";
import { followUpService } from "@/services/follow-up.service";
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

      const eventEntries: import("@/services/activity-event.service").ActivityEntryInput[] = [
        {
          type: "NOTE_ADDED",
          message: "Note added",
          metadata: { noteId: note.id },
        },
      ];

      if (data.scheduleFollowUp && data.followUpDate) {
        let dueDate: Date;
        if (data.followUpTime) {
          const datePart = new Date(data.followUpDate);
          const [h, m] = data.followUpTime.split(":").map(Number);
          dueDate = new Date(Date.UTC(
            datePart.getUTCFullYear(), datePart.getUTCMonth(), datePart.getUTCDate(),
            h, m, 0, 0,
          ));
        } else {
          dueDate = new Date(data.followUpDate);
        }

        const followUp = await tx.followUp.create({
          data: {
            title: `Follow-up: ${(data.whatIDid ?? "Note").slice(0, 80)}`,
            description: data.whatCustomerSaid?.slice(0, 500) ?? null,
            dueDate,
            dueTime: data.followUpTime ?? null,
            priority: "MEDIUM" as const,
            status: "PENDING",
            assignedUserId: actor.id,
            leadId,
            noteId: note.id,
            createdById: actor.id,
          },
        });

        eventEntries.push({
          type: "FOLLOW_UP_SCHEDULED",
          followUpId: followUp.id,
          message: "Follow-up scheduled",
          metadata: { dueDate: dueDate.toISOString(), dueTime: data.followUpTime ?? null },
        });

        await followUpService.recalculateLeadFollowUpFields(leadId, tx);
      }

      await activityEventService.createEvent({
        leadId,
        type: "NOTE",
        actorId: actor.id,
        entries: eventEntries,
      }, tx);

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
      await activityEventService.createEvent({
        leadId: note.leadId,
        type: "NOTE",
        actorId: actor.id,
        entries: [
          {
            type: "NOTE_EDITED",
            message: "Note edited",
            metadata: { noteId: id, oldContent: note.content, newContent },
          },
        ],
      }, tx);
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
    });
  }
}

export const noteService = new NoteService();
