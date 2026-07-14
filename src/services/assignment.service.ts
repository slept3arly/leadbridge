import type { UserRole } from "@/generated/prisma/client";
import { leadService } from "@/services/lead.service";

export class AssignmentService {
  async assign(leadId: string, userId: string | null, actor: { id: string; role: UserRole }) {
    return leadService.assign(leadId, userId, actor);
  }
}

export const assignmentService = new AssignmentService();
