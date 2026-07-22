import { NextResponse } from "next/server";
import { withApiAuthorization, withPermissionAuthorization, apiError, handleApiError } from "@/lib/api";
import { leadSchema } from "@/lib/validation";
import { leadService } from "@/services/lead.service";
import { Permission } from "@/lib/permissions";
import { invalidateAfterMutation } from "@/lib/cache-tags";

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  return NextResponse.json(await leadService.getById(id, session.user));
});

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = leadSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  try {
    const lead = await leadService.update(id, parsed.data, session.user);
    invalidateAfterMutation(session.user.id);
    return NextResponse.json(lead);
  } catch (error) {
    return handleApiError(error, "Failed to update lead");
  }
});

export const DELETE = withPermissionAuthorization<{ params: Promise<{ id: string }> }>(Permission.DELETE_LEAD, async (_request, context, session) => {
  const { id } = await context.params;
  try {
    await leadService.remove(id, session.user);
    invalidateAfterMutation(session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Failed to delete lead");
  }
});
