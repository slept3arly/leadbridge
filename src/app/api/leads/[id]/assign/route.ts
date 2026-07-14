import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { assignmentSchema } from "@/lib/validation";
import { leadService } from "@/services/lead.service";

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  return NextResponse.json(await leadService.assign(id, parsed.data.assignedUserId, session.user));
});
