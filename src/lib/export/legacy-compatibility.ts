import { leadExportFiltersSchema, providerExportFiltersSchema, syncHistoryExportFiltersSchema, userExportFiltersSchema, reportExportFiltersSchema } from "@/lib/export/filters";
import { exportDateInputSchema, type ResolvedExportDateRange } from "@/lib/export/dates";
import { ServiceError } from "@/lib/service-errors";
import { resolveExportColumns } from "@/lib/export/fields";
import { LEGACY_EXPORT_QUERY_PARAMETERS } from "@/lib/export/legacy-contract";
import type { ExportCategoryId } from "@/lib/export/registry";
export { LEGACY_EXPORT_COLUMNS, LEGACY_EXPORT_QUERY_PARAMETERS } from "@/lib/export/legacy-contract";

export function assertValidLegacyExportParameters(category: ExportCategoryId, params: URLSearchParams): void {
  const allowed = LEGACY_EXPORT_QUERY_PARAMETERS[category] as readonly string[];
  const keys = [...new Set([...params.keys()])];
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (unknown.length) throw new ServiceError(`Unknown export parameter(s): ${unknown.join(", ")}.`, 400);
  const duplicates = allowed.filter((key) => params.getAll(key).length > 1);
  if (duplicates.length) throw new ServiceError(`Duplicate export parameter(s): ${duplicates.join(", ")}.`, 400);
}

export function parseLegacyExportColumns(category: "leads" | "users" | "providers", params: URLSearchParams): string[] {
  const raw = params.get("columns");
  if (raw === null) return resolveExportColumns(category);
  const requested = raw.split(",").map((column) => column.trim());
  if (requested.some((column) => !column)) throw new ServiceError("Export columns must be non-empty field identifiers.", 400);
  try {
    return resolveExportColumns(category, requested);
  } catch (error) {
    throw new ServiceError(error instanceof Error ? error.message : "Invalid export columns.", 400);
  }
}

function parseLegacyDate(value: string | null): Date | undefined {
  if (value === null) return undefined;
  const parsed = exportDateInputSchema.safeParse(value);
  if (!parsed.success) throw new ServiceError("Export dates must be ISO-8601 timestamps or YYYY-MM-DD calendar dates.", 400);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new ServiceError("Invalid export date.", 400);
  return date;
}

function inclusiveEndExclusive(value: string, date: Date): Date {
  if (value.length === 10) {
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return nextDay;
  }
  return new Date(date.getTime() + 1);
}

function legacyBounds(params: URLSearchParams): ResolvedExportDateRange | undefined {
  const from = parseLegacyDate(params.get("from"));
  const to = parseLegacyDate(params.get("to"));
  if (!from && !to) return undefined;
  if (from && to && from.getTime() > to.getTime()) throw new ServiceError("The end date must not precede the start date.", 400);
  // Preserve inclusive timestamp bounds; a date-only end includes its UTC day.
  return { ...(from ? { from } : {}), ...(to ? { toExclusive: inclusiveEndExclusive(params.get("to")!, to) } : {}) };
}

function parseMultiValue(params: URLSearchParams, key: string): string[] | undefined {
  const value = params.get(key);
  if (value === null || value.trim() === "") return undefined;
  const values = value.split(",").map((item) => item.trim());
  if (values.some((item) => item.length === 0)) throw new ServiceError(`Invalid '${key}' filter.`, 400);
  return values;
}

function parseActivityDate(params: URLSearchParams): Pick<
  ReturnType<typeof leadExportFiltersSchema.parse>,
  "activityDate" | "activityFrom" | "activityTo"
> {
  const date = params.get("activityDate");
  const from = params.get("activityFrom") ?? undefined;
  const to = params.get("activityTo") ?? undefined;
  if (date === "any") {
    if (from || to) throw new ServiceError("Activity date boundaries require a custom activity date selection.", 400);
    return {};
  }
  if (date && date !== "today" && date !== "yesterday" && date !== "custom") {
    throw new ServiceError("Invalid activity date selection.", 400);
  }
  return {
    ...(date === "today" || date === "yesterday" || date === "custom" ? { activityDate: date } : {}),
    ...(from ? { activityFrom: from } : {}),
    ...(to ? { activityTo: to } : {}),
  };
}

