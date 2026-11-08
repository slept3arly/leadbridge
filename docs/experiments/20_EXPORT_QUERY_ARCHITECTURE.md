# Export Query Architecture — Phase 2

> **Status:** Phase 2 implemented backend query/filter architecture for the existing live categories. Phase 3 added streamed CSV delivery and bounded operation handling; Phase 4 added the workspace UI. No preview/count route, new category query, or background job is implemented.
> **Date:** 2026-11-07
> **Contracts:** [19_EXPORT_SYSTEM_CONTRACTS.md](./19_EXPORT_SYSTEM_CONTRACTS.md)

## 1. Query Architecture

The live flow is `GET /api/export` → the compatibility parsers in `src/lib/export/legacy-compatibility.ts` → `ExportService` in `src/services/export.service.ts` → `ExportQueryService` in `src/services/export/query.service.ts` → category query builders and field projections → Prisma. The route handles session admission, query parsing, status/response headers, and errors. It does not construct Prisma queries.

Responsibilities are separated as follows:

| Module | Responsibility |
|---|---|
| `src/lib/export/registry.ts` | Stable category IDs and implemented/planned availability. |
| `src/lib/export/policy.ts` and `src/services/export/authorization.ts` | Shared role/privilege decision plus a server-side unavailable-category check. |
| `src/lib/export/legacy-compatibility.ts` | Adapts the existing query parameter names and inclusive `to` behavior into validated filter contracts and internal exclusive bounds. |
| `src/lib/export/filters.ts`, `dates.ts`, `fields.ts` | Strict category filters, UTC date ranges, stable field allowlists. |
| `src/services/export/scope.ts` | Server-owned lead predicates for Admin and Sales. |
| `src/services/export/query-builders.ts` | Typed category where/order clauses; client values cannot supply Prisma query objects. |
| `src/services/export/projections.ts` | Explicit, allowlisted Prisma select objects and legacy column identifiers. |
| `src/services/export/keyset.ts` | Count-bounded deterministic keyset page iteration (250 rows per fetch). |
| `src/services/export/query.service.ts` | Validates category filters, authorizes, builds count and row queries, resolves projection, and exposes bounded async row iterators. |
| `src/services/export/csv-serialization.ts` | Stable legacy headers/order and one-row CSV serialization. |
| `src/services/export/csv-stream.ts` | Incremental UTF-8 byte stream, byte/row/time guards, cancellation and outcome callback. |
| `src/services/export.service.ts` | Opens query iterators and yields serialized rows/report sections incrementally. |

The service methods validate their category-specific Zod filter schema even when invoked outside the API route. Selected field IDs pass through `resolveExportColumns()`; invalid or restricted IDs become HTTP 400 service errors. `GET /api/export` remains the only live endpoint and is not a preview/count endpoint.

## 2. Category Support Status

| Category | Registry state | Query support | Live endpoint |
|---|---|---|---|
| `leads` | Implemented | Yes | Yes |
| `users` | Implemented | Yes | Yes |
| `providers` | Implemented | Yes | Yes |
| `sync-history` | Implemented | Yes | Yes |
| `reports` | Implemented | Aggregate query path | Yes |
| `activities` | Planned | No | Rejected as unavailable |
| `follow-ups` | Planned | No | Rejected as unavailable |
| `notes` | Planned | No | Rejected as unavailable |
| `connectors` | Planned | No | Rejected as unavailable |

The route recognizes stable registry IDs. Unknown values return 400; a known but planned category runs its authorization policy and then returns 404 for an authorized caller. No planned category falls through to another live query.

## 3. Authorization and Scope

`authorizeExportCategory()` invokes `canExportCategory()` from the Phase 1 policy for every query service operation. `canExportCategory()` uses the existing `Permission.EXPORT_LEADS` and Senior Sales privilege requirement. The route itself still admits only ADMIN or SALES sessions, while service authorization is the definitive category check.

`buildExportLeadScope()` in `src/services/export/scope.ts` always contributes a server-owned predicate:

- ADMIN: `isDeleted = false`.
- SALES/SENIOR: `assignedUserId = authenticated actor.id AND isDeleted = false`.
- SALES/JUNIOR: denied before query construction.

