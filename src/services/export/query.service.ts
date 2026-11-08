import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import type { ExportActor } from "@/lib/export/policy";
import {
  leadExportFiltersSchema,
  providerExportFiltersSchema,
  reportExportFiltersSchema,
  syncHistoryExportFiltersSchema,
  userExportFiltersSchema,
} from "@/lib/export/filters";
import {
  buildLeadExportCursorWhere,
  buildLeadExportWhere,
  buildLeadOrderBy,
  buildReportLeadWhere,
  buildProviderExportCursorWhere,
  buildProviderExportWhere,
  buildProviderOrderBy,
  buildSyncHistoryExportCursorWhere,
  buildSyncHistoryExportWhere,
  buildSyncHistoryOrderBy,
  buildUserExportCursorWhere,
  buildUserExportWhere,
  buildUserOrderBy,
  type ExportDateBounds,
} from "@/services/export/query-builders";
import {
  resolveLeadProjection,
  resolveProviderProjection,
  resolveSyncHistoryProjection,
  resolveUserProjection,
} from "@/services/export/projections";
import { authorizeExportCategory, authorizeLeadExportFilters } from "@/services/export/authorization";
import { ServiceError } from "@/lib/service-errors";
import {
  assertExportRowLimit,
  EXPORT_QUERY_MAX_WAIT_MS,
  EXPORT_QUERY_STATEMENT_TIMEOUT_MS,
  EXPORT_QUERY_TRANSACTION_TIMEOUT_MS,
} from "@/services/export/limits";
import { iterateKeysetPages } from "@/services/export/keyset";

export const EXPORT_QUERY_BATCH_SIZE = 250;

async function runExportQuery<T>(query: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('statement_timeout', ${`${EXPORT_QUERY_STATEMENT_TIMEOUT_MS}ms`}, true)`;
    return query(tx);
  }, { maxWait: EXPORT_QUERY_MAX_WAIT_MS, timeout: EXPORT_QUERY_TRANSACTION_TIMEOUT_MS });
}

function project<T>(resolve: () => T): T {
  try {
    return resolve();
  } catch (error) {
    throw new ServiceError(error instanceof Error ? error.message : "Invalid export column selection.", 400);
  }
}

function parseRequest<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ServiceError(parsed.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; "), 400);
  return parsed.data;
}

export class ExportQueryService {
  async openLeads(actor: ExportActor, input: unknown, columns?: readonly string[], legacyBounds?: ExportDateBounds, signal?: AbortSignal) {
    authorizeExportCategory(actor, "leads");
    const filters = parseRequest(leadExportFiltersSchema, input);
    authorizeLeadExportFilters(actor, filters);
    const projection = project(() => resolveLeadProjection(columns));
    const where = buildLeadExportWhere(filters, actor, legacyBounds);
    const count = await runExportQuery((tx) => tx.lead.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: { createdAt: Date; id: string } | undefined, take) => runExportQuery((tx) => tx.lead.findMany({
        where: buildLeadExportCursorWhere(where, cursor), select: projection.select,
        orderBy: buildLeadOrderBy(), take,
      })),
      cursorFor: (row) => ({ createdAt: row.createdAt, id: row.id }),
    });
    return { count, columns: projection.columns, rows };
  }

  async openUsers(actor: ExportActor, input: unknown = {}, columns?: readonly string[], signal?: AbortSignal) {
    authorizeExportCategory(actor, "users");
    const filters = parseRequest(userExportFiltersSchema, input);
    const projection = project(() => resolveUserProjection(columns));
    const where = buildUserExportWhere(filters);
    const count = await runExportQuery((tx) => tx.user.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: string | undefined, take) => runExportQuery((tx) => tx.user.findMany({
        where: buildUserExportCursorWhere(where, cursor), select: projection.select,
        orderBy: buildUserOrderBy(), take,
      })),
      cursorFor: (row) => row.id,
    });
    return { count, columns: projection.columns, rows };
  }

  async openProviders(actor: ExportActor, input: unknown = {}, columns?: readonly string[], signal?: AbortSignal) {
    authorizeExportCategory(actor, "providers");
    const filters = parseRequest(providerExportFiltersSchema, input);
    const projection = project(() => resolveProviderProjection(columns));
    const where = buildProviderExportWhere(filters);
    const count = await runExportQuery((tx) => tx.leadSource.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: string | undefined, take) => runExportQuery((tx) => tx.leadSource.findMany({
        where: buildProviderExportCursorWhere(where, cursor), select: projection.select,
        orderBy: buildProviderOrderBy(), take,
      })),
      cursorFor: (row) => row.id,
    });
    return { count, columns: projection.columns, rows };
  }

  async openSyncHistory(actor: ExportActor, input: unknown = {}, columns?: readonly string[], legacyBounds?: ExportDateBounds, signal?: AbortSignal) {
    authorizeExportCategory(actor, "sync-history");
    const filters = parseRequest(syncHistoryExportFiltersSchema, input);
    const projection = project(() => resolveSyncHistoryProjection(columns));
    const where = buildSyncHistoryExportWhere(filters, legacyBounds);
    const count = await runExportQuery((tx) => tx.connectorSyncRun.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: { startedAt: Date; id: string } | undefined, take) => runExportQuery((tx) => tx.connectorSyncRun.findMany({
        where: buildSyncHistoryExportCursorWhere(where, cursor), select: projection.select,
        orderBy: buildSyncHistoryOrderBy(), take,
      })),
      cursorFor: (row) => ({ startedAt: row.startedAt, id: row.id }),
    });
    return { count, columns: projection.columns, rows };
  }

  validateReports(actor: ExportActor, input: unknown) {
    authorizeExportCategory(actor, "reports");
    return parseRequest(reportExportFiltersSchema, input);
  }

  async countReports(actor: ExportActor, input: unknown) {
    const filters = this.validateReports(actor, input);
    const count = await prisma.lead.count({ where: buildReportLeadWhere(filters) });
    return { count, filters };
  }
}

export const exportQueryService = new ExportQueryService();
