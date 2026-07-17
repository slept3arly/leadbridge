import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { leadSchema } from "@/lib/validation";
import { parseListQuery } from "@/lib/query-builder";
import { leadService } from "@/services/lead.service";

export const GET = withApiAuthorization(undefined, async (request, _context, session) => {
  const query = parseListQuery(new URL(request.url).searchParams);
  return NextResponse.json(await leadService.listPage(query, session.user));
});

export const POST = withApiAuthorization(undefined, async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = leadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const lead = await leadService.create(parsed.data, session.user);
    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create lead");
  }
});
