import { apiError, withApiAuthorization } from "@/lib/api";
import { ServiceError } from "@/lib/service-errors";
import { isExportCategoryId, type ExportCategoryId } from "@/lib/export/registry";
import {
  parseLegacyLeadExport,
  parseLegacyProviderExport,
  parseLegacyReportExport,
  parseLegacySyncExport,
  parseLegacyUserExport,
} from "@/lib/export/legacy-compatibility";
import { LEGACY_EXPORT_QUERY_PARAMETERS } from "@/lib/export/legacy-contract";
import { exportService } from "@/services/export.service";
import { ExportDeadline, awaitBeforeDeadline } from "@/services/export/deadline";
import { createCsvByteStream, type ExportStreamSummary } from "@/services/export/csv-stream";
import { logExportOperation } from "@/services/export/operation-log";
import { authorizeExportCategory } from "@/services/export/authorization";
import { z } from "zod";

function safeReason(error: unknown): "VALIDATION_FAILED" | "UNAUTHORIZED" | "CATEGORY_UNAVAILABLE" | "ROW_LIMIT" | "TIMEOUT" | "QUERY_FAILED" {
  if (error instanceof z.ZodError) return "VALIDATION_FAILED";
  if (error instanceof ServiceError) {
    if (error.status === 400) return "VALIDATION_FAILED";
    if (error.status === 403) return "UNAUTHORIZED";
    if (error.status === 404) return "CATEGORY_UNAVAILABLE";
    if (error.status === 413) return "ROW_LIMIT";
    if (error.status === 504) return "TIMEOUT";
  }
  if (error instanceof Error && error.message === "EXPORT_TIMEOUT") return "TIMEOUT";
  return "QUERY_FAILED";
}

function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return apiError("Invalid export parameters.", 400, error.issues.map((issue) => ({ path: issue.path, message: issue.message })));
  }
  if (error instanceof ServiceError) return apiError(error.message, error.status);
  if (error instanceof Error && error.message === "EXPORT_TIMEOUT") return apiError("Export exceeded the 30 second execution limit.", 504);
  return apiError("Export failed.", 500);
}

function logPreStreamFailure(
  actor: { id: string; role: "ADMIN" | "SALES" },
  category: ExportCategoryId,
  startedAt: number,
  error: unknown,
  activeFilterGroups: string[],
): void {
  const reasonCode = safeReason(error);
  const outcome = reasonCode === "ROW_LIMIT" ? "LIMIT_EXCEEDED" : reasonCode === "TIMEOUT" ? "TIMEOUT" : "FAILED";
  logExportOperation({
    actorId: actor.id,
    actorRole: actor.role,
    category,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Math.max(0, Date.now() - startedAt),
    outcome,
    rowCount: 0,
    byteCount: 0,
    reasonCode,
    safeMetadata: { activeFilterGroups },
  });
}

function logStreamCompletion(
  actor: { id: string; role: "ADMIN" | "SALES" },
  category: ExportCategoryId,
  startedAt: number,
  activeFilterGroups: string[],
  summary: ExportStreamSummary,
): void {
  logExportOperation({
    actorId: actor.id,
    actorRole: actor.role,
    category,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: summary.durationMs,
    outcome: summary.outcome,
    rowCount: summary.rowCount,
    byteCount: summary.byteCount,
    ...(summary.reasonCode ? { reasonCode: summary.reasonCode } : {}),
    safeMetadata: { activeFilterGroups },
  });
}

export const GET = withApiAuthorization(["ADMIN", "SALES"], async (request, _context, session) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  if (!type) return apiError("Query parameter 'type' is required. Supported values: leads, users, providers, sync-history, reports", 400);
  if (!isExportCategoryId(type)) return apiError(`Unknown export type: ${type}. Supported: leads, users, providers, sync-history, reports`, 400);

  const startedAt = Date.now();
  const deadline = new ExportDeadline(startedAt);
  const allowedParams: readonly string[] = LEGACY_EXPORT_QUERY_PARAMETERS[type];
  const suppliedKeys = [...new Set([...searchParams.keys()])];
  const activeFilterGroups = suppliedKeys
    .filter((key) => key !== "type" && allowedParams.includes(key))
    .slice(0, 32);

  try {
    const unknown = suppliedKeys.filter((key) => !allowedParams.includes(key));
    if (unknown.length) throw new ServiceError(`Unknown export parameter(s): ${unknown.join(", ")}.`, 400);
    const duplicates = allowedParams.filter((key) => searchParams.getAll(key).length > 1);
    if (duplicates.length) throw new ServiceError(`Duplicate export parameter(s): ${duplicates.join(", ")}.`, 400);

    const opened = await awaitBeforeDeadline((async () => {
      switch (type) {
        case "leads":
          return exportService.openLeads(parseLegacyLeadExport(searchParams), session.user, deadline.signal);
        case "users":
          return exportService.openUsers(session.user, parseLegacyUserExport().filters, deadline.signal);
        case "providers":
          return exportService.openProviders(session.user, parseLegacyProviderExport().filters, deadline.signal);
        case "sync-history":
          return exportService.openSyncHistory(session.user, parseLegacySyncExport(searchParams), deadline.signal);
        case "reports":
          return exportService.openReports(session.user, parseLegacyReportExport(searchParams).filters, deadline.signal);
        default:
          authorizeExportCategory(session.user, type);
          throw new ServiceError(`Export category '${type}' is not available yet.`, 404);
      }
    })(), deadline);

    const body = createCsvByteStream(opened.records, deadline, (summary) => {
      logStreamCompletion(session.user, type, startedAt, activeFilterGroups, summary);
    });
    const filename = `${type}-${new Date().toISOString().split("T")[0]}.csv`;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    deadline.dispose();
    logPreStreamFailure(session.user, type, startedAt, error, activeFilterGroups);
    return errorResponse(error);
  }
});
