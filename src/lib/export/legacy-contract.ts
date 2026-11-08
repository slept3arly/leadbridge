/** Query keys accepted by the live GET /api/export compatibility route. */
export const LEGACY_EXPORT_QUERY_PARAMETERS = {
  leads: [
    "type", "status", "assignedUserId", "from", "to", "search", "source", "activityDate",
    "activityFrom", "activityTo", "activityAction", "activityResponse", "priority", "category",
    "activityInterest", "archived",
  ],
  users: ["type"],
  providers: ["type"],
  "sync-history": ["type", "from", "to", "connectorId"],
  reports: ["type", "from", "to"],
  activities: ["type"],
  "follow-ups": ["type"],
  notes: ["type"],
  connectors: ["type"],
} as const;

/** Fixed field layout currently emitted by GET /api/export. */
export const LEGACY_EXPORT_COLUMNS = {
  leads: ["leadNumber", "name", "company", "email", "phone", "status", "priority", "city", "state", "country", "product", "requirement", "createdAt", "assignedTo", "source"],
  users: ["name", "email", "role", "active", "employeeCode", "designation", "phone", "createdAt"],
  providers: ["name", "slug", "sourceType", "active", "createdAt"],
  "sync-history": ["runId", "connector", "type", "status", "startedAt", "completedAt", "recordsSeen", "recordsCreated", "recordsUpdated", "recordsSkipped"],
} as const;
