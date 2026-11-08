import { leadExportFiltersSchema, providerExportFiltersSchema, syncHistoryExportFiltersSchema, userExportFiltersSchema, reportExportFiltersSchema } from "@/lib/export/filters";
import { exportDateInputSchema, type ResolvedExportDateRange } from "@/lib/export/dates";
import { ServiceError } from "@/lib/service-errors";
export { LEGACY_EXPORT_COLUMNS, LEGACY_EXPORT_QUERY_PARAMETERS } from "@/lib/export/legacy-contract";

function parseLegacyDate(value: string | null): Date | undefined {
  if (value === null) return undefined;
  const parsed = exportDateInputSchema.safeParse(value);
  if (!parsed.success) throw new ServiceError("Export dates must be ISO-8601 timestamps or YYYY-MM-DD calendar dates.", 400);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new ServiceError("Invalid export date.", 400);
  return date;
}

function legacyBounds(params: URLSearchParams): ResolvedExportDateRange | undefined {
  const from = parseLegacyDate(params.get("from"));
  const to = parseLegacyDate(params.get("to"));
  if (!from && !to) return undefined;
  if (from && to && from.getTime() > to.getTime()) throw new ServiceError("The end date must not precede the start date.", 400);
  // The legacy endpoint treated `to` as inclusive. Add one millisecond and
  // convert to the new [from, toExclusive) internal representation.
  return { ...(from ? { from } : {}), ...(to ? { toExclusive: new Date(to.getTime() + 1) } : {}) };
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
      assignedUserIds: assignedUserId && assignedUserId !== "unassigned" ? [assignedUserId] : undefined,
      assignedUnassigned: assignedUserId === "unassigned" ? true : undefined,
      ...parseActivityDate(params),
      archived: archived === "true" ? "archived" : archived === "false" ? "active" : "both",
      search: params.get("search") || undefined,
    }),
    bounds,
  };
}

export function parseLegacyUserExport() {
  return { filters: userExportFiltersSchema.parse({}) };
}

export function parseLegacyProviderExport() {
  // The old provider download silently returned active sources only.
  return { filters: providerExportFiltersSchema.parse({ active: true }) };
}

export function parseLegacySyncExport(params: URLSearchParams) {
  const bounds = legacyBounds(params);
  return {
    filters: syncHistoryExportFiltersSchema.parse({ connectorIds: params.get("connectorId") ? [params.get("connectorId")] : undefined }),
    bounds,
  };
}

export function parseLegacyReportExport(params: URLSearchParams) {
  const from = parseLegacyDate(params.get("from"));
  const to = parseLegacyDate(params.get("to"));
  if (!!from !== !!to) throw new ServiceError("Reports require both from and to dates, or neither.", 400);
  if (from && to && from.getTime() > to.getTime()) throw new ServiceError("The end date must not precede the start date.", 400);
  const filters = reportExportFiltersSchema.parse({
    dateRange: from && to ? { preset: "custom", custom: { from: from.toISOString(), to: new Date(to.getTime() + 1).toISOString() } } : undefined,
  });
  return { filters };
}
