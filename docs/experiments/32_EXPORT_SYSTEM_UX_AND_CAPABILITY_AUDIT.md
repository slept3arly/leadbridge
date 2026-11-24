# Export System UX and Capability Audit

> **Status:** Phase 1 read-only audit; recommendations only
> **Source review date:** 2026-11-15
> **Authority:** Current source code and `prisma/schema.prisma`; experiments 18–24 were treated as historical context and checked against the live implementation.

## 1. Executive summary

LeadBridge currently has a single live download endpoint, `GET /api/export`, which produces UTF-8 CSV. Five categories are implemented: Leads, Users, Providers (the `LeadSource` model), Connector Sync Runs, and Reports. Four categories in the registry (Activities, Follow-ups, Notes, Connectors) are explicitly planned and are rejected as unavailable by the live endpoint.

The Admin export workspace supports useful Lead filters and date presets, plus connector and report date filters. Senior Sales users receive only the Leads category and the server scopes it to their own assigned, non-deleted leads. The live endpoint streams bounded output and has row, byte, and time limits. No current role-scope bypass was found in the export query path.

The main product gap is that the user cannot choose or reorder columns, select table rows, preview rows, or see an estimated count. The export summary only echoes the current filter selection and fixed column names. Downloads open in a new tab, and the UI cannot report transfer completion or show an in-page server error after streaming begins.

There is a material implementation split: `EXPORT_FIELDS`, `EXPORT_CATEGORIES`, generic per-category filter schemas, projection builders, and download/preview/count request schemas describe a broader system, but the live UI builds legacy query parameters and `GET /api/export` parses only that legacy contract. No production route consumes the generic download, preview, or count request schemas. The field registry also disagrees with current output in a few places: the live Leads CSV includes Product even though the field default marks it unselected; live Users includes Phone while the field default omits it and marks Sales Privilege selected; the Sync Runs file has a blank Error column that the column summary does not list.

No confirmed critical authorization defect was identified. Before column selection becomes live, field sensitivity must become an enforced authorization policy: several fields marked sensitive are selectable in the registry today, and selection order is currently normalized back to catalog order. The simplest useful next step is to reconcile the live contract and metadata, then add count/preview and a permission-aware column picker. The current schema already contains most requested Lead data, so ordinary filter and column improvements do not appear to require a migration.

This was a source-only review. No database was queried, no app code or data was changed, and no screenshots were captured. The export routes are session-protected, and browser automation/browser binaries are not available in this environment.

## 2. Current workflow and route references

### Dedicated workspaces

| Route | Page and entry behavior | Categories visible |
|---|---|---|
| `/admin/exports` | `src/app/(dashboard)/admin/exports/page.tsx`; requires an Admin session and loads salesperson, connector, and active source options. | Leads, Users, Providers, Connector Sync Runs, Reports |
| `/sales/exports` | `src/app/(dashboard)/sales/exports/page.tsx`; requires a Sales session and redirects to `/sales` without `EXPORT_LEADS`. | Senior Sales: Leads only. Junior Sales: no access. |
| `GET /api/export` | `src/app/api/export/route.ts`; session-authenticated download route. It accepts the legacy `type` contract and streams an attachment. | Live: Leads, Users, Providers, Sync Runs, Reports. Recognized planned categories return unavailable. |

The workspace in `src/components/export/export-workspace.tsx` presents category selection, applicable filters, a summary, “Download CSV”, and “Reset filters”. It has no column chooser: the summary shows the current fixed CSV header names as chips. Changing category resets filter state. Filters are built into query parameters by `src/lib/export/ui.ts`, then opened with `window.open()` in a new tab.

### Contextual download buttons

The only other export controls found are:

- Leads table controls in `src/components/sales/sales-table-controls.tsx`, reused by the Admin Leads page and Sales My Leads page. The URL-backed filters that the export route supports are passed through; pagination and sort are not, so the download covers all matching rows. Unsupported active page filters prevent the download and show an explanation.
- Admin Users table in `src/components/users/user-table-controls.tsx`. The current Users endpoint accepts no user filters, so active search/date/filter state blocks the shortcut rather than silently exporting a different selection.
- Provider management in `src/components/providers/providers-page-content.tsx`. The route always exports active providers; search, type, or inactive state blocks the shortcut.
- Admin Reports in `src/components/admin/admin-reports.tsx`. Its date range is passed to the Reports export.
- Connector list in `src/components/connectors/connectors-page-content.tsx`, which exports all Sync Runs, and the Sync History modal in `src/components/connectors/sync-history-modal.tsx`, which passes the selected `connectorId`.

