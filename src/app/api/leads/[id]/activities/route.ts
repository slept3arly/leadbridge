import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { activityService } from "@/services/activity.service";
import { noteService } from "@/services/note.service";

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  await noteService.list(id, session.user);
  return NextResponse.json(await activityService.list(id));
});
