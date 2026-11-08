# Export System Audit

> **Status:** Experimental audit and proposed specification; implementation has not begun.
> **Audit date:** 2026-11-07
> **Scope:** Read-only source audit. The only change in this phase is this document.
> **Labels:** **Verified** means directly observed in current source/schema/tests; **Inferred** means a consequence of observed behavior; **Recommended** is proposed future behavior.

## 1. Executive Summary

**Verified:** The current download endpoint is `GET /api/export`. `ExportService` currently generates five CSV types: `leads`, `users`, `providers`, `sync-history`, and `reports`. It does not export Audit Logs, activities, follow-ups, notes, connectors, or the broader lead model. The requested five inventory categories are not a complete list of actual types because the report bundle is also supported.

**Verified:** Admins may export all five types. Only Sales users with `EXPORT_LEADS` (currently `SENIOR`) may export leads; server-side query construction restricts those rows to `assignedUserId = session.user.id`. This excludes unassigned leads and other salespeople’s leads regardless of query parameters. Other types reject Sales users.

**Verified:** The current lead UI buttons export defaults, not the active table query. Admin and Sales lead export buttons pass no `params`, so table search, selected status/source/priority/category/owner, archive state, activity/follow-up filters, and visible date range do not reach `/api/export`. The API accepts only status, assigned user, created-date bounds, and search for leads. Sync history supports connector ID and started-date bounds. Reports accept date bounds but ignore a one-sided range and combine metrics with different date semantics.

**Verified:** CSV encoding uses `escapeCsv`/`toCsvRow` in `src/lib/csv.ts`. It quotes commas, quotes and newlines, doubles embedded quotes, maps null to an empty cell, preserves Unicode, and prefixes formula-like text with an apostrophe. `exportInChunks` fetches 1,000 rows per OFFSET page but accumulates every serialized row in a JavaScript string before returning it; HTTP output is not streamed. There is no configured maximum row count, async job, progress, or export-operation audit record.

**Recommended:** Keep exports role-aware and scope SALES to currently assigned, non-deleted leads, including related CRM rows only through that visible lead set. Offer a small category catalog in a dedicated `/admin/exports` and `/sales/exports` workspace, with contextual shortcuts from relevant pages. Start with CSV, fixed safe defaults, server-side filtering, a preview/count, and selectable columns on Leads. Add related Activities, Follow-ups, and Notes as separate exports. Keep user/provider/connector/sync administration data ADMIN-only. Do not export credentials, raw payloads, auth records, secrets, or unrestricted configuration JSON.

## 2. Existing Export Architecture

### Request and response path

