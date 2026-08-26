import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { routingRuleSchema, routingRuleUpdateSchema } from "@/lib/validation";
import { providerService } from "@/services/provider.service";

export const GET = withApiAuthorization("ADMIN", async () => NextResponse.json({ data: await providerService.listRoutingRules() }));
export const POST = withApiAuthorization("ADMIN", async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = routingRuleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await providerService.createRoutingRule(parsed.data, session.user.id), { status: 201 });
});

export const PATCH = withApiAuthorization("ADMIN", async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  if (!body || typeof body !== "object" || !("id" in body) || typeof body.id !== "string") {
    return apiError("Routing rule id is required.", 400);
  }

  const { id, ...payload } = body as { id: string } & Record<string, unknown>;
  const parsed = routingRuleUpdateSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await providerService.updateRoutingRule(id, parsed.data, session.user.id));
});
