import { NextResponse } from "next/server";
import { withApiAuthorization, handleApiError } from "@/lib/api";
import { followUpService } from "@/services/follow-up.service";
import { invalidateAfterMutation } from "@/lib/cache-tags";
import { z } from "zod";

const completeFollowUpSchema = z.object({
  note: z.string().trim().max(10000).nullable().optional(),
  nextFollowUp: z.object({
    dueDate: z.string(),
    dueTime: z.string().max(10).nullable().optional(),
  }).nullable().optional(),
  activity: z.object({
    action: z.enum(["CALL", "WHATSAPP"]),
    response: z.enum(["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER", "REPLIED"]),
    interest: z.enum(["INTERESTED", "NOT_INTERESTED"]).nullable(),
    notes: z.string().trim().max(10000).nullable().optional(),
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

    invalidateAfterMutation(session.user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, "Failed to complete follow-up");
  }
});
