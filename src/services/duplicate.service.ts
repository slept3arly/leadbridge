import type { LeadInput } from "@/services/lead.service";
import { prisma } from "@/lib/prisma";

export class DuplicateService {
  async findPotentialDuplicates(data: Pick<LeadInput, "email" | "phone">) {
    if (!data.email && !data.phone) {
      return [];
    }

    return prisma.lead.findMany({
      where: {
        OR: [
          data.email ? { email: data.email } : undefined,
          data.phone ? { phone: data.phone } : undefined,
        ].filter(Boolean) as object[],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
      take: 5,
    });
  }
}

export const duplicateService = new DuplicateService();
