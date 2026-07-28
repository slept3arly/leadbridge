import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { providerSchema } from "@/lib/validation";
import { providerService } from "@/services/provider.service";

export const PATCH = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (request, context, session) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  const parsed = providerSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { id } = await context.params;
  return NextResponse.json(await providerService.update(id, parsed.data, session.user.id));
});

export const DELETE = withApiAuthorization<{ params: Promise<{ id: string }> }>("ADMIN", async (_request, context, session) => {
  const { id } = await context.params;
  await providerService.delete(id, session.user.id);
  return new NextResponse(null, { status: 204 });
});
