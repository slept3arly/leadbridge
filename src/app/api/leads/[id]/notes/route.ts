import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { noteSchema } from "@/lib/validation";
import { noteService } from "@/services/note.service";
import { invalidateAfterMutation } from "@/lib/cache-tags";

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  return NextResponse.json(await noteService.list(id, session.user));
});

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  const result = await noteService.create(id, {
    content: parsed.data.content,
    whatIDid: parsed.data.whatIDid,
    whatCustomerSaid: parsed.data.whatCustomerSaid,
    scheduleFollowUp: parsed.data.scheduleFollowUp,
    followUpDate: parsed.data.followUpDate,
    followUpTime: parsed.data.followUpTime,
  }, session.user);
  invalidateAfterMutation(session.user.id);
  return NextResponse.json(result, { status: 201 });
});