1. **Verified — UI:** `src/components/shared/export-button.tsx` builds `/api/export?type=...`, appends supplied non-empty parameters, and opens a new tab with `window.open`. The button itself has no loading/progress or error UI. The icon-only button always uses `aria-label="Export leads"`, even for providers/reports.
2. **Verified — page exposure:** `ExportButton` appears in Admin Leads, Admin Users, Providers, Admin Reports, Connectors (sync history), and Sales My Leads. Sales Dashboard computes and passes `canExport`, but `src/components/sales/sales-dashboard-client.tsx` does not render an export control. No export control appears on Sales Tasks or Profile.
3. **Verified — auth:** `src/app/api/export/route.ts` wraps GET in `withApiAuthorization(["ADMIN", "SALES"])`. `src/lib/api.ts` obtains the session, rejects missing, inactive, banned, or deleted users, and checks the allowed role. The handler separately gates lead exports with `can(..., Permission.EXPORT_LEADS)` and rejects every non-lead type for non-admins.
4. **Verified — query:** The route parses URL parameters inline, creates JavaScript `Date` objects without schema validation, and dispatches to `ExportService`. Export data access uses Prisma in `src/services/export.service.ts`; reports delegate to `src/services/report.service.ts`.
5. **Verified — serialization:** Service methods map explicitly selected fields to CSV rows through `toCsvRow`. Most methods use `exportInChunks`; report output is assembled directly from report aggregates.
6. **Verified — download:** The route returns a `NextResponse` with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="<type>-<UTC date>.csv"`. Errors are passed through `handleApiError`; unexpected failures are logged and returned as generic HTTP 500.

### Supported types and query parameters

| Type | Current caller | Parameters actually consumed | Server authorization |
|---|---|---|---|
| `leads` | Admin Leads; Sales My Leads | `status` (comma-separated), `assignedUserId`, `from`, `to`, `search` | ADMIN; or SALES with `EXPORT_LEADS`, then assigned-lead scope in service |
| `users` | Admin Users | None | ADMIN |
| `providers` | Providers | None | ADMIN |
| `sync-history` | Connectors | `from`, `to`, `connectorId` | ADMIN |
| `reports` | Admin Reports | `from`, `to` | ADMIN |
| `audit-logs` | None | Not supported | No route/model/export implementation |

Unknown types return 400. The missing-type 400 message lists `leads, users, providers, sync-history`, omitting the supported `reports` type; the unknown-type message includes all five.

### Date parsing and behavior

**Verified:** `from` and `to` are passed through `new Date(value)` without checking `isNaN`, ordering, or whether both endpoints are present. Leads and sync runs use inclusive `gte` and `lte` comparisons against `createdAt` and `startedAt`, respectively. A date-only `to=YYYY-MM-DD` parses to midnight UTC, so it includes only the start of that date, not the full calendar day. Invalid values can flow into Prisma and be reported as a generic 500 rather than a 400.

**Verified:** `exportReports` only creates its range when both `from` and `to` exist; one-sided values silently result in “All time.” The four range-sensitive report sections filter lead creation dates inclusively; monthly trends always show a rolling six-month window and interaction activity always uses its own today/7-day/30-day windows. These sections therefore do not all share the displayed report range. The Reports UI currently sends a floating 7/30/90/365-day interval or no range, not the full preset set requested for the new system.

### Ordering, batching, and failures

**Verified:** Leads sort by `createdAt DESC, id DESC`; users/providers by name then ID ascending; sync runs by `startedAt DESC, id DESC`. Data exports page by 1,000 rows using `skip`/`take`; reports aggregate in a few queries and build a small multi-section CSV. No explicit transaction or snapshot spans chunks.

**Inferred:** Concurrent inserts/deletes during multiple OFFSET reads may shift page boundaries, causing duplicate or omitted records even with deterministic ordering. Each chunk limits individual Prisma result size, but the final `chunks` array and `.join("")` hold the entire CSV in process memory; export size is unbounded by application code. There is no explicit empty-state message: empty data returns a header-only CSV. Exceptions return an API JSON error through the download navigation, with no in-app status or toast from `ExportButton`.

## 3. Current Export Inventory

### Leads

- **Verified source:** `Lead` plus optional `assignedUser` and `source` relations in `prisma/schema.prisma`; query/field mapping in `ExportService.exportLeads`.
- **Verified scope:** `isDeleted: false`; SALES additionally gets `assignedUserId = actor.id`. ADMIN may optionally filter by assigned user. Archived state is not filtered, so both archived and active non-deleted leads are included. Unassigned leads appear for ADMIN by default, but never for SALES.
- **Verified limits:** Only five filter dimensions are supported: status, assignee (ADMIN only), created date, search, with invalid statuses removed from the status list. UI passes none of these today. The date filter is creation date only.
- **Sensitivity:** Contact PII (name, email, phone), company/requirements, location, classification, ownership and source. `rawPayload`, imported identifiers, detailed address, financial/campaign fields and histories are not included.

### Users

- **Verified source:** `User` model. `isDeleted: false` only. No actor/query arguments.
- **Verified scope:** ADMIN only at route layer. Inactive but non-deleted users remain included.
- **Verified limits:** No date, role, active-state, or search filters. Does not expose sales privilege, login/last-seen data, auth records, or deletion state.
- **Sensitivity:** Names, email addresses, employee codes and phone numbers are personal/internal workforce data.

### Providers

- **Verified source:** `LeadSource` model.
- **Verified scope:** ADMIN only. `active: true`, so inactive providers visible in the management UI are omitted.
- **Verified limits:** No filters, and the export cannot reproduce the full provider list shown in the UI. Does not include linked connectors/rules/counts.
- **Sensitivity:** Low-to-moderate operational business metadata; names/source types may reveal acquisition channels.

### Connector Sync Runs

- **Verified source:** `ConnectorSyncRun` joined to required `Connector` relation.
- **Verified scope:** ADMIN only. Optional `connectorId`; optional startedAt bounds.
- **Verified limits:** Includes every run status, including active/incomplete runs. No status filter. `errorMessage` is exported verbatim. Configuration, credentials, run `metadata`, and raw connector data are not selected.
- **Sensitivity:** Operational details and potentially internal error text, which may contain payload fragments, external hostnames, or other diagnostic information. Keep as restricted operational data and review error-message content before exporting broadly.

### Reports (additional supported type)

- **Verified source:** `ReportService` queries over Lead, ActivityEntry, provider, connector and user aggregates. ADMIN only.
- **Verified output:** A multi-section CSV with summary metrics, status breakdown, source totals, salesperson assignment totals plus unassigned, monthly lead trends, and interaction counts. This is a report bundle rather than a row-level export.
- **Verified limits:** Mixed date semantics described above; activity section is fixed relative windows, trends are rolling six months, and rows are aggregates. No column selection or filter controls beyond the report period. `ReportService` computes closed/deleted/lost-rate and source-by-connector/parser aggregates, but `exportReports` omits those values; it exports provider-source totals only.
- **Sensitivity:** Aggregated commercial performance and employee performance data; ADMIN-only remains appropriate.

### Audit Logs (requested category; unsupported today)

- **Verified:** There is no `AuditLog` model, no `/api/audit-logs` route implementation, and no `audit-logs` export type. Schema models `ActivityEvent` and `ActivityEntry` instead. `docs/architecture.md` documents the removal of the old AuditLog model.
- **Verified distinction:** Activity events describe lead-linked CRM lifecycle, interaction, follow-up, note, system, assignment, and import events. They are not a general security/admin audit trail. Export operations themselves are not persisted or logged as audit records.
- **Recommended:** Do not label CRM activity as Audit Logs. For export accountability, add a narrowly scoped structured export event/log design with actor, category, timestamp, outcome, row count, and safe filter metadata; do not restore the removed AuditLog model by assumption.

## 4. Field-by-Field Export Matrix

In each row below the displayed CSV column is followed by its selected value, in exact current order. Null strings render blank; dates use JavaScript `Date.toISOString()`; enum values are raw Prisma enum strings.

### Leads — current order

| # | CSV column | Source / meaning | Null or representation | Sensitivity / gap |
|---:|---|---|---|---|
| 1 | Lead Number | `Lead.leadNumber`, stable CRM identifier | Stored string | Internal identifier |
| 2 | Name | `Lead.displayName` (DB column `name`) | Stored string | Personal data |
| 3 | Company | `Lead.company` | Blank if null | Business contact data |
| 4 | Email | `Lead.email` | Blank if null | Personal data |
| 5 | Phone | `Lead.phone` | Blank if null | Personal data; `alternatePhone` omitted |
| 6 | Status | `Lead.status` | Raw enum (`NEW`, `CONVERTED`, `LOST`, `SPAM`, `ON_HOLD`) | Current state only; `closedAt`, `convertedAt`, loss reason omitted |
| 7 | Priority | `Lead.priority` | Raw enum | Internal classification |
| 8 | City | `Lead.city` | Blank if null | Location |
| 9 | State | `Lead.state` | Blank if null | Location |
| 10 | Country | `Lead.country` | Blank if null | Location |
| 11 | Product | `Lead.product` | Blank if null | Legacy import field; intentionally retained after product was removed from manual UI |
| 12 | Requirement | `Lead.requirement` | Blank if null | Potentially sensitive sales/customer detail |
| 13 | Created At | `Lead.createdAt` | ISO-8601 UTC string | Creation date only; no last/first contact, due, closure, import timestamps |
| 14 | Assigned To | `assignedUser.name` | Blank when unassigned | Owner name; user ID omitted, so names may collide |
| 15 | Source | `source.name` via `Lead.sourceId` | Blank if source is null/deleted relation | Current display name; source ID/type omitted |

### Users — current order

| # | CSV column | Source / meaning | Null or representation | Sensitivity / gap |
|---:|---|---|---|---|
| 1 | Name | `User.name` | Stored string | Personal data |
| 2 | Email | `User.email` | Stored string | Personal data/account identifier |
| 3 | Role | `User.role` | Raw enum (`ADMIN`, `SALES`) | Internal authorization metadata |
| 4 | Active | `User.active` | `Yes` / `No` | Inactive users included; deleted excluded |
| 5 | Employee Code | `User.employeeCode` | Blank if null | Internal personnel identifier |
| 6 | Designation | `User.designation` | Blank if null | Internal workforce metadata |
| 7 | Phone | `User.phone` | Blank if null | Personal data |
| 8 | Created At | `User.createdAt` | ISO-8601 UTC | No date filter; `salesPrivilege`, `lastLoginAt`, `lastSeenAt`, `banned` omitted |

### Providers — current order

| # | CSV column | Source / meaning | Null or representation | Sensitivity / gap |
|---:|---|---|---|---|
| 1 | Name | `LeadSource.name` | Stored string | Provider/source label |
| 2 | Slug | `LeadSource.slug` | Stored string | Internal machine key |
| 3 | Type | `LeadSource.sourceType` | Stored string, not necessarily enum | Source kind |
| 4 | Active | `LeadSource.active` | Always `Yes` in current query | Inactive provider omission makes export incomplete |
| 5 | Created At | `LeadSource.createdAt` | ISO-8601 UTC | No date filter |

### Connector Sync Runs — current order

| # | CSV column | Source / meaning | Null or representation | Sensitivity / gap |
|---:|---|---|---|---|
| 1 | Run ID | `ConnectorSyncRun.id` | Stored string | Internal identifier |
| 2 | Connector | `connector.name` | Required relation | Operational label |
| 3 | Type | `connector.type` | Stored string | Connector implementation/type |
| 4 | Status | `ConnectorSyncRun.status` | Raw `ConnectorStatus` enum | Active, success/error-like status per connector model |
| 5 | Started At | `startedAt` | ISO-8601 UTC; filter field | Date filter is inclusive |
| 6 | Completed At | `completedAt` | Blank if not completed; otherwise ISO-8601 UTC | Incomplete runs remain represented |
| 7 | Records Seen | `recordsSeen` | Integer | Operational metric |
| 8 | Created | `recordsCreated` | Integer | Operational metric |
| 9 | Updated | `recordsUpdated` | Integer | Operational metric |
| 10 | Skipped | `recordsSkipped` | Integer | Operational metric |
| 11 | Error | `errorMessage` | Blank if null; raw text otherwise | Potential diagnostic/payload disclosure |

### Reports — current sections and values

`exportReports` emits an initial `LeadBridge Report, <range label>` row; then, in order: metric/value rows for Total Leads, Active, Won, Lost, Conversion Rate and Open Rate; Lead Status/Count rows; Lead Source/Leads rows; Salesperson/Assigned Leads rows plus Unassigned; Month/Created/Won/Lost rows; Activity/Count rows for Today, This Week and This Month. The five-column padding in many sections creates blank trailing CSV cells. Report semantics and date mismatch are documented in section 2.

## 5. Existing Filters and Date Semantics

**Verified existing export filters only:**

- Leads: status (CSV list), assigned user (ADMIN service behavior only; SALES-supplied value is overridden by actor scope), createdAt from/to, case-insensitive substring search across display name, company, email, phone and lead number.
- Sync runs: connector ID and startedAt from/to.
- Reports: from/to, but range only applies if both are provided; see section 2.
- Users and Providers: no filters.
- Audit Logs: unsupported.

**Important distinction:** The lead table itself has richer UI query state (status, priority, category, source, assigned user, archived/deleted, follow-up, activity date/action/response/interest, search, date, sorting and pagination) in `parseListQuery` and `LeadService.listPage`. Those filters are not wired into the current export button or export service. Export intentionally/implicitly does not inherit page pagination or sort order; it emits all matching rows.

## 6. Authorization and Data Isolation Audit

### Current permission matrix

| Actor | Leads | Users | Providers | Sync Runs | Reports | Audit Logs |
|---|---|---|---|---|---|---|
| ADMIN | Allowed; non-deleted leads across owners and unassigned; archived included | Allowed; non-deleted users | Allowed; active providers only | Allowed; all connectors unless filtered | Allowed | Unsupported |
| SALES / JUNIOR | 403 | 403 | 403 | 403 | 403 | Unsupported |
| SALES / SENIOR | Allowed; only own assigned, non-deleted leads | 403 | 403 | 403 | 403 | Unsupported |

**Verified authorization protections:** Session and account checks happen server-side in `withApiAuthorization`; role is restricted to ADMIN/SALES; `can()` grants `EXPORT_LEADS` only to ADMIN or SALES/SENIOR; service-level lead filtering binds SALES results to the session actor ID. A malicious `assignedUserId` cannot expand Sales scope. Unauthenticated, inactive, banned, and deleted user sessions are rejected.

**Verified related data isolation:** There is no related-entity export today. Existing access patterns demonstrate the intended scope: lead access (`LeadService.accessWhere`/`listPage`), notes (`NoteService.assertAccess`), and follow-ups (`salesFollowUpLeadScope`) restrict Sales to assigned, non-deleted leads. Any new activity/note/follow-up export must independently apply a lead relation predicate for the authorized lead set; filtering only on child assignee or actor is insufficient. Activities and notes are lead-linked. Follow-ups have both their own assignee and the lead's assignee; current Sales task listing requires the task's lead to be assigned to the actor and also filters task assignment/creation.

**Verified potential gaps / concerns:**

- The route gives ADMIN/Sales roles access to the handler and performs granular checks inside it; current checks are sound for currently implemented types, but future types must be added to an explicit allowlist and default-deny permission matrix.
- `exportLeads` silently removes invalid status values. A mixture of valid and invalid statuses returns the valid subset; an all-invalid list may become an empty `in` predicate. Validate and reject invalid/duplicate values explicitly in future contracts.
- Export filters are not schema-validated. Invalid/contradictory date inputs produce generic database errors or empty results; clients can supply unsupported params that are ignored.
- The current route's explicit row policy protects Sales even with query manipulation. Admin restrictions are appropriate for operational categories, but errors and user/provider columns remain deliberately privileged.
- There is no export-operation accountability record or persisted record count. The service logger only receives unexpected errors via API helper; successful exports are not logged.

**Recommended future permission matrix:** ADMIN may export all approved categories, including organization-wide CRM data and safe administration metadata. SALES/SENIOR (the existing `EXPORT_LEADS` capability) may export Leads, Activities, Follow-ups and Notes only for currently assigned, non-deleted leads. SALES/JUNIOR may not export unless product policy explicitly grants `EXPORT_LEADS`; do not infer it from page access. No SALES privilege exports Users, Providers, Connectors/configuration, Sync Runs, or administration/security logs. Every category must be independently authorized on the server, with scope restrictions enforced in service query construction.

## 7. Recommended Export Catalog

| Category | Status | Audience and purpose | Scope and relation shape | Date field / core filters |
|---|---|---|---|---|
| Leads | Supported; expand | ADMIN CRM operations; SALES/SENIOR pipeline analysis | Flat one-row-per-lead; Sales assigned leads only | Created, last contacted, closed/converted, follow-up due; classification/source/owner/location/search/archive filters |
| Lead Activities / Interaction History | New recommendation | ADMIN coaching/history; SALES/SENIOR personal customer follow-up and performance | Separate event-entry rows; Sales only events attached to visible assigned leads | `ActivityEvent.occurredAt`; event/entry type, channel, response, interest, lead, actor |
| Follow-ups | New recommendation | ADMIN workload planning; SALES/SENIOR personal task management | Separate one-row-per-follow-up; join lead and assignee summary | Due, completed, created dates; status, overdue, priority, owner, lead |
| Notes | New, restricted recommendation | ADMIN customer context; SALES/SENIOR customer continuity | Separate note rows; Sales limited to currently assigned leads | Note created/edited dates; lead, author, pinned, visibility; do not include hidden/private notes if policy evolves |
| Users | Supported; restricted to ADMIN | Workforce/account administration | One row per user; no auth relations | Created/active/account status; active, role, privilege, designation; avoid search indexing secrets |
| Providers | Supported; include inactive option | ADMIN source registry maintenance | One row per provider; optional aggregate counts separately | Created date; active state and source type |
| Connector configurations | Not currently supported; optional safe metadata recommendation | ADMIN integration inventory | One row per connector with allowlisted metadata only | Created/updated/last sync; enabled, status, type, source, schedule |
| Connector Sync Runs | Supported; improve | ADMIN operations and troubleshooting | One row per run | StartedAt or completedAt selector; connector, status, result counts |
| Audit / Export events | Unsupported; decision needed | ADMIN accountability/security operations | Separate export-event record, not relabeled CRM activity | OccurredAt; actor, category, outcome; no raw secrets/filter values |
| Analytics report bundle | Supported; maintain as a distinct “Reports” option | ADMIN summary/reconciliation | Aggregate sections, not row-level records | Consistent selected period per metric; make fixed-window metrics explicit or selectable |

**Not recommended for export:** Better Auth `Account`, `Session`, `Verification` rows; passwords, access/refresh/id tokens, cookies, OAuth/client secrets, API keys, raw `Connector.configuration`, secret-bearing headers, `Setting.value` without an explicit allowlist, `Lead.rawPayload`, imported raw email/body data, parser/routing credentials, internal lock-generation/token state, or attachment storage keys/checksums. Avoid exporting all JSON metadata wholesale; define field-specific safe projections.

## 8. Recommended Field Selections

**Recommended defaults and optional fields:**

- **Leads:** Lead Number; Name; Company; Email; Phone; Alternate Phone (optional); Status; Priority; Category; City; State; Country; Requirement; Product (legacy, optional); Created At; First Contacted At; Last Contacted At; Next Follow-up Due; Last Follow-up At; Closed At; Converted At; Assigned To; Source; Is Archived. Add expected value, currency, budget, campaign/UTM, website, job title, industry, full address, and lost reason only as explicit opt-ins due to sensitivity/usefulness. Exclude raw payload/custom JSON by default; expose bounded, documented custom-field columns only if business asks.
- **Activities:** Event ID (optional), occurred at, event type, entry type, lead number/name/company, actor name, channel/action, response, interest, message/notes, follow-up ID/title if useful. Prefer one row per ActivityEntry with event-level fields repeated. Avoid arbitrary metadata JSON; support a separate sanitized details field only if format contract is defined.
- **Follow-ups:** Follow-up ID, title, description (optional), lead number/name/company, due date/time, status, priority, assigned owner, created by, created at, completed at, linked note indicator. Do not flatten multiple follow-ups into one lead row.
- **Notes:** Note ID, lead number/name, created at, edited at, author, pinned, visibility, structured “What I did” and “What customer said”; full note content can be an optional field. Apply current lead visibility and sensitivity policy; notes may contain personal data.
- **Users:** Name, email, role, Sales privilege, active/banned state (admin only), employee code, designation, phone (optional), created at, last login (optional). Do not include auth/account/session values; omit last-seen unless an operational need is confirmed.
- **Providers:** Name, slug, source type, active, created at, updated at; optional lead count. Include inactive providers when requested rather than silently omit them.
- **Connector inventory:** Name, type, enabled/status, provider, parser name/version, schedule type, next/last sync, health, failure counts/duration. Configuration must be projected through an explicit safe allowlist; omit entire secret-bearing `configuration` JSON by default.
- **Sync Runs:** Current columns plus selected/completed duration and safe error class/message; include connector. Exclude raw metadata; redact URLs, payloads and credentials from errors. ADMIN only.
- **Reports:** Preserve a separate aggregate report, but align all sections to one explicit period or label each distinct window in columns/section headings. Include deleted counts only if explicitly requested.

Enums should remain stable machine values for data processing, with optional human labels in separate columns if the CSV is meant for nontechnical users. Date-times should serialize as ISO-8601 UTC consistently. Nulls should remain blank; optional boolean labels should consistently use `Yes`/`No` or lowercase `true`/`false` across all categories.

## 9. Recommended Filter Specifications

### Shared date contract

**Recommended:** All time is the default. Presets: Today, Yesterday, Last 7 days, Last 30 days, This month, Previous month, Custom. Define relative calendar periods in one explicit application/business timezone (current helpers use UTC; absent a configured CRM timezone, UTC is the verified-safe default). Compute start-inclusive and next-period-start-exclusive timestamp bounds. For custom date-only inputs, use `[from start-of-day, day-after-to start-of-day)` so the selected end day is fully included. For timestamp-based clients, retain explicit instants and document that `to` is exclusive. Reject malformed dates, missing custom endpoints, reversed ranges, and unreasonable future/old ranges with 400 validation errors. Keep separate date-field selector where a category has several meaningful dates.

| Category | Default date field | Additional date selectors |
|---|---|---|
| Leads | `createdAt` | `lastContactedAt`, `firstContactedAt`, `closedAt`, `convertedAt`, `nextFollowUpAt`, `lastFollowUpAt`, `updatedAt` |
| Activities | `ActivityEvent.occurredAt` | Entry createdAt only when needed for audit/ingest comparisons |
| Follow-ups | `dueDate` | `createdAt`, `updatedAt`, `completedAt`; explicitly state which field a preset filters |
| Notes | `createdAt` | `editedAt` |
| Users | `createdAt` | `updatedAt`, `lastLoginAt` (ADMIN only) |
| Providers | `createdAt` | `updatedAt` |
| Connector Sync Runs | `startedAt` | `completedAt` |
| Reports | Lead creation date for lead counts | Each metric must share the selected period or advertise its fixed window |
| Export events | Event occurredAt | N/A |

### Lead filters

**Recommended:** status (multi-select; values from `LeadStatus`), priority (multi-select), category (multi-select), source/provider (multi-select by stable ID), assigned salesperson (multi-select for ADMIN; Sales fixed to self), created/last-contacted/closed/follow-up date field and range, city/state/country (free text or location select), search term (free text over the same five existing lead identity/search fields), archived state (active/archived/both), and deleted state (default exclude; admin-only explicit include if recoverable deleted data should be exported). Category and source values must be validated against schema/known IDs.

### Activity filters

**Recommended:** activity event type and entry type (multi-select), action/channel (multi-select), response (multi-select), interest (multi-select), occurred-at range, lead (free-text lead number/name or selected IDs), actor (multi-select for ADMIN; Sales fixed actor or current lead scope), and optional lead status/priority/category. Related lead filters combine with activity-specific constraints.

### Follow-up filters

**Recommended:** status (`PENDING`, `COMPLETED`, `CANCELLED`, multi-select), due-date range, priority (multi-select), owner (multi-select for ADMIN; Sales fixed to self if exporting tasks assigned to them), lead, overdue (derived as pending and `dueDate < now` in declared timezone), and created/completed date field. For SALES, constrain by visible lead and then decide whether to include follow-ups assigned to another user on that visible lead; default to only tasks assigned to the actor, with an explicit policy decision if shared tasks are valid.

### Other categories

- **Users:** role (multi-select), Sales privilege (multi-select), active/banned (multi-select), created/updated/login range, designation (multi-select/free text), search name/email/employee code; ADMIN only.
- **Providers:** source type and active state (multi-select), created/updated range, name/slug search; include inactive as explicit filter.
- **Connectors:** type, provider/source, enabled, health/status, schedule type, last sync/failure range; ADMIN only and never filter/return secrets.
- **Sync Runs:** connector (multi-select), connector type, run status, started/completed range, error/non-error outcome, records-created range; ADMIN only.
- **Reports:** one shared date range plus optional source/owner/status segmentation; all sections use the selected range unless section explicitly says otherwise.
- **Export events:** actor, category, outcome, date range; ADMIN only; omit sensitive raw parameter values.

### Combination semantics

**Recommended:** AND between different filter groups; OR among selected values within the same multi-select. Search is ANDed with other groups and ORed across the documented search fields. Date range is ANDed with other predicates. Unknown filter keys/values should return 400 (or be ignored only by versioned forward-compatibility policy); never silently broaden results. Sales identity and lead-scope predicates are server-owned and combined with every client predicate using AND.

## 10. Export UI and Navigation Recommendation

**Recommendation:** A dedicated Export workspace/page is the better primary architecture for the requested multi-step flow. Categories, role-aware controls, filter builder, column picker, preview/count, and generation/download states exceed the compact `ExportButton` interaction. Current navigation supports role-specific routes; Admin has Leads/Reports as primary and secondary admin destinations in the More drawer, while Sales has Dashboard/My Leads/Tasks/Profile.

Proposed `/admin/exports` and `/sales/exports` routes can use the dashboard layouts and server authorization. Add Export to Admin’s More drawer and Sales’ secondary/overflow navigation. Keep contextual buttons on relevant list pages as shortcuts that open the workspace with category and current filter values preselected; provide a visible “current filters” summary and an explicit “all matching records” explanation. Do not imply table pagination limits the export.

**Prioritized UX:**

1. V1: category selection; date preset/custom control; category-specific core filters; sensible fixed safe columns; selection summary; server-side estimated count; generate/download; clear empty result, loading, completion and retryable error states.
2. V1.1: optional column selection for Leads and field documentation/tooltips; include/exclude archived choice; saved presets only if repeatable operator workflows are observed.
3. Later: saved/shared presets, async large exports, multiple file formats, Activity/Follow-up/Notes exports, scheduled exports, or XLSX only with demonstrated need.

The same workflow should be reused across Admin and Sales, with server-derived categories and immutable Sales scope. Accessible labels must reflect the selected category; the current icon label is fixed to “Export leads.”

## 11. Security and Reliability Findings

- **CSV syntax (verified):** `escapeCsv` handles delimiters, double quotes, CR/LF quoting, Unicode, and null-as-empty. `toCsvRow` terminates each row with LF. It does not emit a UTF-8 BOM; this is acceptable for valid UTF-8 but some spreadsheet apps may need one for reliable Unicode detection.
- **Formula injection (verified):** Text beginning with `=`, `+`, `-`, `@`, tab, or CR is prefixed with `'`; leading whitespace/control characters are stripped only for candidate detection, and original text is then prefixed. Numeric JavaScript numbers/bigints are preserved as numeric strings. `tests/phase1-hardening.test.ts` covers common formula prefixes, whitespace/control prefix, negative number versus text, quoting, multiline text and Unicode. This is a meaningful safeguard; retain tests and extend with spreadsheet-specific edge cases during implementation.
- **Dates/timezone (verified):** Row timestamps and filenames use UTC ISO strings/date. Preset/calendar timezone behavior is not centralized; report UI constructs floating millisecond windows and report service uses a mix of `startOfTodayUTC()` and local `setDate`/`setMonth` operations. Standardize before adding more filters.
- **Relations/duplicates (verified):** Lead export joins only optional to-one owner/source relations; users/providers are direct; sync run joins a required to-one connector; these joins do not multiply rows. Reports use counts/grouping. New activity exports will naturally have multiple entries per event; define row grain explicitly to avoid accidental duplicate joins.
- **Headers and filename (verified):** Content type and attachment disposition are set. Filename is built solely from fixed type plus UTC date, so user input cannot inject a filename. No explicit cache-control or content-length is set; Next.js response buffers body. Content type is CSV, no charset/BOM negotiation.
- **Query manipulation (verified):** Currently accepted parameters are constrained by hard-coded branches and Sales scope is server-enforced. There is no centralized Zod export schema, and extra query keys are ignored.
- **Logging/accountability (verified):** No success/failure export audit record, download ID, row count, or filter summary is persisted. Unexpected errors are logged by `handleApiError` without export context. Recommend structured events with actor/category/result/count/duration and safe filter names, while excluding PII/search text and secrets.
- **Operational errors (verified):** Sync-run Error text is emitted raw. Audit output should not expose diagnostic secrets; sanitize or omit this value by default.
- **Error responses (verified):** `handleApiError` returns known `ServiceError`s directly; unexpected exceptions are logged and return generic “Something went wrong.” A rejected date parse is not classified as a client validation error.