`buildLeadExportWhere()` puts this predicate in an `AND` list separate from all client filters. A requested `assignedUserIds` list can narrow Sales results to none; it cannot replace the actor ID or retrieve unassigned/other-owner leads. Archive state (`active`, `archived`, or `both`) is independently ANDed and defaults to `both`. User-supplied identity is never used to derive scope.

Users, Providers, Sync Runs, and Reports remain Admin-only. User rows exclude deleted users, but there is no implicit active/banned filter. Provider state is likewise unfiltered in the new query path unless explicitly selected. The legacy provider adapter uses `active=true` to preserve the old endpoint’s active-only result set.

Activities, Follow-ups, and Notes retain their contract policies but have no query implementation here. When Follow-ups are implemented, their predicates must AND the visible, non-deleted parent lead with `FollowUp.assignedUserId = actor.id` as defined by the contract.

## 4. Filter Mapping

`query-builders.ts` maps only validated filter objects to typed Prisma `where` values. Each applicable filter group is an AND clause; enum/ID multi-select filters use `in` (OR among values). Search ORs only across the documented fields, then ANDs with other predicates.

| Category | Applied filters |
|---|---|
| Leads | Status, priority, category, source IDs, requested assignee IDs, city/state/country contains search, identity search across display name/company/email/phone/lead number, archive state, and selected date field. Mandatory actor/deleted scope is independent. |
| Users | Role, Sales privilege, active, banned, designation, identity search across name/email/employee code, and created/updated/last-login date. Deleted users are excluded. |
| Providers | Source type, active, name/slug contains search, and created/updated date. Inactive records are included when no state filter is supplied. |
| Sync Runs | Connector IDs/types, status, error outcome, and started/completed date. Error outcome is based on the `ConnectorSyncRun.status` enum (`ERROR` vs not `ERROR`), not the raw diagnostic string. |
| Reports | One shared lead-creation range plus source, owner, and status segmentation across summary, status, source, assignment, trend, and interaction aggregates. Deleted counts use the selected range and segmentation but are kept as a separate summary metric. |

Invalid enum values, date fields, unknown filter keys, malformed date values, incomplete/reversed ranges, and invalid selections are rejected. Multi-select duplicates are normalized by the Phase 1 schemas. The live compatibility adapter does not accept new arbitrary filter keys; old callers continue to use `status`, `assignedUserId`, `from`, `to`, `search`, and `connectorId`.

## 5. Date Boundaries

`resolveExportDateRange()` supplies UTC calendar bounds. Category builders map a range to Prisma `gte` for `from` and `lt` for `toExclusive`. Leads support created, last-contacted, closed, and next-follow-up dates. Users support created, updated, and last-login. Providers support created and updated. Sync Runs support started and completed. Reports use created date for lead-level aggregates and occurrence time for their fixed interaction windows.

The compatibility adapter intentionally preserves legacy endpoint behavior: a legacy `to` timestamp was inclusive, so it is advanced by one millisecond and passed internally as exclusive. Legacy lead and sync filters continue to permit one-sided ranges. Reports reject one-sided ranges; paired legacy report boundaries are converted to the internal exclusive range. New contract requests use the Phase 1 timestamp-exclusive/date-only-inclusive rules without this adapter adjustment.

The export report Activity section keeps fixed operational windows: UTC today, trailing seven 24-hour days, and trailing thirty 24-hour days. It is not narrowed to the selected lead-creation range; source/owner/status segmentation is applied through each event’s lead. The current CSV label `This Month` still describes the trailing 30-day metric, a pre-existing labeling mismatch deferred to the serialization phase to avoid changing report layout in this phase. Calls from the existing `/api/reports` UI omit export filters and retain that endpoint’s prior rolling-trend and activity-window behavior.

## 6. Field Projection and Serialization Boundary

`projections.ts` resolves default or selected field IDs with `resolveExportColumns()` and constructs explicit Prisma selects. Lead relations select only `assignedUser.name` and `source.name`. Sync Run selects connector name/type and operational counters only; it does not select `errorMessage`, `metadata`, connector configuration, or secrets. User selects do not include Better Auth Account/Session/Verification data or credentials. Lead raw payload and custom JSON fields are not selectable.

