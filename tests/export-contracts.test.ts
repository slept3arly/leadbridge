import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPORT_CATEGORIES,
  EXPORT_CATEGORY_IDS,
  EXPORT_DATE_PRESETS,
  EXPORT_FIELDS,
  EXPORT_FILTER_COMBINATION,
  EXPORT_FORMATS,
  EXPORT_LIMITS,
  EXPORT_PREVIEW_DEFAULT_LIMIT,
  EXPORT_PREVIEW_MAX_LIMIT,
  SALES_SCOPE_RULES,
  canExportCategory,
  getDefaultExportColumns,
  getExportScopePolicy,
  isImplementedExportCategory,
  leadExportFiltersSchema,
  exportDateRangeSchema,
  exportCountRequestSchema,
  exportDownloadRequestSchema,
  exportPreviewRequestSchema,
  exportFiltersByCategory,
  parseImplementedExportCategory,
  reportExportFiltersSchema,
  resolveExportColumns,
  resolveExportDateRange,
  userExportFiltersSchema,
} from "../src/lib/export";

test("category registry contains the stable identifiers and current/planned availability", () => {
  assert.deepEqual(EXPORT_CATEGORY_IDS, [
    "leads", "activities", "follow-ups", "notes", "users", "providers", "connectors", "sync-history", "reports",
  ]);
  assert.deepEqual(Object.keys(EXPORT_CATEGORIES), [...EXPORT_CATEGORY_IDS]);

  const implemented = EXPORT_CATEGORY_IDS.filter(isImplementedExportCategory);
  assert.deepEqual(implemented, ["leads", "users", "providers", "sync-history", "reports"]);
  for (const planned of ["activities", "follow-ups", "notes", "connectors"] as const) {
    assert.equal(isImplementedExportCategory(planned), false);
    assert.equal(parseImplementedExportCategory(planned), null);
  }
  assert.equal(parseImplementedExportCategory("unknown"), null);
});

test("category authorization policy matches Admin and Sales privilege matrix", () => {
  const admin = { id: "admin-1", role: "ADMIN" } as const;
  const junior = { id: "sales-1", role: "SALES", salesPrivilege: "JUNIOR" } as const;
  const senior = { id: "sales-2", role: "SALES", salesPrivilege: "SENIOR" } as const;

  for (const category of EXPORT_CATEGORY_IDS) {
    assert.equal(canExportCategory(admin, category), true, `ADMIN should access ${category}`);
    assert.equal(canExportCategory(junior, category), false, `JUNIOR should not access ${category}`);
    assert.equal(canExportCategory(senior, category), ["leads", "activities", "follow-ups", "notes"].includes(category));
  }
  assert.equal(canExportCategory({ id: "sales-3", role: "SALES" }, "leads"), false, "missing privilege defaults to JUNIOR policy");
  assert.deepEqual(getExportScopePolicy("leads"), "ORGANIZATION_NON_DELETED_LEADS");
  assert.deepEqual(getExportScopePolicy("follow-ups"), "FOLLOW_UPS_FOR_VISIBLE_LEADS_ASSIGNED_TO_ACTOR");
  assert.equal(SALES_SCOPE_RULES.unassignedLeads, "DENY");
  assert.equal(SALES_SCOPE_RULES.clientSuppliedIdentityCanWidenScope, false);
});

