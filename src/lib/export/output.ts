import { z } from "zod";
import { exportFiltersByCategory } from "@/lib/export/filters";
import { EXPORT_CATEGORIES, EXPORT_CATEGORY_IDS, type ExportCategoryId } from "@/lib/export/registry";
import { resolveExportColumns } from "@/lib/export/fields";

export const EXPORT_FORMATS = ["csv"] as const;
export const exportFormatSchema = z.enum(EXPORT_FORMATS);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

const columnIds = z.array(z.string().trim().min(1).max(80)).min(1).max(100)
  .transform((columns) => [...new Set(columns)]);

function exportRequestVariant<C extends ExportCategoryId>(category: C) {
  const filters = exportFiltersByCategory[category];
  return z.object({
    category: z.literal(category),
    filters,
    columns: columnIds.optional(),
    format: exportFormatSchema.default("csv"),
  }).strict().superRefine((request, ctx) => {
    const definition = EXPORT_CATEGORIES[category];
    if (!definition.columnSelection && request.columns) {
      ctx.addIssue({ code: "custom", path: ["columns"], message: "Column selection is not supported for this category." });
      return;
    }
    if (request.columns) {
      try {
        resolveExportColumns(category as keyof typeof import("@/lib/export/fields").EXPORT_FIELDS, request.columns);
      } catch (error) {
        ctx.addIssue({ code: "custom", path: ["columns"], message: error instanceof Error ? error.message : "Unsupported export column." });
      }
    }
  });
}

const rawExportDownloadRequestSchema = z.discriminatedUnion("category", [
  exportRequestVariant("leads"),
  exportRequestVariant("activities"),
  exportRequestVariant("follow-ups"),
  exportRequestVariant("notes"),
  exportRequestVariant("users"),
  exportRequestVariant("providers"),
  exportRequestVariant("connectors"),
  exportRequestVariant("sync-history"),
  exportRequestVariant("reports"),
]);

export const exportDownloadRequestSchema = rawExportDownloadRequestSchema.transform((request) => {
  if (!request.columns) return request;
  return {
    ...request,
    columns: resolveExportColumns(request.category as keyof typeof import("@/lib/export/fields").EXPORT_FIELDS, request.columns),
  };
});

export type ExportDownloadRequest = z.infer<typeof exportDownloadRequestSchema>;

export const EXPORT_PREVIEW_DEFAULT_LIMIT = 20;
export const EXPORT_PREVIEW_MAX_LIMIT = 100;
function previewRequestVariant<C extends (typeof EXPORT_CATEGORY_IDS)[number]>(category: C) {
  return z.object({
    category: z.literal(category),
    filters: exportFiltersByCategory[category],
    limit: z.number().int().min(1).max(EXPORT_PREVIEW_MAX_LIMIT).default(EXPORT_PREVIEW_DEFAULT_LIMIT),
  }).strict();
}

export const exportPreviewRequestSchema = z.discriminatedUnion("category", [
  previewRequestVariant("leads"),
  previewRequestVariant("activities"),
  previewRequestVariant("follow-ups"),
  previewRequestVariant("notes"),
  previewRequestVariant("users"),
  previewRequestVariant("providers"),
  previewRequestVariant("connectors"),
  previewRequestVariant("sync-history"),
  previewRequestVariant("reports"),
]);

export type ExportPreviewRequest = z.infer<typeof exportPreviewRequestSchema>;

function countRequestVariant<C extends (typeof EXPORT_CATEGORY_IDS)[number]>(category: C) {
  return z.object({
    category: z.literal(category),
    filters: exportFiltersByCategory[category],
  }).strict();
}

export const exportCountRequestSchema = z.discriminatedUnion("category", [
  countRequestVariant("leads"),
  countRequestVariant("activities"),
  countRequestVariant("follow-ups"),
  countRequestVariant("notes"),
  countRequestVariant("users"),
  countRequestVariant("providers"),
  countRequestVariant("connectors"),
  countRequestVariant("sync-history"),
  countRequestVariant("reports"),
]);

