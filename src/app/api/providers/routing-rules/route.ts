import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { routingRuleSchema } from "@/lib/validation";
import { providerService } from "@/services/provider.service";

export const GET = withApiAuthorization("ADMIN", async () => NextResponse.json({ data: await providerService.listRoutingRules() }));
export const POST = withApiAuthorization("ADMIN", async (request, _context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = routingRuleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  return NextResponse.json(await providerService.createRoutingRule(parsed.data, session.user.id), { status: 201 });
});