## 12. Performance and Scalability Assessment

**Verified:** Service exports use 1,000-row OFFSET batches and deterministic ordering with an ID tie-breaker; the final CSV is fully buffered in memory. There is no row/byte cap, timeout policy, streaming response, background job, progress endpoint, cancellation, or cleanup flow. The performance guide currently labels lead export “Background export,” but current code runs synchronously inside the route and does not enqueue work.

**Inferred:** Small/medium local CRM exports may be adequate synchronously, but full organization exports become request-duration and memory risks as records/large text fields increase. Batching controls Prisma page size, not end-to-end memory. OFFSET cost grows with depth; concurrent writes can shift pages. Large reports are aggregate-oriented and likely much smaller.

**Recommended:** For initial synchronous v1, establish and enforce a tested maximum row/byte/time threshold, use a stable snapshot/cursor strategy where possible, stream CSV in the route, and add cancellation/error visibility. Verify common query plans and indexes before adding indexes. Existing relevant indexes include Lead `(isDeleted, createdAt)`, `(status, isArchived, isDeleted)`, `(assignedUserId, status, isDeleted)`, `(assignedUserId, isDeleted, updatedAt)`; ActivityEvent `(leadId, occurredAt)` and `(leadId, type, occurredAt)`; ActivityEntry `(type, createdAt)`; FollowUp `(leadId, dueDate, status)`, `(assignedUserId, status, dueDate)`, `(leadId, createdAt)`; ConnectorSyncRun `(connectorId, startedAt)` and `(status, startedAt)`; User `(role, active, isDeleted)`. Export combinations across source/category/date/status may need measurements and `EXPLAIN (ANALYZE, BUFFERS)` before index changes.

