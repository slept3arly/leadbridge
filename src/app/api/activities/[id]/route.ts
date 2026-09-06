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

  const activity = await prisma.leadActivity.findUnique({
    where: { id },
    select: { id: true, leadId: true, metadata: true },
  });
  if (!activity) return apiError("Activity not found.", 404);

  // Verify the activity is a structured activity
  const metadata = activity.metadata as Record<string, unknown> | null;
  if (!metadata || metadata.structuredActivity !== true) {
    return apiError("Only structured activities can be edited.", 400);
  }

  // Verify lead access
  const lead = await prisma.lead.findFirst({
    where: { id: activity.leadId, isDeleted: false, assignedUserId: session.user.id },
    select: { id: true },
  });
  if (!lead) return apiError("Lead not found or access denied.", 404);

  const data = parsed.data;

  // Validate action → response → interest combinations
  if (data.action && data.response) {
    const responseValid = data.action === "CALL"
      ? ["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response)
      : ["REPLIED", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response);
    if (!responseValid) {
      return apiError("Invalid response for the selected action.", 400);
    }
  }

  if (data.response) {
    const actionForValidation = data.action ?? "CALL";
    const respondsToCustomer = data.response === "PICKED_UP" || data.response === "REPLIED";
    if (respondsToCustomer && data.interest === undefined) {
      // Interest is required when response indicates customer was reached
    } else if (!respondsToCustomer && data.interest !== undefined && data.interest !== null) {
      return apiError("Interest cannot be set for this response type.", 400);
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (data.action !== undefined) updateData.action = data.action;
  if (data.response !== undefined) updateData.response = data.response;
  if (data.interest !== undefined) updateData.interest = data.interest;

  // Update metadata.notes while preserving structuredActivity flag
  if (data.notes !== undefined) {
    const currentMetadata = (activity.metadata as Record<string, unknown>) ?? {};
    updateData.metadata = {
      ...currentMetadata,
      notes: data.notes,
    };
  }

  // Rebuild the message field to reflect updated action/response/interest
  if (data.action || data.response || data.interest !== undefined) {
    const action = data.action ?? (metadata.action as string) ?? "CALL";
    const response = data.response ?? (metadata.response as string) ?? "NO_RESPONSE";
    const interest = data.interest !== undefined ? data.interest : (metadata.interest as string | null);

    const actionLabel = action === "CALL" ? "Called" : "WhatsApp";
    const responseLabel = response.replaceAll("_", " ");
    const interestLabel = interest ? ` (${interest.replaceAll("_", " ")})` : "";

    const currentNotes = data.notes !== undefined
      ? data.notes
      : ((metadata.notes as string) ?? null);

    updateData.message = currentNotes || `${action} - ${responseLabel}${interestLabel}`;
  }

  try {
    const updated = await prisma.leadActivity.update({
      where: { id },
      data: updateData,
      include: { actor: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, "Failed to update activity");
  }
});
