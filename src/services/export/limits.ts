import { EXPORT_LIMITS } from "@/lib/export/output";
import { ServiceError } from "@/lib/service-errors";

export const EXPORT_QUERY_STATEMENT_TIMEOUT_MS = 15_000;
export const EXPORT_QUERY_TRANSACTION_TIMEOUT_MS = 16_000;
export const EXPORT_QUERY_MAX_WAIT_MS = 2_000;

export function assertExportRowLimit(count: number, label = "Export"): void {
  if (count > EXPORT_LIMITS.maxRows) {
    throw new ServiceError(`${label} exceeds the ${EXPORT_LIMITS.maxRows.toLocaleString()} row limit.`, 413);
  }
}
