import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { followUpSchema } from "@/lib/validation";
import { followUpService } from "@/services/follow-up.service";

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = followUpSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await followUpService.update(id, parsed.data, session.user));
});

export const DELETE = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  await followUpService.remove(id, session.user);
  return new NextResponse(null, { status: 204 });
});