No export of selected table rows was found. Other page areas do not expose a separate CSV download action.

There are no screenshots in this audit. The route and source references above are the available evidence for the current experience; the pages require an authenticated session.

## 3. Categories and current capabilities

The registry (`src/lib/export/registry.ts`) lists nine categories, but only five are both implemented and available to a given actor through `getAvailableExportCategories()`.

| Category | Status | Current filter controls and live parameters | Current emitted columns / structure |
|---|---|---|---|
| Leads | Implemented | Status, source, Activity Action/Response/Interest, Priority, Category, archived state, search, created-date range, Activity Date range. Admin only: one assigned salesperson or unassigned. | 15 fixed columns: Lead Number, Name, Company, Email, Phone, Status, Priority, City, State, Country, Product, Requirement, Created At, Assigned To, Source. |
| Users | Implemented | None. The endpoint exports all non-deleted users, active and inactive. | 8 fixed columns: Name, Email, Role, Active, Employee Code, Designation, Phone, Created At. |
| Providers | Implemented | None on the download route. The compatibility parser forces `active=true`. In the UI this means active `LeadSource` records, not connector providers. | 5 fixed columns: Name, Slug, Type, Active, Created At. |
| Connector Sync Runs | Implemented | `connectorId`, `from`, `to`; dates use `startedAt`. The modal can scope to one connector. | 11 actual CSV header cells: Run ID, Connector, Type, Status, Started At, Completed At, Records Seen, Created, Updated, Skipped, Error. The Error cell is always blank. |
| Reports | Implemented | Paired `from` and `to`, or neither. The dedicated workspace exposes date presets/custom range; report page shortcut passes its current date range. | Fixed sectioned CSV (metrics, status, source, salesperson, monthly trends, activity). Not a rectangular table or selectable columns. |
| Activities | Planned | Generic schema exists but live route returns unavailable. | No live file. |
| Follow-ups | Planned | Generic schema exists but live route returns unavailable. | No live file. |
| Notes | Planned | Generic schema exists but live route returns unavailable. | No live file. |
| Connectors | Planned | Generic schema exists but live route returns unavailable. | No live file. |

### Defaults and date presets

- Dedicated Lead export defaults to all statuses/sources/actions/etc., all active and archived leads, and all time. Sales scope is still the authenticated user’s assigned leads. The UI offers date presets: All time, Today, Yesterday, Last 7 days, Last 30 days, This month, Previous month, and Custom. Preset dates are UTC calendar boundaries.
- The Lead table shortcut sends `archived=false` if the page has no explicit archived filter, matching its active-only table default. The dedicated workspace defaults to both active and archived.
- Activity date is independent of Lead created date. It supports Any, Today, Yesterday, and custom date boundaries. Activity Action, Response, and Interest apply to a matching CALL/WHATSAPP entry on the same event; groups combine with AND, and multiple selected values within one group combine with OR.
- Sync Runs and Reports use the same preset list in the dedicated workspace. The Reports page itself has 7, 30, 90, 365 days, and all time, so its shortcut range options differ from the dedicated export workspace.
- Users and Providers have no date/filter controls in the current workspace even though their generic schemas define them.

## 4. Detailed filter inventory

The live query-string allowlist is `LEGACY_EXPORT_QUERY_PARAMETERS` in `src/lib/export/legacy-contract.ts`; request parsing is in `src/lib/export/legacy-compatibility.ts`. Unknown and duplicate query parameters are rejected. Comma-separated values are parsed and deduplicated. The generic Zod filter schemas are broader than this allowlist and are not the live route contract.

### Leads: live workspace behavior

