import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { providerService } from "@/services/provider.service";

export const DELETE = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (_request, context, session) => {
  const params = context as { params: Promise<{ id: string }> | { id: string } };
  const resolvedParams = await (typeof params.params === "object" && "then" in params.params ? params.params : Promise.resolve(params.params));
  if (!resolvedParams.id) return apiError("Routing rule id is required.", 400);
  await providerService.deleteRoutingRule(resolvedParams.id, session.user.id);
  return new NextResponse(null, { status: 204 });
});
