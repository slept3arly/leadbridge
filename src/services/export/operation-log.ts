import { exportOperationLogSchema, type ExportOperationLog } from "@/lib/export/output";
import { logger } from "@/lib/logger";

export function logExportOperation(event: ExportOperationLog): void {
  try {
    const safeEvent = exportOperationLogSchema.parse(event);
    const fields = { event: "export.operation", ...safeEvent };
    if (safeEvent.outcome === "FAILED" || safeEvent.outcome === "LIMIT_EXCEEDED" || safeEvent.outcome === "TIMEOUT") {
      logger.warn(fields, "Export operation finished");
    } else {
      logger.info(fields, "Export operation finished");
    }
  } catch {
    try { logger.warn({ event: "export.operation_log_failure" }, "Export operation log could not be written"); } catch { /* Best-effort audit logging. */ }
  }
}
