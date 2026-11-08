import { z } from "zod";
import {
  ActivityEntryType,
  ActivityEventType,
  ActionType,
  ConnectorHealthStatus,
  ConnectorScheduleType,
  ConnectorStatus,
  FollowUpPriority,
  FollowUpStatus,
  InterestType,
  LeadCategory,
  LeadPriority,
  LeadStatus,
  ResponseType,
  SalesPrivilege,
  UserRole,
} from "@/generated/prisma/enums";
import { exportDateInputSchema, exportDateRangeSchema } from "@/lib/export/dates";

export const EXPORT_FILTER_COMBINATION = {
  betweenGroups: "AND",
  withinMultiSelect: "OR",
  searchAcrossFields: "OR",
  searchAgainstOtherGroups: "AND",
  dateAgainstOtherGroups: "AND",
  serverAuthorization: "AND",
  duplicateMultiSelectValues: "DEDUPLICATE_PRESERVE_FIRST_ORDER",
} as const;

export const EXPORT_DEFAULT_DATE_FIELDS = {
  leads: "createdAt",
  activities: "occurredAt",
  "follow-ups": "dueDate",
  notes: "createdAt",
  users: "createdAt",
  providers: "createdAt",
  connectors: "createdAt",
  "sync-history": "startedAt",
  reports: "createdAt",
} as const;

const enumSchema = <T extends Record<string, string>>(values: T) =>
  z.enum(values);
const multi = <T extends z.ZodType>(schema: T) =>
  z.array(schema).min(1).max(100).transform((values) => [...new Set(values)]);
const id = z.string().trim().min(1).max(128);
const search = z.string().trim().min(1).max(200).optional();
const dateRange = exportDateRangeSchema.optional();

export const ARCHIVED_STATE_VALUES = ["active", "archived", "both"] as const;
export const archivedStateSchema = z.enum(ARCHIVED_STATE_VALUES);
export const ERROR_OUTCOME_VALUES = ["any", "with-error", "without-error"] as const;
export const errorOutcomeSchema = z.enum(ERROR_OUTCOME_VALUES);

export const LEAD_DATE_FIELDS = ["createdAt", "lastContactedAt", "closedAt", "nextFollowUpAt"] as const;
export const leadDateFieldSchema = z.enum(LEAD_DATE_FIELDS);
export const LEAD_ACTIVITY_DATE_PRESETS = ["today", "yesterday", "custom"] as const;
export const leadActivityDatePresetSchema = z.enum(LEAD_ACTIVITY_DATE_PRESETS);

export const leadExportFiltersSchema = z.object({
  dateRange,
  dateField: leadDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS.leads),
  status: multi(enumSchema(LeadStatus)).optional(),
  priority: multi(enumSchema(LeadPriority)).optional(),
  category: multi(enumSchema(LeadCategory)).optional(),
  sourceIds: multi(id).optional(),
  assignedUserIds: multi(id).optional(),
  assignedUnassigned: z.boolean().optional(),
  actions: multi(enumSchema(ActionType)).optional(),
  responses: multi(enumSchema(ResponseType)).optional(),
  interests: multi(enumSchema(InterestType)).optional(),
  activityDate: leadActivityDatePresetSchema.optional(),
  activityFrom: exportDateInputSchema.optional(),
  activityTo: exportDateInputSchema.optional(),
  city: search,
  state: search,
  country: search,
  search,
  archived: archivedStateSchema.default("both"),
}).strict().superRefine((filters, ctx) => {
  if (filters.assignedUnassigned && filters.assignedUserIds?.length) {
    ctx.addIssue({ code: "custom", path: ["assignedUnassigned"], message: "Unassigned cannot be combined with assigned user IDs." });
  }

  const hasActivityBounds = Boolean(filters.activityFrom || filters.activityTo);
  if (filters.activityDate === "custom" && !hasActivityBounds) {
    ctx.addIssue({ code: "custom", path: ["activityFrom"], message: "A custom activity date filter requires at least one boundary." });
  }
  if (filters.activityDate !== "custom" && hasActivityBounds) {
    ctx.addIssue({ code: "custom", path: ["activityDate"], message: "Activity date boundaries require the custom activity date selection." });
  }
  if (filters.activityFrom && filters.activityTo) {
    const fromDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(filters.activityFrom);
    const toDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(filters.activityTo);
    const from = Date.parse(fromDateOnly ? `${filters.activityFrom}T00:00:00.000Z` : filters.activityFrom);
    const to = Date.parse(toDateOnly ? `${filters.activityTo}T23:59:59.999Z` : filters.activityTo);
    if (from > to) ctx.addIssue({ code: "custom", path: ["activityTo"], message: "The activity end date must not precede the start date." });
  }
});

export const ACTIVITY_DATE_FIELDS = ["occurredAt", "createdAt"] as const;
export const activityDateFieldSchema = z.enum(ACTIVITY_DATE_FIELDS);
export const activityExportFiltersSchema = z.object({
  dateRange,
  dateField: activityDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS.activities),
  eventTypes: multi(enumSchema(ActivityEventType)).optional(),
  entryTypes: multi(enumSchema(ActivityEntryType)).optional(),
  actions: multi(enumSchema(ActionType)).optional(),
  responses: multi(enumSchema(ResponseType)).optional(),
  interests: multi(enumSchema(InterestType)).optional(),
  leadIds: multi(id).optional(),
  actorIds: multi(id).optional(),
}).strict();

