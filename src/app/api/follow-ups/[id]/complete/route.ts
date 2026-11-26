import { NextResponse } from "next/server";
import { withApiAuthorization, handleApiError } from "@/lib/api";
import { followUpService } from "@/services/follow-up.service";
import { invalidateAfterMutation } from "@/lib/cache-tags";
import { z } from "zod";
import { ACTIVITY_INTEREST_VALUES } from "@/lib/activity-options";
import { activityReasonSchema } from "@/lib/validation";

const completeFollowUpSchema = z.object({
  note: z.string().trim().max(10000).nullable().optional(),
  nextFollowUp: z.object({
    dueDate: z.string(),
    dueTime: z.string().max(10).nullable().optional(),
  }).nullable().optional(),
  activity: z.object({
    action: z.enum(["CALL", "WHATSAPP"]),
    response: z.enum(["PICKED_UP", "NOT_PICKED_UP", "INVALID_NUMBER", "SWITCHED_OFF", "REPLIED", "NOT_REPLIED"]),
    interest: z.enum(ACTIVITY_INTEREST_VALUES).nullable(),
    reason: activityReasonSchema.nullable().optional(),
    notes: z.string().trim().max(10000).nullable().optional(),
  }).superRefine((activity, ctx) => {
    if (activity.interest === "NOT_INTERESTED" && !activity.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Select a reason when the lead is not interested." });
    if (activity.interest !== "NOT_INTERESTED" && activity.reason != null) ctx.addIssue({ code: "custom", path: ["reason"], message: "Reason is only allowed when interest is not interested." });
  }).nullable().optional(),
});

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const parsed = completeFollowUpSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;

  try {
    const result = await followUpService.complete(id, {
      note: parsed.data.note ?? null,
      nextFollowUp: parsed.data.nextFollowUp ?? null,
      activity: parsed.data.activity ?? null,
    }, session.user);

    invalidateAfterMutation(session.user.id, result.affectedUserIds);

    return NextResponse.json({
      completedFollowUp: result.completedFollowUp,
      nextFollowUp: result.nextFollowUp,
    }, { status: 200 });
  } catch (error) {
    return handleApiError(error, "Failed to complete follow-up");
  }
});
