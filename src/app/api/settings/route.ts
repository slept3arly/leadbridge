import { NextResponse } from "next/server";
import { withApiAuthorization, apiError, handleApiError } from "@/lib/api";
import { settingsService } from "@/services/settings.service";

export const GET = withApiAuthorization("ADMIN", async () => {
  try {
    const settings = await settingsService.getAll();
    const definitions = settingsService.getDefinitions();
    return NextResponse.json({ data: { settings, definitions } });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Failed to fetch settings", 500);
  }
});

export const PATCH = withApiAuthorization("ADMIN", async (request, _ctx, session) => {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return apiError("Request body must be a non-empty object with key-value pairs", 400);
    }
    const updated = await settingsService.updateMany(body, session.user.id);
    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error, "Failed to update settings");
  }
});
