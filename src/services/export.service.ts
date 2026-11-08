import type { ExportActor } from "@/lib/export/policy";
import { LEGACY_EXPORT_COLUMNS } from "@/services/export/projections";
import { exportQueryService } from "@/services/export/query.service";
import type { ExportDateBounds } from "@/services/export/query-builders";
import { reportService } from "@/services/report.service";
import type { ReportExportFilters } from "@/lib/export/filters";
import { EXPORT_LIMITS } from "@/lib/export/output";
import { ServiceError } from "@/lib/service-errors";
import { ExportDeliveryError, type CsvExportRecord } from "@/services/export/csv-stream";
import { resolveExportDateRange } from "@/lib/export/dates";
import { prisma } from "@/lib/prisma";
import {
  EXPORT_QUERY_MAX_WAIT_MS,
  EXPORT_QUERY_STATEMENT_TIMEOUT_MS,
  EXPORT_QUERY_TRANSACTION_TIMEOUT_MS,
} from "@/services/export/limits";
import {
  EXPORT_CSV_HEADERS,
  serializeCsvBlankLine,
  serializeLeadCsvRow,
  serializeProviderCsvRow,
  serializeReportCsvRow,
  serializeSyncRunCsvRow,
  serializeUserCsvRow,
} from "@/services/export/csv-serialization";
export { escapeCsv, toCsvRow } from "@/lib/csv";

function csv(values: unknown[], dataRows = 1): CsvExportRecord {
  try {
    return { csv: serializeReportCsvRow(values), dataRows };
  } catch {
    throw new ExportDeliveryError("SERIALIZATION_FAILED");
  }
}

function emptyLine(): CsvExportRecord {
  return { csv: serializeCsvBlankLine(), dataRows: 0 };
}

export class ExportService {
  async openLeads(params: { filters: unknown; bounds?: ExportDateBounds }, actor: ExportActor, signal: AbortSignal) {
    const result = await exportQueryService.openLeads(actor, params.filters, LEGACY_EXPORT_COLUMNS.leads, params.bounds, signal);
    const records = async function* (): AsyncGenerator<CsvExportRecord> {
      yield { csv: serializeReportCsvRow([...EXPORT_CSV_HEADERS.leads]), dataRows: 0 };
      for await (const lead of result.rows) {
        yield { csv: serializeLeadCsvRow(lead) };
      }
    };
    return { count: result.count, records: records() };
  }

  async openUsers(actor: ExportActor, filters: unknown, signal: AbortSignal) {
    const result = await exportQueryService.openUsers(actor, filters, LEGACY_EXPORT_COLUMNS.users, signal);
    const records = async function* (): AsyncGenerator<CsvExportRecord> {
      yield { csv: serializeReportCsvRow([...EXPORT_CSV_HEADERS.users]), dataRows: 0 };
      for await (const user of result.rows) {
        yield { csv: serializeUserCsvRow(user) };
      }
    };
    return { count: result.count, records: records() };
  }

  async openProviders(actor: ExportActor, filters: unknown, signal: AbortSignal) {
    const result = await exportQueryService.openProviders(actor, filters, LEGACY_EXPORT_COLUMNS.providers, signal);
    const records = async function* (): AsyncGenerator<CsvExportRecord> {
      yield { csv: serializeReportCsvRow([...EXPORT_CSV_HEADERS.providers]), dataRows: 0 };
      for await (const provider of result.rows) {
        yield { csv: serializeProviderCsvRow(provider) };
      }
    };
    return { count: result.count, records: records() };
  }

  async openSyncHistory(actor: ExportActor, params: { filters: unknown; bounds?: ExportDateBounds }, signal: AbortSignal) {
    const result = await exportQueryService.openSyncHistory(actor, params.filters, LEGACY_EXPORT_COLUMNS["sync-history"], params.bounds, signal);
    const records = async function* (): AsyncGenerator<CsvExportRecord> {
      yield { csv: serializeReportCsvRow([...EXPORT_CSV_HEADERS["sync-history"]]), dataRows: 0 };
      for await (const run of result.rows) {
        yield { csv: serializeSyncRunCsvRow(run) };
      }
    };
    return { count: result.count, records: records() };
  }