export const FOLLOW_UP_DATE_FIELDS = ["dueDate", "createdAt", "completedAt"] as const;
export const followUpDateFieldSchema = z.enum(FOLLOW_UP_DATE_FIELDS);
export const followUpExportFiltersSchema = z.object({
  dateRange,
  dateField: followUpDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS["follow-ups"]),
  statuses: multi(enumSchema(FollowUpStatus)).optional(),
  priorities: multi(enumSchema(FollowUpPriority)).optional(),
  ownerIds: multi(id).optional(),
  leadIds: multi(id).optional(),
  overdue: z.boolean().optional(),
}).strict();

export const NOTE_DATE_FIELDS = ["createdAt", "editedAt"] as const;
export const noteDateFieldSchema = z.enum(NOTE_DATE_FIELDS);
export const noteExportFiltersSchema = z.object({
  dateRange,
  dateField: noteDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS.notes),
  leadIds: multi(id).optional(),
  authorIds: multi(id).optional(),
  pinned: z.boolean().optional(),
}).strict();

export const USER_DATE_FIELDS = ["createdAt", "updatedAt", "lastLoginAt"] as const;
export const userDateFieldSchema = z.enum(USER_DATE_FIELDS);
export const userExportFiltersSchema = z.object({
  dateRange,
  dateField: userDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS.users),
  roles: multi(enumSchema(UserRole)).optional(),
  salesPrivileges: multi(enumSchema(SalesPrivilege)).optional(),
  active: z.boolean().optional(),
  banned: z.boolean().optional(),
  designations: multi(z.string().trim().min(1).max(120)).optional(),
  search,
}).strict();

export const PROVIDER_DATE_FIELDS = ["createdAt", "updatedAt"] as const;
export const providerDateFieldSchema = z.enum(PROVIDER_DATE_FIELDS);
export const providerExportFiltersSchema = z.object({
  dateRange,
  dateField: providerDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS.providers),
  sourceTypes: multi(z.string().trim().min(1).max(60)).optional(),
  active: z.boolean().optional(),
  search,
}).strict();

export const CONNECTOR_DATE_FIELDS = ["createdAt", "updatedAt", "lastSyncedAt"] as const;
export const connectorDateFieldSchema = z.enum(CONNECTOR_DATE_FIELDS);
export const connectorExportFiltersSchema = z.object({
  dateRange,
  dateField: connectorDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS.connectors),
  connectorTypes: multi(z.string().trim().min(1).max(60)).optional(),
  providerIds: multi(id).optional(),
  enabled: z.boolean().optional(),
  statuses: multi(enumSchema(ConnectorStatus)).optional(),
  healthStatuses: multi(enumSchema(ConnectorHealthStatus)).optional(),
  scheduleTypes: multi(enumSchema(ConnectorScheduleType)).optional(),
}).strict();

export const SYNC_HISTORY_DATE_FIELDS = ["startedAt", "completedAt"] as const;
export const syncHistoryDateFieldSchema = z.enum(SYNC_HISTORY_DATE_FIELDS);
export const syncHistoryExportFiltersSchema = z.object({
  dateRange,
  dateField: syncHistoryDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS["sync-history"]),
  connectorIds: multi(id).optional(),
  connectorTypes: multi(z.string().trim().min(1).max(60)).optional(),
  statuses: multi(enumSchema(ConnectorStatus)).optional(),
  errorOutcome: errorOutcomeSchema.default("any"),
}).strict();

export const REPORT_DATE_FIELDS = ["createdAt"] as const;
export const reportDateFieldSchema = z.enum(REPORT_DATE_FIELDS);
export const reportExportFiltersSchema = z.object({
  dateRange,
  dateField: reportDateFieldSchema.default(EXPORT_DEFAULT_DATE_FIELDS.reports),
  sourceIds: multi(id).optional(),
  ownerIds: multi(id).optional(),
  statuses: multi(enumSchema(LeadStatus)).optional(),
}).strict();

export const exportFiltersByCategory = {
  leads: leadExportFiltersSchema,
  activities: activityExportFiltersSchema,
  "follow-ups": followUpExportFiltersSchema,
  notes: noteExportFiltersSchema,
  users: userExportFiltersSchema,
  providers: providerExportFiltersSchema,
  connectors: connectorExportFiltersSchema,
  "sync-history": syncHistoryExportFiltersSchema,
  reports: reportExportFiltersSchema,
} as const;

export type LeadExportFilters = z.infer<typeof leadExportFiltersSchema>;
export type ActivityExportFilters = z.infer<typeof activityExportFiltersSchema>;
export type FollowUpExportFilters = z.infer<typeof followUpExportFiltersSchema>;
export type NoteExportFilters = z.infer<typeof noteExportFiltersSchema>;
export type UserExportFilters = z.infer<typeof userExportFiltersSchema>;
export type ProviderExportFilters = z.infer<typeof providerExportFiltersSchema>;
export type ConnectorExportFilters = z.infer<typeof connectorExportFiltersSchema>;
export type SyncHistoryExportFilters = z.infer<typeof syncHistoryExportFiltersSchema>;
export type ReportExportFilters = z.infer<typeof reportExportFiltersSchema>;

export type CategoryFilterSchemaMap = typeof exportFiltersByCategory;