**Recommendation on async jobs:** Keep bounded exports synchronous with streaming initially. Introduce a background job only when measured duration/size exceeds an agreed threshold or local request timeouts are observed. The application currently has no external queue; avoid adding one without evidence. A DB-backed export job may be sufficient for this local, single-tenant product if lifecycle needs arise.

## 13. Identified Bugs, Gaps, and Risks

1. **Current UI filters are dropped:** Admin/Sales Lead export buttons do not pass current query state. Provider export omits inactive rows even though the page can display/filter them.
2. **Incomplete date upper bound:** Date-only `to` includes only midnight at start of day because the query uses `lte` on the parsed instant.
3. **Missing request validation:** Invalid or reversed dates and unsupported filters are not rejected as client errors. Unknown status values are silently filtered.
4. **Reports range mismatch:** One-sided ranges silently mean all time; monthly trends/activity use windows independent of selected range.
5. **Potential OFFSET drift and full memory buffering:** Batch pagination is not streamed and has no maximum.
6. **No export accountability:** Successful and failed export attempts are not recorded with actor/category/count/duration.
7. **Sync error text exposure:** `ConnectorSyncRun.errorMessage` is included raw for all admin sync exports.
8. **Misleading API docs:** `docs/api.md` calls `/api/export` “Any authenticated”; actual code permits only ADMIN/SALES roles and further restricts types/privileges.
9. **Stale service docs:** `docs/backend.md` lists ExportService for leads/users/providers/sync history but omits actual `reports` type.
10. **Stale UX/performance docs:** `docs/frontend.md` claims ExportButton has toast feedback; the component opens a new tab with no toast. `docs/performance.md` describes “Background export”; current route executes synchronously.
11. **No export integration tests:** Existing test coverage includes CSV formula/escaping unit coverage and a structural assertion for the Product field/order (`tests/lead-creation-validation.test.ts`), but no route authorization, filters, exact all-column snapshot, filename/header, empty export, or large-result test was found.
12. **Audit category unsupported:** No audit-log model/export; ActivityEvent is CRM history, not a security log.

