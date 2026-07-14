import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { leadService } from "@/services/lead.service";

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (_request, context, session) => {
  const { id } = await context.params;
  await leadService.restore(id, session.user);
  return NextResponse.json({ restored: true });
});
