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
    return prisma.note.findMany({ where: { leadId }, orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }] });
  }

  async create(leadId: string, content: string, actor: Actor) {
    await this.assertAccess(leadId, actor);
    return prisma.$transaction(async (tx) => {
      const note = await tx.note.create({ data: { leadId, content, authorId: actor.id } });
      await activityService.record(leadId, "NOTE_ADDED", "Note added", actor.id, { noteId: note.id }, tx);
      await auditService.log("note.created", "Note", note.id, actor.id, { leadId }, undefined, tx);
      return note;
    });
  }

  async update(id: string, content: string, actor: Actor) {
    const note = await prisma.note.findUnique({ where: { id }, select: { id: true, leadId: true } });
    if (!note) throw new ServiceError("Note not found.", 404);
    await this.assertAccess(note.leadId, actor);
    return prisma.$transaction(async (tx) => {
      const updated = await tx.note.update({ where: { id }, data: { content } });
      await activityService.record(note.leadId, "NOTE_EDITED", "Note edited", actor.id, { noteId: id }, tx);
      await auditService.log("note.updated", "Note", id, actor.id, { leadId: note.leadId }, undefined, tx);
      return updated;
    });
  }

  async remove(id: string, actor: Actor) {
    const note = await prisma.note.findUnique({ where: { id }, select: { id: true, leadId: true } });
    if (!note) throw new ServiceError("Note not found.", 404);
    await this.assertAccess(note.leadId, actor);
    if (actor.role !== "ADMIN") throw new ServiceError("Only admins can delete notes.", 403);
    await prisma.$transaction(async (tx) => {
      await tx.note.delete({ where: { id } });
      await auditService.log("note.deleted", "Note", id, actor.id, { leadId: note.leadId }, undefined, tx);
    });
  }
}

export const noteService = new NoteService();