| Filter | Current behavior | Audit observation |
|---|---|---|
| Search | One text term; case-insensitive contains match across display name, company, email, phone, and stored lead number. | Useful but cannot target one field or distinguish exact lead number/ID lookup. Search follows the documented `%term%` pattern and is accepted at current scale. |
| Status, Priority, Category | Multi-select. Values within a group are ORed. | Server validates against enum values. |
| Lead Source | Multi-select of active source IDs loaded by both export pages. | The server can accept an ID, but the UI does not offer inactive sources; archived leads with an inactive source are harder to target. |
| Assigned salesperson | Admin workspace only; one salesperson or unassigned. | The generic schema can represent multiple IDs, but the live query parser rejects a comma-separated assignee. Sales cannot narrow or widen their owner scope. |
| Archived | Active only, archived only, or both in the dedicated workspace. | Workspace default is both. Contextual list export explicitly uses active-only unless archived is selected. |
| Activity Action, Response, Interest | Multi-select; each selected group is ANDed with the other groups; each group uses OR. | The selected predicates must match the same qualifying CALL/WHATSAPP entry on an event. |
| Activity Date | Any, Today, Yesterday, or Custom; date is `ActivityEvent.occurredAt`. Custom can have a start, end, or both. | This is “an activity in the range”, not specifically the lead’s latest interaction. |
| Lead creation date | UTC date presets/custom range serialized to inclusive legacy `from`/`to`. | Dedicated workspace labels the field as Lead created. |

The contextual Leads shortcut maps supported table filters and blocks unsupported active filters. The current blocked-filter message says the endpoint supports “Status and Assigned Salesperson only”, although the mapper also passes source, priority, category, activity action/response/interest, archived, search, and date values. That message is more restrictive than the actual supported mapper.

### Other categories

- **Users:** no query filters accepted. The database query excludes soft-deleted users, but includes inactive users. `userExportFiltersSchema` and the query builder define role, privilege, active, banned, designation, search, and created/updated/last-login date filters; none are reachable through the live download route.
- **Providers / Lead Sources:** no query filters accepted; parser forces active sources. Generic filter schema and query builder define source type, active, search, and created/updated date, but the route/UI do not expose them.
- **Sync Runs:** connector ID and date bounds only. The date field is start time. Generic schema additionally defines status, connector type, error outcome, and completion date, but the live GET allowlist/parser does not expose them.
- **Reports:** date bounds only in the live route; both boundaries must be present or both absent. Generic schema defines source, owner, and status filters, but no live request parser/UI exposes them. Report activity totals retain their report service’s fixed activity windows rather than becoming a per-filter activity range.
- **Planned categories:** Activities, Follow-ups, Notes, and Connectors have generic filter schemas and field metadata only. They are not available downloads and should not be described as implemented capabilities.

## 5. Database fields and filter opportunities

The current Prisma schema already contains most requested Lead data (`Lead` in `prisma/schema.prisma`): string `id` and unique string `leadNumber`; display name, company, email, phone and alternate phone; city, district, state and country; status, priority, category, source and assigned user relations; created/updated/archive/delete timestamps; last-contacted and follow-up denormalized timestamps; and relations to ActivityEvents, Notes, and FollowUps.

| Requested Lead filter | Available data | Current live status and implementation notes |
|---|---|---|
| Lead number / ID | `Lead.leadNumber` is a unique string (currently CUID-style); `Lead.id` is a separate CUID. | Search can match lead number but there is no exact-ID filter. Numeric Lead Number is not available from the current schema and should not be fabricated by extracting digits. Exact ID/number filters require no migration. |
| Name and company | `displayName`, `company` | Included in shared search. Dedicated per-field filters are not present. |
| Email and phone | `email`, `phone`, `alternatePhone` | Email/primary phone are in search. Alternate phone is not. Field-scoped search or including alternate phone is straightforward. |
| City and District independently | `city`, `district` | City is in the latent generic schema/query builder but not exposed by the live route. District is absent from both export filter schema and field allowlist. No migration needed. |
| State | `state` | Also in generic schema/query builder but not in live UI/legacy route. No migration needed. |
| Status, Priority, Category | Enum fields | Live multi-selects. |
| Lead Source | `LeadSource` relation | Live multi-select; UI supplies active sources only. Decide whether inactive sources should be selectable. |
| Assigned salesperson | `assignedUserId` relation | Admin-only, one value/unassigned in UI. Sales server scope is independent and mandatory. |
| Created / Updated date | `createdAt`, `updatedAt` | Created date is live. `updatedAt` exists but Lead filter date-field schema does not include it. The Lead model has an assigned/deleted/updated index useful to scoped patterns, but Admin query plans still need measurement. No schema change is inherently required. |
| Last interaction date | `lastContactedAt` and `ActivityEvent.occurredAt` | `lastContactedAt` is available and appears in generic date field definitions, but the legacy parser fixes date meaning to creation date. Activity Date filters any matching event by `occurredAt`; it is not equivalent to last interaction. |
| Follow-up status / due date | `FollowUp.status`, `dueDate`, `assignedUserId`; `Lead.nextFollowUpAt` and `lastFollowUpAt` | `nextFollowUpAt` is available as a generic date-field option and optional column, but no live filter selects it. Status/has-pending filters can use a relation `some` predicate or the maintained denormalized next date; choose semantics carefully for multiple/cancelled/completed follow-ups. Follow-up indexes already include lead, due date, and status. |
| Has pending / no pending follow-up | FollowUp relation and maintained `nextFollowUpAt` | Not a live filter. Define pending/cancelled semantics explicitly and use the transactionally maintained denormalized fields only where they answer the same question. No migration likely needed. |
| Archived / non-archived | `isArchived` | Live. Deleted records are always excluded and are not an export option. |

