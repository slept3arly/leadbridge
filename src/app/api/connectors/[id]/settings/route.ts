import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { restConnectorConfigSchema } from "@/lib/validation";
import { invalidateAdminDashboard } from "@/lib/cache-tags";

function retainSecrets(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!existing) return incoming;

  const merged = { ...existing, ...incoming };
  for (const key of ["headers", "queryParams"] as const) {
    const incomingValues = incoming[key] as Record<string, unknown> | undefined;
    const existingValues = existing[key] as Record<string, unknown> | undefined;
    if (!incomingValues && existingValues) merged[key] = existingValues;
    else if (incomingValues && existingValues && Object.keys(incomingValues).length > 0) {
      merged[key] = { ...existingValues, ...incomingValues };
    }
  }

  const existingPagination = existing.pagination as Record<string, unknown> | undefined;
  const incomingPagination = incoming.pagination as Record<string, unknown> | undefined;
  if (existingPagination && incomingPagination) {
    merged.pagination = { ...existingPagination, ...incomingPagination };
  } else if (existingPagination && !incomingPagination) {
    merged.pagination = existingPagination;
  }

  const existingAuth = existing.auth as Record<string, unknown> | undefined;
  const incomingAuth = incoming.auth as Record<string, unknown> | undefined;

  if (existingAuth && incomingAuth && incomingAuth.type === existingAuth.type) {
    const mergedAuth = { ...incomingAuth };

    if (incomingAuth.type === "API_KEY") {
      const existingKey = existingAuth.apiKey as Record<string, unknown> | undefined;
      const incomingKey = incomingAuth.apiKey as Record<string, unknown> | undefined;
      if (existingKey) {
        mergedAuth.apiKey = {
          ...existingKey,
          ...incomingKey,
          ...(incomingKey?.name ? {} : { name: existingKey.name }),
          ...(incomingKey?.in ? {} : { in: existingKey.in }),
          ...(incomingKey?.value ? {} : { value: existingKey.value }),
        };
      }
    }

    if (incomingAuth.type === "BEARER" && !incomingAuth.bearerToken) {
      mergedAuth.bearerToken = existingAuth.bearerToken;
    }

    if (incomingAuth.type === "BASIC") {
      const existingBasic = existingAuth.basic as Record<string, unknown> | undefined;
      const incomingBasic = incomingAuth.basic as Record<string, unknown> | undefined;
      if (existingBasic) {
        mergedAuth.basic = {
          ...existingBasic,
          ...incomingBasic,
          ...(incomingBasic?.username ? {} : { username: existingBasic.username }),
          ...(incomingBasic?.password ? {} : { password: existingBasic.password }),
        };
      }
    }

    if (incomingAuth.type === "CUSTOM_HEADER") {
      const existingCh = existingAuth.customHeader as Record<string, unknown> | undefined;
      const incomingCh = incomingAuth.customHeader as Record<string, unknown> | undefined;
      if (existingCh) {
        mergedAuth.customHeader = {
          ...existingCh,
          ...incomingCh,
          ...(incomingCh?.name ? {} : { name: existingCh.name }),
          ...(incomingCh?.value ? {} : { value: existingCh.value }),
        };
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

  const connector = await prisma.connector.findUnique({ where: { id }, select: { id: true, type: true, configuration: true, scheduleType: true, scheduleConfig: true } });
  if (!connector) return apiError("Connector not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const updateData: Record<string, unknown> = {};

  if (body.enabled !== undefined) updateData.enabled = Boolean(body.enabled);
  const allowedScheduleTypes = ["MANUAL", "EVERY_5_MIN", "EVERY_15_MIN", "EVERY_30_MIN", "HOURLY", "DAILY", "CUSTOM"];
  const scheduleType = body.scheduleType === undefined ? connector.scheduleType : body.scheduleType;
  const scheduleConfig = body.scheduleConfig === undefined ? connector.scheduleConfig : body.scheduleConfig;
  if (body.scheduleType !== undefined && (typeof body.scheduleType !== "string" || !allowedScheduleTypes.includes(body.scheduleType))) {
    return apiError("Invalid scheduleType.", 400);
  }
  if (body.scheduleConfig !== undefined && body.scheduleConfig !== null && (typeof body.scheduleConfig !== "object" || Array.isArray(body.scheduleConfig))) {
    return apiError("scheduleConfig must be an object or null.", 400);
  }
  if (scheduleType === "CUSTOM") {
    const intervalMinutes = scheduleConfig && typeof scheduleConfig === "object" && !Array.isArray(scheduleConfig)
      ? (scheduleConfig as Record<string, unknown>).intervalMinutes
      : undefined;
    if (typeof intervalMinutes !== "number" || !Number.isInteger(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 525600) {
      return apiError("Custom schedules require intervalMinutes between 1 and 525600.", 400);
    }
  }
  if (body.scheduleType !== undefined) updateData.scheduleType = body.scheduleType;
  if (body.scheduleConfig && typeof body.scheduleConfig === "object") updateData.scheduleConfig = body.scheduleConfig as object;
  const scheduleChanged = (body.scheduleType !== undefined && body.scheduleType !== connector.scheduleType)
    || (body.scheduleConfig !== undefined && JSON.stringify(body.scheduleConfig) !== JSON.stringify(connector.scheduleConfig));
  if (scheduleChanged) {
    updateData.nextScheduledRun = scheduleType === "MANUAL" ? null : new Date();
  }

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

  if (body.sourceId !== undefined) {
    if (body.sourceId === null) {
      updateData.sourceId = null;
    } else if (typeof body.sourceId === "string" && body.sourceId.trim()) {
      const provider = await prisma.leadSource.findUnique({ where: { id: body.sourceId }, select: { id: true } });
      if (!provider) return apiError("Provider not found.", 404);
      updateData.sourceId = body.sourceId;
    } else {
      return apiError("sourceId must be a string or null.", 400);
    }
  }

  if (Object.keys(updateData).length === 0) {
    return apiError("No valid fields to update.", 400);
  }

  await prisma.connector.update({
    where: { id },
    data: updateData as Record<string, unknown>,
  });
  invalidateAdminDashboard();

  return NextResponse.json({ success: true });
});
