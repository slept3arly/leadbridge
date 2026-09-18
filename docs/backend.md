# LeadBridge Backend

> **Status:** Canonical
> **Last verified:** 2026-09-17
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

Lead mutations create `ActivityEvent` + `ActivityEntry` records in the same transaction:

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

## Middleware

Single middleware at `src/middleware.ts`:

- Checks for `better-auth.session_token` cookie
- Redirects unauthenticated users from `/admin/*` and `/sales/*` to `/login`
- Redirects authenticated users away from `/login` to `/`
- Matcher: `/login`, `/admin/:path*`, `/sales/:path*`

## Background Jobs

`src/jobs/index.ts` is empty. There is no background job system. The scheduler (`POST /api/scheduler/trigger`) must be triggered by an external cron service.
