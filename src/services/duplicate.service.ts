import type { LeadInput } from "@/services/lead.service";
import { prisma } from "@/lib/prisma";

export class DuplicateService {
  async findPotentialDuplicates(data: Pick<LeadInput, "email" | "phone" | "alternatePhone">) {
    const phones = [data.phone, data.alternatePhone].filter((phone): phone is string => Boolean(phone));
    if (!data.email && phones.length === 0) {
      return [];
    }

    return prisma.lead.findMany({
      where: {
        isDeleted: false,
        OR: [
          data.email ? { email: data.email } : undefined,
          ...phones.flatMap((phone) => [{ phone }, { alternatePhone: phone }]),
        ].filter(Boolean) as object[],
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
      },
      take: 5,
    });
  }
}

export const duplicateService = new DuplicateService();
