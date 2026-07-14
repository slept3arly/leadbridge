import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { unmatchedActionSchema } from "@/lib/validation";
import { unmatchedEmailService } from "@/services/unmatched-email.service";

export const GET = withApiAuthorization("ADMIN", async () => NextResponse.json({ data: await unmatchedEmailService.list() }));
export const PATCH = withApiAuthorization("ADMIN", async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") return apiError("Unmatched email id is required.", 400);
  const parsed = unmatchedActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await unmatchedEmailService.handle(body.id, parsed.data, session.user.id));
});
