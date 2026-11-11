# LeadBridge Backend

> **Status:** Canonical
> **Last verified:** 2026-11-07
> **Source of truth:** `src/services/`, `src/lib/`, `src/runtime/`

## Service Layer

21 domain services in `src/services/`. Each exports a class and a singleton instance.

`src/lib/export/` contains export category definitions, policy metadata, field allowlists, validation schemas, and date contracts. `src/services/export/` enforces category authorization and lead scope, builds typed Prisma filters/projections, counts records, retrieves row exports in bounded keyset pages, serializes CSV rows, and streams bounded UTF-8 response chunks. The legacy `/api/export` parameters are adapted in `src/lib/export/legacy-compatibility.ts`. Row/byte/application-time limits and best-effort structured operation logging apply to the five current categories; see [the delivery reliability design](experiments/21_EXPORT_DELIVERY_RELIABILITY.md).

Lead exports also accept comma-separated status, source, action, response, priority, category, and interest values, archive state, search, ADMIN assignee selection, lead-created date bounds, and activity date bounds. Activity date uses `ActivityEvent.occurredAt`; all selected activity entry predicates are nested under the same event and same `ActivityEntry`, matching the Leads table relationship semantics. These predicates are ANDed with the authenticated lead-scope predicate. See [the advanced Lead export filter note](experiments/24_EXPORT_ADVANCED_LEAD_FILTERS.md).

| Service | File | Purpose |
|---|---|---|
| `LeadWorkflowService` | `lead-workflow.service.ts` | Atomic manual lead creation with initial interaction; Record Progress orchestration |
| `LeadService` | `lead.service.ts` | Lead CRUD, list/paginate, search, assign, activity enrichment, change-aware updates |
| `FollowUpService` | `follow-up.service.ts` | Shared scheduling, supersession, completion, rescheduling, soft cancellation, and lead date recalculation |
| `ActivityEventService` | `activity-event.service.ts` | Activity event/entry creation, querying by lead or follow-up |
| `DashboardService` | `dashboard.service.ts` | Admin and sales dashboard aggregations |
| `AttentionService` | `attention.service.ts` | Attention center: overdue, today's, new, needs-attention leads |
| `NoteService` | `note.service.ts` | Note CRUD with optional follow-up scheduling |
| `UserService` | `user.service.ts` | User listing, pagination, assignable users |
| `ProviderService` | `provider.service.ts` | Provider CRUD, routing rules, stats |
| `ConnectorService` | `connector.service.ts` | Connector listing, sync run recording, Gmail account discovery |
| `ConnectorHealthService` | `connector-health.service.ts` | Health tracking (consecutive failures, average duration) |
| `ExecutionLockService` | `execution-lock.service.ts` | Distributed lock for connector execution |
| `SchedulerService` | `scheduler.service.ts` | Discover due connectors and execute them |
| `ParserService` | `parser.service.ts` | Parser registry access and management |
| `ParserRequestService` | `parser-request.service.ts` | Parser request listing and status updates |
| `ExportService` | `export.service.ts` | Incremental CSV record production for leads, users, providers, sync history, and reports, backed by the export query service |
| `ReportService` | `report.service.ts` | Analytics: summary, sources, assignments, status, trends |
| `SettingsService` | `settings.service.ts` | Global settings with caching and definitions |
| `DuplicateService` | `duplicate.service.ts` | Potential duplicate detection by email/phone |
| `AssignmentService` | `assignment.service.ts` | Lead assignment delegation |
| `UnmatchedEmailService` | `unmatched-email.service.ts` | Handle unmatched emails |

## Service Patterns

### Access Control

Services use `accessWhere()` to build Prisma `where` clauses based on role:

```typescript
// SALES users only see their own leads
private accessWhere(user: AppSession) {
  if (user.role === "SALES") {
    return { assignedUserId: user.id, isDeleted: false };
  }
  return { isDeleted: false }; // ADMIN sees all
}
```

### Pagination

All list endpoints use OFFSET pagination via `parseListQuery()` from `src/lib/query-builder.ts`:

```typescript
const query = parseListQuery(urlSearchParams);
// Returns: { page, pageSize, search, sortBy, sortDirection, filters, dateFrom, dateTo }
```

Search uses `ILIKE '%term%'` across 5 fields: `displayName`, `company`, `email`, `phone`, `leadNumber`.

Lead stores nullable `city` and nullable `district` as independent location fields. Each field is validated and normalized independently; differing values are accepted. Single-key writes affect only that key, and omitted PATCH fields remain unchanged. Lead list/detail projections return both. The generic lead list filter parser supports `filter.district`; export city filters continue to target only city. Connector normalization still supplies city, and this change does not alter connector mappings.

### Activity Recording

Manual lead creation and Record Progress are orchestrated by `LeadWorkflowService`. Manual `POST /api/leads` requires one CALL or WHATSAPP interaction; it atomically creates the lead, SYSTEM/CREATED event, exactly one INTERACTION event, and an optional pending follow-up. Connector/import creation continues through `LeadService.create()` and does not require or fabricate a customer interaction.

`Lead.product` remains a nullable database field for historical records and compatibility. The manual lead forms and current detail/list projections omit it. The optional API input remains accepted for older clients, while `LeadService.updateFieldsInTransaction()` updates only submitted fields, so an omitted Product value is preserved. Connector imports continue mapping parsed Product values into the stored field.

