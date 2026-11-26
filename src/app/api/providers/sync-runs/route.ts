import { NextResponse } from "next/server";
import { apiError, handleApiError, withApiAuthorization } from "@/lib/api";
import { parseLegacySyncExport } from "@/lib/export/legacy-compatibility";
import { ServiceError } from "@/lib/service-errors";
import { connectorService } from "@/services/connector.service";
import { z } from "zod";

function parseNonNegativeInt(raw: string | null, fallback: number, max?: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || (max !== undefined && parsed > max)) {
    throw new ServiceError("Invalid pagination parameter.", 400);
  }
  return parsed;
}

export const GET = withApiAuthorization("ADMIN", async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const { filters, bounds } = parseLegacySyncExport(searchParams);
    const limit = parseNonNegativeInt(searchParams.get("limit"), 100, 100);
    if (limit < 1) return apiError("Limit must be at least 1.", 400);
    const offset = parseNonNegativeInt(searchParams.get("offset"), 0);
    const result = await connectorService.listSyncRunsPage({ filters, bounds, limit, offset });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("Invalid sync history filter parameters.", 400);
    }
    return handleApiError(error, "Could not load sync history.");
  }
});
