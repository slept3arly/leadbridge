import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { activityService } from "@/services/activity.service";
import { leadService } from "@/services/lead.service";
import { noteService } from "@/services/note.service";
import { followUpService } from "@/services/follow-up.service";

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;

  const [lead, notes, activities, followUps] = await Promise.all([
    leadService.getById(id, session.user),
    noteService.list(id, session.user),
    activityService.list(id),
    followUpService.list(id, session.user),
  ]);

  return NextResponse.json({ lead, notes, activities, followUps });
});