### Combination and query-cost notes

The export filter contract is AND between filter groups, OR within multi-select groups, OR across fields within search, and AND between search/date/authorization and the other groups. This is a sensible default. Exclusion controls are absent; start with inclusion filters and add negation only for a demonstrated workflow because null handling and “exclude these selected values” semantics need clear UX.

The export builder uses case-insensitive contains search on five Lead fields. Existing indexes include Lead `isDeleted+createdAt`, `assignedUserId+isDeleted+updatedAt`, status/archive/deleted, and follow-up date fields; ActivityEvent has lead/date indexes and ActivityEntry has event/type indexes. City, district, state, and broad contains search do not have matching trigram indexes. The project guidance considers contains search acceptable below roughly 15k leads. Do not add indexes based only on this audit; capture representative `EXPLAIN (ANALYZE, BUFFERS)` plans after filters are chosen and data volume is known.

## 6. Column customization opportunities

### What users receive today

Columns are fixed for the four row categories, and Reports has fixed sections. The UI only displays the current headers; users cannot select, reorder, rename, or save them. Fixed live output is:

- **Leads (15):** Lead Number, Name, Company, Email, Phone, Status, Priority, City, State, Country, Product, Requirement, Created At, Assigned To, Source.
- **Users (8):** Name, Email, Role, Active, Employee Code, Designation, Phone, Created At.
- **Providers (5):** Name, Slug, Type, Active, Created At.
- **Sync Runs (11):** Run ID, Connector, Type, Status, Started At, Completed At, Records Seen, Created, Updated, Skipped, Error (blank in every row).
- **Reports:** named sections and blank spacer rows rather than a fixed rectangular column set.

### Existing pieces and inconsistencies

`src/lib/export/fields.ts` already contains a central allowlist, typed sensitivity, optional fields, and projections exist in `src/services/export/projections.ts`. The query service accepts a `columns` argument and resolves a projection. This is useful groundwork, but `ExportService` always passes `LEGACY_EXPORT_COLUMNS`; the workspace has no column state; and the live GET contract does not parse `columns`.

The generic `exportDownloadRequestSchema` can validate a column list, but is not consumed by a production route. `resolveExportColumns()` rejects non-selectable/unknown fields, removes duplicate IDs, then sorts by registry order, so it does not preserve user-requested order. `EXPORT_CATEGORIES.columnSelection` is metadata, not proof that the live UI supports customization.

The current default metadata does not exactly describe current files:

- `product` is `defaultSelected: false`, while legacy Leads output includes Product.
- `salesPrivilege` is `defaultSelected: true`, while legacy Users output omits it; conversely, Phone is in the live Users file but marked default-unselected.
- Registry/projection metadata has `errorDiagnostic` optional and not in the legacy columns, while the actual Sync Runs serializer emits an Error header with an always-empty cell. The summary header chips are derived from the legacy column list and omit that Error header.

Resolve these mismatches before using metadata to render a customizable UI or output projection. Do not expose all `selectable` fields without a role/sensitivity review: the Lead allowlist labels Requirement, Budget, Expected Value, and Lost Reason sensitive, and planned Notes contain sensitive text fields. A field’s sensitivity label is currently descriptive, not a separate permission decision.

