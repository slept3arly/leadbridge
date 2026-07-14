import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leadSchema } from "@/lib/validation";
import { auditService } from "@/services/audit.service";
import { duplicateService } from "@/services/duplicate.service";

export type LeadInput = z.infer<typeof leadSchema>;

const leadListSelect = {
  id: true,
  name: true,
  company: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  status: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  assignedUser: {
    select: {
      id: true,
      name: true,
    },
  },
  source: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

export class LeadService {
  async list(userId?: string) {
    return prisma.lead.findMany({
      where: userId ? { assignedUserId: userId } : undefined,
      select: leadListSelect,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async stats(userId?: string) {
    const where = userId ? { assignedUserId: userId } : {};

    const [total, open, qualified] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: { in: ["NEW", "CONTACTED"] } } }),
      prisma.lead.count({ where: { ...where, status: "QUALIFIED" } }),
    ]);

    return { total, open, qualified };
  }

  async create(data: LeadInput, actorId: string) {
    const duplicates = await duplicateService.findPotentialDuplicates(data);

    const lead = await prisma.lead.create({
      data,
      select: leadListSelect,
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        actorId,
        type: "CREATED",
        message: "Lead created",
        metadata: duplicates.length ? { duplicateCandidates: duplicates } : undefined,
      },
    });

    await auditService.log("lead.created", "Lead", lead.id, actorId, {
      duplicateCandidates: duplicates.length,
    });

    return lead;
  }

  async update(id: string, data: Partial<LeadInput>, actorId: string) {
    const lead = await prisma.lead.update({
      where: { id },
      data,
      select: leadListSelect,
    });

    await prisma.leadActivity.create({
      data: {
        leadId: id,
        actorId,
        type: "UPDATED",
        message: "Lead updated",
      },
    });

    await auditService.log("lead.updated", "Lead", id, actorId);

    return lead;
  }

  async remove(id: string, actorId: string) {
    await prisma.lead.delete({ where: { id } });
    await auditService.log("lead.deleted", "Lead", id, actorId);
  }
}

export const leadService = new LeadService();