## 14. Prioritized Implementation Roadmap

1. **Contracts and policy:** Agree category catalog, per-category role/privilege matrix, Sales lead scope, date-field selector/boundaries/timezone, row grain, field defaults, exclusion policy, maximum size, and export accountability requirements. Define typed/Zod query/output contracts and safe allowlists before UI expansion.
2. **Backend query/filter architecture:** Implement per-category query builders that validate every value, AND user filters, OR multi-select values, and always add server-owned authorization predicates. Reuse domain scopes for lead-linked Activities/Follow-ups/Notes. Keep route thin and Prisma access in services.
3. **Serialization and reliability:** Preserve/extend CSV escaping and formula neutralization; normalize UTC dates/null/enums; sanitize sync errors; add streaming and a measured size/time limit; establish stable ordering/snapshot semantics and response headers; record safe structured export outcomes.
4. **Export workspace UI:** Add role-aware `/admin/exports` and `/sales/exports` routes and navigation. Build category/filter/column/preview/download stages, active filter summary, empty/error/progress states; contextual entry points pass current filters explicitly.
5. **Initial category expansion:** Add Activity, Follow-up and Note exports with clearly documented row grains and current authorized lead scope; add safe connector inventory only if Admin confirms operational value. Improve Providers to include inactive records on request and Sync Runs with safe diagnostics.
6. **Tests, performance verification, and docs:** Add export contract/service/API authorization tests for all categories and scope manipulation; exact field order and CSV safety tests; date boundary/invalid-input tests; duplicate/empty tests; bounded large-result/stream tests. Measure representative queries, use `EXPLAIN (ANALYZE, BUFFERS)` before new indexes, verify streaming/limits, and update API/backend/frontend/performance/auth docs to actual behavior.
7. **Later capabilities:** Saved presets, async jobs, alternate formats, and audit/event browser should follow usage evidence and agreed retention/access policy.

