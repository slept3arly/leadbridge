# LeadBridge Backend

> **Status:** Canonical
> **Last verified:** 2026-11-05
> **Source of truth:** `src/services/`, `src/lib/`, `src/runtime/`

## Service Layer

20 domain services in `src/services/`. Each exports a class and a singleton instance.

| Service | File | Purpose |
|---|---|---|
| `LeadService` | `lead.service.ts` | Lead CRUD, list/paginate, search, assign, activity enrichment |
| `FollowUpService` | `follow-up.service.ts` | Follow-up CRUD, complete, reschedule, recalculate lead fields |
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
| `ExportService` | `export.service.ts` | CSV export for leads, users, providers, sync history |
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

### Activity Recording

Lead mutations create `ActivityEvent` + `ActivityEntry` records in the same transaction. Manual lead creation can include an optional structured initial interaction. `LeadService.create()` writes the lead and exactly one SYSTEM/CREATED event, then—when requested—creates a separate INTERACTION event. An optional follow-up is created through `FollowUpService.create()` using the same transaction client; its scheduled entry is linked to the interaction event, and follow-up denormalized lead fields are recalculated in that transaction.

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

The initial activity actor is always the authenticated caller. Follow-up assignment is not accepted from the create payload: the existing follow-up policy assigns Sales follow-ups to the Sales actor and Admin follow-ups to the Admin actor. The create API invalidates dashboard and attention caches only after the transaction commits. The standalone Sales Log Activity endpoint uses the same `interactionActivitySchema` and `ActivityFormFields` as the combined flow.

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
| `validation.ts` | Zod schemas for all request types |
| `query-builder.ts` | `parseListQuery()`, `containsSearch()`, `pagination()` helpers |
| `cache-tags.ts` | Cache tag constants and `invalidateAfterMutation()` |
| `logger.ts` | Pino logger named "leadbridge" |
| `navigation.tsx` | Navigation configuration for admin/sales |
| `utils.ts` | `cn()`, date formatting, `startOfTodayUTC()`, `daysSince()` |
| `get-error-message.ts` | Error message extraction from Axios/Error/strings |
| `service-errors.ts` | `ServiceError` class |
| `lead-constants.ts` | Status/priority/category value constants |
| `audit-export-params.ts` | Dead code -- exports empty object, related to removed AuditLog feature |

## Request Proxy and Authorization

`src/proxy.ts` exports Next.js `proxy()` and matches `/login`, `/admin/:path*`, and `/sales/:path*`. It checks for the Better Auth session cookie to redirect page requests without one from `/admin/*` and `/sales/*` to `/login`, and redirects requests with a cookie away from `/login` to `/`. This proxy check supports navigation flow; cookie presence alone does not authenticate or authorize a request.

Dashboard layouts use `requireSession(role)` from `src/lib/session.ts` to validate the server session and role. API route handlers use the authorization wrappers in `src/lib/api.ts` to validate sessions and enforce roles or permissions. These server-side checks are the authoritative access controls.

## Background Jobs

`src/jobs/index.ts` is empty. There is no background job system. The scheduler (`POST /api/scheduler/trigger`) must be triggered by an external cron service.
