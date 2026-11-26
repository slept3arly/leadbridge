/** Query keys accepted by the live GET /api/export compatibility route. */
export const LEGACY_EXPORT_QUERY_PARAMETERS = {
  leads: [
    "type", "status", "assignedUserId", "from", "to", "search", "source", "activityDate",
    "activityFrom", "activityTo", "activityAction", "activityResponse", "priority", "category",
    "activityInterest", "activityReason", "archived", "columns",
  ],
  users: ["type", "columns", "search", "role", "active", "banned", "salesPrivilege", "designation", "from", "to"],
  providers: ["type", "columns", "active", "sourceType"],
  "sync-history": ["type", "from", "to", "connectorId", "status", "errorOutcome"],
  reports: ["type", "from", "to", "source", "owner", "status"],
  activities: ["type"],
  "follow-ups": ["type"],
  notes: ["type"],
  connectors: ["type"],
} as const;

/** Backward-compatible default field selections for GET /api/export. */
export const LEGACY_EXPORT_COLUMNS = {
  leads: ["serialNumber", "name", "company", "phone", "status", "city", "district", "state", "source"],
  users: ["name", "email", "role", "active", "employeeCode", "designation", "phone", "createdAt"],
  providers: ["name", "slug", "sourceType", "active", "createdAt"],
  "sync-history": ["runId", "connector", "type", "status", "startedAt", "completedAt", "recordsSeen", "recordsCreated", "recordsUpdated", "recordsSkipped", "errorDiagnostic"],
} as const;