## 15. Open Decisions and Assumptions

- What is the CRM business timezone? Current date helpers use UTC, but some report calculations use local runtime methods.
- Should SALES/SENIOR exports retain current assigned-only scope if assignment changes during a multi-chunk export? Define snapshot timing.
- May SALES export follow-ups assigned to another salesperson when the parent lead is currently assigned to them?
- Should full Note content and customer statements be included by default, opt-in, or excluded for Sales? Any note visibility rules planned beyond current `INTERNAL` value?
- Should ADMIN Lead exports include archived records by default (current behavior), and should deleted records ever be exportable?
- Should `reports` remain a dedicated aggregate CSV, and should the selected period govern all report sections?
- Should inactive Providers and Users remain exportable by default or be controlled by explicit state filters?
- Which safe Sync Run diagnostic fields are useful, and what redaction policy is needed for errors?
- Should export accountability use structured Pino records, a new export-specific persistence model, or another established security-event sink? Do not treat lead-linked ActivityEvent as a global audit log.
- What max synchronous row count, response size and duration suit the local deployment? This needs measurement.
- Should V1 allow column selection only for Leads or all row-based categories? Recommendations assume Leads first.
- Are CSV as the only initial format and no saved presets acceptable? They minimize implementation complexity and match the current service.

---

## Source References

