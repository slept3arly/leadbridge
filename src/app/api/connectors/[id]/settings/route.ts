import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const PATCH = withApiAuthorization("ADMIN", async (request, context) => {
  const params = context as { params: Promise<{ id: string }> | { id: string } };
  const resolvedParams = await (typeof params.params === "object" && "then" in params.params ? params.params : Promise.resolve(params.params));
  const id = resolvedParams.id;

  const connector = await prisma.connector.findUnique({ where: { id }, select: { id: true } });
  if (!connector) return apiError("Connector not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const updateData: Record<string, unknown> = {};

  if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled);
  if (body.scheduleType !== undefined) updateData.scheduleType = body.scheduleType as string;
  if (body.scheduleConfig !== undefined) updateData.scheduleConfig = body.scheduleConfig as object;

  if (body.resetHealth) {
    updateData.consecutiveFailures = 0;
    updateData.healthStatus = "HEALTHY";
    updateData.isRunning = false;
    updateData.lockedAt = null;
    updateData.lockedBy = null;
  }

  if (Object.keys(updateData).length === 0) {
    return apiError("No valid fields to update.", 400);
  }

  await prisma.connector.update({
    where: { id },
    data: updateData as Record<string, unknown>,
  });

  return NextResponse.json({ success: true });
});
