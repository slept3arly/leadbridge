import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { followUpSchema } from "@/lib/validation";
import { followUpService } from "@/services/follow-up.service";

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  return NextResponse.json(await followUpService.list(id, session.user));
});

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  const { id } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = followUpSchema.safeParse({ ...(body as object), leadId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(await followUpService.create(parsed.data, session.user), { status: 201 });
});