- `src/components/shared/export-button.tsx` — `ExportButton`
- `src/services/export.service.ts` — `exportInChunks`, `ExportService.exportLeads`, `exportUsers`, `exportProviders`, `exportSyncHistory`, `exportReports`
- `src/app/api/export/route.ts` — authenticated GET dispatch, per-type authorization, headers and filename
- `src/lib/csv.ts` — `escapeCsv`, `toCsvRow`
- `src/lib/api.ts` — `withApiAuthorization`, `handleApiError`
- `src/lib/permissions.ts` — `Permission.EXPORT_LEADS`, `can`
- `src/lib/query-builder.ts` — `parseListQuery`, `dateRange`, `containsSearch`
- `src/services/lead.service.ts` — `accessWhere`, `listPage`
- `src/services/follow-up-policy.ts`, `src/services/follow-up.service.ts` — `salesFollowUpLeadScope`, Sales follow-up access
- `src/services/note.service.ts` — `assertAccess`, note scope
- `src/services/activity-event.service.ts` — ActivityEvent/Entry relationships and lead timeline queries
- `src/services/report.service.ts` — report aggregate queries/date behavior
- `prisma/schema.prisma` — User, Lead, LeadSource, ActivityEvent, ActivityEntry, Note, FollowUp, Connector, ConnectorSyncRun, auth models, indexes
- `tests/phase1-hardening.test.ts` — CSV escaping/formula test
- `tests/lead-creation-validation.test.ts` — Product export compatibility and order assertion
- `src/app/(dashboard)/admin/leads/page.tsx`, `admin/users/page.tsx`, `sales/my-leads/page.tsx`; `src/components/providers/providers-page-content.tsx`, `connectors/connectors-page-content.tsx`, `admin/admin-reports.tsx` — export entry points
- `docs/architecture.md`, `docs/database.md`, `docs/backend.md`, `docs/frontend.md`, `docs/api.md`, `docs/authentication.md`, `docs/performance.md`, `docs/integrations.md`, `docs/development.md` — canonical architecture and behavior references consulted; where export claims differ, current code is authoritative
