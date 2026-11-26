# LeadBridge API Reference

> **Status:** Canonical
> **Last verified:** 2026-11-24
> **Source of truth:** `src/app/api/`

## Overview

40 API route files under `src/app/api/`. All use Next.js App Router HTTP verb exports (`GET`, `POST`, `PATCH`, `DELETE`).

## Authentication Patterns

- `withApiAuthorization(undefined)` -- any authenticated user (both ADMIN and SALES)
- `withApiAuthorization("ADMIN")` -- ADMIN role only
- `withPermissionAuthorization(Permission.X)` -- checks granular permission (ADMIN always passes; SALES requires SENIOR privilege for supported permissions)
- Public: `/api/auth/[...all]` and the non-sensitive health endpoints below

## Routes (40 files, 55+ handlers)

### Authentication

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...all]` | ALL | Public | Better Auth authentication handlers |

### Dashboard

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/dashboard` | GET | Any authenticated | Role-derived dashboard metrics (ADMIN or SALES) |

### Health

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health/live` | GET | Public | Confirms the application process can serve a request; does not check PostgreSQL |
| `/api/health/ready` | GET | Public | Runs a minimal PostgreSQL connectivity query; returns 503 when the database is unavailable |

### Leads

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/leads` | GET | Any authenticated | List leads with pagination, search, status, priority, source and other filters; supports `filter.district` |
| `/api/leads` | POST | `CREATE_LEAD` permission | Create a lead with mandatory initial interaction and optional follow-up atomically; accepts independent `city` and `district` fields |
| `/api/leads/[id]` | GET | Any authenticated | Get lead details, including both `city` and `district` |
| `/api/leads/[id]` | PATCH | Any authenticated | Update lead fields, including backward-compatible `city` and `district` |
| `/api/leads/[id]` | DELETE | `DELETE_LEAD` permission | Permanently delete lead and cascade-deleted dependent records |
| `/api/leads/[id]/assign` | POST | ADMIN | Assign lead to sales user |
| `/api/leads/[id]/activities` | GET | Any authenticated | Get lead activity timeline |
| `/api/leads/[id]/activities` | POST | ADMIN or assigned SALES | Record progress; optional classification changes, explicit pending follow-up completion, and optional next follow-up |
| `/api/leads/[id]/notes` | GET | Any authenticated | List lead notes |
| `/api/leads/[id]/notes` | POST | Any authenticated | Add note to lead |
| `/api/leads/[id]/follow-ups` | GET | Any authenticated | List lead follow-ups |
| `/api/leads/[id]/follow-ups` | POST | Any authenticated | Schedule or replace the lead's pending follow-up; integrity conflicts return 409 |
| `/api/leads/[id]/details` | GET | Any authenticated | Get lead with up to 100 latest Notes, all follow-ups, and the latest 100 activity events |

### Lead Sources

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/lead-sources` | GET | Any authenticated | List active lead sources |
| `/api/lead-sources` | POST | ADMIN | Create lead source (reactivates if soft-deleted) |
| `/api/lead-sources/[id]` | DELETE | ADMIN | Deactivate lead source (soft delete: sets `active: false`) |

### Follow-ups

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/follow-ups/[id]` | PATCH | Any authenticated | Update or reschedule follow-up |
| `/api/follow-ups/[id]/complete` | POST | Any authenticated | Complete follow-up |
| `/api/follow-ups/[id]` | DELETE | Any authenticated | Soft-cancel a pending follow-up; row and activity links are retained |

### Notes

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/notes/[id]` | PATCH | Any authenticated | Update note |
| `/api/notes/[id]` | DELETE | Any authenticated | Delete note |

### Activities

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/activities/[id]` | PATCH | Assigned SALES user (checked against lead ownership) | Edit an interaction activity entry |

### Users

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/users` | GET | ADMIN | List users with pagination |
| `/api/users` | POST | ADMIN | Provision new user |
| `/api/users/[id]` | PATCH | ADMIN | Update user |

### Providers (Routing & Integration Management)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/providers` | GET | ADMIN | List providers with connector & routing info |
| `/api/providers` | POST | ADMIN | Create provider |
| `/api/providers/[id]` | PATCH | ADMIN | Update provider |
| `/api/providers/[id]` | DELETE | ADMIN | Delete provider |
| `/api/providers/routing-rules` | GET | ADMIN | List routing rules |
| `/api/providers/routing-rules` | POST | ADMIN | Create routing rule |
| `/api/providers/routing-rules` | PATCH | ADMIN | Update routing rule identified by `id` in the request body |
| `/api/providers/routing-rules/[id]` | DELETE | ADMIN | Delete routing rule |
| `/api/providers/connectors/test` | POST | ADMIN | Test connector connection |
| `/api/providers/gmail` | GET | ADMIN | List Gmail accounts from env |
| `/api/providers/unmatched` | GET | ADMIN | List unmatched emails |
| `/api/providers/unmatched` | PATCH | ADMIN | Process unmatched email |
| `/api/providers/parser-requests` | GET | ADMIN | List parser requests |
| `/api/providers/parser-requests` | PATCH | ADMIN | Update parser request status |
| `/api/providers/parsers` | GET | ADMIN | List parser catalog |
| `/api/providers/sync-runs` | GET | ADMIN | List sync run history |

