import { prisma } from "@/lib/prisma";
import { auditService } from "@/services/audit.service";

export class AssignmentService {
  async assign(leadId: string, userId: string, actorId: string) {
    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { assignedUserId: userId },
    });

    await prisma.leadActivity.create({
      data: {
        leadId,
        actorId,
        type: "ASSIGNED",
        message: "Lead assigned",
        metadata: { userId },
      },
    });

    await auditService.log("lead.assigned", "Lead", leadId, actorId, { userId });

    return lead;
  }
}

export const assignmentService = new AssignmentService();
