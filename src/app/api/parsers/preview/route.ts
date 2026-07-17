import { NextResponse } from "next/server";
import { withApiAuthorization, apiError } from "@/lib/api";
import { parserService } from "@/services/parser.service";
import { LeadNormalizer } from "@/runtime/lead-normalizer";

export const POST = withApiAuthorization("ADMIN", async (request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body.", 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("parserKey" in body) ||
    typeof body.parserKey !== "string" ||
    !("payload" in body) ||
    typeof body.payload !== "object"
  ) {
    return apiError("parserKey (string) and payload (object) are required.", 400);
  }

  const parser = parserService.get(body.parserKey);
  if (!parser) {
    return apiError(`Parser '${body.parserKey}' not found.`, 404);
  }

  try {
    const lead = parser.parse(body.payload as Record<string, unknown>);
    const normalizer = new LeadNormalizer();
    const { lead: validated, warnings } = normalizer.validate(lead);

    return NextResponse.json({
      data: {
        success: true,
        parsed: lead,
        validated,
        warnings,
        manifest: parser.manifest,
      },
    });
  } catch (error) {
    return NextResponse.json({
      data: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        manifest: parser.manifest,
      },
    });
  }
});