### Connectors

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/connectors` | GET | ADMIN | List connector types |
| `/api/connectors` | POST | ADMIN | Create connector (accepts `configuration` for REST type) |
| `/api/connectors/[id]` | DELETE | ADMIN | Delete connector |
| `/api/connectors/[id]/settings` | PATCH | ADMIN | Update connector settings (accepts `configuration` for REST type, `enabled`, `scheduleType`, `scheduleConfig`, `resetHealth`, `sourceId`) |
| `/api/connectors/[id]/sync` | POST | ADMIN | Trigger manual sync |

### Parsers

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/parsers` | GET | ADMIN | List parser manifests |
| `/api/parsers/preview` | POST | ADMIN | Preview parser on sample payload |

### Scheduler

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/scheduler/trigger` | POST | ADMIN session or `Authorization: Bearer <SCHEDULER_TRIGGER_SECRET>` | Trigger due connectors; only an Admin session can request a specific connector |

### Reports

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/reports` | GET | ADMIN | Generate analytics reports |

### Settings

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/settings` | GET | ADMIN | Get system settings |
| `/api/settings` | PATCH | ADMIN | Update system settings |

### Export

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/export` | GET | ADMIN; SALES/SENIOR for leads only | Download current CSV export types |
| `/api/export/count` | GET | Same as `/api/export` | Count records matching current export filters without retrieving rows |

The endpoints support `leads`, `users`, `providers`, `sync-history`, and `reports`. Leads, Users, and Providers accept a comma-separated `columns` list of stable field IDs; fields are validated against server-owned allowlists, ordered by the registry, and projected explicitly. Unknown, duplicate, unsupported, or sensitive identifiers are rejected. Client labels and database property names are never accepted. Omitting `columns` uses the category defaults. CSV is the only format. The download route streams UTF-8 CSV rows and enforces 50,000 data rows, 25,000,000 serialized body bytes, and a 30-second application deadline. Row exports count the filtered result first, then fetch deterministic keyset pages of up to 250 rows; each count/page query uses a short transaction. Row exports do not hold a database snapshot across the download, so concurrent changes can affect row membership or values. Responses are marked private/no-store. Boolean columns serialize as `Yes` or `No`. Sync History includes a sanitized diagnostic in its `Error` column. Failures after streaming begins terminate the body without appending diagnostics.

`GET /api/export/count` accepts the same supported query parameters as the download route and applies the same category validation, authorization, Sales lead scope, and query predicates. It returns a numeric `count` and category metadata; the Reports count represents leads summarized. It runs a database count and does not fetch matching rows. Preview and download are separate requests, so concurrent database changes can make their results differ. Cancelling the response stops further iteration between page operations and records a cancellation outcome; an in-flight Prisma query is bounded by PostgreSQL's 15-second statement timeout. Export operation logs are best-effort structured Pino events containing actor/category, outcome, row/byte counts, and accepted filter-group names, not filter values or exported content. They are not durable audit records. No background export job is implemented.

The Admin and Senior Sales workspaces are `/admin/exports` and `/sales/exports`.

