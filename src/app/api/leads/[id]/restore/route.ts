import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { leadService } from "@/services/lead.service";
import { invalidateAfterMutation } from "@/lib/cache-tags";

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (_request, context, session) => {
  const { id } = await context.params;
  await leadService.restore(id, session.user);
  invalidateAfterMutation(session.user.id);
  return NextResponse.json({ restored: true });
});
