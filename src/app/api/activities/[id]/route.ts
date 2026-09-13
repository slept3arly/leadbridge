import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
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
    select: { id: true, eventId: true, type: true, action: true, message: true },
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

  if (data.action && data.response) {
    const responseValid = data.action === "CALL"
      ? ["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response)
      : ["REPLIED", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response);
    if (!responseValid) {
      return apiError("Invalid response for the selected action.", 400);
    }
  }

  if (data.response) {
    const respondsToCustomer = data.response === "PICKED_UP" || data.response === "REPLIED";
    if (!respondsToCustomer && data.interest !== undefined && data.interest !== null) {
      return apiError("Interest cannot be set for this response type.", 400);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (data.action !== undefined) updateData.action = data.action;
  if (data.response !== undefined) updateData.response = data.response;
  if (data.interest !== undefined) updateData.interest = data.interest;

  if (data.action || data.response || data.interest !== undefined || data.notes !== undefined) {
    const action = data.action ?? entry.action ?? entry.type;
    const response = data.response ?? "NO_RESPONSE";
    const responseLabel = response.replaceAll("_", " ");
    const interestLabel = data.interest ? ` (${data.interest.replaceAll("_", " ")})` : "";
    updateData.message = data.notes || `${action} - ${responseLabel}${interestLabel}`;
  }

  try {
    const updated = await prisma.activityEntry.update({
      where: { id },
      data: updateData,
      include: { event: { include: { actor: { select: { id: true, name: true } } } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "Failed to update activity");
  }
});
