import type { ActivityType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Pick<typeof prisma, "leadActivity">;

export class ActivityService {
  async record(
    leadId: string,
    type: ActivityType,
    message: string,
    actorId?: string,
    metadata?: object,
    client: DbClient = prisma,
  ) {
    return client.leadActivity.create({ data: { leadId, type, message, actorId, metadata } });
  }

  async list(leadId: string, client: DbClient = prisma) {
    return client.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    });
  }
}

export const activityService = new ActivityService();