- **Leads** accept `status`, `source`, `activityAction`, `activityResponse`, `activityInterest`, `activityReason`, `priority`, `category`, `archived`, `assignedUserId` (ADMIN only), `search`, lead creation `from`/`to`, and `activityDate` with optional `activityFrom`/`activityTo`. Multi-value filters are comma-separated; values within a group are ORed and groups are ANDed. Activity action, response, interest, reason, and occurrence-date predicates must match a `CALL`/`WHATSAPP` entry on the same event. Selected responses that exclude contacted outcomes (`PICKED_UP`, `REPLIED`) cannot be combined with `activityInterest` or `activityReason`; `activityReason` requires `NOT_INTERESTED` in `activityInterest`. Activity presets are `today`, `yesterday`, and `custom`, evaluated in UTC. For custom activity dates, date-only end bounds include the whole selected UTC day; timestamp end bounds are inclusive to match the Leads table. Legacy `from`/`to` date-only ends include the full UTC date; timestamp ends remain inclusive through that exact millisecond. Contextual Leads exports keep created-date bounds separate from activity-date filters. `archived=true` selects archived leads, `false` selects active leads, and omission selects both (with deleted leads always excluded). `assignedUserId=unassigned` selects unassigned leads for ADMIN. Sales scope remains fixed to the authenticated Senior Sales user and cannot be widened with query parameters.
- **Users** accept `search` (name, email, employee code, designation, phone), `role`, `active`, `banned`, `salesPrivilege`, `designation`, and `from`/`to` (`User.createdAt` bounds). Deleted users are always excluded; inactive and banned users are included by default unless filtered.
- **Providers** accept `active` (`true`, `false`, or `all`; defaults to `true` when omitted) and `sourceType`.
- **Sync History** accepts `connectorId`, `status` (`ACTIVE`, `INACTIVE`, `ERROR`), `errorOutcome` (`any`, `with-error`, `without-error`), and `from`/`to` (`startedAt` bounds). `/api/providers/sync-runs` shares these filters and returns paginated runs (`limit` up to 100, `offset`, `total`, `hasMore`), while CSV exports stream all matching runs.
- **Reports** (`/api/reports`, `/api/export?type=reports`, `/api/export/count?type=reports`) accept paired `from`/`to` (`Lead.createdAt` bounds), `source`, `owner`, and `status`. All date-sensitive sections (`summary`, `sources`, `assignments`, `status`, `trends`) apply the same `ReportExportFilters`; `activity` applies `source`, `owner`, and `status` over fixed UTC today / 7-day / 30-day windows. Report CSV `count` reflects actual data rows rather than section headings.

Default Leads fields are `S.No.`, Name, Company, Phone, Status, City, District, State, and Source. `S.No.` is mandatory, first, and generated from 1 in serialized row order; it is unrelated to the database ID and stored Lead Number. Lead Number remains an optional selectable field. District is nullable and serializes as an empty cell when absent. Users default to Name, Email, Role, Active, Employee Code, Designation, Phone, and Created At; Sales Privilege is optional. Providers default to Name, Slug, Type, Active, and Created At; Description, Routing Priority, and Updated At are optional. User Banned and Last Login fields are excluded as account-security state and telemetry; user Updated At is omitted as system metadata. Provider icon and color are omitted as presentation details. Authentication data, tokens, passwords, raw configuration, internal IDs, arbitrary custom fields, and other unapproved system metadata are excluded. Lead activity details and per-task follow-up rows are not flattened into the one-row-per-lead export; supported denormalized follow-up timestamps remain optional fields. The count and download are separate requests and do not share a database snapshot.

