import type { ActivityEventType, ActivityEntryType, ActionType, ResponseType, InterestType } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type DbClient = Pick<typeof prisma, "activityEvent" | "activityEntry" | "$transaction">;

export type ActivityEntryInput = {
  type: ActivityEntryType;
  action?: ActionType;
  response?: ResponseType;
  interest?: InterestType | null;
  message?: string;
  metadata?: Record<string, unknown>;
  followUpId?: string | null;
};

export type CreateActivityEventInput = {
  leadId: string;
  type: ActivityEventType;
  actorId?: string | null;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
  entries: ActivityEntryInput[];
};

export class ActivityEventService {
  async createEvent(input: CreateActivityEventInput, client: DbClient = prisma) {
    const event = await client.activityEvent.create({
      data: {
        type: input.type,
        leadId: input.leadId,
        actorId: input.actorId ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    if (input.entries.length > 0) {
      await client.activityEntry.createMany({
        data: input.entries.map((e) => ({
          eventId: event.id,
          type: e.type,
          action: e.action ?? null,
          response: e.response ?? null,
          interest: e.interest ?? null,
          message: e.message ?? null,
          metadata: e.metadata ? (e.metadata as Prisma.InputJsonValue) : undefined,
          followUpId: e.followUpId ?? null,
        })),
      });
    }

    return event;
  }

  async listByLead(leadId: string, options?: { limit?: number; cursor?: string }) {
    const limit = options?.limit ?? 50;
    const cursor = options?.cursor;

    return prisma.activityEvent.findMany({
      where: { leadId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        actor: { select: { id: true, name: true } },
        entries: {
          orderBy: { createdAt: "asc" },
          include: {
            followUp: {
              select: { id: true, title: true, dueDate: true, dueTime: true, status: true, completedAt: true },
            },
          },
        },
      },
    });
  }

  async listByFollowUp(followUpId: string) {
    return prisma.activityEntry.findMany({
      where: { followUpId },
      include: {
        event: {
          include: {
            actor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getEvent(eventId: string) {
    return prisma.activityEvent.findUnique({
      where: { id: eventId },
      include: {
        actor: { select: { id: true, name: true } },
        entries: {
          include: {
            followUp: {
              select: { id: true, title: true, dueDate: true, dueTime: true, status: true },
            },
          },
        },
      },
    });
  }
}

export const activityEventService = new ActivityEventService();