export type ExportCountRequest = z.infer<typeof exportCountRequestSchema>;

export const EXPORT_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "CATEGORY_NOT_IMPLEMENTED",
  "LIMIT_EXCEEDED",
  "EXPORT_TIMEOUT",
  "EXPORT_FAILED",
] as const;
export const exportErrorCodeSchema = z.enum(EXPORT_ERROR_CODES);
export const exportValidationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  message: z.string(),
}).strict();
export const exportErrorResponseSchema = z.object({
  error: z.object({
    code: exportErrorCodeSchema,
    message: z.string(),
    issues: z.array(exportValidationIssueSchema).optional(),
  }).strict(),
}).strict();

export const exportDownloadMetadataSchema = z.object({
  category: z.enum(EXPORT_CATEGORY_IDS),
  format: exportFormatSchema,
  filename: z.string().min(1).max(180),
  contentType: z.literal("text/csv; charset=utf-8"),
  generatedAt: z.iso.datetime({ offset: true }),
  rowCount: z.number().int().min(0),
  byteCount: z.number().int().min(0),
  empty: z.boolean(),
}).strict();

export const EXPORT_EMPTY_RESULT_POLICY = {
  preview: "Return count 0 and an explicit empty flag.",
  download: "Return a valid header-only CSV and metadata with rowCount 0 and empty true.",
} as const;

export const EXPORT_CSV_REPRESENTATION = {
  format: "UTF-8 CSV; comma delimiter; LF record separator",
  headers: "Explicit registry headers in deterministic registry order",
  null: "Empty cell",
  dates: "ISO-8601 UTC",
  enums: "Stable Prisma enum value",
  booleans: "true or false",
  decimals: "Base-10 decimal string without locale formatting",
  spreadsheetFormulas: "Prefix text cells that could be formulas with an apostrophe before CSV quoting",
} as const;

export const EXPORT_LIMITS = {
  maxRows: 50_000,
  maxSerializedBytes: 25_000_000,
  maxExecutionMs: 30_000,
  behavior: "Reject before streaming when detectable; terminate the stream without success if a later limit is exceeded.",
} as const;

export const EXPORT_OPERATION_LOG_FIELDS = [
  "actorId",
  "actorRole",
  "category",
  "startedAt",
  "durationMs",
  "outcome",
  "rowCount",
  "byteCount",
  "reasonCode",
  "safeMetadata",
] as const;

export const EXPORT_OPERATION_REASON_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "CATEGORY_UNAVAILABLE",
  "ROW_LIMIT",
  "BYTE_LIMIT",
  "TIMEOUT",
  "QUERY_FAILED",
  "SERIALIZATION_FAILED",
] as const;

export const exportOperationLogSchema = z.object({
  actorId: z.string().min(1).max(128),
  actorRole: z.enum(["ADMIN", "SALES"]),
  category: z.enum(EXPORT_CATEGORY_IDS),
  startedAt: z.iso.datetime({ offset: true }),
  durationMs: z.number().int().min(0),
  outcome: z.enum(["SUCCESS", "EMPTY", "FAILED", "LIMIT_EXCEEDED", "TIMEOUT", "CANCELLED"]),
  rowCount: z.number().int().min(0).optional(),
  byteCount: z.number().int().min(0).optional(),
  reasonCode: z.enum(EXPORT_OPERATION_REASON_CODES).optional(),
  safeMetadata: z.object({
    datePreset: z.string().max(32).optional(),
    dateField: z.string().max(40).optional(),
    activeFilterGroups: z.array(z.string().max(40)).max(32).optional(),
    selectedColumnCount: z.number().int().min(0).max(100).optional(),
  }).strict(),
}).strict();

export type ExportOperationLog = z.infer<typeof exportOperationLogSchema>;
