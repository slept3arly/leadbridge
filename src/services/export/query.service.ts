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

async function runExportQuery<T>(database: typeof prisma, query: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return database.$transaction(async (tx) => {
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
  constructor(private readonly database: typeof prisma = prisma) {}

  private run<T>(query: (tx: Prisma.TransactionClient) => Promise<T>) {
    return runExportQuery(this.database, query);
  }

  private prepareLeads(actor: ExportActor, input: unknown, columns?: readonly string[], legacyBounds?: ExportDateBounds) {
    authorizeExportCategory(actor, "leads");
    const filters = parseRequest(leadExportFiltersSchema, input);
    authorizeLeadExportFilters(actor, filters);
    const projection = project(() => resolveLeadProjection(columns));
    return { projection, where: buildLeadExportWhere(filters, actor, legacyBounds) };
  }

  private prepareUsers(actor: ExportActor, input: unknown = {}, columns?: readonly string[], legacyBounds?: ExportDateBounds) {
    authorizeExportCategory(actor, "users");
    const filters = parseRequest(userExportFiltersSchema, input);
    const projection = project(() => resolveUserProjection(columns));
    return { projection, where: buildUserExportWhere(filters, legacyBounds) };
  }

  private prepareProviders(actor: ExportActor, input: unknown = {}, columns?: readonly string[]) {
    authorizeExportCategory(actor, "providers");
    const filters = parseRequest(providerExportFiltersSchema, input);
    const projection = project(() => resolveProviderProjection(columns));
    return { projection, where: buildProviderExportWhere(filters) };
  }

  async openLeads(actor: ExportActor, input: unknown, columns?: readonly string[], legacyBounds?: ExportDateBounds, signal?: AbortSignal) {
    const { projection, where } = this.prepareLeads(actor, input, columns, legacyBounds);
    const count = await this.run((tx) => tx.lead.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: { createdAt: Date; id: string } | undefined, take) => this.run((tx) => tx.lead.findMany({
        where: buildLeadExportCursorWhere(where, cursor), select: projection.select,
        orderBy: buildLeadOrderBy(), take,
      })),
      cursorFor: (row) => ({ createdAt: row.createdAt, id: row.id }),
    });
    return { count, columns: projection.columns, rows };
  }

  async openUsers(actor: ExportActor, input: unknown = {}, columns?: readonly string[], signal?: AbortSignal, legacyBounds?: ExportDateBounds) {
    const { projection, where } = this.prepareUsers(actor, input, columns, legacyBounds);
    const count = await this.run((tx) => tx.user.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: string | undefined, take) => this.run((tx) => tx.user.findMany({
        where: buildUserExportCursorWhere(where, cursor), select: projection.select,
        orderBy: buildUserOrderBy(), take,
      })),
      cursorFor: (row) => row.id,
    });
    return { count, columns: projection.columns, rows };
  }

  async openProviders(actor: ExportActor, input: unknown = {}, columns?: readonly string[], signal?: AbortSignal) {
    const { projection, where } = this.prepareProviders(actor, input, columns);
    const count = await this.run((tx) => tx.leadSource.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: string | undefined, take) => this.run((tx) => tx.leadSource.findMany({
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
    const count = await this.run((tx) => tx.connectorSyncRun.count({ where }));
    assertExportRowLimit(count);

    const rows = iterateKeysetPages({
      count, signal, batchSize: EXPORT_QUERY_BATCH_SIZE,
      fetchPage: (cursor: { startedAt: Date; id: string } | undefined, take) => this.run((tx) => tx.connectorSyncRun.findMany({
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
    const count = await this.run((tx) => tx.lead.count({ where: buildReportLeadWhere(filters) }));
    return { count, filters };
  }

  async countLeads(actor: ExportActor, input: unknown, legacyBounds?: ExportDateBounds) {
    const { where } = this.prepareLeads(actor, input, undefined, legacyBounds);
    return this.run((tx) => tx.lead.count({ where }));
  }

  async countUsers(actor: ExportActor, input: unknown = {}, legacyBounds?: ExportDateBounds) {
    const { where } = this.prepareUsers(actor, input, undefined, legacyBounds);
    return this.run((tx) => tx.user.count({ where }));
  }

  async countProviders(actor: ExportActor, input: unknown = {}) {
    const { where } = this.prepareProviders(actor, input);
    return this.run((tx) => tx.leadSource.count({ where }));
  }

  async countSyncHistory(actor: ExportActor, input: unknown, legacyBounds?: ExportDateBounds) {
    authorizeExportCategory(actor, "sync-history");
    const filters = parseRequest(syncHistoryExportFiltersSchema, input);
    const where = buildSyncHistoryExportWhere(filters, legacyBounds);
    return this.run((tx) => tx.connectorSyncRun.count({ where }));
  }
}

export const exportQueryService = new ExportQueryService();
