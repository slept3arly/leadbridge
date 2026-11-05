import { NextResponse } from "next/server";
import { withApiAuthorization, withPermissionAuthorization, apiError, handleApiError } from "@/lib/api";
import { createLeadRequestSchema } from "@/lib/validation";
import { parseListQuery } from "@/lib/query-builder";
import { leadService } from "@/services/lead.service";
import { mutateAndInvalidate } from "@/lib/cache-tags";
import { Permission } from "@/lib/permissions";

export const GET = withApiAuthorization(undefined, async (request, _context, session) => {
  const query = parseListQuery(new URL(request.url).searchParams);
  return NextResponse.json(await leadService.listPage(query, session.user));
});

export const POST = withPermissionAuthorization(Permission.CREATE_LEAD, async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = createLeadRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await mutateAndInvalidate(
      session.user.id,
      () => leadService.create(parsed.data, session.user),
      (created) => created.status === "created" ? created.affectedUserIds : null,
    );
    if (result.status === "skipped") {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json(result.lead, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create lead");
  }
});
