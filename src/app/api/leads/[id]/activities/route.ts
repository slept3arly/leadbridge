import { NextResponse } from "next/server";
import { withApiAuthorization } from "@/lib/api";
import { activityService } from "@/services/activity.service";
import { noteService } from "@/services/note.service";
import { followUpService } from "@/services/follow-up.service";
import { z } from "zod";

const structuredActivitySchema = z.object({
  action: z.enum(["CALL", "WHATSAPP"]),
  response: z.enum(["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER", "REPLIED"]),
  interest: z.enum(["INTERESTED", "NOT_INTERESTED"]).nullable(),
  notes: z.string().trim().max(10000).nullable(),
  scheduleFollowUp: z.boolean(),
  followUpDate: z.string().nullable(),
  followUpTime: z.string().max(10).nullable(),
});

export const GET = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  await noteService.list(id, session.user);
  return NextResponse.json(session.user.role === "SALES" ? await activityService.listLegacy(id) : await activityService.list(id));
});

export const POST = withApiAuthorization<{ params: Promise<{ id: string }> }>(["SALES"], async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const parsed = structuredActivitySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id } = await context.params;
  const data = parsed.data;
  const responseValid = data.action === "CALL"
    ? ["PICKED_UP", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response)
    : ["REPLIED", "NO_RESPONSE", "INVALID_NUMBER"].includes(data.response);
  const interestValid = data.response === "PICKED_UP" || data.response === "REPLIED"
    ? data.interest !== null
    : data.interest === null;
  if (!responseValid || !interestValid || (data.scheduleFollowUp && !data.followUpDate)) {
    return NextResponse.json({ error: "Invalid structured activity combination." }, { status: 400 });
  }

  await noteService.list(id, session.user);
  const responseLabel = data.response.replaceAll("_", " ");
  const interestLabel = data.interest ? ` (${data.interest.replaceAll("_", " ")})` : "";

  let followUpId: string | null = null;
  if (data.scheduleFollowUp && data.followUpDate) {
    const fu = await followUpService.create({
      leadId: id,
      title: `${data.action === "CALL" ? "Call" : "WhatsApp"} follow-up`,
      description: data.notes,
      dueDate: data.followUpDate,
      dueTime: data.followUpTime,
      assignedUserId: session.user.id,
    }, session.user);
    followUpId = fu.id;
  }

  const activity = await activityService.recordStructured(
    id,
    "UPDATED",
    data.notes || `${data.action} - ${responseLabel}${interestLabel}`,
    session.user.id,
    {
      structuredActivity: true,
      ...(data.notes ? { notes: data.notes } : {}),
      ...(followUpId ? { followUpId } : {}),
    },
    data.action,
    data.response,
    data.interest,
  );

  return NextResponse.json(activity, { status: 201 });
});
