export type ExportValueKind = "text" | "enum" | "boolean" | "number" | "date" | "date-time";
export type ExportSensitivity = "business" | "personal" | "operational" | "sensitive";

export type ExportFieldDefinition = {
  id: string;
  header: string;
  source: string;
  kind: ExportValueKind;
  sensitivity: ExportSensitivity;
  defaultSelected: boolean;
  selectable: boolean;
  relationProjection?: string;
  nullRepresentation: "empty";
  representation?: string;
};

const field = <Id extends string>(
  id: Id,
  header: string,
  source: string,
  kind: ExportValueKind,
  sensitivity: ExportSensitivity,
  defaultSelected: boolean,
  options: Partial<Pick<ExportFieldDefinition, "selectable" | "relationProjection" | "representation">> = {},
): ExportFieldDefinition & { readonly id: Id } => ({
  id,
  header,
  source,
  kind,
  sensitivity,
  defaultSelected,
  selectable: options.selectable ?? true,
  nullRepresentation: "empty",
  ...options,
});

/** Central field allowlist. Client requests may refer only to these stable IDs. */
export const EXPORT_FIELDS = {
  leads: [
    field("leadNumber", "Lead Number", "Lead.leadNumber", "text", "business", true),
    field("name", "Name", "Lead.displayName", "text", "personal", true),
    field("company", "Company", "Lead.company", "text", "business", true),
    field("email", "Email", "Lead.email", "text", "personal", true),
    field("phone", "Phone", "Lead.phone", "text", "personal", true),
    field("status", "Status", "Lead.status", "enum", "business", true, { representation: "Prisma enum value" }),
    field("priority", "Priority", "Lead.priority", "enum", "business", true, { representation: "Prisma enum value" }),
    field("category", "Category", "Lead.category", "enum", "business", true, { representation: "Prisma enum value" }),
    field("city", "City", "Lead.city", "text", "personal", true),
    field("state", "State", "Lead.state", "text", "personal", true),
    field("country", "Country", "Lead.country", "text", "personal", true),
    field("requirement", "Requirement", "Lead.requirement", "text", "sensitive", true),
    field("createdAt", "Created At", "Lead.createdAt", "date-time", "business", true, { representation: "ISO-8601 UTC" }),
    field("assignedTo", "Assigned To", "Lead.assignedUser.name", "text", "personal", true, { relationProjection: "assignedUser.name only" }),
    field("source", "Source", "Lead.source.name", "text", "business", true, { relationProjection: "source.name only" }),
    field("alternatePhone", "Alternate Phone", "Lead.alternatePhone", "text", "personal", false),
    field("firstContactedAt", "First Contacted At", "Lead.firstContactedAt", "date-time", "business", false, { representation: "ISO-8601 UTC" }),
    field("lastContactedAt", "Last Contacted At", "Lead.lastContactedAt", "date-time", "business", false, { representation: "ISO-8601 UTC" }),
    field("nextFollowUpAt", "Next Follow-up Due", "Lead.nextFollowUpAt", "date-time", "business", false, { representation: "ISO-8601 UTC" }),
    field("lastFollowUpAt", "Last Follow-up At", "Lead.lastFollowUpAt", "date-time", "business", false, { representation: "ISO-8601 UTC" }),
    field("closedAt", "Closed At", "Lead.closedAt", "date-time", "business", false, { representation: "ISO-8601 UTC" }),
    field("convertedAt", "Converted At", "Lead.convertedAt", "date-time", "business", false, { representation: "ISO-8601 UTC" }),
    field("isArchived", "Archived", "Lead.isArchived", "boolean", "business", false, { representation: "true/false" }),
    field("product", "Product", "Lead.product", "text", "business", false, { representation: "Legacy compatibility field" }),
    field("industry", "Industry", "Lead.industry", "text", "business", false),
    field("website", "Website", "Lead.website", "text", "business", false),
    field("jobTitle", "Job Title", "Lead.jobTitle", "text", "personal", false),
    field("address", "Address", "Lead.address", "text", "personal", false),
    field("budget", "Budget", "Lead.budget", "number", "sensitive", false, { representation: "Decimal as base-10 string" }),
    field("expectedValue", "Expected Value", "Lead.expectedValue", "number", "sensitive", false, { representation: "Decimal as base-10 string" }),
    field("currency", "Currency", "Lead.currency", "text", "business", false),
    field("lostReason", "Lost Reason", "Lead.lostReason", "text", "sensitive", false),
    field("campaign", "Campaign", "Lead.campaign", "text", "business", false),
    field("campaignId", "Campaign ID", "Lead.campaignId", "text", "business", false),
    field("utmSource", "UTM Source", "Lead.utmSource", "text", "business", false),
    field("utmMedium", "UTM Medium", "Lead.utmMedium", "text", "business", false),
    field("utmCampaign", "UTM Campaign", "Lead.utmCampaign", "text", "business", false),
    field("utmContent", "UTM Content", "Lead.utmContent", "text", "business", false),
    field("utmTerm", "UTM Term", "Lead.utmTerm", "text", "business", false),
  ],
  activities: [
    field("occurredAt", "Occurred At", "ActivityEvent.occurredAt", "date-time", "business", true, { representation: "ISO-8601 UTC" }),
    field("eventType", "Event Type", "ActivityEvent.type", "enum", "business", true),
    field("entryType", "Entry Type", "ActivityEntry.type", "enum", "business", true),
    field("leadNumber", "Lead Number", "ActivityEvent.lead.leadNumber", "text", "business", true, { relationProjection: "lead.leadNumber only" }),
    field("leadName", "Lead Name", "ActivityEvent.lead.displayName", "text", "personal", true, { relationProjection: "lead.displayName only" }),
    field("actor", "Actor", "ActivityEvent.actor.name", "text", "personal", true, { relationProjection: "actor.name only" }),
    field("action", "Action", "ActivityEntry.action", "enum", "business", true),
    field("response", "Response", "ActivityEntry.response", "enum", "business", true),
    field("interest", "Interest", "ActivityEntry.interest", "enum", "business", true),
    field("message", "Message", "ActivityEntry.message", "text", "sensitive", false),
  ],
  "follow-ups": [
    field("title", "Title", "FollowUp.title", "text", "business", true),
    field("dueDate", "Due Date", "FollowUp.dueDate", "date-time", "business", true, { representation: "ISO-8601 UTC" }),
    field("dueTime", "Due Time", "FollowUp.dueTime", "text", "business", true),
    field("status", "Status", "FollowUp.status", "enum", "business", true),
    field("priority", "Priority", "FollowUp.priority", "enum", "business", true),
    field("leadNumber", "Lead Number", "FollowUp.lead.leadNumber", "text", "business", true, { relationProjection: "lead.leadNumber only" }),
    field("leadName", "Lead Name", "FollowUp.lead.displayName", "text", "personal", true, { relationProjection: "lead.displayName only" }),
    field("owner", "Owner", "FollowUp.assignedUser.name", "text", "personal", true, { relationProjection: "assignedUser.name only" }),
    field("createdBy", "Created By", "FollowUp.createdBy.name", "text", "personal", true, { relationProjection: "createdBy.name only" }),
    field("createdAt", "Created At", "FollowUp.createdAt", "date-time", "business", true, { representation: "ISO-8601 UTC" }),
    field("completedAt", "Completed At", "FollowUp.completedAt", "date-time", "business", true, { representation: "ISO-8601 UTC" }),
    field("description", "Description", "FollowUp.description", "text", "sensitive", false),
  ],
  notes: [
    field("leadNumber", "Lead Number", "Note.lead.leadNumber", "text", "business", true, { relationProjection: "lead.leadNumber only" }),
    field("leadName", "Lead Name", "Note.lead.displayName", "text", "personal", true, { relationProjection: "lead.displayName only" }),
    field("author", "Author", "Note.author.name", "text", "personal", true, { relationProjection: "author.name only" }),
    field("createdAt", "Created At", "Note.createdAt", "date-time", "business", true, { representation: "ISO-8601 UTC" }),
    field("editedAt", "Edited At", "Note.editedAt", "date-time", "business", true, { representation: "ISO-8601 UTC" }),
    field("pinned", "Pinned", "Note.isPinned", "boolean", "business", true, { representation: "true/false" }),
    field("visibility", "Visibility", "Note.visibility", "text", "operational", true),
    field("content", "Content", "Note.content", "text", "sensitive", false),
    field("whatIDid", "What I Did", "Note.whatIDid", "text", "sensitive", false),
    field("whatCustomerSaid", "What Customer Said", "Note.whatCustomerSaid", "text", "sensitive", false),
  ],
  users: [
    field("name", "Name", "User.name", "text", "personal", true),
    field("email", "Email", "User.email", "text", "personal", true),
    field("role", "Role", "User.role", "enum", "operational", true),
    field("salesPrivilege", "Sales Privilege", "User.salesPrivilege", "enum", "operational", true),
    field("active", "Active", "User.active", "boolean", "operational", true, { representation: "true/false" }),
    field("employeeCode", "Employee Code", "User.employeeCode", "text", "personal", true),
    field("designation", "Designation", "User.designation", "text", "personal", true),
    field("createdAt", "Created At", "User.createdAt", "date-time", "operational", true, { representation: "ISO-8601 UTC" }),
    field("phone", "Phone", "User.phone", "text", "personal", false),
    field("banned", "Banned", "User.banned", "boolean", "operational", false, { representation: "true/false" }),
    field("lastLoginAt", "Last Login At", "User.lastLoginAt", "date-time", "sensitive", false, { representation: "ISO-8601 UTC" }),
    field("updatedAt", "Updated At", "User.updatedAt", "date-time", "operational", false, { representation: "ISO-8601 UTC" }),
  ],
  providers: [
    field("name", "Name", "LeadSource.name", "text", "business", true),
    field("slug", "Slug", "LeadSource.slug", "text", "operational", true),
    field("sourceType", "Type", "LeadSource.sourceType", "text", "business", true),
    field("active", "Active", "LeadSource.active", "boolean", "operational", true, { representation: "true/false" }),
    field("createdAt", "Created At", "LeadSource.createdAt", "date-time", "operational", true, { representation: "ISO-8601 UTC" }),
    field("updatedAt", "Updated At", "LeadSource.updatedAt", "date-time", "operational", false, { representation: "ISO-8601 UTC" }),
  ],
  connectors: [
    field("name", "Name", "Connector.name", "text", "operational", true),
    field("type", "Type", "Connector.type", "text", "operational", true),
    field("enabled", "Enabled", "Connector.enabled", "boolean", "operational", true, { representation: "true/false" }),
    field("status", "Status", "Connector.status", "enum", "operational", true),
    field("healthStatus", "Health Status", "Connector.healthStatus", "enum", "operational", true),
    field("scheduleType", "Schedule Type", "Connector.scheduleType", "enum", "operational", true),
    field("provider", "Provider", "Connector.source.name", "text", "business", true, { relationProjection: "source.name only" }),
    field("parser", "Parser", "Connector.parser.name", "text", "operational", true, { relationProjection: "parser.name only" }),
    field("lastSyncedAt", "Last Synced At", "Connector.lastSyncedAt", "date-time", "operational", true, { representation: "ISO-8601 UTC" }),
    field("nextScheduledRun", "Next Scheduled Run", "Connector.nextScheduledRun", "date-time", "operational", false, { representation: "ISO-8601 UTC" }),
    field("consecutiveFailures", "Consecutive Failures", "Connector.consecutiveFailures", "number", "operational", false),
    field("averageDurationMs", "Average Duration (ms)", "Connector.averageDurationMs", "number", "operational", false),
  ],
  "sync-history": [
    field("runId", "Run ID", "ConnectorSyncRun.id", "text", "operational", true),
    field("connector", "Connector", "ConnectorSyncRun.connector.name", "text", "operational", true, { relationProjection: "connector.name only" }),
    field("type", "Type", "ConnectorSyncRun.connector.type", "text", "operational", true, { relationProjection: "connector.type only" }),
    field("status", "Status", "ConnectorSyncRun.status", "enum", "operational", true),
    field("startedAt", "Started At", "ConnectorSyncRun.startedAt", "date-time", "operational", true, { representation: "ISO-8601 UTC" }),
    field("completedAt", "Completed At", "ConnectorSyncRun.completedAt", "date-time", "operational", true, { representation: "ISO-8601 UTC" }),
    field("recordsSeen", "Records Seen", "ConnectorSyncRun.recordsSeen", "number", "operational", true),
    field("recordsCreated", "Created", "ConnectorSyncRun.recordsCreated", "number", "operational", true),
    field("recordsUpdated", "Updated", "ConnectorSyncRun.recordsUpdated", "number", "operational", true),
    field("recordsSkipped", "Skipped", "ConnectorSyncRun.recordsSkipped", "number", "operational", true),
    field("errorDiagnostic", "Error", "Sanitized sync diagnostic", "text", "operational", false, { representation: "Sanitized diagnostic only" }),
  ],
  reports: [
    field("summary", "Summary Metrics", "ReportService aggregates", "number", "business", true, { selectable: false }),
    field("statuses", "Status Breakdown", "Lead.status aggregate", "number", "business", true, { selectable: false }),
    field("sources", "Source Totals", "Lead.source aggregate", "number", "business", true, { selectable: false }),
    field("owners", "Owner Totals", "Lead.assignedUser aggregate", "number", "business", true, { selectable: false }),
    field("trends", "Monthly Trends", "Lead.createdAt aggregate", "number", "business", true, { selectable: false }),
    field("activity", "Activity Totals", "ActivityEntry aggregate", "number", "business", true, { selectable: false }),
  ],
} as const satisfies Record<string, readonly ExportFieldDefinition[]>;

