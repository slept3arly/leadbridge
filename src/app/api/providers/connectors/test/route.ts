import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { GmailConnector } from "@/connectors/gmail/gmail-connector";
import { RestConnector } from "@/connectors/rest/rest-connector";

export const POST = withApiAuthorization("ADMIN", async (request) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const connectorId = body.connectorId as string;
  if (!connectorId) return apiError("connectorId is required.", 400);

  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
    select: {
      id: true,
      name: true,
      type: true,
      environmentKey: true,
      configuration: true,
    },
  });

  if (!connector) return apiError("Connector not found.", 404);

  const type = connector.type.toLowerCase();

  if (type === "gmail") {
    const environmentKey = connector.environmentKey ?? "MAIN";
    const result = await GmailConnector.testConnection(environmentKey);
    return NextResponse.json({
      success: result.success,
      diagnostic: result.success
        ? {
            status: "authenticated",
            email: result.emailAddress ?? null,
            message: "Connection successful",
          }
        : {
            status: "auth_failed",
            email: result.emailAddress ?? null,
            message: result.error ?? "Authentication failed",
            details: result.details ?? null,
          },
    });
  }

  if (type === "rest") {
    const config = (connector.configuration as Record<string, unknown>) ?? {};
    const result = await RestConnector.testConnection(config);
    return NextResponse.json({
      success: result.success,
      diagnostic: result.success
        ? {
            status: "reachable",
            statusCode: result.statusCode ?? null,
            message: "Endpoint reachable",
          }
        : {
            status: "unreachable",
            statusCode: result.statusCode ?? null,
            message: result.error ?? "Endpoint unreachable",
          },
    });
  }

  return apiError(`Unsupported connector type: ${type}`, 400);
});
