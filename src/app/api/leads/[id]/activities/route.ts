import { NextResponse } from "next/server";
import { withApiAuthorization, handleApiError } from "@/lib/api";
import { activityEventService } from "@/services/activity-event.service";
import { invalidateAfterMutation } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { leadProgressRequestSchema } from "@/lib/validation";
import { leadWorkflowService } from "@/services/lead-workflow.service";

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

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const parsed = leadProgressRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;
  try {
    const result = await leadWorkflowService.recordLeadProgress(id, parsed.data, session.user);
    invalidateAfterMutation(session.user.id, result.affectedUserIds);
    return NextResponse.json({
      ...result.interaction,
      lead: result.lead,
      completedFollowUp: result.completedFollowUp,
      nextFollowUp: result.nextFollowUp,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to record lead progress");
  }
});
