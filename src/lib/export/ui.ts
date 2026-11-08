import { EXPORT_CATEGORIES, EXPORT_CATEGORY_IDS, type ExportCategoryId } from "@/lib/export/registry";
import { EXPORT_FIELDS } from "@/lib/export/fields";
import { EXPORT_DATE_PRESETS, resolveExportDateRange, type ExportDatePreset } from "@/lib/export/dates";
import { LEGACY_EXPORT_COLUMNS, LEGACY_EXPORT_QUERY_PARAMETERS } from "@/lib/export/legacy-contract";
import { canExportCategory, type ExportActor } from "@/lib/export/policy";
import { LEAD_CATEGORIES, LEAD_PRIORITIES, LEAD_STATUSES } from "@/lib/lead-constants";
import { ACTIVITY_ACTION_OPTIONS, ACTIVITY_INTEREST_OPTIONS, ACTIVITY_RESPONSE_OPTIONS } from "@/lib/activity-options";

export type ExportUiRole = "ADMIN" | "SALES";
export type ExportUiActor = Pick<ExportActor, "id" | "role" | "salesPrivilege">;

export type ExportWorkspaceSelection = {
  status: string[];
  sourceIds: string[];
  actions: string[];
  responses: string[];
  priorities: string[];
  categories: string[];
  interests: string[];
  assignedUserId: string;
  archived: "both" | "active" | "archived";
  search: string;
  datePreset: ExportDatePreset;
  dateFrom: string;
  dateTo: string;
  activityDate: "any" | "today" | "yesterday" | "custom";
  activityFrom: string;
  activityTo: string;
  connectorId: string;
};

export type ExportQueryResult =
  | { ok: true; params: URLSearchParams }
  | { ok: false; error: string };

export function getAvailableExportCategories(actor: ExportUiActor) {
  return EXPORT_CATEGORY_IDS
    .filter((category) => EXPORT_CATEGORIES[category].availability === "implemented")
    .filter((category) => canExportCategory(actor, category))
    .map((category) => EXPORT_CATEGORIES[category]);
}

export function createDefaultExportSelection(): ExportWorkspaceSelection {
  return {
    status: [],
    sourceIds: [],
    actions: [],
    responses: [],
    priorities: [],
    categories: [],
    interests: [],
    assignedUserId: "",
    archived: "both",
    search: "",
    datePreset: "all-time",
    dateFrom: "",
    dateTo: "",
    activityDate: "any",
    activityFrom: "",
    activityTo: "",
    connectorId: "",
  };
}

export function getCurrentCsvHeaders(category: ExportCategoryId): string[] {
  if (category === "reports") return [];
  const fields = EXPORT_FIELDS[category as keyof typeof LEGACY_EXPORT_COLUMNS];
  return LEGACY_EXPORT_COLUMNS[category as keyof typeof LEGACY_EXPORT_COLUMNS]
    .map((id) => fields.find((field) => field.id === id)?.header)
    .filter((header): header is string => Boolean(header));
}

function dateQueryValues(
  preset: ExportDatePreset,
  dateFrom: string,
  dateTo: string,
  now: Date,
): { from?: string; to?: string } | string {
  if (preset === "custom") {
    if (!dateFrom || !dateTo) return "Choose both a start and end date for a custom range.";
    if (!isValidDateOnly(dateFrom) || !isValidDateOnly(dateTo)) return "Enter valid calendar dates.";
    if (dateTo < dateFrom) return "The end date must not precede the start date.";
  }

  const resolved = resolveExportDateRange({
    preset,
    ...(preset === "custom" ? { custom: { from: dateFrom, to: dateTo } } : {}),
  }, now);
  if (!resolved.from || !resolved.toExclusive) return {};
  return {
    from: resolved.from.toISOString(),
    // The legacy route treats `to` as inclusive; serialize the final UTC millisecond.
    to: new Date(resolved.toExclusive.getTime() - 1).toISOString(),
  };
}