export function parseLegacyLeadExport(params: URLSearchParams) {
  const bounds = legacyBounds(params);
  const assignedUserId = params.get("assignedUserId");
  if (assignedUserId?.includes(",")) throw new ServiceError("Only one assigned salesperson may be selected.", 400);
  const archived = params.get("archived");
  if (archived !== null && archived !== "true" && archived !== "false") {
    throw new ServiceError("The archived filter must be true or false.", 400);
  }
  return {
    filters: leadExportFiltersSchema.parse({
      status: parseMultiValue(params, "status"),
      priority: parseMultiValue(params, "priority"),
      category: parseMultiValue(params, "category"),
      sourceIds: parseMultiValue(params, "source"),
      actions: parseMultiValue(params, "activityAction"),
      responses: parseMultiValue(params, "activityResponse"),
      interests: parseMultiValue(params, "activityInterest"),
      reasons: parseMultiValue(params, "activityReason"),
      assignedUserIds: assignedUserId && assignedUserId !== "unassigned" ? [assignedUserId] : undefined,
      assignedUnassigned: assignedUserId === "unassigned" ? true : undefined,
      ...parseActivityDate(params),
      archived: archived === "true" ? "archived" : archived === "false" ? "active" : "both",
      search: params.get("search") || undefined,
    }),
    bounds,
  };
}

function parseBooleanFilter(params: URLSearchParams, key: string, defaultValue?: boolean): boolean | undefined {
  const raw = params.get(key);
  if (raw === null) return defaultValue;
  if (raw === "all") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ServiceError(`The ${key} filter must be true, false, or all.`, 400);
}

export function parseLegacyUserExport(params: URLSearchParams = new URLSearchParams()) {
  const bounds = legacyBounds(params);
  return {
    filters: userExportFiltersSchema.parse({
      roles: parseMultiValue(params, "role"),
      salesPrivileges: parseMultiValue(params, "salesPrivilege"),
      designations: parseMultiValue(params, "designation"),
      active: parseBooleanFilter(params, "active"),
      banned: parseBooleanFilter(params, "banned"),
      search: params.get("search")?.trim() || undefined,
    }),
    bounds,
  };
}

export function parseLegacyProviderExport(params: URLSearchParams = new URLSearchParams()) {
  // The old provider download silently returned active sources only; preserve that default when `active` is omitted.
  return {
    filters: providerExportFiltersSchema.parse({
      active: parseBooleanFilter(params, "active", true),
      sourceTypes: parseMultiValue(params, "sourceType"),
    }),
  };
}

export function parseLegacySyncExport(params: URLSearchParams) {
  const bounds = legacyBounds(params);
  return {
    filters: syncHistoryExportFiltersSchema.parse({
      connectorIds: parseMultiValue(params, "connectorId"),
      statuses: parseMultiValue(params, "status"),
      errorOutcome: params.get("errorOutcome") ?? undefined,
    }),
    bounds,
  };
}

export function parseLegacyReportExport(params: URLSearchParams) {
  const from = parseLegacyDate(params.get("from"));
  const to = parseLegacyDate(params.get("to"));
  if (!!from !== !!to) throw new ServiceError("Reports require both from and to dates, or neither.", 400);
  if (from && to && from.getTime() > to.getTime()) throw new ServiceError("The end date must not precede the start date.", 400);
  const filters = reportExportFiltersSchema.parse({
    dateRange: from && to ? { preset: "custom", custom: { from: from.toISOString(), to: inclusiveEndExclusive(params.get("to")!, to).toISOString() } } : undefined,
    sourceIds: parseMultiValue(params, "source"),
    ownerIds: parseMultiValue(params, "owner"),
    statuses: parseMultiValue(params, "status"),
  });
  return { filters };
}
