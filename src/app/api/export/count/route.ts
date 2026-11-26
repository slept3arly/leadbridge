import { apiError, withApiAuthorization } from "@/lib/api";
import { isExportCategoryId } from "@/lib/export/registry";
import { ServiceError } from "@/lib/service-errors";
import {
  assertValidLegacyExportParameters,
  parseLegacyExportColumns,
  parseLegacyLeadExport,
  parseLegacyProviderExport,
  parseLegacyReportExport,
  parseLegacySyncExport,
  parseLegacyUserExport,
} from "@/lib/export/legacy-compatibility";
import { authorizeExportCategory } from "@/services/export/authorization";
import { exportQueryService } from "@/services/export/query.service";
import { z } from "zod";

function responseError(error: unknown): Response {
  if (error instanceof z.ZodError) return apiError("Invalid export parameters.", 400);
  if (error instanceof ServiceError) return apiError(error.message, error.status);
  return apiError("Could not calculate the matching export record count.", 500);
}

export const GET = withApiAuthorization(["ADMIN", "SALES"], async (request, _context, session) => {
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  if (!type) return apiError("Query parameter 'type' is required.", 400);
  if (!isExportCategoryId(type)) return apiError(`Unknown export type: ${type}.`, 400);

  try {
    authorizeExportCategory(session.user, type);
    assertValidLegacyExportParameters(type, params);
    let count: number;
    switch (type) {
      case "leads": {
        parseLegacyExportColumns("leads", params);
        const parsed = parseLegacyLeadExport(params);
        count = await exportQueryService.countLeads(session.user, parsed.filters, parsed.bounds);
        break;
      }
      case "users": {
        parseLegacyExportColumns("users", params);
        const parsed = parseLegacyUserExport(params);
        count = await exportQueryService.countUsers(session.user, parsed.filters, parsed.bounds);
        break;
      }
      case "providers":
        parseLegacyExportColumns("providers", params);
        count = await exportQueryService.countProviders(session.user, parseLegacyProviderExport(params).filters);
        break;
      case "sync-history": {
        const parsed = parseLegacySyncExport(params);
        count = await exportQueryService.countSyncHistory(session.user, parsed.filters, parsed.bounds);
        break;
      }
      case "reports":
        count = (await exportQueryService.countReports(session.user, parseLegacyReportExport(params).filters)).count;
        break;
      default:
        throw new ServiceError(`Export category '${type}' is not available yet.`, 404);
    }
    return Response.json({ category: type, count, ...(type === "reports" ? { countLabel: "matching leads summarized" } : {}) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return responseError(error);
  }
});
