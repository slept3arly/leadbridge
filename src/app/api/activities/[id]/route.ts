import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { validateActivityOutcomePatch } from "@/lib/validation";
import { invalidateAfterMutation } from "@/lib/cache-tags";
import { z } from "zod";

const updateActivitySchema = z.object({
  action: z.enum(["CALL", "WHATSAPP"]).optional(),
  response: z.enum(["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER", "REPLIED"]).optional(),
  interest: z.enum(["INTERESTED", "NOT_INTERESTED"]).nullable().optional(),
  notes: z.string().trim().max(10000).nullable().optional(),
});

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }

  const parsed = updateActivitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;

  const entry = await prisma.activityEntry.findUnique({
    where: { id },
    select: { id: true, eventId: true, type: true, action: true, response: true, interest: true, message: true },
  });
  if (!entry) return apiError("Activity not found.", 404);

  const event = await prisma.activityEvent.findUnique({
    where: { id: entry.eventId },
    select: { id: true, leadId: true, actorId: true },
  });
  if (!event) return apiError("Activity event not found.", 404);

  if (entry.type !== "CALL" && entry.type !== "WHATSAPP") {
    return apiError("Only interaction activities can be edited.", 400);
  }

  const lead = await prisma.lead.findFirst({
    where: { id: event.leadId, isDeleted: false, assignedUserId: session.user.id },
    select: { id: true },
  });
  if (!lead) return apiError("Lead not found or access denied.", 404);

  const data = parsed.data;

  const outcomeValidation = validateActivityOutcomePatch({
    action: entry.action ?? entry.type,
    response: entry.response,
    interest: entry.interest,
  }, data);
  if (outcomeValidation && !outcomeValidation.success) {
    return NextResponse.json({ error: outcomeValidation.error.flatten() }, { status: 400 });
  }

  const resultingAction = data.action ?? entry.action ?? entry.type;
  const resultingResponse = data.response ?? entry.response ?? "NO_RESPONSE";
  const resultingInterest = data.interest !== undefined ? data.interest : entry.interest;

  const updateData: Record<string, unknown> = {};
  if (data.action !== undefined) updateData.action = data.action;
  if (data.response !== undefined) updateData.response = data.response;
  if (data.interest !== undefined) updateData.interest = data.interest;

  if (data.action || data.response || data.interest !== undefined || data.notes !== undefined) {
    const responseLabel = resultingResponse.replaceAll("_", " ");
    const interestLabel = resultingInterest ? ` (${resultingInterest.replaceAll("_", " ")})` : "";
    updateData.message = data.notes || `${resultingAction} - ${responseLabel}${interestLabel}`;
  }

  try {
    const updated = await prisma.activityEntry.update({
      where: { id },
      data: updateData,
      include: { event: { include: { actor: { select: { id: true, name: true } } } } },
    });
    invalidateAfterMutation(session.user.id);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "Failed to update activity");
  }
});