Reasonable first defaults are current legacy columns for compatibility, with common optional Lead fields available as opt-ins. Optional possibilities already represented in the Lead field catalog include Alternate Phone; first/last contact dates; next/last follow-up dates; closed/converted dates; Archived; Industry, Website, Job Title, Address; Product; Budget, Expected Value, Currency; Lost Reason; Campaign and UTM fields. District is present in Prisma but absent from this catalog. User options include Sales Privilege, Banned, Last Login, and Updated At. Each should be reviewed for audience and sensitivity before being selectable.

Custom presets are useful after users can choose and order columns. An initial browser-local preset avoids a migration but is device/browser-specific. Cross-device/shared presets require an ownership model and likely a persisted configuration model; any shared preset must re-check current actor permissions at execution and must not store or widen a frozen record scope.

## 7. CSV versus XLSX

CSV currently fits flat exports: it streams with low memory, opens in Excel/Google Sheets, preserves a simple data contract, and has formula-prefix neutralization. The serializer quotes commas, quotes, and newlines, emits UTF-8 with LF records, represents null as an empty cell, serializes dates as ISO UTC, and keeps decimals as base-10 strings. Booleans are not perfectly uniform: Users/Providers use Yes/No while current contract metadata says true/false.

CSV cannot provide multiple worksheets, widths, styled headers, frozen panes, or worksheet filters. The current Reports CSV uses multiple labeled sections, blank lines, and uneven columns, which is the strongest case for a true workbook. Adding `.xlsx` for ordinary flat tables is not necessary just to support filter, column selection, or order; those work well in CSV.

**Recommendation:** keep CSV as the initial format. If user research confirms a need for polished Reports workbooks or multi-table deliverables, evaluate XLSX as a later format with a streaming writer, explicit sheet names, stable widths/date/number formats, frozen headers, worksheet filters, and a size/memory benchmark. No spreadsheet package is currently listed in `package.json`. XLSX does not require a schema migration; it does add an output implementation, tests, and resource/compatibility work. Keep formula injection defenses for text cells and test Excel/Google Sheets behavior.

## 8. UX assessment and proposed workflow

The dedicated workspace is safer than the contextual shortcuts because it states the category and explains AND/OR semantics, but the user still has to infer the final result size and exact file structure. The summary reports selected filters and fixed headers but not a count or sample. It hides the actual search term, which is privacy-conscious but can make confirmation harder. Filter controls are uneven by category: Lead receives most attention while Users, Providers, and Sync Runs expose only a subset of data-layer capabilities.

Suggested workflow:

1. Choose the data category and show its record grain (one row per Lead, Sync Run, etc.) and row-scope statement.
2. Organize relevant filters into searchable groups; show selected values, AND/OR semantics, clear-group actions, and UTC/local date explanation.
3. Show a server-calculated match count and a small permission-filtered preview before download. State when an export will hit the row/byte/time ceiling.
4. Let the user choose and reorder allowlisted columns, with category-specific defaults and sensitivity-aware optional fields. Show the ordered header preview.
5. Download in the current tab or a reliably named file and report request/transfer/error state honestly. Do not claim transfer success when only a new tab was opened.
6. Offer saved configurations only after filters and columns have stable, permission-checked contracts.

Selected-row export can be added as an explicit scope mode (“selected rows” vs “all matching”). For selected rows, accept a bounded set of IDs and always AND those IDs with the server-owned Sales scope; never let a client ID set replace authorization. For large result sets, keep “all matching” as a server query rather than sending all IDs from the browser.

## 9. Backend lifecycle and performance/reliability

### Live lifecycle

`ExportWorkspace` / `ExportButton` → `buildExportQuery()` or contextual filter mapper → `window.open(GET /api/export?... )` → `withApiAuthorization()` → strict legacy parameter checks and parsers → `ExportService` → `ExportQueryService` authorization/filter/scope/projection → Prisma count and keyset pages or report aggregates → serializer → byte-counted `ReadableStream` → attachment response and best-effort operation log.

The live API rejects unknown and duplicate query keys, malformed enum/date values, one-sided report date ranges, and unauthorized categories/assignee filters. API responses include generic pre-stream errors. The response uses `Content-Disposition: attachment`, `${type}-${UTC-date}.csv`, `text/csv; charset=utf-8`, private/no-store cache headers, and `nosniff`.