export type ExportCategoryFieldId<C extends keyof typeof EXPORT_FIELDS> = (typeof EXPORT_FIELDS)[C][number]["id"];

export const RESTRICTED_EXPORT_FIELD_PATTERNS = [
  "rawPayload",
  "customFields",
  "Connector.configuration",
  "Account.*",
  "Session.*",
  "Verification.*",
  "password",
  "accessToken",
  "refreshToken",
  "idToken",
  "secret",
  "credential",
  "auth headers",
] as const;

export function getDefaultExportColumns<C extends keyof typeof EXPORT_FIELDS>(category: C): string[] {
  return EXPORT_FIELDS[category].filter((item) => item.defaultSelected).map((item) => item.id);
}

export function resolveExportColumns<C extends keyof typeof EXPORT_FIELDS>(
  category: C,
  requested?: readonly string[],
): string[] {
  const fields = EXPORT_FIELDS[category];
  const selected = requested ?? getDefaultExportColumns(category);
  if (selected.length === 0) throw new Error("At least one export column must be selected.");
  const allowed = new Set<string>(fields.filter((item) => item.selectable).map((item) => item.id));
  const unique = [...new Set(selected)];
  const rejected = unique.filter((id) => !allowed.has(id));
  if (rejected.length > 0) throw new Error(`Unsupported export column(s): ${rejected.join(", ")}`);
  const order = new Map<string, number>(fields.map((item, index) => [item.id, index]));
  return unique.sort((a, b) => order.get(a)! - order.get(b)!);
}
