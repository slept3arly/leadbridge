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
    return client.leadActivity.create({
      data: {
        leadId,
        type,
        message,
        actorId,
        metadata,
      },
    });
  }

  async recordStructured(
    leadId: string,
    type: ActivityType,
    message: string,
    actorId?: string,
    metadata?: object,
    action?: "CALL" | "WHATSAPP",
    response?: "PICKED_UP" | "NO_RESPONSE" | "INVALID_NUMBER" | "REPLIED",
    interest?: "INTERESTED" | "NOT_INTERESTED" | null,
    client: DbClient = prisma,
  ) {
    return client.leadActivity.create({
      data: {
        leadId,
        type,
        message,
        actorId,
        metadata,
        action: action ?? "CALL",
        response: response ?? "NO_RESPONSE",
        interest: interest ?? null,
      },
    });
  }

  async list(leadId: string) {
    return prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    });
  }

  async listLegacy(leadId: string) {
    return prisma.leadActivity.findMany({
      where: {
        leadId,
        NOT: { metadata: { path: ["structuredActivity"], equals: true } },
      },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    });
  }

  async listStructured(leadId: string) {
    return prisma.leadActivity.findMany({
      where: { leadId, metadata: { path: ["structuredActivity"], equals: true } },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    });
  }
}

export const activityService = new ActivityService();
