import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { activityEventService } from "@/services/activity-event.service";
import { followUpService } from "@/services/follow-up.service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const structuredActivitySchema = z.object({
  action: z.enum(["CALL", "WHATSAPP"]),
  response: z.enum(["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER", "REPLIED"]),
  interest: z.enum(["INTERESTED", "NOT_INTERESTED"]).nullable(),
  notes: z.string().trim().max(10000).nullable(),
  scheduleFollowUp: z.boolean().optional().default(false),
  followUpDate: z.string().nullable().optional(),
  followUpTime: z.string().max(10).nullable().optional(),
});

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;

  const lead = await prisma.lead.findFirst({
    where: {
      id,
      isDeleted: false,
      ...(session.user.role === "SALES" ? { assignedUserId: session.user.id } : {}),
    },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found or access denied." }, { status: 404 });

  const events = await activityEventService.listByLead(id, { limit: 100 });
  return NextResponse.json(events);
});

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>(["SALES"], async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const parsed = structuredActivitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;
  const data = parsed.data;
  const responseValid = data.action === "CALL"
    ? ["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response)
    : ["REPLIED", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response);
  const interestValid = data.response === "PICKED_UP" || data.response === "REPLIED"
    ? data.interest !== null
    : data.interest === null;
  if (!responseValid || !interestValid || (data.scheduleFollowUp && !data.followUpDate)) {
    return NextResponse.json({ error: "Invalid structured activity combination." }, { status: 400 });
  }

  const lead = await prisma.lead.findFirst({
    where: { id, isDeleted: false, assignedUserId: session.user.id },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found or access denied." }, { status: 404 });

  const responseLabel = data.response.replaceAll("_", " ");
  const interestLabel = data.interest ? ` (${data.interest.replaceAll("_", " ")})` : "";

  const result = await prisma.$transaction(async (tx) => {
    const eventEntries: import("@/services/activity-event.service").ActivityEntryInput[] = [
      {
        type: data.action === "CALL" ? "CALL" : "WHATSAPP",
        action: data.action,
        response: data.response,
        interest: data.interest ?? null,
        message: data.notes || `${data.action} - ${responseLabel}${interestLabel}`,
        metadata: data.notes ? { notes: data.notes } : undefined,
      },
    ];

    let followUpId: string | null = null;
    if (data.scheduleFollowUp && data.followUpDate) {
      const fu = await followUpService.create({
        leadId: id,
        title: `${data.action === "CALL" ? "Call" : "WhatsApp"} follow-up`,
        description: data.notes,
        dueDate: data.followUpDate,
        dueTime: data.followUpTime,
        assignedUserId: session.user.id,
      }, session.user, tx, false);

      followUpId = fu.id;

      eventEntries.push({
        type: "FOLLOW_UP_SCHEDULED",
        followUpId: fu.id,
        message: "Follow-up scheduled",
        metadata: { dueDate: data.followUpDate, dueTime: data.followUpTime ?? null },
      });
    }

    const event = await activityEventService.createEvent({
      leadId: id,
      type: "INTERACTION",
      actorId: session.user.id,
      entries: eventEntries,
    }, tx);

    return { event, followUpId };
  });

  return NextResponse.json(result.event, { status: 201 });
});
