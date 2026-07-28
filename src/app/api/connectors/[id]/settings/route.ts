import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { restConnectorConfigSchema } from "@/lib/validation";

function retainSecrets(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!existing) return incoming;

  const merged = { ...incoming };
  const existingAuth = existing.auth as Record<string, unknown> | undefined;
  const incomingAuth = incoming.auth as Record<string, unknown> | undefined;

  if (existingAuth && incomingAuth && incomingAuth.type === existingAuth.type) {
    const mergedAuth = { ...incomingAuth };

    if (incomingAuth.type === "API_KEY") {
      const existingKey = existingAuth.apiKey as Record<string, unknown> | undefined;
      const incomingKey = incomingAuth.apiKey as Record<string, unknown> | undefined;
      if (existingKey && incomingKey && !incomingKey.value) {
        mergedAuth.apiKey = { ...incomingKey, value: existingKey.value };
      }
    }

    if (incomingAuth.type === "BEARER" && !incomingAuth.bearerToken) {
      mergedAuth.bearerToken = existingAuth.bearerToken;
    }

    if (incomingAuth.type === "BASIC") {
      const existingBasic = existingAuth.basic as Record<string, unknown> | undefined;
      const incomingBasic = incomingAuth.basic as Record<string, unknown> | undefined;
      if (existingBasic && incomingBasic && !incomingBasic.password) {
        mergedAuth.basic = { ...incomingBasic, password: existingBasic.password };
      }
    }

    if (incomingAuth.type === "CUSTOM_HEADER") {
      const existingCh = existingAuth.customHeader as Record<string, unknown> | undefined;
      const incomingCh = incomingAuth.customHeader as Record<string, unknown> | undefined;
      if (existingCh && incomingCh && !incomingCh.value) {
        mergedAuth.customHeader = { ...incomingCh, value: existingCh.value };
      }
    }

    merged.auth = mergedAuth;
  }

  return merged;
}

export const PATCH = withApiAuthorization("ADMIN", async (request, context) => {
  const params = context as { params: Promise<{ id: string }> | { id: string } };
  const resolvedParams = await (typeof params.params === "object" && "then" in params.params ? params.params : Promise.resolve(params.params));
  const id = resolvedParams.id;

  const connector = await prisma.connector.findUnique({ where: { id }, select: { id: true, type: true, configuration: true } });
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

  if (body.configuration !== undefined) {
    if (connector.type !== "rest") {
      return apiError("Configuration is only supported for REST connectors.", 400);
    }

    const incomingConfig = body.configuration as Record<string, unknown>;
    const existingConfig = connector.configuration as Record<string, unknown> | null;
    const mergedConfig = retainSecrets(incomingConfig, existingConfig);

    const parsed = restConnectorConfigSchema.safeParse(mergedConfig);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid configuration.", details: parsed.error.flatten() }, { status: 400 });
    }

    updateData.configuration = parsed.data as object;
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