  async openReports(actor: ExportActor, filters: ReportExportFilters, signal: AbortSignal) {
    const validated = exportQueryService.validateReports(actor, filters);
    const range = validated.dateRange && validated.dateRange.preset !== "all-time"
      ? resolveExportDateRange(validated.dateRange)
      : undefined;
    const reportRange = range?.from && range.toExclusive
      ? { from: range.from, to: new Date(range.toExclusive.getTime() - 1) }
      : undefined;
    const dateLabel = reportRange ? `${reportRange.from.toISOString().split("T")[0]} to ${reportRange.to.toISOString().split("T")[0]}` : "All time";
    const [summary, sources, assignments, statusBreakdown, trends, activity] = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${`${EXPORT_QUERY_STATEMENT_TIMEOUT_MS}ms`}, true)`;
      return Promise.all([
        reportService.leadSummary(reportRange, validated, tx),
        reportService.leadSources(reportRange, validated, tx),
        reportService.assignments(reportRange, validated, tx),
        reportService.statusBreakdown(reportRange, validated, tx),
        reportService.monthlyTrends(validated, tx),
        reportService.activity(validated, tx),
      ]);
    }, { maxWait: EXPORT_QUERY_MAX_WAIT_MS, timeout: EXPORT_QUERY_TRANSACTION_TIMEOUT_MS });
    if (signal.aborted) throw new ServiceError("Export request timed out.", 504);

    const outputRows = 23 + statusBreakdown.length + sources.byProvider.length + assignments.bySalesperson.length + trends.length;
    if (outputRows > EXPORT_LIMITS.maxRows) throw new ServiceError(`Report exceeds the ${EXPORT_LIMITS.maxRows.toLocaleString()} output row limit.`, 413);
    const records = async function* (): AsyncGenerator<CsvExportRecord> {
      yield csv(["LeadBridge Report", dateLabel, "", "", ""]);
      yield emptyLine();
      yield csv(["Metric", "Value", "", "", ""]);
      yield csv(["Total Leads", summary.total, "", "", ""]);
      yield csv(["Active", summary.active, "", "", ""]);
      yield csv(["Won", summary.won, "", "", ""]);
      yield csv(["Lost", summary.lost, "", "", ""]);
      yield csv(["Conversion Rate", `${summary.conversionRate}%`, "", "", ""]);
      yield csv(["Open Rate", `${summary.openRate}%`, "", "", ""]);
      yield emptyLine();
      yield csv(["Lead Status", "Count", "", "", ""]);
      for (const status of statusBreakdown) yield csv([status.status, status.count, "", "", ""]);
      yield emptyLine();
      yield csv(["Lead Source", "Leads", "", "", ""]);
      for (const source of sources.byProvider) yield csv([source.providerName, source.count, "", "", ""]);
      yield emptyLine();
      yield csv(["Salesperson", "Assigned Leads", "", "", ""]);
      for (const assignment of assignments.bySalesperson) yield csv([assignment.userName, assignment.leadCount, "", "", ""]);
      yield csv(["Unassigned", assignments.unassigned, "", "", ""]);
      yield emptyLine();
      yield csv(["Month", "Created", "Won", "Lost", ""]);
      for (const trend of trends) yield csv([trend.month, trend.total, trend.won, trend.lost, ""]);
      yield emptyLine();
      yield csv(["Activity", "Count", "", "", ""]);
      yield csv(["Today", activity.today, "", "", ""]);
      yield csv(["This Week", activity.thisWeek, "", "", ""]);
      yield csv(["This Month", activity.thisMonth, "", "", ""]);
    };
    return { count: outputRows, records: records() };
  }
}

export const exportService = new ExportService();