`recordLeadProgress()` atomically records one genuine interaction, optionally changes status/priority/category/requirement, explicitly completes the supplied pending follow-up ID, and optionally schedules a task through the shared follow-up lifecycle service. Scheduling supersedes the one existing pending task, with completion and scheduling entries grouped into the caller's event. Interaction-only updates leave pending tasks unchanged. Manual lead creation, note-based scheduling, standalone scheduling, and completion-with-next use the same lifecycle scheduler. Activity notes remain on the activity entry; they are not converted to `Note` records or copied into `FollowUp.description`.

Follow-ups for assigned leads are assigned to the lead's responsible salesperson even when Admin performs the workflow. For an unassigned lead, the task is assigned to the acting user. Sales access remains scoped to assigned leads; lead creation remains controlled by `CREATE_LEAD` (SENIOR Sales only).

Lead PATCH and workflow field changes compare normalized values against the row read in the transaction, update only changed columns, and use `updatedAt` as a conditional concurrency token. Unchanged patches do not update lead timestamps/actor metadata or create field-history entries. Follow-up lifecycle transitions use a lead-row `FOR UPDATE` lock, reject multiple legacy pending rows as HTTP 409, and use conditional state transitions. Replacement, history, and denormalized-field recalculation are atomic. Cancellation is soft: PENDING becomes CANCELLED with server-derived `cancelledAt`; the row and activity links remain. The `FollowUp_one_pending_per_lead` partial unique index is defined in the pending migration as a second integrity layer. The migration has not been applied to the configured external Neon database.

Interaction validation pairs CALL with `PICKED_UP`, `NOT_PICKED_UP`, `INVALID_NUMBER`, or `SWITCHED_OFF`, and WHATSAPP with `REPLIED` or `NOT_REPLIED`. Legacy `NO_RESPONSE` remains stored and readable for history, but is not an option for new interactions. Priority enums include `COLD`; MEDIUM remains the stored value displayed as “Medium”.

No business timezone is configured. Follow-up due dates persist as UTC instants. Date-only workflow values use UTC midnight; date-time values require an explicit offset. Existing browser forms submit ISO instants after local date/time selection. A business timezone/default-hour decision remains deferred.

```typescript
await prisma.$transaction(async (tx) => {
  const lead = await tx.lead.create({ data: ... });
  await activityEventService.createEvent({
    leadId: lead.id,
    type: "SYSTEM",
    entries: [{ type: "CREATED" }],
  }, tx);
  return lead;
});
```

The initial activity actor is always the authenticated caller. Follow-up assignment is derived from the lead owner and never accepted from the workflow payload. Cache invalidation runs only after a successful transaction and includes affected Sales-user dashboard/attention tags when Admin works on their lead. Activity, Note, and standalone follow-up API routes remain available for their supported edit, historical, compatibility, and schedule-only behaviors; primary interaction creation and task completion in the UI use the unified workflows.

### Denormalized Field Maintenance

`FollowUpService.recalculateLeadFollowUpFields()` runs inside transactions whenever follow-ups change:

- `Lead.nextFollowUpAt` = MIN `dueDate` where status = PENDING
- `Lead.lastFollowUpAt` = MAX `completedAt` where status = COMPLETED

## Shared Libraries (`src/lib/`)

| File | Purpose |
|---|---|
| `prisma.ts` | Prisma client singleton with PrismaPg adapter |
| `auth.ts` | Better Auth server configuration |
| `auth-client.ts` | Better Auth client configuration |
| `session.ts` | `getSession()`, `requireSession()`, `AppSession` type |
| `api.ts` | `apiError()`, `withApiAuthorization()`, `withPermissionAuthorization()`, `handleApiError()` |
| `permissions.ts` | `Permission` enum, `can()` function for RBAC |
| `validation.ts` | Zod schemas for all request types, including manual creation and progress workflows |
| `follow-up-date.ts` | UTC instant parsing for date-only and offset-bearing workflow due dates |
| `query-builder.ts` | `parseListQuery()`, `containsSearch()`, `pagination()` helpers |
| `cache-tags.ts` | Cache tag constants and `invalidateAfterMutation()` |
| `logger.ts` | Pino logger named "leadbridge" |
| `navigation.tsx` | Navigation configuration for admin/sales |
| `utils.ts` | `cn()`, date formatting, `startOfTodayUTC()`, `daysSince()` |
| `get-error-message.ts` | Error message extraction from Axios/Error/strings |
| `service-errors.ts` | `ServiceError` class |
| `lead-constants.ts` | Status/priority/category value constants |

## Request Proxy and Authorization

`src/proxy.ts` exports Next.js `proxy()` and matches `/login`, `/admin/:path*`, and `/sales/:path*`. It checks for the Better Auth session cookie to redirect page requests without one from `/admin/*` and `/sales/*` to `/login`, and redirects requests with a cookie away from `/login` to `/`. This proxy check supports navigation flow; cookie presence alone does not authenticate or authorize a request.

Dashboard layouts use `requireSession(role)` from `src/lib/session.ts` to validate the server session and role. API route handlers use the authorization wrappers in `src/lib/api.ts` to validate sessions and enforce roles or permissions. These server-side checks are the authoritative access controls.

## Background Jobs

`src/jobs/index.ts` is empty. There is no background job system. The scheduler (`POST /api/scheduler/trigger`) must be triggered by an external cron service.
