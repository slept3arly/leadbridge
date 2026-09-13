import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { activityEventService } from "@/services/activity-event.service";
import { leadService } from "@/services/lead.service";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;

  // Lead access is verified by leadService.getById below.
  // Notes and follow-ups are queried directly (skipping redundant access
  // checks in noteService.list / followUpService.list) to avoid extra lead
  // table lookups that would otherwise add latency to every modal open.
  const [lead, notes, followUps, activityEvents] = await Promise.all([
    leadService.getById(id, session.user),
    prisma.note.findMany({
      where: { leadId: id },
      orderBy: [{ createdAt: "desc" }],
      include: {
        author: { select: { id: true, name: true } },
        followUps: {
          select: { id: true, dueDate: true, dueTime: true, status: true, completedAt: true },
          take: 1,
        },
      },
    }),
    prisma.followUp.findMany({
      where: { leadId: id },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignedUser: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    }),
    activityEventService.listByLead(id, { limit: 100 }),
  ]);

  return NextResponse.json({
    lead,
    notes,
    followUps,
    activityEvents,
  });
});