### Safeguards

| Safeguard | Current value / behavior |
|---|---|
| Maximum output rows | 50,000. Row queries do an exact filtered count and reject before streaming when it exceeds the limit. Reports compute their aggregate output rows and reject when over the limit. |
| Maximum serialized body | 25,000,000 UTF-8 bytes. Enforced as records are encoded; an over-limit stream is errored after it has started. |
| Application deadline | 30 seconds from request start, including query setup and streaming. |
| PostgreSQL statement timeout | 15 seconds per export statement. |
| Interactive transaction | 16-second timeout, 2-second max wait. Count and each data page use separate transactions; Reports run their aggregate queries in one interactive transaction. |
| Pagination | Keyset, batch size 250. Leads use `createdAt,id` descending; Sync Runs use `startedAt,id` descending; Users and Providers use ID ascending. |
| Memory | Row categories produce an async record generator, fetch one keyset page at a time, and use a `ReadableStream` with zero high-water mark. The browser-native download avoids a client-side full-file buffer. Reports materialize their aggregate result arrays before emitting rows. |
| Cancellation | Stream cancellation aborts the deadline signal, ends iteration between operations, closes the iterator, and logs cancellation. In-flight Prisma work is not directly cancelled by the signal; SQL/transaction timeouts provide separate bounds. |
| Concurrent exports | No global queue, concurrency ceiling, or rate limiter was found. UI guards only prevent a duplicate click per mounted button and reset after 1.2 seconds; that is not a server-side concurrency limit. |

### Consistency and correctness risks

There is no point-in-time database snapshot across the exact count and subsequent pages: every page uses a new transaction/read. Unique cursor tie-breakers prevent offset shifting and ordinary duplicate traversal, but records inserted/deleted or changed during the export can change membership or values. This is acceptable only if the product communicates “current matching records” rather than a transactional snapshot.

The row and byte caps protect ordinary CSVs, but a file can pass the row count then fail at 25 MB mid-stream. A timeout, database error, serialization error, or late limit error also terminates an already-started stream; the user may receive a partial download and the opener UI cannot display the later server error. No preflight byte estimate or background-job/resume mechanism exists.

Search uses case-insensitive contains predicates across five Lead fields. Existing indexes do not make arbitrary substring matching cheap; current project guidance considers this acceptable below about 15k Leads. Relation filters use `some` over ActivityEvent/ActivityEntry, which avoids row duplication from joins, but activity combinations can cost more than scalar enum predicates. No production-scale `EXPLAIN`, peak-memory, cancellation, or concurrent-export measurement was run as part of this read-only audit.

## 10. Security and permissions

- Admin export pages require an Admin session. Admin policy allows all five implemented categories and all non-deleted Leads, Users, Providers, Sync Runs, and Reports as applicable.
- Sales export pages require a Sales session and `EXPORT_LEADS`; the current permissions map grants that permission to Senior Sales only. The category policy repeats this check in the service. Junior Sales is denied.
- Sales Lead scope is server-owned: `assignedUserId = authenticated actor ID AND isDeleted = false`. Client assignee filters are rejected for Sales; the mandatory scope is still ANDed with all other predicates. A client-supplied ID cannot widen the scope.
- Deleted Leads and soft-deleted Users are excluded. Archived Leads are not deleted; the dedicated Lead workspace can include them. Do not conflate the two states.
- Current Lead export includes name, email, phone, requirement, and other business details. User export includes email and phone. These are personal data, but access is bounded by Admin/Senior Sales policy and Lead owner scope. The current output does not select raw Lead payload/custom JSON, auth credentials, sessions, or raw connector configuration.
- CSV escaping neutralizes spreadsheet formula candidates in text values. Keep this protection when adding fields/formats, especially user-controlled campaign, requirement, note, and diagnostic text.
- Export operation events log actor ID/role, category, duration, outcome, emitted row/byte counts, a safe reason code, and filter-group names, but not filter values or row contents. Logging uses the application logger and is best-effort; it is not a durable database audit trail. If durable compliance history is required, scope and retention need a separate design.
- Saved export configurations must be inert preferences, not authorization grants. Always reauthorize the actual request and apply current row scope. If a configuration can be shared, enforce owner/admin semantics and revalidate fields and filters when it is used.

