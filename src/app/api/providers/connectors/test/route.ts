import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { createConfiguredRuntime } from "@/connectors/platform";
import { connectorService } from "@/services/connector.service";

export const POST = withApiAuthorization("ADMIN", async (request) => {
  let body: unknown;
  try { body = await request.json(); } catch { return apiError("Invalid JSON body.", 400); }
  if (!body || typeof body !== "object" || !("key" in body) || !("kind" in body) || typeof body.key !== "string" || typeof body.kind !== "string") return apiError("Connector key and kind are required.", 400);
  return NextResponse.json(await connectorService.testConnection(body.key, body.kind as Parameters<typeof createConfiguredRuntime>[1]));
});