The four row projections can be selected from approved registry fields. A stable ID is selected internally where needed for ordering, not serialized as an unapproved output column. The current route continues to serialize its legacy hardcoded column order. Leads retain the legacy Product column at its existing position. Sync history retains the existing `Error` CSV header but now emits an empty cell: no safe sanitizer exists in the current diagnostic path, and raw text is not read or emitted.

Phase 3 preserves `src/lib/csv.ts` escaping/formula neutralization and the existing category headers/order. The route now serializes and emits UTF-8 records incrementally; see [21_EXPORT_DELIVERY_RELIABILITY.md](./21_EXPORT_DELIVERY_RELIABILITY.md).

## 7. Count and Bounded Retrieval

For row categories, the query service first executes a count with the exact same `where` object used for retrieval. A count above `EXPORT_LIMITS.maxRows` (50,000) is rejected with HTTP 413 before any page fetch. Rows are fetched in 250-record keyset pages, stopping at the initial count. Leads sort by created time descending then ID descending; sync runs sort by start time descending then ID descending; users and providers sort by ID ascending.

The count and page queries are separate short transactions without a repeatable-read snapshot. Keyset traversal avoids offset shifts; concurrent inserts/deletes/updates can still affect membership/values and the result may be shorter than the initial count. No database-backed concurrency test was run. Aggregate Reports use SQL/Prisma aggregation rather than loading source leads into JavaScript; their output is also streamed after bounded aggregate results are assembled.

Lead predicates can use existing indexes such as `[assignedUserId, status, isDeleted]`, `[assignedUserId, isDeleted, updatedAt]`, `[isDeleted, createdAt]`, and `[status, isArchived, isDeleted]`. Alternate date fields (last contacted, closed, follow-up due) and broad location predicates may scan more rows; users/providers remain small administrative tables. No index or schema change was made, and no `EXPLAIN`/database performance measurement was run in this phase.

The 50,000 row, 25,000,000 UTF-8 body byte, and 30-second application deadline limits are enforced in the Phase 3 execution path. PostgreSQL statements use a 15-second statement timeout and each short transaction is capped at 16 seconds. An in-flight Prisma query is not actively aborted by the request signal; the database timeout bounds it. These application limits do not guarantee process/proxy availability for 30 seconds.

## 8. Backward Compatibility Adapter

The adapter keeps the existing query names and the `text/csv; charset=utf-8` and `Content-Disposition` response headers/filename convention. It preserves fixed column order and legacy date inclusivity. Provider exports retain the old active-only behavior. The API still exposes only the five implemented categories.

Two deliberate safety/validation changes are visible to existing callers:

1. Sync Runs no longer include arbitrary raw `errorMessage` values; the existing `Error` column is blank until a safe diagnostic policy is available.
2. Malformed dates, unsupported status values, and one-sided report ranges are rejected with 400 instead of being silently ignored or treated as all time. One-sided lead/sync ranges remain valid.
3. Unknown and duplicate query parameters are rejected with 400. Export Reports’ monthly trend section now follows the selected report range instead of silently using the report page’s rolling six-month window; the page’s `/api/reports` data behavior remains unchanged.

The existing ExportButton continues to use the same route/download response shape. Phase 4 adds dedicated role-aware pages and contextual shortcuts without changing the endpoint contract; see [22_EXPORT_UI_IMPLEMENTATION.md](./22_EXPORT_UI_IMPLEMENTATION.md).

## 9. Verification and Limitations

Unit tests in `tests/export-query.test.ts` exercise pure query predicates, Sales scope composition, archive/date/search behavior, inactive-state filters, projection exclusions, ordering, UTC preset bounds, validation, and row-limit paging. Phase 1 contract tests remain in `tests/export-contracts.test.ts`. These tests do not claim database query execution, route integration, or authorization against a live session store.

No Activities, Follow-ups, Notes, or Connector inventory query is implemented. No preview/count endpoint exists. Snapshot consistency is not implemented. Export accountability is best-effort structured Pino logging, not durable audit persistence. See Phase 3 reliability documentation for stream, limits, cancellation, and known constraints.
