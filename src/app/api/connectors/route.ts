import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { supportedConnectorTypes } from "@/connectors/registry";

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

  if (!name || !type) {
    return apiError("Name and type are required.", 400);
  }

  const supported = supportedConnectorTypes();
  if (!supported.includes(type)) {
    return apiError(`Unsupported connector type: ${type}. Supported types: ${supported.join(", ")}`, 400);
  }

  const connector = await prisma.connector.create({
    data: {
      name,
      type,
      enabled: false,
      status: "INACTIVE",
      configuration: (configuration ?? {}) as object,
      environmentKey: environmentKey ?? null,
    },
  });

  return NextResponse.json({ data: { id: connector.id, name: connector.name, type: connector.type } });
});
