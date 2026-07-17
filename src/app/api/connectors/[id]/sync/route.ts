import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ConnectorRuntime } from "@/runtime/connector-runtime";
import { parserRegistry } from "@/parsers/registry";
import { createConnector } from "@/connectors/registry";
import { executionLock } from "@/services/execution-lock.service";
import { connectorHealthService } from "@/services/connector-health.service";
import { randomUUID } from "crypto";

export const POST = withApiAuthorization("ADMIN", async (_request, context, session) => {
  const params = context as { params: Promise<{ id: string }> | { id: string } };
  const resolvedParams = await (typeof params.params === "object" && "then" in params.params ? params.params : Promise.resolve(params.params));
  const id = resolvedParams.id;

  const connector = await prisma.connector.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      configuration: true,
      runtimeMetadata: true,
      environmentKey: true,
    },
  });

  if (!connector) return apiError("Connector not found.", 404);

  const executionId = randomUUID();
  const acquired = await executionLock.acquire(connector.id, executionId);
  if (!acquired) {
    return apiError("Connector is already running. Wait for the current execution to complete.", 409);
  }

  try {
    const config = (connector.configuration as Record<string, unknown>) ?? {};
    const runtimeMeta = (connector.runtimeMetadata as Record<string, unknown>) ?? {};

    const registry = {
      get(type: string) {
        return createConnector(type, { ...config, environmentKey: connector.environmentKey ?? "MAIN", runtimeMetadata: runtimeMeta });
      },
    };

    const parserRegistryAdapter = {
      get(key: string) {
        return parserRegistry.get(key);
      },
    };

    const runtime = new ConnectorRuntime({
      connectorRegistry: registry,
      parserRegistry: parserRegistryAdapter,
    });

    const actor = { id: session.user.id, role: session.user.role as "ADMIN" | "SALES" };

    const result = await runtime.execute(
      connector.id,
      connector.type,
      actor,
      {
        configuration: config,
      },
    );

    await connectorHealthService.recordCompletion(
      connector.id,
      result.status,
      result.durationMs,
      result.errors[0]?.message,
    );

    const updatedMeta = {
      ...runtimeMeta,
      lastSyncResult: result.status,
      lastSyncAt: new Date().toISOString(),
      lastSyncLeadCount: result.leadCount,
      lastSyncPayloadCount: result.rawPayloadCount,
      lastSyncWarningCount: result.warnings.length,
      lastSyncErrorCount: result.errors.length,
    };
    await prisma.connector.update({
      where: { id: connector.id },
      data: { runtimeMetadata: updatedMeta as object },
    });

    return NextResponse.json({ data: result });
  } finally {
    await executionLock.release(connector.id, executionId);
  }
});