function isValidDateOnly(value: string): boolean {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function activityDateQueryValues(
  preset: ExportWorkspaceSelection["activityDate"],
  dateFrom: string,
  dateTo: string,
): { activityDate?: string; activityFrom?: string; activityTo?: string } | string {
  if (preset === "any") return {};
  if (preset === "custom") {
    if (!dateFrom && !dateTo) return "Choose at least one activity date boundary.";
    if ((dateFrom && !isValidDateOnly(dateFrom)) || (dateTo && !isValidDateOnly(dateTo))) return "Enter valid activity calendar dates.";
    if (dateFrom && dateTo && dateTo < dateFrom) return "The activity end date must not precede its start date.";
    return { activityDate: "custom", ...(dateFrom ? { activityFrom: dateFrom } : {}), ...(dateTo ? { activityTo: dateTo } : {}) };
  }
  return { activityDate: preset };
}

export function buildExportQuery(
  category: ExportCategoryId,
  selection: ExportWorkspaceSelection,
  actor: Pick<ExportActor, "role" | "salesPrivilege">,
  now = new Date(),
): ExportQueryResult {
  if (!EXPORT_CATEGORIES[category] || EXPORT_CATEGORIES[category].availability !== "implemented") {
    return { ok: false, error: "This export category is not available yet." };
  }

  const params = new URLSearchParams({ type: category });
  const add = (key: string, value: string | undefined) => {
    if (value?.trim()) params.set(key, value.trim());
  };

  if (category === "leads") {
    const allowedFilters = [
      [selection.status, LEAD_STATUSES, "lead status"],
      [selection.actions, ACTIVITY_ACTION_OPTIONS, "activity action"],
      [selection.responses, ACTIVITY_RESPONSE_OPTIONS, "activity response"],
      [selection.priorities, LEAD_PRIORITIES, "lead priority"],
      [selection.categories, LEAD_CATEGORIES, "lead category"],
      [selection.interests, ACTIVITY_INTEREST_OPTIONS, "activity interest"],
    ] as const;
    for (const [selected, options, label] of allowedFilters) {
      const allowed = new Set<string>(options.map((item) => item.value));
      if (selected.some((value) => !allowed.has(value))) return { ok: false, error: `Choose a valid ${label}.` };
    }
    for (const [key, values] of [
      ["status", selection.status],
      ["source", selection.sourceIds],
      ["activityAction", selection.actions],
      ["activityResponse", selection.responses],
      ["priority", selection.priorities],
      ["category", selection.categories],
      ["activityInterest", selection.interests],
    ] as const) {
      if (values.length) add(key, [...new Set(values)].join(","));
    }
    if (selection.assignedUserId) {
      if (actor.role !== "ADMIN") return { ok: false, error: "Sales exports are limited to your assigned leads." };
      add("assignedUserId", selection.assignedUserId);
    }
    if (selection.archived === "active") add("archived", "false");
    if (selection.archived === "archived") add("archived", "true");
    add("search", selection.search);
    const dates = dateQueryValues(selection.datePreset, selection.dateFrom, selection.dateTo, now);
    if (typeof dates === "string") return { ok: false, error: dates };
    add("from", dates.from);
    add("to", dates.to);
    const activityDates = activityDateQueryValues(selection.activityDate, selection.activityFrom, selection.activityTo);
    if (typeof activityDates === "string") return { ok: false, error: activityDates };
    add("activityDate", activityDates.activityDate);
    add("activityFrom", activityDates.activityFrom);
    add("activityTo", activityDates.activityTo);
  }

  if (category === "sync-history") {
    add("connectorId", selection.connectorId);
    const dates = dateQueryValues(selection.datePreset, selection.dateFrom, selection.dateTo, now);
    if (typeof dates === "string") return { ok: false, error: dates };
    add("from", dates.from);
    add("to", dates.to);
  }

  if (category === "reports") {
    const dates = dateQueryValues(selection.datePreset, selection.dateFrom, selection.dateTo, now);
    if (typeof dates === "string") return { ok: false, error: dates };
    add("from", dates.from);
    add("to", dates.to);
  }

  const allowed = LEGACY_EXPORT_QUERY_PARAMETERS[category] as readonly string[];
  if ([...params.keys()].some((key) => !allowed.includes(key))) {
    return { ok: false, error: "The selected filters are not supported by the current export endpoint." };
  }
  return { ok: true, params };
}

export type ContextualExportType = "leads" | "users";

/** Maps only current, URL-backed page filters. Unsupported active filters block export. */
export function getContextualExportParams(
  context: ContextualExportType,
  currentSearch: string,
): { params: Record<string, string>; error?: string } {
  const current = new URLSearchParams(currentSearch);
  const filterEntries = [...current.entries()].filter(([key, value]) => key.startsWith("filter.") && value.trim());

  if (context === "users") {
    if (current.get("search") || current.get("dateFrom") || current.get("dateTo") || filterEntries.length) {
      return { params: {}, error: "The current Users CSV endpoint does not support the active page filters. Clear them before exporting." };
    }
    return { params: {} };
  }

  const supportedFilters = new Set([
    "filter.status", "filter.source", "filter.priority", "filter.category", "filter.activityDate",
    "filter.activityAction", "filter.activityResponse", "filter.activityInterest", "filter.archived",
    "filter.assignedUserId",
  ]);
  const unsupported = filterEntries.find(([key]) => !supportedFilters.has(key));
  if (unsupported) {
    return { params: {}, error: "The current Leads CSV endpoint supports Status and Assigned Salesperson only. Clear the other page filters before exporting." };
  }

  const params: Record<string, string> = {};
  const mappedFilters: Array<[string, string]> = [
    ["filter.status", "status"], ["filter.source", "source"], ["filter.priority", "priority"],
    ["filter.category", "category"], ["filter.activityAction", "activityAction"],
    ["filter.activityResponse", "activityResponse"], ["filter.activityInterest", "activityInterest"],
  ];
  for (const [currentKey, exportKey] of mappedFilters) {
    const value = current.get(currentKey);
    if (value) params[exportKey] = value;
  }
  const assignee = current.get("filter.assignedUserId");
  if (assignee === "unassigned") {
    params.assignedUserId = "unassigned";
  } else if (assignee) {
    params.assignedUserId = assignee;
  }
  const activityDate = current.get("filter.activityDate");
  if (activityDate === "today" || activityDate === "yesterday") params.activityDate = activityDate;
  if (activityDate === "custom") {
    if (!current.get("dateFrom") && !current.get("dateTo")) {
      return { params: {}, error: "Choose at least one custom Activity Date boundary before exporting." };
    }
    params.activityDate = "custom";
    if (current.get("dateFrom")) params.activityFrom = current.get("dateFrom")!;
    if (current.get("dateTo")) params.activityTo = current.get("dateTo")!;
  } else if (!activityDate) {
    if (current.get("dateFrom")) params.from = current.get("dateFrom")!;
    if (current.get("dateTo")) params.to = current.get("dateTo")!;
    const activityFilters = ["filter.activityAction", "filter.activityResponse", "filter.activityInterest"];
    if (!activityDate && activityFilters.some((key) => current.get(key))) {
      if (current.get("dateFrom") || current.get("dateTo")) {
        params.activityDate = "custom";
        if (current.get("dateFrom")) params.activityFrom = current.get("dateFrom")!;
        if (current.get("dateTo")) params.activityTo = current.get("dateTo")!;
      }
    }
  }
  const archived = current.get("filter.archived");
  params.archived = archived === "true" ? "true" : "false";
  if (current.get("search")?.trim()) params.search = current.get("search")!.trim();
  return { params };
}

export function getContextualExportParamsFromState(
  context: ContextualExportType,
  state: { search?: string; filters?: Record<string, string>; dateFrom?: string; dateTo?: string },
): { params: Record<string, string>; error?: string } {
  const current = new URLSearchParams();
  if (state.search) current.set("search", state.search);
  for (const [key, value] of Object.entries(state.filters ?? {})) {
    if (value) current.set(`filter.${key}`, value);
  }
  if (state.dateFrom) current.set("dateFrom", state.dateFrom);
  if (state.dateTo) current.set("dateTo", state.dateTo);
  return getContextualExportParams(context, current.toString());
}

export function supportedDatePresets(): readonly ExportDatePreset[] {
  return EXPORT_DATE_PRESETS;
}

export type ExportDownloadGuard = { pending: boolean };

export function beginExportDownload(guard: ExportDownloadGuard): boolean {
  if (guard.pending) return false;
  guard.pending = true;
  return true;
}

export function endExportDownload(guard: ExportDownloadGuard): void {
  guard.pending = false;
}
