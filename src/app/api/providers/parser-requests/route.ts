import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { parserRequestService } from "@/services/parser-request.service";

export const GET = withApiAuthorization("ADMIN", async () => NextResponse.json({ data: await parserRequestService.list() }));
export const PATCH = withApiAuthorization("ADMIN", async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string" || !("status" in body) || typeof body.status !== "string") return apiError("Parser request id and status are required.", 400);
  if (!["OPEN", "IN_PROGRESS", "COMPLETED", "DECLINED"].includes(body.status)) return apiError("Invalid parser request status.", 400);
  const payload = body as { id: string; status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "DECLINED"; developerNotes?: unknown };
  return NextResponse.json(await parserRequestService.updateStatus(payload.id, payload.status, typeof payload.developerNotes === "string" ? payload.developerNotes : undefined, session.user.id));
});