No current row-level bypass or direct exposure of a restricted field was verified. The broader generic field metadata must not be treated as permission enforcement if column selection is implemented.

## 11. Prioritized recommendations

No active P0 security or correctness defect was verified in the live download path. The P0 gate below applies before introducing configurable columns.

| Priority / recommendation | User benefit | Technical impact | Schema / migration |
|---|---|---|---|
| **P0 gate — before column customization, make sensitivity/role policy executable.** Restrict selectable fields by category and actor; review Requirement, financial fields, Lost Reason, User Last Login, and planned note text; keep raw payload/auth/config fields excluded. | Prevents a “choose columns” feature from unexpectedly broadening access. | Add role-aware allowlists and server-side enforcement before projections; tests must prove ADMIN and Senior Sales cannot use client columns to escape their existing scope. Reconcile the descriptive `sensitivity` metadata with the actual policy. | No migration. |
| **P1 — unify the live export contract and metadata.** Decide whether to migrate the current GET adapter to the generic request schemas or make the legacy contract authoritative; remove/update unused claims. Reconcile Product, Sales Privilege, Phone, and blank Sync Error metadata/header mismatches. | Users see the same columns/filters in the summary and downloaded file; fewer surprises and failed requests. | Connect one validated request contract to UI, route, service, projection, serializer, and tests. Preserve a compatibility adapter for existing shortcut URLs while migrating. | No migration. |
| **P1 — add a server count and permission-filtered preview before download.** Use a bounded preview (for example, 20 rows) and exact/estimated total with limit warnings. | Helps confirm filters and avoid empty or unexpectedly large files. | Add explicit count/preview endpoints or a typed export preparation request. Reuse the same validator, row scope, and predicate builder as download; cap preview rows and query time. Current preview/count schemas are not routes. | No migration. |
| **P1 — add the highest-value Lead filters:** exact Lead Number/ID; City, District, State separately; Updated date; Last Contacted date; pending/no-pending and due-date range. Include alternate phone in optional search. | Makes exports materially more targeted without requiring database edits. | Wire schema, UI, URL/request validation, query predicates, and tests. Use `Lead.lastContactedAt` for last-contact semantics; define follow-up status/date semantics against `FollowUp.status/dueDate` and the maintained `nextFollowUpAt`. Keep `assignedUserId` and non-deleted scope server-owned. Measure relation/filter query plans before indexing. | No migration expected; all these fields/relations already exist. |
| **P1 — implement permission-aware column selection and ordering for row exports.** Start with Leads and Users; default to current fixed headers for compatibility. | Removes unwanted columns and enables useful, audience-specific files. | Reconcile field catalog and actual projections; pass selected ordered IDs through request, projection, and serializer. Change current registry-order sorting only after order semantics are tested. Add an explicit column preview. | No migration. |
| **P1 — make contextual shortcut limitations accurate and actionable.** Correct the Leads “Status and Assigned Salesperson only” message and identify which filters prevent export; keep blocking unsupported filters rather than silently dropping them. | Builds trust that the downloaded file matches the visible table. | Align messages/tests with `getContextualExportParams()` and the accepted legacy mapper. Consider a small confirmation summary for all matching rows vs selected rows. | No migration. |
| **P2 — expose missing filters in Users, Providers, Sync Runs, and Reports selectively.** Candidate first additions: user active/role/designation, provider active/type/search, sync status/error/completed date, and report source/owner/status. | Gives admins more useful exports without adding categories immediately. | Promote existing schemas/query builders only where route/UI/service implementations are complete; strict parameter allowlists must change together. Consider inactive sources/users in lookup data where appropriate. | No migration anticipated. |
| **P2 — add an explicit “selected rows” mode alongside “all matching.”** | Supports small curated handoffs from table screens. | Add bounded ID lists and a clear scope label. Always combine selected IDs with authenticated Sales scope; selected mode must not replace filters/authorization. Keep bulk “all matching” query server-side. | No migration. |
| **P2 — improve download feedback and reliability.** Avoid claiming the transfer started/succeeded based only on `window.open`; show preflight errors inline and make late stream failure/partial files understandable. Consider generating the download in the same tab or returning a tracked job only if the UI requires actual progress. | Reduces confusion when the browser blocks a popup, export times out, or the stream fails. | Native navigation cannot report transfer progress. A reliable progress/job flow implies job state, polling, and download lifecycle design; a lighter same-tab download can improve errors but still may not expose completion. Add global concurrency/rate controls only if measured need warrants them. | No migration for same-tab/error copy. Durable jobs/history require schema/storage design. |
| **P3 — persist reusable export presets after filters and columns stabilize.** | Avoids repeating common exports. | Begin with browser-local presets; if cross-device sharing is required, add owner and share permissions, versioned config validation, and request-time authorization. | Local storage: none. Server-saved/shared presets: likely a new model and migration. |
| **P3 — evaluate XLSX for Reports or multi-table cases, not as a prerequisite for flat exports.** | Enables multiple sheets, widths, formats, frozen headers, and sheet filters when those features matter. | Add workbook generation, streaming/large-output benchmark, format/compatibility tests, and formula-safety tests. Keep CSV available. | No migration. |

