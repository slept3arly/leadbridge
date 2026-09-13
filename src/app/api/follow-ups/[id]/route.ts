import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { followUpSchema } from "@/lib/validation";
import { followUpService } from "@/services/follow-up.service";
import { invalidateAfterMutation } from "@/lib/cache-tags";

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = followUpSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    // Use reschedule when dueDate/dueTime changes on a pending follow-up
    if (parsed.data.dueDate !== undefined || parsed.data.dueTime !== undefined) {
      const data = parsed.data;
      if (data.dueDate) {
        const dueDateStr = data.dueDate instanceof Date
          ? data.dueDate.toISOString()
          : String(data.dueDate);
        const result = await followUpService.reschedule(id, {
          dueDate: dueDateStr,
          dueTime: data.dueTime ?? null,
        }, session.user);
        invalidateAfterMutation(session.user.id);
        return NextResponse.json(result);
      }
    }

    const result = await followUpService.update(id, parsed.data, session.user);
    invalidateAfterMutation(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Failed to update follow-up");
  }
});

export const DELETE = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  try {
    await followUpService.remove(id, session.user);
    invalidateAfterMutation(session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Failed to delete follow-up");
  }
});
