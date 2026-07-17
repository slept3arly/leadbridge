import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { GmailConnector } from "@/connectors/gmail/gmail-connector";
import { RestConnector } from "@/connectors/rest/rest-connector";

export const POST = withApiAuthorization("ADMIN", async (request) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  const kind = (body.kind as string) ?? (body.type as string);

  if (kind === "GMAIL" || kind === "gmail") {
    const key = body.key as string;
    if (!key) return apiError("Connector key is required.", 400);
    const result = await GmailConnector.testConnection(key);
    return NextResponse.json(result);
  }

  if (kind === "REST" || kind === "rest") {
    const config = body.config as Record<string, unknown>;
    if (!config) return apiError("REST connector configuration is required.", 400);
    const result = await RestConnector.testConnection(config);
    return NextResponse.json(result);
  }

  return apiError(`Unsupported connector kind: ${kind}`, 400);
});
