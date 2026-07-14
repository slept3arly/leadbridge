import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { noteSchema } from "@/lib/validation";
import { noteService } from "@/services/note.service";

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  return NextResponse.json(await noteService.update(id, parsed.data.content, session.user));
});

export const DELETE = withApiAuthorization<{ params: Promise<{ id: string }> }>(undefined, async (_request, context, session) => {
  const { id } = await context.params;
  await noteService.remove(id, session.user);
  return new NextResponse(null, { status: 204 });
});
