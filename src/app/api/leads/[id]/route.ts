import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { leadSchema } from "@/lib/validation";
import { leadService } from "@/services/lead.service";

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = leadSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await context.params;
  const lead = await leadService.update(id, parsed.data, session.user);

  return NextResponse.json(lead);
});

export const DELETE = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (_request, context, session) => {
  const { id } = await context.params;
  await leadService.remove(id, session.user);
  return new NextResponse(null, { status: 204 });
});