test("date range contract validates custom boundaries and resolves consistent UTC calendar windows", () => {
  assert.deepEqual(EXPORT_DATE_PRESETS, ["all-time", "today", "yesterday", "last-7-days", "last-30-days", "this-month", "previous-month", "custom"]);
  assert.equal(exportDateRangeSchema.parse({}).preset, "all-time");
  assert.equal(exportDateRangeSchema.safeParse({ preset: "custom" }).success, false);
  assert.equal(exportDateRangeSchema.safeParse({ preset: "custom", custom: { from: "not-a-date", to: "2026-01-02" } }).success, false);
  assert.equal(exportDateRangeSchema.safeParse({ preset: "custom", custom: { from: "2026-02-02", to: "2026-02-01" } }).success, false);
  assert.equal(exportDateRangeSchema.safeParse({ preset: "custom", custom: { from: "2026-02-02", to: "2026-02-02" } }).success, true);
  assert.equal(exportDateRangeSchema.safeParse({ preset: "custom", custom: { from: "2026-02-02", to: "2026-02-03T00:00:00Z" } }).success, false);

  const now = new Date("2026-03-15T18:45:00.000Z");
  const expected = {
    "all-time": [undefined, undefined],
    today: ["2026-03-15T00:00:00.000Z", "2026-03-16T00:00:00.000Z"],
    yesterday: ["2026-03-14T00:00:00.000Z", "2026-03-15T00:00:00.000Z"],
    "last-7-days": ["2026-03-09T00:00:00.000Z", "2026-03-16T00:00:00.000Z"],
    "last-30-days": ["2026-02-14T00:00:00.000Z", "2026-03-16T00:00:00.000Z"],
    "this-month": ["2026-03-01T00:00:00.000Z", "2026-03-16T00:00:00.000Z"],
    "previous-month": ["2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z"],
  } as const;

  for (const [preset, [from, to]] of Object.entries(expected)) {
    const range = resolveExportDateRange({ preset: preset as keyof typeof expected }, now);
    assert.equal(range.from?.toISOString(), from);
    assert.equal(range.toExclusive?.toISOString(), to);
  }

  const dateOnly = resolveExportDateRange({ preset: "custom", custom: { from: "2026-03-01", to: "2026-03-01" } }, now);
  assert.equal(dateOnly.from?.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(dateOnly.toExclusive?.toISOString(), "2026-03-02T00:00:00.000Z");
  const timestamps = resolveExportDateRange({ preset: "custom", custom: { from: "2026-03-01T02:00:00+02:00", to: "2026-03-02T00:00:00Z" } }, now);
  assert.equal(timestamps.from?.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.equal(timestamps.toExclusive?.toISOString(), "2026-03-02T00:00:00.000Z");
});

test("category filter contracts reject unknown keys and unsupported date fields", () => {
  for (const [category, schema] of Object.entries(exportFiltersByCategory)) {
    assert.equal(schema.safeParse({ unexpectedContractKey: true }).success, false, `${category} should reject unknown keys`);
  }
  assert.equal(leadExportFiltersSchema.safeParse({ unknownFilter: true }).success, false);
  assert.equal(leadExportFiltersSchema.safeParse({ status: ["NOT_A_STATUS"] }).success, false);
  assert.equal(leadExportFiltersSchema.safeParse({ dateField: "updatedAt" }).success, false);
  assert.equal(reportExportFiltersSchema.safeParse({ dateField: "lastContactedAt" }).success, false);
  assert.equal(userExportFiltersSchema.safeParse({ active: "yes" }).success, false);
});

test("multi-select filters deduplicate values and define AND/OR semantics", () => {
  const parsed = leadExportFiltersSchema.parse({ status: ["NEW", "NEW", "LOST"] });
  assert.deepEqual(parsed.status, ["NEW", "LOST"]);
  assert.deepEqual(EXPORT_FILTER_COMBINATION, {
    betweenGroups: "AND",
    withinMultiSelect: "OR",
    searchAcrossFields: "OR",
    searchAgainstOtherGroups: "AND",
    dateAgainstOtherGroups: "AND",
    serverAuthorization: "AND",
    duplicateMultiSelectValues: "DEDUPLICATE_PRESERVE_FIRST_ORDER",
  });
});

test("field allowlists have deterministic defaults, optional columns, and reject restricted fields", () => {
  for (const category of EXPORT_CATEGORY_IDS) {
    const fields = EXPORT_FIELDS[category];
    const defaults = EXPORT_CATEGORIES[category].defaultFields;
    const optional = EXPORT_CATEGORIES[category].optionalFields;
    assert.ok(defaults.length > 0, `${category} has declared defaults`);
    assert.equal(new Set(defaults).size, defaults.length, `${category} defaults are unique`);
    assert.equal(new Set(optional).size, optional.length, `${category} optional columns are unique`);
    assert.deepEqual(defaults, fields.filter((item) => item.defaultSelected).map((item) => item.id));
    assert.deepEqual(optional, fields.filter((item) => !item.defaultSelected && item.selectable).map((item) => item.id));
  }
  assert.deepEqual(getDefaultExportColumns("leads").slice(0, 4), ["leadNumber", "name", "company", "email"]);
  assert.ok(EXPORT_FIELDS.leads.some((item) => item.id === "product" && !item.defaultSelected && item.selectable));
  assert.ok(EXPORT_CATEGORIES.notes.optionalFields.includes("content"));
  assert.deepEqual(resolveExportColumns("leads", ["product", "name"]), ["name", "product"]);
  assert.throws(() => resolveExportColumns("leads", ["rawPayload"]), /Unsupported export column/);
  assert.throws(() => resolveExportColumns("leads", ["customFields"]), /Unsupported export column/);
  assert.equal(EXPORT_CATEGORIES.connectors.restrictedFields.includes("raw connector configuration and secret-bearing values"), true);
});

test("request and output contracts accept CSV only and reject unavailable or unsafe selections", () => {
  const leadRequest = exportDownloadRequestSchema.safeParse({ category: "leads", filters: {}, columns: ["name", "product"] });
  assert.equal(leadRequest.success, true);
  if (leadRequest.success) assert.deepEqual(leadRequest.data.columns, ["name", "product"]);
  const reorderedRequest = exportDownloadRequestSchema.safeParse({ category: "leads", filters: {}, columns: ["product", "name"] });
  assert.equal(reorderedRequest.success, true);
  if (reorderedRequest.success) assert.deepEqual(reorderedRequest.data.columns, ["name", "product"]);
  assert.equal(exportDownloadRequestSchema.safeParse({ category: "leads", filters: {}, format: "xlsx" }).success, false);
  assert.equal(exportDownloadRequestSchema.safeParse({ category: "leads", filters: { unexpected: "value" } }).success, false);
  assert.equal(exportDownloadRequestSchema.safeParse({ category: "leads", filters: {}, columns: ["rawPayload"] }).success, false);
  assert.equal(exportDownloadRequestSchema.safeParse({ category: "reports", filters: {}, columns: ["summary"] }).success, false);
  assert.equal(exportDownloadRequestSchema.safeParse({ category: "unknown", filters: {} }).success, false);
  assert.deepEqual(EXPORT_FORMATS, ["csv"]);
  assert.equal(exportPreviewRequestSchema.parse({ category: "leads", filters: {} }).limit, EXPORT_PREVIEW_DEFAULT_LIMIT);
  assert.equal(exportPreviewRequestSchema.safeParse({ category: "leads", filters: {}, limit: EXPORT_PREVIEW_MAX_LIMIT + 1 }).success, false);
  assert.equal(exportCountRequestSchema.safeParse({ category: "leads", filters: {} }).success, true);
  assert.equal(exportCountRequestSchema.safeParse({ category: "leads", filters: { unrecognized: true } }).success, false);
});

test("synchronous limits and row-grain metadata are explicit", () => {
  assert.deepEqual(EXPORT_LIMITS, {
    maxRows: 50_000,
    maxSerializedBytes: 25_000_000,
    maxExecutionMs: 30_000,
    behavior: "Reject before streaming when detectable; terminate the stream without success if a later limit is exceeded.",
  });
  assert.match(EXPORT_CATEGORIES.activities.rowGrain, /ActivityEntry/);
  assert.match(EXPORT_CATEGORIES.reports.rowGrain, /aggregate/);
});