### Cache / State

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/resync` | POST | Any authenticated | Revalidate cached dashboard/attention tags |

## Validation

All request bodies are validated with Zod schemas from `src/lib/validation.ts`:

- `createLeadRequestSchema` -- Manual lead creation, including at least one of email or phone and required initial activity
- `leadSchema` -- Lead update fields
- `manualLeadPatchSchema` -- Independently validated Lead PATCH fields, including City and District
- `interactionActivitySchema` -- Shared structured interaction validation for Add Lead and resulting activity-edit validation
- `leadProgressRequestSchema` -- Record Progress interaction, optional classification fields, explicit completion ID, and optional follow-up schedule
- `followUpSchema` -- Follow-up create/update
- `noteSchema` -- Note create/update
- `userSchema` -- User create/update
- `providerSchema` -- Provider create/update
- `routingRuleSchema` -- Routing rule create/update
- `assignmentSchema` -- Lead assignment
- `loginSchema` -- Login form
- `settingSchema` -- Settings update
- `restConnectorConfigSchema` -- REST connector configuration
- `unmatchedActionSchema` -- Unmatched email action

### Manual lead creation payload

`POST /api/leads` accepts lead fields plus a required `initialActivity` object. Name is optional; missing, blank, and whitespace-only names normalize to null. Manual creation still requires at least one of Email or primary Phone. Email is optional, whitespace is trimmed, and a non-empty value must be valid. Primary and alternate phone are optional, but a non-empty value must consist of exactly 10 digits. Empty or whitespace-only optional values normalize to null. Lead API responses preserve nullable names; the UI-only `Unnamed Lead` fallback is not persisted or returned by APIs. CALL responses are `PICKED_UP`, `NOT_PICKED_UP`, `INVALID_NUMBER`, and `SWITCHED_OFF`; WHATSAPP responses are `REPLIED` and `NOT_REPLIED`. The action and response must be compatible, and Interest is required exactly for `PICKED_UP` and `REPLIED`. Historical `NO_RESPONSE` entries remain readable and unchanged, but are not accepted for new interactions. Follow-up scheduling is optional; when enabled, `followUpDate` is required and `followUpTime` is optional. Manual lead creation is limited to ADMIN and SALES users with `CREATE_LEAD` (currently SENIOR Sales). SALES-created leads are assigned to the actor; only Admin may choose a Sales assignee. Connector/import creation remains on the service import path and does not fabricate an interaction.

The `LeadStatus` enum adds `REPEATED` without rewriting historical records. Lead status writes through the manual create, patch, and activity workflows accept `NEW`, `OLD`, `CONVERTED`, and `REPEATED`; Repeated has no special transition side effects. It appears in dashboard and report status breakdowns; the existing active/won/lost summary definitions are unchanged. Historical `LOST`, `SPAM`, and `ON_HOLD` records remain readable and filterable.

Interest values are `INTERESTED` (Interested), `NOT_INTERESTED` (Not interested), `DETAIL_SHARED` (Detail shared), and `POSITIVE` (Positive). The existing `NOT_INTERESTED` identifier and label are retained. `DETAIL_SHARED` and `POSITIVE` are accepted in activity creation, editing, follow-up completion, and filters; the Sales dashboard's Interested metric includes these positive classifications. The existing rule remains: only `NOT_INTERESTED` accepts or requires a Reason. The shared `ActivityReason` enum adds `CALL_CUT_HOLD` (Call cut/Hold) and preserves all earlier values, including the healthcare-product reasons. Existing activity records are not rewritten; null historical Reasons remain valid.

City and District are independent optional fields. Each value is trimmed and validated independently; differing values are accepted. City-only and District-only requests write only the supplied field, and omitted PATCH fields remain unchanged. Lead create, patch, list, and detail responses include both fields. The lead-list API supports `filter.district` as a case-insensitive substring filter. The export `city` filter continues to query `Lead.city` only. District is a default selectable export field and emits an empty CSV cell when null.

Product is omitted from the manual Add/Edit Lead forms. The optional `product` request field remains accepted for existing API clients and integrations; omitting it from a lead PATCH leaves any stored value unchanged. Connector imports may continue supplying it. Product is an optional selectable CSV field and is excluded from the Leads default selection.

```json
{
  "name": "Example Lead",
  "email": "lead@example.test",
  "initialActivity": {
    "action": "CALL",
    "response": "PICKED_UP",
    "interest": "INTERESTED",
    "notes": "Requested a product catalogue.",
    "scheduleFollowUp": true,
    "followUpDate": "2026-12-01T10:00:00.000Z",
    "followUpTime": "10:00"
  }
}
```

Lead, SYSTEM/CREATED event, exactly one INTERACTION event and entry, and optional follow-up are committed atomically. The route returns the existing lead response shape. A request without `initialActivity` returns 400.

### Record Progress

`POST /api/leads/[id]/activities` accepts the existing interaction fields and optional `status`, `priority`, `category`, `requirement`, `completeFollowUpId`, `scheduleFollowUp`, `followUpDate`, and `followUpTime`. `requirement` is an additive optional classification field for the Latest Requirement UI label; existing payloads remain valid. Every successful request creates a new genuine interaction event; matching payloads are not deduplicated. Admin may record progress on any non-deleted lead. Sales may act only on assigned leads. Activity notes remain on the interaction and are neither copied to `FollowUp.description` nor written as standalone Notes.

When `completeFollowUpId` is present, it must identify a pending follow-up belonging to the route's lead. A concurrent or already-completed task returns 409. Scheduling any follow-up supersedes the sole existing pending task. The shared lifecycle service applies this behavior to manual lead creation, Record Progress, note scheduling, standalone scheduling, and completion-with-next. Multiple legacy pending rows return 409 without cleanup. Follow-ups for assigned leads are assigned to that lead's salesperson; for unassigned leads, they are assigned to the authenticated actor.

Lead field writes compare normalized values in the transaction. No-op fields do not update `updatedAt`/`updatedById` or create history entries. A stale conflicting lead update returns 409 and rolls back the interaction/follow-up work. Follow-up dates are stored as UTC instants: date-only values use UTC midnight and date-time values require an explicit timezone offset. No business timezone is configured.

`PATCH /api/leads/[id]` also skips unchanged fields and returns without history/cache invalidation when the submitted patch is a no-op. `nextFollowUpAt` is derived from pending follow-up records and cannot be written through lead PATCH.

The legacy `POST /api/follow-ups/[id]/complete` remains available and continues to accept `{}` for existing callers; it is not treated as Record Progress and does not fabricate an interaction. Supplying a next task uses the same shared scheduler. DELETE changes PENDING to CANCELLED with server-derived `cancelledAt`; completed/cancelled tasks cannot be cancelled again.

## Error Handling

API routes use `handleApiError()` from `src/lib/api.ts` which returns structured JSON errors:

```json
{ "error": "Error message", "details": "Additional context" }
```

HTTP status codes: 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 409 (conflict/duplicate), 500 (internal).

## Dead/Empty API Directories

The following directories exist but contain no `route.ts` files:

- `src/app/api/audit-logs/` -- empty (AuditLog model was removed)
- `src/app/api/mock/leads/` -- empty
- `src/app/api/sync/` -- empty
- `src/app/api/follow-ups/[id]/cancel/` -- empty
