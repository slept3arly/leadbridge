import { EXPORT_FIELDS, getDefaultExportColumns } from "@/lib/export/fields";
import {
  ACTIVITY_DATE_FIELDS,
  CONNECTOR_DATE_FIELDS,
  EXPORT_DEFAULT_DATE_FIELDS,
  FOLLOW_UP_DATE_FIELDS,
  LEAD_DATE_FIELDS,
  NOTE_DATE_FIELDS,
  PROVIDER_DATE_FIELDS,
  REPORT_DATE_FIELDS,
  SYNC_HISTORY_DATE_FIELDS,
  USER_DATE_FIELDS,
  exportFiltersByCategory,
} from "@/lib/export/filters";
import { EXPORT_AUTHORIZATION, type ExportCategoryPolicyId } from "@/lib/export/policy";

export const EXPORT_CATEGORY_IDS = [
  "leads",
  "activities",
  "follow-ups",
  "notes",
  "users",
  "providers",
  "connectors",
  "sync-history",
  "reports",
] as const;

export type ExportCategoryId = (typeof EXPORT_CATEGORY_IDS)[number];
export type ExportCategoryAvailability = "implemented" | "planned";
export type ExportCategoryKind = "rows" | "aggregate";

export type ExportCategoryDefinition = {
  id: ExportCategoryId;
  label: string;
  description: string;
  availability: ExportCategoryAvailability;
  authorization: (typeof EXPORT_AUTHORIZATION)[ExportCategoryPolicyId];
  dateFields: readonly string[];
  defaultDateField: string;
  filters: readonly string[];
  defaultFields: readonly string[];
  optionalFields: readonly string[];
  restrictedFields: readonly string[];
  rowGrain: string;
  columnSelection: boolean;
  kind: ExportCategoryKind;
};

const restricted = [
  "Lead.rawPayload",
  "Lead.customFields (arbitrary JSON)",
  "authentication credentials/tokens/session data",
  "raw connector configuration and secret-bearing values",
] as const;

function fieldsFor(category: keyof typeof EXPORT_FIELDS) {
  const fields = EXPORT_FIELDS[category];
  return {
    defaultFields: getDefaultExportColumns(category),
    optionalFields: fields.filter((item) => !item.defaultSelected && item.selectable).map((item) => item.id),
  };
}

function filtersFor(category: ExportCategoryId): string[] {
  return Object.keys(exportFiltersByCategory[category].shape);
}

function defineCategory(
  definition: Omit<ExportCategoryDefinition, "authorization" | "defaultFields" | "optionalFields" | "restrictedFields"> & {
    fieldCategory: keyof typeof EXPORT_FIELDS;
    restrictedFields?: readonly string[];
  },
): ExportCategoryDefinition {
  const { fieldCategory, ...category } = definition;
  return {
    ...category,
    authorization: EXPORT_AUTHORIZATION[category.id],
    ...fieldsFor(fieldCategory),
    restrictedFields: category.restrictedFields ?? restricted,
  };
}

export const EXPORT_CATEGORIES = {
  leads: defineCategory({
    id: "leads",
    label: "Leads",
    description: "Lead records, current classification, source, ownership, and contact timeline fields.",
    availability: "implemented",
    fieldCategory: "leads",
    dateFields: LEAD_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS.leads,
    filters: filtersFor("leads"),
    rowGrain: "One row per non-deleted lead.",
    columnSelection: true,
    kind: "rows",
  }),
  activities: defineCategory({
    id: "activities",
    label: "Activities",
    description: "Lead-linked interaction and lifecycle event entries.",
    availability: "planned",
    fieldCategory: "activities",
    dateFields: ACTIVITY_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS.activities,
    filters: filtersFor("activities"),
    rowGrain: "One row per ActivityEntry; event and lead fields repeat for entries in the same event.",
    columnSelection: true,
    kind: "rows",
  }),
  "follow-ups": defineCategory({
    id: "follow-ups",
    label: "Follow-ups",
    description: "Lead-linked follow-up tasks, including pending, completed, and cancelled records.",
    availability: "planned",
    fieldCategory: "follow-ups",
    dateFields: FOLLOW_UP_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS["follow-ups"],
    filters: filtersFor("follow-ups"),
    rowGrain: "One row per FollowUp.",
    columnSelection: true,
    kind: "rows",
  }),
  notes: defineCategory({
    id: "notes",
    label: "Notes",
    description: "Standalone lead notes with full text available only as an explicit optional column.",
    availability: "planned",
    fieldCategory: "notes",
    dateFields: NOTE_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS.notes,
    filters: filtersFor("notes"),
    rowGrain: "One row per Note.",
    columnSelection: true,
    kind: "rows",
  }),
  users: defineCategory({
    id: "users",
    label: "Users",
    description: "Internal user directory metadata; excludes authentication records and secrets.",
    availability: "implemented",
    fieldCategory: "users",
    dateFields: USER_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS.users,
    filters: filtersFor("users"),
    rowGrain: "One row per user account, including inactive but non-deleted users when selected.",
    columnSelection: true,
    kind: "rows",
  }),
  providers: defineCategory({
    id: "providers",
    label: "Providers",
    description: "Lead source registry metadata, with active state controlled by an explicit filter.",
    availability: "implemented",
    fieldCategory: "providers",
    dateFields: PROVIDER_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS.providers,
    filters: filtersFor("providers"),
    rowGrain: "One row per provider/source.",
    columnSelection: true,
    kind: "rows",
  }),
  connectors: defineCategory({
    id: "connectors",
    label: "Connectors",
    description: "Allowlisted operational metadata only; raw configuration is excluded.",
    availability: "planned",
    fieldCategory: "connectors",
    dateFields: CONNECTOR_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS.connectors,
    filters: filtersFor("connectors"),
    rowGrain: "One row per connector using the safe field projection.",
    columnSelection: true,
    kind: "rows",
  }),
  "sync-history": defineCategory({
    id: "sync-history",
    label: "Connector Sync Runs",
    description: "Connector execution records with sanitized diagnostics only.",
    availability: "implemented",
    fieldCategory: "sync-history",
    dateFields: SYNC_HISTORY_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS["sync-history"],
    filters: filtersFor("sync-history"),
    rowGrain: "One row per ConnectorSyncRun.",
    columnSelection: true,
    kind: "rows",
  }),
  reports: defineCategory({
    id: "reports",
    label: "Reports",
    description: "Aggregate CRM metrics aligned to a shared selected date range.",
    availability: "implemented",
    fieldCategory: "reports",
    dateFields: REPORT_DATE_FIELDS,
    defaultDateField: EXPORT_DEFAULT_DATE_FIELDS.reports,
    filters: filtersFor("reports"),
    rowGrain: "Named aggregate sections; not one row per source record.",
    columnSelection: false,
    kind: "aggregate",
  }),
} as const satisfies Record<ExportCategoryId, ExportCategoryDefinition>;

export function isExportCategoryId(value: string): value is ExportCategoryId {
  return (EXPORT_CATEGORY_IDS as readonly string[]).includes(value);
}

export function isImplementedExportCategory(category: ExportCategoryId): boolean {
  return EXPORT_CATEGORIES[category].availability === "implemented";
}

export function parseExportCategory(value: string): ExportCategoryId | null {
  return isExportCategoryId(value) ? value : null;
}

export function parseImplementedExportCategory(value: string): ExportCategoryId | null {
  const category = parseExportCategory(value);
  return category && isImplementedExportCategory(category) ? category : null;
}

export type ExportFilterContractByCategory = typeof exportFiltersByCategory;