## 12. Proposed implementation phases and dependencies

1. **Contract and safety baseline:** choose the canonical request contract, reconcile column metadata/output, define per-role field allowlists, and document row-grain/AND-OR semantics. Dependency for all subsequent work; no schema change.
2. **Lead filter completion:** add exact IDs, separate location fields, updated/last-contact date choices, and pending-follow-up filters to the live contract and UI. Use existing Prisma fields; measure plans before any index proposal.
3. **Preview and count:** build count/preview on shared validated predicates and server scope. This supports informed downloads before adding more advanced options.
4. **Columns and order:** expose safe field choices and drag/keyboard reorder for row exports, preserve current headers as defaults, and ensure serializer output exactly follows requested order. Requires phase 1 safety baseline.
5. **Other categories and contextual row selection:** add Admin category filters and optionally selected-row mode, preserving strict parameter validation and actor scope.
6. **Presets and output formats:** add local presets first if useful; consider persisted presets or XLSX only after user demand, permission model, and memory measurements are clear.

## 13. Files and components inspected

### Active implementation

- `src/app/(dashboard)/admin/exports/page.tsx`
- `src/app/(dashboard)/sales/exports/page.tsx`
- `src/app/(dashboard)/sales/my-leads/page.tsx`
- `src/app/(dashboard)/sales/layout.tsx`
- `src/app/api/export/route.ts`
- `src/components/export/export-workspace.tsx`
- `src/components/shared/export-button.tsx`
- `src/components/sales/sales-table-controls.tsx`
- `src/components/users/user-table-controls.tsx`
- `src/components/providers/providers-page-content.tsx`
- `src/components/connectors/connectors-page-content.tsx`
- `src/components/connectors/sync-history-modal.tsx`
- `src/components/admin/admin-reports.tsx`
- `src/lib/export/registry.ts`, `fields.ts`, `filters.ts`, `dates.ts`, `policy.ts`, `legacy-contract.ts`, `legacy-compatibility.ts`, `output.ts`, `ui.ts`
- `src/services/export.service.ts`
- `src/services/export/authorization.ts`, `scope.ts`, `query-builders.ts`, `query.service.ts`, `projections.ts`, `keyset.ts`, `limits.ts`, `deadline.ts`, `csv-stream.ts`, `csv-serialization.ts`, `operation-log.ts`
- `src/lib/csv.ts`, `src/lib/permissions.ts`, `src/lib/export/index.ts`
- `prisma/schema.prisma`
- `package.json`

### Historical context and test contracts

- Historical export implementation reports were consulted as context; the live claims above were checked against source. Current endpoint behavior is documented in [the API guide](../api.md), and current UI behavior in [the Frontend guide](../frontend.md).
- `tests/export-contracts.test.ts`, `tests/export-query.test.ts`, `tests/export-delivery.test.ts`, `tests/export-ui.test.ts`, plus export-related checks in `tests/phase1-hardening.test.ts` and `tests/lead-workflow-form.test.ts`.

## Verification and limits of this audit

- Read-only source inspection and `git status` were used; no test/build command, database query, schema validation, or browser interaction was run for this audit.
- Existing export tests were inspected as contract evidence, not treated as proof of real PostgreSQL plans or browser download behavior.
- No database updates, schema changes, migrations, or application-code changes were made.
- The only requested deliverables are this report and its entry in `docs/README.md`.
