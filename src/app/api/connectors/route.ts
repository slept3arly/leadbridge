import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { supportedConnectorTypes } from "@/connectors/registry";
import { restConnectorConfigSchema } from "@/lib/validation";
import { invalidateAdminDashboard } from "@/lib/cache-tags";

export const GET = withApiAuthorization("ADMIN", async () => {
  const types = supportedConnectorTypes();
  return NextResponse.json({ data: types });
});

export const POST = withApiAuthorization("ADMIN", async (request) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const name = body.name as string;
  const type = (body.type as string)?.toLowerCase();
  const configuration = body.configuration as Record<string, unknown> | undefined;
  const environmentKey = body.environmentKey as string | undefined;
  const sourceId = body.sourceId as string | null | undefined;

  if (!name || !type) {
    return apiError("Name and type are required.", 400);
  }

  const supported = supportedConnectorTypes();
  if (!supported.includes(type)) {
    return apiError(`Unsupported connector type: ${type}. Supported types: ${supported.join(", ")}`, 400);
  }

  if (type === "rest" && configuration !== undefined) {
    const parsed = restConnectorConfigSchema.safeParse(configuration);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid configuration.", details: parsed.error.flatten() }, { status: 400 });
    }
  }

  if (sourceId) {
    const provider = await prisma.leadSource.findUnique({ where: { id: sourceId }, select: { id: true } });
    if (!provider) return apiError("Provider not found.", 404);
  }

  const connector = await prisma.connector.create({
    data: {
      name,
      type,
      enabled: false,
      status: "INACTIVE",
      configuration: (configuration ?? {}) as object,
      environmentKey: environmentKey ?? null,
      sourceId: sourceId ?? null,
    },
  });
  invalidateAdminDashboard();

  return NextResponse.json({ data: { id: connector.id, name: connector.name, type: connector.type } });
});
