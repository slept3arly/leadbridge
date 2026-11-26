# Export System End-to-End Audit

> **Status:** Read-only audit; findings and recommendations are not approved requirements.
> **Date:** 2026-11-26
> **Scope:** LeadBridge export system end to end: UI entry points, `GET /api/export`, export services, Prisma queries, CSV serialization, streamed delivery, browser download behavior, tests, and documentation.
> **Verification:** Source inspection plus the existing export test suite. `node --import tsx --test tests/export-contracts.test.ts tests/export-query.test.ts tests/export-delivery.test.ts tests/export-ui.test.ts` reported **39 passing tests**. `pnpm typecheck` was intentionally not run because `tsconfig.json` uses incremental output and would write `tsconfig.tsbuildinfo`.
> **Working tree at audit time:** `M package.json`, `M pnpm-lock.yaml` were pre-existing; no files were modified by the audit.

---

## 1. Executive Summary

The export system has a sound core architecture: one authenticated route, server-owned authorization and lead scope, explicit filter allowlists, deterministic keyset paging, streamed CSV delivery, row/byte/time limits, and redacted best-effort operation logging. It is materially safer than a typical ad-hoc CSV endpoint.

The main problems are **contract drift and UI/API parity**, not a broken pipeline:

1. **Confirmed bug — date-only legacy `to` bounds cover only 1 ms of the selected day.** `legacyBounds` adds one millisecond to midnight instead of advancing to the next UTC day (`src/lib/export/legacy-compatibility.ts:15-23`). The same pattern exists for Reports (`:98-107`). The dedicated workspace avoids it by sending full timestamps, but direct API callers and the contextual Leads shortcut can hit it.
2. **Confirmed bug — the Sync Run `Error` column is always blank.** The header exists, the serializer emits `""`, and the projection never selects `errorMessage` (`src/services/export/csv-serialization.ts:8,70-85`; `src/services/export/projections.ts:93-112`). The UI column chips also omit it because `LEGACY_EXPORT_COLUMNS` omits it (`src/lib/export/legacy-contract.ts:23`).
3. **Confirmed contract drift — field metadata does not match the live CSV.** `product` is `defaultSelected: false` but is exported; `category` and `salesPrivilege` default to selected but are not exported; `phone` defaults to unselected for Users but is exported; booleans are documented as `true/false` but serialized as `Yes/No` (`src/lib/export/fields.ts:47,63,122,127`; `src/services/export/csv-serialization.ts:57,67`; `src/lib/export/output.ts:147`).
4. **Confirmed parity bug — contextual Leads export can apply the page's lead-created date range to activity occurrence as well.** When activity action/response/interest filters are present and a page date range exists, `getContextualExportParams` adds `activityDate=custom` plus `activityFrom`/`activityTo` from the lead-created date fields (`src/lib/export/ui.ts:250-260`). The Leads table does not do that, so the shortcut export is narrower than the visible list.
5. **Confirmed data-fidelity weakness — CSV formula neutralization mutates legitimate values.** Any string starting with `+`, `-`, `=`, `@`, tab, or CR gets a leading apostrophe (`src/lib/csv.ts:1-11`). A phone such as `+1 (555) 123-4567` becomes `'+1 (555) 123-4567`. The existing test explicitly enshrines this behavior (`tests/export-delivery.test.ts:56-58`).
6. **No durable export audit trail.** Operation logging is best-effort Pino only (`src/services/export/operation-log.ts:4-15`), with filter-group names but not values, and no database record. For a CRM exporting personal data, this is a compliance and investigation gap.
7. **No server-side rate limiting or concurrency control.** The client guard re-enables after 1.2 seconds regardless of transfer completion (`src/components/export/export-workspace.tsx:143-146`; `src/components/shared/export-button.tsx:51-54`). Multiple 50,000-row, 30-second exports can be launched concurrently by one authenticated user.
8. **No count/preview.** The generic preview/count schemas exist but are unused (`src/lib/export/output.ts:58-101`), and `countReports` is unused (`src/services/export/query.service.ts:150-154`). Users cannot see how many rows they are about to download.

**Recommended first phase:** fix correctness and contract reconciliation first (date bounds, Sync `Error`, metadata/live columns, contextual parity, formula policy), then add a preflight count/preview. Do not start with new export categories or cosmetic UI work.

---

## 2. Export Architecture Map

### 2.1 Request path

```text
Browser UI
  ├─ /admin/exports  → ExportWorkspace
  ├─ /sales/exports  → ExportWorkspace
  ├─ Contextual ExportButton
  │    ├─ Admin Leads / My Leads
  │    ├─ Admin Users
  │    ├─ Admin Providers
  │    ├─ Admin Reports
  │    ├─ Admin Connectors (all sync history)
  │    └─ Sync History modal (one connector)
  │
  └─ URL built by src/lib/export/ui.ts
        ↓
GET /api/export?type=...
        ↓
src/app/api/export/route.ts
  ├─ withApiAuthorization(["ADMIN","SALES"])
  ├─ isExportCategoryId(type)
  ├─ LEGACY_EXPORT_QUERY_PARAMETERS allowlist
  ├─ reject unknown/duplicate params
  ├─ parseLegacy*Export(...)
  ├─ exportService.open*(...)
  └─ createCsvByteStream(...)
        ↓
ExportService
  ├─ ExportQueryService (count + keyset pages)
  ├─ ReportService (reports aggregates)
  ├─ projections / query-builders / scope
  ├─ csv-serialization
  └─ deadline / limits / operation-log
        ↓
Prisma → PostgreSQL
        ↓
ReadableStream<Uint8Array> → text/csv response
```

### 2.2 Layer responsibilities

| Layer | Files | Responsibility |
|---|---|---|
| Route | `src/app/api/export/route.ts` | Auth, category dispatch, parameter allowlist, duplicate/unknown rejection, response headers, failure logging |
| Compatibility parsers | `src/lib/export/legacy-compatibility.ts` | Convert legacy query strings into typed filter objects and date bounds |
| Live contract | `src/lib/export/legacy-contract.ts` | Accepted query keys and fixed legacy CSV column IDs |
| Registry / metadata | `src/lib/export/registry.ts`, `fields.ts`, `filters.ts`, `policy.ts`, `output.ts` | Category availability, fields, filter schemas, authorization, limits, response/error contracts |
| Export service | `src/services/export.service.ts` | Produce CSV records for the five live categories; assemble Reports CSV |
| Query service | `src/services/export/query.service.ts` | Authorization, validation, count, keyset paging, projection |
| Query builders | `src/services/export/query-builders.ts` | Prisma `where`, cursor, and order-by construction; date/activity semantics |
| Scope / policy | `src/services/export/scope.ts`, `authorization.ts`, `src/lib/export/policy.ts` | Server-owned lead visibility and category permissions |
| Serialization | `src/services/export/csv-serialization.ts`, `src/lib/csv.ts` | Headers, row values, escaping, formula handling |
| Delivery | `src/services/export/csv-stream.ts`, `deadline.ts`, `limits.ts` | Streaming, cancellation, row/byte/time limits |
| Logging | `src/services/export/operation-log.ts` | Best-effort structured Pino event; not durable audit |
| UI | `src/components/export/export-workspace.tsx`, `src/components/shared/export-button.tsx`, `src/lib/export/ui.ts` | Filter UI, query construction, new-tab download, guard |

### 2.3 Trust boundaries

- The route is role-gated, then each category is re-authorized in `authorizeExportCategory` (`src/services/export/authorization.ts:6-13`).
- Sales lead scope is server-owned: `assignedUserId = actor.id AND isDeleted = false` (`src/services/export/scope.ts:5-9`). Client filters are ANDed with it; Sales cannot widen scope via `assignedUserId` (`src/services/export/authorization.ts:15-18`).
- Users, Providers, Sync Runs, Connectors, and Reports are Admin-only by policy (`src/lib/export/policy.ts:42-46`).
- `withApiAuthorization` checks session presence, active account, and role, but the route does not add CSRF/rate-limit controls (`src/lib/api.ts:13-29`).

---

## 3. Export Inventory

| Category | Status | Access | Live filters | CSV shape | UI surfaces | Key caveat |
|---|---|---|---|---|---|---|
| **Leads** | Implemented | Admin; Senior Sales with `EXPORT_LEADS` | status, source, priority, category, actions, responses, interests, activity date, archived, search, assigned user (Admin), lead-created `from`/`to` | 15 fixed columns: Lead Number, Name, Company, Email, Phone, Status, Priority, City, State, Country, Product, Requirement, Created At, Assigned To, Source | `/admin/exports`, `/sales/exports`, Admin Leads, My Leads | No column selection; metadata defaults differ from live output; date-only `to` bug; contextual activity/date parity bug |
| **Users** | Implemented | Admin only | None accepted | 8 columns: Name, Email, Role, Active, Employee Code, Designation, Phone, Created At | `/admin/exports`, Admin Users | No filters despite rich generic schema; includes inactive, excludes deleted; `salesPrivilege` not exported despite metadata default; booleans `Yes/No` |
| **Providers** | Implemented | Admin only | None accepted; parser forces `active: true` | 5 columns: Name, Slug, Type, Active, Created At | `/admin/exports`, Admin Providers | Inactive providers cannot be exported; no search/type/date filters; UI disables export when filters are active |
| **Sync History** | Implemented | Admin only | connector ID, `from`/`to` | 11 headers including `Error`; Error always blank | `/admin/exports`, Admin Connectors, Sync History modal | Error column blank; modal shows latest 100 runs but export covers all matching runs; no status/type/error filters live |
| **Reports** | Implemented | Admin only | paired `from`/`to` or none | Fixed aggregate sections: summary, statuses, sources, assignments, monthly trends, activity | `/admin/exports`, Admin Reports | Trends/activity parity gaps vs on-screen report; no source/owner/status filters live; output row count includes section rows |
| **Activities** | Planned | Policy says Admin/Senior Sales | Generic schema only | Not implemented | Not offered | `404` from route default branch |
| **Follow-ups** | Planned | Policy says Admin/Senior Sales | Generic schema only | Not implemented | Not offered | `404` |
| **Notes** | Planned | Policy says Admin/Senior Sales | Generic schema only | Not implemented | Not offered | `404` |
| **Connectors** | Planned | Admin only | Generic schema only | Not implemented | Not offered | `404` |
| **Audit Logs** | Does not exist | — | — | — | — | `AuditLog` model removed; `src/app/api/audit-logs/` is empty; activity system is `ActivityEvent`/`ActivityEntry`; export logs are Pino only |

Registry evidence: `src/lib/export/registry.ts:17-27` (all category IDs), `:84-202` (definitions and availability), `:208-210` (implemented check). Route dispatch: `src/app/api/export/route.ts:105-121`. Planned categories fall to the default branch and return 404 at `:117-120`.

---

## 4. Per-Export Findings

### 4.1 Leads

**L-1 — Confirmed bug: date-only `to` includes only 1 ms of the day.**  
`parseLegacyDate` parses `2026-03-01` as `2026-03-01T00:00:00.000Z`, and `legacyBounds` converts it to `toExclusive = to + 1 ms` (`src/lib/export/legacy-compatibility.ts:6-23`). A request `?from=2026-03-01&to=2026-03-01` therefore covers `[00:00:00.000, 00:00:00.001)`, not the full day. The dedicated workspace avoids this by serializing `to` as the last millisecond of the resolved day (`src/lib/export/ui.ts:90-94`), but direct API callers and date-only contextual values are affected.

**L-2 — Confirmed parity bug: contextual export applies lead-created dates to activity.**  
`getContextualExportParams` maps page `dateFrom`/`dateTo` to export `from`/`to` when no activity date is selected (`src/lib/export/ui.ts:250-252`). Then, if any activity action/response/interest filter is present, it also adds `activityDate=custom` and copies the same page dates into `activityFrom`/`activityTo` (`:253-260`). The Leads table treats `dateFrom`/`dateTo` as lead-created dates unless `filter.activityDate=custom`; it does not apply them to activity occurrence. Result: the shortcut export can omit leads that the table shows.

**L-3 — Confirmed bug/design ambiguity: Activity Date alone always requires a CALL/WHATSAPP entry.**  
`buildLeadExportWhere` adds the activity clause whenever `activityBounds` exists, and the nested `entries.some` always includes `type: { in: ["CALL", "WHATSAPP"] }` (`src/services/export/query-builders.ts:93-110`). The UI copy says the date matches `ActivityEvent.occurredAt`, while only selected action/response/interest values must match a CALL/WHATSAPP entry (`src/components/export/export-workspace.tsx:228`). Selecting only an activity date therefore excludes leads whose events are notes, follow-ups, or system events. Either the predicate or the copy should change.

**L-4 — Confirmed data mutation: formula neutralization alters phone/name text.**  
`escapeCsv` prefixes `'` for any string starting with `=`, `+`, `-`, `@`, tab, or CR (`src/lib/csv.ts:5`). This protects spreadsheets but changes legitimate values such as `+1 (555) 123-4567` and names beginning with `-`. The test suite asserts this behavior (`tests/export-delivery.test.ts:56-58`), so it is intentional but not data-faithful. It should be field-aware or documented as a lossy transformation.

**L-5 — Confirmed contract drift: `product` and `category` metadata disagree with live output.**  
`product` is `defaultSelected: false` (`src/lib/export/fields.ts:63`) but is included in `LEGACY_EXPORT_COLUMNS.leads` (`src/lib/export/legacy-contract.ts:20`) and emitted (`src/services/export/csv-serialization.ts:42`). `category` is `defaultSelected: true` (`src/lib/export/fields.ts:47`) but is absent from the legacy columns and is not emitted. The export workspace's column chips derive from the legacy list (`src/lib/export/ui.ts:65-71`), so they show `Product` but not `Category`, matching the CSV but not the metadata.

**L-6 — Confirmed bug: contextual export inherits the Leads table's end-of-day truncation.**  
The table's date handler stores `dateTo` as `23:59:59.000Z` (`src/components/sales/sales-table-controls.tsx:123-127`). The contextual export forwards that timestamp (`src/lib/export/ui.ts:251-252`), and the legacy parser adds only 1 ms (`src/lib/export/legacy-compatibility.ts:22`). The last 999 ms of the selected day are excluded. The dedicated workspace sends `23:59:59.999Z`, so the two export paths disagree for the same selected date.

**L-7 — Design weakness: no column selection, despite registry metadata.**  
`EXPORT_CATEGORIES.leads.columnSelection` is `true` (`src/lib/export/registry.ts:95`), and the generic request schema supports columns (`src/lib/export/output.ts:13-54`), but the live route accepts no `columns` parameter (`src/lib/export/legacy-contract.ts:3-7`) and always requests `LEGACY_EXPORT_COLUMNS.leads` (`src/services/export.service.ts:41-42`). The workspace explicitly says custom columns are not accepted (`src/components/export/export-workspace.tsx:328`). The metadata is therefore misleading.

**L-8 — Potential performance risk: complex activity filters and search are count-then-page.**  
The count query and each page use the same `where`, including nested `activityEvents.some` / `entries.some` and `ILIKE '%term%'` search (`src/services/export/query.service.ts:73-83`; `src/services/export/query-builders.ts:93-112`). Existing indexes cover `Lead(isDeleted, createdAt)`, `Lead(assignedUserId, status, isDeleted)`, `ActivityEvent(leadId, occurredAt)`, and `ActivityEntry(eventId)` (`prisma/schema.prisma:351-361,376-377,395-397`), but search has no trigram index. Acceptable at current scale; measure before changing.

**L-9 — Design weakness: Sales scope cannot be narrowed by owner, but that is correctly enforced.**  
`authorizeLeadExportFilters` rejects assigned-user filters for Sales (`src/services/export/authorization.ts:15-18`), and `buildExportLeadScope` always ANDs the actor scope (`src/services/export/scope.ts:5-9`). This is correct security behavior; the only UX gap is that the workspace hides the assignee control for Sales rather than explaining the fixed scope.

### 4.2 Users

**U-1 — Confirmed contract drift: `salesPrivilege` and `phone` metadata disagree with live output.**  
`salesPrivilege` is `defaultSelected: true` (`src/lib/export/fields.ts:122`) but is not in `LEGACY_EXPORT_COLUMNS.users` (`src/lib/export/legacy-contract.ts:21`) and is not emitted. `phone` is `defaultSelected: false` (`src/lib/export/fields.ts:127`) but is in the legacy columns and is emitted (`src/services/export/csv-serialization.ts:57`).

**U-2 — Confirmed bug: boolean representation contradicts the documented contract.**  
`EXPORT_CSV_REPRESENTATION.booleans` says `true or false` (`src/lib/export/output.ts:147`), and field metadata says `true/false` (`src/lib/export/fields.ts:123,128`), but the serializer emits `Yes`/`No` (`src/services/export/csv-serialization.ts:57`). Providers do the same (`:67`). Pick one representation and update metadata, docs, and tests.

**U-3 — Design weakness: no live filters despite a full generic schema.**  
`userExportFiltersSchema` supports date range/field, roles, sales privileges, active, banned, designations, and search (`src/lib/export/filters.ts:140-149`), and the query builder implements them (`src/services/export/query-builders.ts:126-137`), but the live contract accepts only `type` (`src/lib/export/legacy-contract.ts:8`) and the parser passes `{}` (`src/lib/export/legacy-compatibility.ts:81-83`). The Admin Users shortcut is disabled whenever search/date/filter state is active (`src/components/users/user-table-controls.tsx:44,148`), and the workspace explains that no filters are accepted (`src/components/export/export-workspace.tsx:281-283`).

**U-4 — Design weakness: inactive and banned users are included without a visible choice.**  
`buildUserExportWhere` only enforces `isDeleted: false` (`src/services/export/query-builders.ts:126-137`), so inactive and banned accounts are exported by default. That may be correct for an admin directory, but the UI does not state it beyond the workspace note.

### 4.3 Providers

**P-1 — Confirmed design limitation: inactive providers can never be exported.**  
`parseLegacyProviderExport` hard-codes `active: true` (`src/lib/export/legacy-compatibility.ts:85-88`). The live contract accepts no `active` parameter (`src/lib/export/legacy-contract.ts:9`). The Providers page labels the action "Export active providers" and disables it when search/type/inactive filters are active (`src/components/providers/providers-page-content.tsx:202-209`). This is honest, but it is a capability gap.

**P-2 — Confirmed contract drift: provider boolean representation.**  
`Active` is emitted as `Yes`/`No` (`src/services/export/csv-serialization.ts:67`) while metadata says `true/false` (`src/lib/export/fields.ts:136`). Same root cause as U-2.

**P-3 — Design weakness: generic provider filters are unreachable.**  
`providerExportFiltersSchema` supports source types, active, search, and date range/field (`src/lib/export/filters.ts:153-159`), and the query builder implements them (`src/services/export/query-builders.ts:148-156`), but the live route exposes none of them.

**P-4 — Potential performance risk: no live date filter, so no index concern yet.**  
Provider export currently scans all active sources. `LeadSource` has `@@index([active, priority])` (`prisma/schema.prisma:279`), which helps the active filter. If date filters are added later, `LeadSource.createdAt` has no standalone index; measure before adding one.

### 4.4 Sync Runs / Sync History

**S-1 — Confirmed bug: `Error` is a permanent blank column.**  
`EXPORT_CSV_HEADERS["sync-history"]` includes `"Error"` (`src/services/export/csv-serialization.ts:8`), `serializeSyncRunCsvRow` always emits `""` for it (`:70-85`), and `resolveSyncHistoryProjection` never selects `errorMessage` (`src/services/export/projections.ts:93-112`). `LEGACY_EXPORT_COLUMNS["sync-history"]` omits the field entirely (`src/lib/export/legacy-contract.ts:23`), so the workspace chips show 10 columns while the CSV has 11. The schema stores `errorMessage` (`prisma/schema.prisma:533`), so this is a deliberate omission without a working alternative.

**S-2 — Confirmed parity gap: modal shows 100 runs, export covers all matching runs.**  
`connectorService.listSyncRuns` uses `take: 100` (`src/services/connector.service.ts:51-52`). The modal loads that list (`src/components/connectors/sync-history-modal.tsx:54`) and offers "Export this connector" (`:71`). The export query has no 100-row cap; it counts and pages all matching runs (`src/services/export/query.service.ts:126-143`). A user can therefore export rows they never saw.

**S-3 — Confirmed UX gap: `errorMessage` is selected by the modal API but not rendered.**  
The modal's `SyncRun` type includes `errorMessage` (`src/components/connectors/sync-history-modal.tsx:21`), and `listSyncRuns` includes it by default (`src/services/connector.service.ts:52`), but the table renders only status and counters (`src/components/connectors/sync-history-modal.tsx:95-136`). The error is invisible in both the modal and the CSV.

**S-4 — Design weakness: live filters are much narrower than the generic schema.**  
The live contract accepts only connector ID and date bounds (`src/lib/export/legacy-contract.ts:10`; parser `src/lib/export/legacy-compatibility.ts:90-96`). `syncHistoryExportFiltersSchema` supports connector types, statuses, error outcome, and completion date (`src/lib/export/filters.ts:176-183`), and the query builder implements them (`src/services/export/query-builders.ts:167-177`). Those capabilities are unreachable.

**S-5 — Potential performance risk: date-only sync export may not use an ideal index.**  
`ConnectorSyncRun` has `@@index([connectorId, startedAt])` and `@@index([status, startedAt])` (`prisma/schema.prisma:536-537`), but no standalone `startedAt` index. A date-range export with no connector/status filter may scan more than necessary. At current scale this is likely fine; confirm with `EXPLAIN (ANALYZE, BUFFERS)` before adding an index.

### 4.5 Reports

**R-1 — Confirmed parity gap: on-screen trends are always last 6 months; CSV trends follow the selected range/all-time.**  
`reportService.monthlyTrends` adds a six-month condition only when `filters === undefined` (`src/services/report.service.ts:179-188`). `/api/reports?type=trends` calls it with no filters (`src/app/api/reports/route.ts:41-43`), so the UI always gets the last six months; the Admin Reports UI even labels it "Last 6 months, regardless of the report period" (`src/components/admin/admin-reports.tsx:316,424`). The CSV passes validated filters (`src/services/export.service.ts:101`), so trends are all-time when no date range is selected, or date-range-scoped when one is. The same "Reports" label can therefore mean different data in the UI and the CSV.

**R-2 — Confirmed parity gap: on-screen activity is global; CSV activity is scoped to filtered non-deleted leads.**  
`/api/reports?type=activity` calls `reportService.activity()` with no filters (`src/app/api/reports/route.ts:37-39`), so it counts all `ActivityEntry` rows in the fixed windows. The CSV calls `reportService.activity(validated, tx)` (`src/services/export.service.ts:102`), which applies `buildReportActivityLeadWhere` (`src/services/export/query-builders.ts:190-196`) — non-deleted leads plus source/owner/status filters. Different populations.

**R-3 — Confirmed design weakness: "This Month" is a rolling 30 days, not a calendar month.**  
`reportService.activity` uses `thirtyDaysAgo = now - 30 days` when filters are present, and `setDate(getDate() - 30)` when not (`src/services/report.service.ts:131-158`). The CSV path always passes filters, so it uses the rolling 30-day window. The label "This Month" is misleading. "This Week" is likewise a rolling 7 days, not a calendar week.

**R-4 — Confirmed contract mismatch: report output row count includes headers/section rows.**  
`openReports` computes `outputRows = 23 + statuses + sources + assignments + trends` (`src/services/export.service.ts:107`). The stream counts each `csv(...)` record as one data row by default (`src/services/export/csv-stream.ts:70-81`; `csv()` default `dataRows = 1` at `src/services/export.service.ts:28-34`). `EXPORT_LIMITS.maxRows` is described as "data rows" (`src/lib/export/output.ts:152-157`), but report counts include title, blank, and section header lines. Minor, but the limit semantics are inconsistent.

**R-5 — Design weakness: live report filters are only date bounds.**  
The live parser accepts only paired `from`/`to` (`src/lib/export/legacy-compatibility.ts:98-107`; `src/lib/export/legacy-contract.ts:11`). `reportExportFiltersSchema` supports source IDs, owner IDs, and statuses (`src/lib/export/filters.ts:187-193`), and the query builders implement them (`src/services/export/query-builders.ts:179-196`), but no live route/UI exposes them.

**R-6 — Potential reliability risk: report generation runs six aggregate queries in one 16-second transaction.**  
`openReports` runs `Promise.all` for summary, sources, assignments, status breakdown, trends, and activity inside one transaction with a 15-second statement timeout and 16-second transaction timeout (`src/services/export.service.ts:94-104`; `src/services/export/limits.ts:4-6`). If the transaction times out, the route's `errorResponse` does not map the Prisma timeout to a specific message and returns generic 500 (`src/app/api/export/route.ts:32-39`). At current data volume this is likely fine; it is a scaling risk.

### 4.6 Planned / Unavailable Categories

**X-1 — Confirmed: Activities, Follow-ups, Notes, and Connectors are metadata-only.**  
They are in the registry with `availability: "planned"` (`src/lib/export/registry.ts:98-136,163-175`), have field/filter schemas, but the route's default branch authorizes and then throws 404 (`src/app/api/export/route.ts:117-120`). They should not be described as implemented.

**X-2 — Confirmed: exportable data with no export option.**  
Beyond the four planned categories:
- `Attachment` metadata (`prisma/schema.prisma:446`)
- `RoutingRule` (`:540`)
- `UnmatchedEmail` (`:565`)
- `ParserRequest` (`:589`)
- `FieldMapping` (`:607`)
- `Setting` (`:621`)
- `Session` / `Account` / `Verification` (intentionally excluded for security)
- `User` fields not in the live CSV: `salesPrivilege`, `banned`, `lastLoginAt`, `updatedAt`
- `Lead` fields not in the live CSV: `category`, `alternatePhone`, follow-up/contact timestamps, UTM/campaign fields, budget/expectedValue/currency, lostReason, industry/website/jobTitle/address
- `ConnectorSyncRun.errorMessage` (header exists, value blank)

These are not necessarily requirements; they are capability gaps to decide explicitly.

### 4.7 Audit Logs

**A-1 — Confirmed: there is no Audit Log export because there is no Audit Log model.**  
The migration `20260913120000_remove_lead_activity_and_audit_log` removed `LeadActivity` and `AuditLog`; the migration file's own comments state both tables were already dropped by a previous attempt (`prisma/migrations/20260913120000_remove_lead_activity_and_audit_log/migration.sql:1-2`). `src/app/api/audit-logs/` contains no route files. The current activity system is `ActivityEvent` (`prisma/schema.prisma:364`) and `ActivityEntry` (`:380`). The only export-operation record is a best-effort Pino event (`src/services/export/operation-log.ts:4-15`), explicitly not durable (`docs/api.md:159`).

**A-2 — Design weakness: export operation logs cannot reconstruct what was exported.**  
The log schema allows `datePreset`, `dateField`, `activeFilterGroups`, and `selectedColumnCount`, but not filter values (`src/lib/export/output.ts:183-199`). The route passes only `activeFilterGroups` (`src/app/api/export/route.ts:50-61,71-82`). For investigation, you can see that "status" was used, not which statuses. This is privacy-conscious but insufficient for a durable audit requirement.

---

## 5. Security Findings

| ID | Classification | Finding | Evidence |
|---|---|---|---|
| SEC-1 | Strength | Route requires an authenticated, active session and ADMIN/SALES role; category policy is re-checked server-side. | `src/app/api/export/route.ts:85`; `src/lib/api.ts:13-29`; `src/services/export/authorization.ts:6-13` |
| SEC-2 | Strength | Sales lead scope is server-owned and cannot be widened by query parameters; assigned-user filters are rejected for Sales. | `src/services/export/scope.ts:5-9`; `src/services/export/authorization.ts:15-18` |
| SEC-3 | Strength | Users/Providers/Sync/Reports are Admin-only by policy even though the route accepts SALES at the outer layer. | `src/lib/export/policy.ts:42-46` |
| SEC-4 | Strength | Unknown and duplicate query parameters are rejected; filter schemas are strict. | `src/app/api/export/route.ts:100-103`; `src/lib/export/filters.ts:61-193` |
| SEC-5 | Strength | Response is private/no-store/nosniff; no caching of exported personal data. | `src/app/api/export/route.ts:127-136` |
| SEC-6 | Strength | Operation logs redact filter values and exported content. | `src/app/api/export/route.ts:95-97`; `src/lib/export/output.ts:183-199` |
| SEC-7 | Potential risk | No server-side rate limiting or concurrency cap. One authenticated user can launch many large exports; each can consume a DB connection and up to 30 seconds. | `src/app/api/export/route.ts:85-142`; `src/components/export/export-workspace.tsx:143-146`; `src/components/shared/export-button.tsx:51-54` |
| SEC-8 | Potential risk | No durable audit record for personal-data exports. Best-effort Pino logs can be lost or rotated. | `src/services/export/operation-log.ts:4-15` |
| SEC-9 | Potential risk | GET download has no CSRF token. An attacker generally cannot read the response cross-origin, but can force downloads/resource consumption in a victim's browser. | `src/app/api/export/route.ts:85`; `src/components/shared/export-button.tsx:38-43` |
| SEC-10 | Potential risk | Error messages reflect unknown parameter names supplied by the caller. Low impact, but avoid reflecting arbitrary strings in production if logs/alerts treat them as trusted. | `src/app/api/export/route.ts:101` |
| SEC-11 | Design weakness | CSV formula neutralization mutates legitimate values rather than applying a field-aware policy. It also may not match every spreadsheet's interpretation. | `src/lib/csv.ts:1-11` |
| SEC-12 | Design weakness | Exported CSV has no watermark, export ID, actor, or generation timestamp inside the file, so a leaked file cannot be tied to an export event. | `src/services/export.service.ts:43-48,54-59,65-70,76-81` |

**Not found:** SQL injection in export query construction. The builders use Prisma typed objects; the only raw SQL in `monthlyTrends` uses `Prisma.sql` parameterization (`src/services/report.service.ts:179-202`). No secret-bearing connector configuration is selected; the sync projection is allowlisted (`src/services/export/projections.ts:93-112`).

---

## 6. Data Integrity Findings

| ID | Classification | Finding | Evidence |
|---|---|---|---|
| DI-1 | Confirmed bug | Date-only legacy `to` covers 1 ms, not the full day; same pattern in Reports. | `src/lib/export/legacy-compatibility.ts:15-23,98-107` |
| DI-2 | Confirmed bug | Contextual Leads export can apply lead-created dates to activity occurrence, narrowing results vs the table. | `src/lib/export/ui.ts:250-260` |
| DI-3 | Confirmed bug | Contextual Leads export inherits `23:59:59.000Z` end-of-day, excluding the last 999 ms; dedicated export includes it. | `src/components/sales/sales-table-controls.tsx:123-127`; `src/lib/export/ui.ts:251-252`; `src/lib/export/legacy-compatibility.ts:22` |
| DI-4 | Confirmed bug | Activity Date alone requires a CALL/WHATSAPP entry, contrary to the UI copy's implication. | `src/services/export/query-builders.ts:93-110`; `src/components/export/export-workspace.tsx:228` |
| DI-5 | Confirmed bug | Sync `Error` column is always blank. | `src/services/export/csv-serialization.ts:8,70-85`; `src/services/export/projections.ts:93-112` |
| DI-6 | Confirmed contract drift | Field metadata and live CSV disagree on `product`, `category`, `salesPrivilege`, `phone`, and boolean representation. | `src/lib/export/fields.ts:47,63,122,123,127`; `src/lib/export/legacy-contract.ts:20-21`; `src/services/export/csv-serialization.ts:57,67`; `src/lib/export/output.ts:147` |
| DI-7 | Confirmed mismatch | Workspace column chips omit Sync `Error` and reflect legacy columns rather than actual serializer headers. | `src/lib/export/ui.ts:65-71`; `src/lib/export/legacy-contract.ts:23`; `src/services/export/csv-serialization.ts:8` |
| DI-8 | Confirmed design limitation | Provider export forces active-only; inactive providers are unreachable. | `src/lib/export/legacy-compatibility.ts:85-88`; `src/lib/export/legacy-contract.ts:9` |
| DI-9 | Confirmed parity gap | Sync modal shows at most 100 runs; export covers all matching runs. | `src/services/connector.service.ts:51-52`; `src/services/export/query.service.ts:126-143` |
| DI-10 | Confirmed parity gap | Reports trends and activity differ between on-screen API and CSV. | `src/app/api/reports/route.ts:37-43`; `src/services/report.service.ts:131-165,179-188`; `src/services/export.service.ts:94-103` |
| DI-11 | Confirmed semantic inconsistency | "This Week" is 7 rolling days and "This Month" is 30 rolling days, not calendar periods. | `src/services/report.service.ts:131-158` |
| DI-12 | Documented tradeoff | Count-then-keyset paging has no snapshot; concurrent inserts/deletes can change membership or values during a download. | `src/services/export/query.service.ts:73-84`; `src/services/export/keyset.ts:1-22`; `docs/api.md:157` |
| DI-13 | Potential edge case | `iterateKeysetPages` treats the pre-count as a hard emission cap. If concurrent backdated inserts occur after the count, the export can stop at the old count. | `src/services/export/keyset.ts:8-21` |
| DI-14 | Minor contract mismatch | Report row limit counts section/header rows, while `EXPORT_LIMITS` describes data rows. | `src/services/export.service.ts:28-34,107`; `src/services/export/csv-stream.ts:70-81`; `src/lib/export/output.ts:152-157` |
| DI-15 | Design weakness | CSV formula neutralization changes stored values. | `src/lib/csv.ts:5` |

---

## 7. Performance Findings

| ID | Classification | Finding | Evidence |
|---|---|---|---|
| PERF-1 | Strength | Row exports count once, then fetch deterministic keyset pages of 250 instead of OFFSET. | `src/services/export/query.service.ts:44,73-84`; `src/services/export/keyset.ts:1-22` |
| PERF-2 | Strength | Streaming is pull-driven with `highWaterMark: 0`, so the full CSV is not buffered. | `src/services/export/csv-stream.ts:48-99` |
| PERF-3 | Strength | Row, byte, and elapsed-time limits terminate the stream without reporting success. | `src/services/export/csv-stream.ts:72-79`; `src/services/export/limits.ts:4-6` |
| PERF-4 | Potential risk | Each 250-row page opens a new interactive transaction with a 2-second `maxWait`; 50,000 rows means up to 200 transactions and possible pool contention. | `src/services/export/query.service.ts:46-51`; `src/services/export/limits.ts:4-6` |
| PERF-5 | Potential risk | Lead export count and paging repeat complex nested activity filters; no trigram index for `ILIKE '%term%'`. | `src/services/export/query-builders.ts:93-112`; `prisma/schema.prisma:351-361,376-377,395-397` |
| PERF-6 | Potential risk | Reports run six aggregate query groups in one transaction; `leadSources` adds three `groupBy` calls and two lookup `findMany` calls. | `src/services/export.service.ts:94-104`; `src/services/report.service.ts:49-129` |
| PERF-7 | Potential risk | Sync date-range export may not have an ideal standalone `startedAt` index. | `prisma/schema.prisma:536-537` |
| PERF-8 | Potential risk | No route-level `runtime`/`maxDuration` config; serverless deployment defaults may be shorter than the 30-second application deadline. | `src/app/api/export/route.ts:85` (no segment config) |
| PERF-9 | Design weakness | No compression; large CSVs are sent uncompressed. Acceptable for local hosting, but bandwidth-heavy for remote use. | `src/app/api/export/route.ts:127-136` |
| PERF-10 | Design weakness | No benchmark evidence for the 50,000-row/25 MB/30-second limits against the actual database. | `docs/performance.md:45` explicitly says these have not been benchmarked |

---

## 8. UX Findings

| ID | Classification | Finding | Evidence |
|---|---|---|---|
| UX-1 | Confirmed bug | Contextual Leads blocked-filter message says the endpoint supports "Status and Assigned Salesperson only," but the mapper also supports source, priority, category, activity action/response/interest, archived, search, and dates. | `src/lib/export/ui.ts:222` |
| UX-2 | Confirmed bug | Workspace column chips show 10 Sync columns while the CSV has 11; Users shows Phone; Leads shows Product. | `src/lib/export/ui.ts:65-71`; `src/lib/export/legacy-contract.ts:20-23`; `src/services/export/csv-serialization.ts:8` |
| UX-3 | Design weakness | No row count, byte estimate, or preview before download. | `src/lib/export/output.ts:58-101`; `src/services/export/query.service.ts:150-154`; `src/components/export/export-workspace.tsx:335` |
| UX-4 | Design weakness | No progress indicator, completion state, or cancel control; the app opens a new tab and loses visibility. | `src/components/export/export-workspace.tsx:131-146`; `src/components/shared/export-button.tsx:38-54` |
| UX-5 | Design weakness | The client download guard re-enables after 1.2 seconds, not when the transfer finishes, encouraging duplicate clicks. | `src/components/export/export-workspace.tsx:143-146`; `src/components/shared/export-button.tsx:51-54` |
| UX-6 | Design weakness | Server errors are shown as JSON in a new tab, outside the app's error handling. | `src/app/api/export/route.ts:32-39`; `src/components/export/export-workspace.tsx:142` |
| UX-7 | Design weakness | Users and Providers workspaces advertise no filters; the contextual Users button is disabled whenever any filter is active. | `src/components/export/export-workspace.tsx:279-285`; `src/components/users/user-table-controls.tsx:44,148` |
| UX-8 | Design weakness | Sync History modal shows only 100 runs and does not render `errorMessage`; the export button covers all runs. | `src/services/connector.service.ts:51-52`; `src/components/connectors/sync-history-modal.tsx:21,54,71,95-136` |
| UX-9 | Design weakness | Reports export is a fixed aggregate file with no section/column choice and no explanation of trends/activity parity. | `src/lib/export/registry.ts:189-201`; `src/components/admin/admin-reports.tsx:316,424` |
| UX-10 | Design weakness | No UTF-8 BOM; Excel on some Windows configurations may mis-render non-ASCII names. | `src/services/export/csv-stream.ts:28,70`; `src/app/api/export/route.ts:130` |
| UX-11 | Design weakness | Filename is only `<type>-<date>.csv`; repeated exports collide and the file does not identify the filter range or actor. | `src/app/api/export/route.ts:126` |
| UX-12 | Design weakness | Empty exports return a header-only file with no explicit "0 rows" message. | `src/lib/export/output.ts:136-139`; `src/services/export/csv-stream.ts:59-67` |
| UX-13 | Design weakness | All date presets are UTC-only; the UI labels this but offers no local-time option. | `src/lib/export/dates.ts:17`; `src/components/export/export-workspace.tsx:69-78` |
| UX-14 | Design weakness | No saved export presets, scheduled exports, or export history. | Not implemented; no routes/models found |

---

## 9. Test Coverage Assessment

| Test file | Tests | Coverage | Gaps |
|---|---:|---|---|
| `tests/export-contracts.test.ts` | 8 | Registry IDs/availability, authorization matrix, date contracts, filter strictness, multi-select semantics, field allowlists, request/output contracts, limits | Does not compare `EXPORT_FIELDS.defaultSelected` with live `LEGACY_EXPORT_COLUMNS`; does not test boolean representation against serializers |
| `tests/export-query.test.ts` | 15 | Authorization, Sales scope, lead filter composition, user/provider builders, sync predicates, projections, keyset cursors/traversal, date presets, legacy bounds, report constraints, advanced filters, activity predicates, legacy adapter | No date-only `to` case; no contextual activity+date parity case; no real DB execution |
| `tests/export-delivery.test.ts` | 8 | Headers (including blank Error), CSV quoting/Unicode/null/formula neutralization, incremental streaming, cancellation, row/byte limits, query/serialization failure, callback failure, deadline/redaction | Asserts formula mutation rather than data fidelity; no BOM assertion; no phone/email/name mutation regression |
| `tests/export-ui.test.ts` | 8 | Category availability, navigation, reset/headers, lead filter serialization, advanced filters, date presets, contextual mapping/blocking, download guard | Encodes the current activity-date behavior; no test for activity filters + page date range; no test for 1.2-second guard behavior; no header-chip vs CSV parity |

**Overall:** Good unit coverage of the pure query/contract/stream layers. Weak integration coverage of the actual route and of cross-layer contract consistency. There are no route-handler tests for auth, unknown/duplicate parameters, headers, or dispatch; no database-backed tests; and no test that every live category's headers, serializers, metadata, and UI chips agree.

**Suggested test additions:**
- `GET /api/export` route tests with mocked session/service: 401, 403, unknown type, planned type 404, unknown param 400, duplicate param 400, correct `Content-Type`/`Content-Disposition`.
- Date-only `from`/`to` for Leads, Sync, and Reports, including same-day ranges and full-day inclusion.
- Contextual export with `filter.activityResponse` + `dateFrom`/`dateTo`; assert `from`/`to` are not copied to `activityFrom`/`activityTo`.
- Header/serializer/metadata parity for all five categories, including Users Phone/Sales Privilege and Sync Error.
- `escapeCsv("+1 (555) 123-4567")` and name/email cases, once policy is decided.
- Reports CSV assembly: exact row count, section order, date label, and trends/activity parity.
- Empty export, BOM (if added), and filename format.
- Concurrency/rate-limit behavior once implemented.

---

## 10. Documentation Gaps

| ID | Gap | Evidence |
|---|---|---|
| DOC-1 | Prior export audit says search covers 5 fields; current code covers 6 (adds `alternatePhone`). | `docs/experiments/32_EXPORT_SYSTEM_UX_AND_CAPABILITY_AUDIT.md:79` vs `src/services/export/query-builders.ts:112` |
| DOC-2 | API guide says legacy `from`/`to` bounds are inclusive, but date-only `to` only covers 1 ms. | `docs/api.md:161` vs `src/lib/export/legacy-compatibility.ts:22` |
| DOC-3 | Frontend guide calls `alternatePhone` an "optional configurable export field," but the live route has no column selection and legacy columns omit it. | `docs/frontend.md:45`; `src/lib/export/legacy-contract.ts:20`; `src/lib/export/output.ts:13-54` |
| DOC-4 | No canonical end-to-end export guide. Export behavior is split across `api.md`, `backend.md`, `frontend.md`, and `performance.md`; the only end-to-end document is a dated experiment. | `docs/README.md:24-37`; `docs/experiments/README.md:8` |
| DOC-5 | Docs accurately say the Sync `Error` column is blank, but do not explain why the header is retained or that the modal also hides `errorMessage`. | `docs/api.md:157`; `src/components/connectors/sync-history-modal.tsx:95-136` |
| DOC-6 | Docs do not mention the metadata/live-column drift (`product`, `category`, `salesPrivilege`, `phone`, booleans). | `src/lib/export/fields.ts` vs `src/lib/export/legacy-contract.ts` |
| DOC-7 | Docs do not document the contextual Leads activity/date parity behavior or the table's `23:59:59.000Z` end-of-day truncation. | `src/lib/export/ui.ts:250-260`; `src/components/sales/sales-table-controls.tsx:123-127` |
| DOC-8 | Docs correctly say export logs are not durable audit records, but there is no explicit statement of what compliance requirement they do or do not satisfy. | `docs/api.md:159`; `src/services/export/operation-log.ts:4-15` |

---

## 11. Prioritized Recommendations (P0–P3)

### P0 — Correctness, data integrity, and security

| ID | Action | Why | Files |
|---|---|---|---|
| P0-1 | Fix date-only `to` expansion for Leads, Sync, and Reports. Prefer a shared normalizer: date-only `to` → next UTC day; timestamp `to` → +1 ms. Add same-day and end-of-day tests. | Prevents silent data loss for direct API users and contextual exports. | `src/lib/export/legacy-compatibility.ts:6-23,98-107`; `src/lib/export/dates.ts:58-94` |
| P0-2 | Reconcile `EXPORT_FIELDS` defaults, `LEGACY_EXPORT_COLUMNS`, serializer headers, and UI chips. Choose the authoritative contract and derive the others. Decide `product`, `category`, `salesPrivilege`, `phone`, and boolean representation. | Eliminates misleading metadata and UI/CSV mismatch. | `src/lib/export/fields.ts`; `src/lib/export/legacy-contract.ts`; `src/services/export/csv-serialization.ts`; `src/lib/export/ui.ts:65-71` |
| P0-3 | Implement or remove the Sync `Error` column. If implementing, select `errorMessage`, sanitize/redact it, serialize it, and render it in the modal. If removing, remove the header and update docs/tests. | A permanently blank column is a correctness and trust problem. | `src/services/export/projections.ts:93-112`; `src/services/export/csv-serialization.ts:70-85`; `src/components/connectors/sync-history-modal.tsx` |
| P0-4 | Fix contextual Leads activity/date mapping: do not copy lead-created `from`/`to` into `activityFrom`/`activityTo` merely because activity filters exist. Add a regression test. | Shortcut export must match the visible table. | `src/lib/export/ui.ts:250-260`; `tests/export-ui.test.ts:131-160` |
| P0-5 | Fix the Leads table's `23:59:59.000Z` end-of-day truncation or normalize it before export. Prefer date-only values in the table and expand on the server. | The last 999 ms of a selected day are currently excluded. | `src/components/sales/sales-table-controls.tsx:123-127`; `src/lib/export/legacy-compatibility.ts:22` |
| P0-6 | Adopt a field-aware CSV formula policy. Neutralize `=`, `@`, tab, CR; treat `+`/`-` according to field type so phone numbers and legitimate names are not mutated. Document the policy and add regression tests. | Preserves data fidelity while retaining spreadsheet safety. | `src/lib/csv.ts:1-11`; `src/services/export/csv-serialization.ts` |
| P0-7 | Add server-side export rate limiting and concurrency caps per actor/category, plus a global cap. Return 429 with a clear message. | Prevents accidental or malicious resource exhaustion. | `src/app/api/export/route.ts`; new limiter module; `src/services/export/limits.ts` |
| P0-8 | Add a durable export audit record (new model/migration) or explicitly accept and document best-effort-only logging. Record actor, category, sanitized filter summary, row/byte counts, outcome, and timestamps. | Personal-data exports need accountability. | `src/services/export/operation-log.ts`; `prisma/schema.prisma`; new migration |

### P1 — Capability and parity

| ID | Action | Why | Files |
|---|---|---|---|
| P1-1 | Add a preflight count/preview endpoint and UI using the existing unused schemas; show count, estimated bytes, and limit warnings. Reuse or remove `countReports`. | Users cannot predict download size or failure. | `src/lib/export/output.ts:58-101`; `src/services/export/query.service.ts:150-154`; `src/components/export/export-workspace.tsx:335` |
| P1-2 | Expose the live filters already supported by generic schemas: Users (search/role/active/date), Providers (active/type/search/date), Sync (status/type/error/date field), Reports (source/owner/status). Or remove the unused schema affordances. | Reduces "metadata says yes, UI says no" confusion. | `src/lib/export/filters.ts`; `src/lib/export/legacy-contract.ts`; `src/lib/export/legacy-compatibility.ts` |
| P1-3 | Allow explicit Provider `active` filtering, with active-only as the backward-compatible default. | Enables inactive-provider audits. | `src/lib/export/legacy-compatibility.ts:85-88`; `src/lib/export/legacy-contract.ts:9` |
| P1-4 | Align Sync History: show "latest 100" explicitly, render `errorMessage`, and add status/error/date filters to the modal/export. | The modal and CSV currently describe different datasets. | `src/services/connector.service.ts:51-52`; `src/components/connectors/sync-history-modal.tsx` |
| P1-5 | Unify Reports semantics: make `/api/reports` honor range/filters or make CSV match the UI exactly. Use calendar week/month for labels, or rename them. | "Reports" currently means different data in UI and CSV. | `src/app/api/reports/route.ts:37-43`; `src/services/report.service.ts:131-188`; `src/services/export.service.ts:94-103` |
| P1-6 | Add optional UTF-8 BOM and a more informative filename (`<category>-<range>-<timestamp>.csv`). | Improves Excel compatibility and avoids collisions. | `src/services/export/csv-stream.ts:28,70`; `src/app/api/export/route.ts:126` |
| P1-7 | Add explicit route segment config (`runtime = "nodejs"`, `maxDuration`) aligned with the 30-second deadline. | Avoids serverless default timeouts. | `src/app/api/export/route.ts:85` |
| P1-8 | Improve error UX: return a JSON error with a correlation ID and surface it in the app instead of a raw new tab. Consider a fetch-based download for small exports and streaming for large ones. | Better recovery and supportability. | `src/app/api/export/route.ts:32-39`; `src/components/export/export-workspace.tsx:131-146` |

### P2 — Product completeness

| ID | Action | Why |
|---|---|---|
| P2-1 | Implement column selection and saved export presets. | Makes the rich field metadata useful and supports compliance minimization. |
| P2-2 | Add export history UI backed by durable audit records. | Lets admins see who exported what and when. |
| P2-3 | Add sensitivity-aware confirmation/masking for personal/sensitive fields. | Reduces accidental over-sharing. |
| P2-4 | Add gzip/compression for large CSVs and `Content-Length` for buffered small exports. | Bandwidth and progress UX. |
| P2-5 | Implement planned Activities, Follow-ups, Notes, and Connectors categories with scoping and tests. | Closes the largest capability gaps. |
| P2-6 | Decide whether to export Attachments metadata, Routing Rules, Unmatched Emails, Parser Requests, and Field Mappings. | Some operational data currently has no export path. |
| P2-7 | Add `EXPLAIN (ANALYZE, BUFFERS)` benchmarks for representative filters before adding indexes. | Avoid speculative indexes. |

### P3 — Advanced / long-term

| ID | Action | Why |
|---|---|---|
| P3-1 | Add background/scheduled exports and retention policies. | Large exports and recurring reports. |
| P3-2 | Add additional formats (XLSX/JSON) only if a real requirement exists. | CSV is sufficient for current scale; avoid scope creep. |
| P3-3 | Add export metrics/dashboards (duration, rows, bytes, failure reasons, concurrency). | Operational visibility. |
| P3-4 | Add data-retention/expiry rules for exported artifacts if background jobs are introduced. | Compliance and storage hygiene. |

---

## 12. Proposed Improvement Roadmap

### Phase 1 — Correctness and contract reconciliation (recommended first)

**Scope:** P0-1 through P0-6.  
**Deliverables:**
- Shared date-bound normalizer; date-only `to` fixed for Leads, Sync, Reports.
- Single source of truth for live columns; metadata, serializers, and UI chips reconciled.
- Sync `Error` implemented with sanitization or removed consistently.
- Contextual Leads activity/date parity fixed.
- Leads table end-of-day truncation fixed or normalized.
- Field-aware CSV formula policy with regression tests.
- Contract tests covering every live category's headers, serializers, metadata, and chips.

**Exit criteria:** all existing 39 tests pass, new regression tests pass, no metadata/live mismatch remains, and a manual spot-check of each category produces the expected headers and values.  
**Estimate:** 2–3 focused engineering days. This is an estimate, not a commitment.

### Phase 2 — Visibility and parity

**Scope:** P1-1 through P1-5.  
**Deliverables:**
- Preflight count/preview API and UI.
- Live filters for Users, Providers, Sync, and Reports, or removal of unused schemas.
- Provider active-state choice.
- Sync modal/export alignment and error display.
- Reports trends/activity parity and calendar-period labels.

**Exit criteria:** the UI and CSV describe the same dataset for every category; users see row counts before download; no filter control is a dead end.  
**Estimate:** 3–5 engineering days.

### Phase 3 — Accountability and resilience

**Scope:** P0-7, P0-8, P1-6 through P1-8, P2-2.  
**Deliverables:**
- Durable export audit records and history UI.
- Rate limiting/concurrency caps.
- BOM/filename improvements.
- Route runtime/maxDuration config.
- App-level error handling and, if feasible, progress/cancel.

**Exit criteria:** exports are attributable, rate-limited, and observable; failures are recoverable without leaving the app.  
**Estimate:** 3–5 engineering days.

### Phase 4 — Capability expansion

**Scope:** P2-1, P2-3 through P2-7, P3.  
**Deliverables:**
- Column selection/saved presets.
- Planned categories.
- Additional operational exports.
- Benchmarks, compression, scheduled exports, metrics.

**Exit criteria:** each new category has authorization, scoping, filters, serializers, contract tests, and docs; performance is measured before index changes.  
**Estimate:** 1–2 weeks, depending on which categories are approved.

---

## 13. Files and Code References

| Path | Symbol / area | Lines | Relevance |
|---|---|---|---|
| `src/app/api/export/route.ts` | `GET` | 85-142 | Sole live export endpoint; auth, dispatch, params, headers |
| `src/app/api/export/route.ts` | `safeReason`, `errorResponse` | 19-39 | Error classification and generic 500 behavior |
| `src/app/api/export/route.ts` | `logPreStreamFailure`, `logStreamCompletion` | 41-83 | Best-effort operation logging |
| `src/app/api/export/route.ts` | param allowlist / duplicate checks | 93-103 | Unknown/duplicate rejection |
| `src/app/api/export/route.ts` | dispatch | 105-121 | Category-specific open calls; planned 404 |
| `src/app/api/export/route.ts` | response headers / filename | 126-136 | CSV headers, no-store, filename |
| `src/services/export.service.ts` | `ExportService.openLeads` | 41-50 | Leads CSV assembly |
| `src/services/export.service.ts` | `openUsers` | 52-61 | Users CSV assembly |
| `src/services/export.service.ts` | `openProviders` | 63-72 | Providers CSV assembly |
| `src/services/export.service.ts` | `openSyncHistory` | 74-83 | Sync CSV assembly |
| `src/services/export.service.ts` | `openReports` | 85-139 | Report aggregates and CSV sections |
| `src/services/export/query.service.ts` | `runExportQuery` | 46-51 | Per-page transaction + statement timeout |
| `src/services/export/query.service.ts` | `openLeads` | 68-86 | Count + keyset paging |
| `src/services/export/query.service.ts` | `openUsers` | 88-105 | Count + keyset paging |
| `src/services/export/query.service.ts` | `openProviders` | 107-124 | Count + keyset paging |
| `src/services/export/query.service.ts` | `openSyncHistory` | 126-143 | Count + keyset paging |
| `src/services/export/query.service.ts` | `countReports` | 150-154 | Unused count capability |
| `src/services/export/query-builders.ts` | `dateTimeFilter` | 30-35 | `gte`/`lt` bounds |
| `src/services/export/query-builders.ts` | `leadActivityDateBounds` | 48-71 | Activity date semantics |
| `src/services/export/query-builders.ts` | `buildLeadExportWhere` | 73-114 | Lead filters; activity requires CALL/WHATSAPP; 6-field search |
| `src/services/export/query-builders.ts` | `buildUserExportWhere` | 126-137 | Users filters (not live) |
| `src/services/export/query-builders.ts` | `buildProviderExportWhere` | 148-156 | Providers filters (not live) |
| `src/services/export/query-builders.ts` | `buildSyncHistoryExportWhere` | 167-177 | Sync filters (mostly not live) |
| `src/services/export/query-builders.ts` | `buildReportLeadWhere`, `buildReportActivityLeadWhere` | 179-196 | Report scoping |
| `src/services/export/query-builders.ts` | cursor builders | 219-247 | Keyset pagination |
| `src/services/export/projections.ts` | `resolveLeadProjection` | 9-55 | Lead select |
| `src/services/export/projections.ts` | `resolveUserProjection` | 57-76 | User select |
| `src/services/export/projections.ts` | `resolveProviderProjection` | 78-91 | Provider select |
| `src/services/export/projections.ts` | `resolveSyncHistoryProjection` | 93-112 | Sync select; no `errorMessage` |
| `src/services/export/csv-serialization.ts` | `EXPORT_CSV_HEADERS` | 4-9 | Header contract; Sync Error included |
| `src/services/export/csv-serialization.ts` | `serializeLeadCsvRow` | 23-45 | Lead values |
| `src/services/export/csv-serialization.ts` | `serializeUserCsvRow` | 47-58 | User values; Yes/No |
| `src/services/export/csv-serialization.ts` | `serializeProviderCsvRow` | 60-68 | Provider values; Yes/No |
| `src/services/export/csv-serialization.ts` | `serializeSyncRunCsvRow` | 70-85 | Blank Error at line 83 |
| `src/lib/csv.ts` | `escapeCsv`, `toCsvRow` | 1-15 | Formula neutralization at line 5 |
| `src/lib/export/legacy-compatibility.ts` | `parseLegacyDate`, `legacyBounds` | 6-23 | Date-only `to` bug at line 22 |
| `src/lib/export/legacy-compatibility.ts` | `parseLegacyLeadExport` | 54-79 | Lead legacy filters |
| `src/lib/export/legacy-compatibility.ts` | `parseLegacyUserExport` | 81-83 | Users accept no filters |
| `src/lib/export/legacy-compatibility.ts` | `parseLegacyProviderExport` | 85-88 | Forces `active: true` |
| `src/lib/export/legacy-compatibility.ts` | `parseLegacySyncExport` | 90-96 | Connector + dates only |
| `src/lib/export/legacy-compatibility.ts` | `parseLegacyReportExport` | 98-107 | Paired dates; date-only bug at line 104 |
| `src/lib/export/legacy-contract.ts` | `LEGACY_EXPORT_QUERY_PARAMETERS` | 2-16 | Live query allowlist |
| `src/lib/export/legacy-contract.ts` | `LEGACY_EXPORT_COLUMNS` | 19-24 | Fixed columns; Sync omits Error |
| `src/lib/export/fields.ts` | `EXPORT_FIELDS.leads` | 39-79 | `category` line 47; `product` line 63 |
| `src/lib/export/fields.ts` | `EXPORT_FIELDS.users` | 118-131 | `salesPrivilege` 122; `active` 123; `phone` 127 |
| `src/lib/export/fields.ts` | `EXPORT_FIELDS.providers` | 132-139 | `active` 136 |
| `src/lib/export/fields.ts` | `EXPORT_FIELDS["sync-history"]` | 154-166 | `errorDiagnostic` 165 |
| `src/lib/export/fields.ts` | `EXPORT_FIELDS.reports` | 167-174 | Non-selectable aggregate fields |
| `src/lib/export/filters.ts` | Lead schema | 61-100 | Full lead filter contract |
| `src/lib/export/filters.ts` | User schema | 140-149 | Rich user filters |
| `src/lib/export/filters.ts` | Provider schema | 153-159 | Rich provider filters |
| `src/lib/export/filters.ts` | Sync schema | 176-183 | Rich sync filters |
| `src/lib/export/filters.ts` | Report schema | 187-193 | Rich report filters |
| `src/lib/export/output.ts` | Preview/count schemas | 58-101 | Unused by production route |
| `src/lib/export/output.ts` | Empty result policy | 136-139 | Header-only policy |
| `src/lib/export/output.ts` | CSV representation | 141-150 | Booleans `true/false`; formula policy |
| `src/lib/export/output.ts` | Limits | 152-157 | 50k rows / 25 MB / 30 s |
| `src/lib/export/output.ts` | Operation log schema | 183-199 | Redacted audit fields |
| `src/lib/export/ui.ts` | `getCurrentCsvHeaders` | 65-71 | Chips from legacy columns |
| `src/lib/export/ui.ts` | `dateQueryValues` | 73-95 | Full-timestamp `from`/`to` |
| `src/lib/export/ui.ts` | `buildExportQuery` | 119-196 | Workspace query builder |
| `src/lib/export/ui.ts` | contextual mapper | 198-266 | Users block; Leads mapping; activity parity bug at 250-260; inaccurate message at 222 |
| `src/lib/export/ui.ts` | download guard | 286-296 | Client-side guard |
| `src/components/export/export-workspace.tsx` | download handler | 120-152 | New tab at 134; 1.2 s guard at 143-146 |
| `src/components/export/export-workspace.tsx` | Users/Providers notes | 279-285 | No-filter messaging |
| `src/components/export/export-workspace.tsx` | summary/no preview | 322-335 | Column chips and count disclaimer |
| `src/components/shared/export-button.tsx` | `handleExport` | 30-55 | New tab at 43; 1.2 s guard at 51-54 |
| `src/components/connectors/sync-history-modal.tsx` | modal data/export | 21,54,71,95-136 | 100-run list; error not rendered |
| `src/services/connector.service.ts` | `listSyncRuns` | 51-52 | `take: 100` |
| `src/services/report.service.ts` | `activity` | 131-165 | Fixed windows; rolling 7/30 days |
| `src/services/report.service.ts` | `monthlyTrends` | 179-210 | Six-month condition only when filters undefined |
| `src/app/api/reports/route.ts` | activity/trends cases | 37-43 | Ignores range/filters |
| `src/components/admin/admin-reports.tsx` | period handler | 181-190 | Rolling date range |
| `src/components/admin/admin-reports.tsx` | trend notes | 316,424 | "Last 6 months, regardless of the report period" |
| `src/services/export/csv-stream.ts` | stream/limits/cancel | 21-102 | TextEncoder, row/byte limits, cancellation |
| `src/services/export/deadline.ts` | `ExportDeadline` | 3-39 | 30-second deadline |
| `src/services/export/limits.ts` | query limits | 4-11 | 15 s statement / 16 s transaction / 2 s maxWait |
| `src/services/export/scope.ts` | `buildExportLeadScope` | 5-9 | Server-owned Sales scope |
| `src/services/export/authorization.ts` | category/filter auth | 6-18 | Category and Sales assignee rules |
| `src/lib/export/policy.ts` | `EXPORT_AUTHORIZATION` | 21-47 | Admin/Sales matrix |
| `src/lib/api.ts` | `withApiAuthorization` | 13-29 | Session/active/role gate |
| `src/lib/permissions.ts` | `Permission`, `can` | 1-35 | `EXPORT_LEADS`, Senior privilege |
| `prisma/schema.prisma` | `User` | 171-213 | User fields/indexes |
| `prisma/schema.prisma` | `LeadSource` | 262-280 | Provider fields/index |
| `prisma/schema.prisma` | `Lead` | 282-362 | Lead fields/indexes |
| `prisma/schema.prisma` | `ActivityEvent` | 364-378 | Activity event/indexes |
| `prisma/schema.prisma` | `ActivityEntry` | 380-398 | Activity entry/indexes |
| `prisma/schema.prisma` | `Note` | 400-417 | Planned notes export |
| `prisma/schema.prisma` | `FollowUp` | 419-444 | Planned follow-up export |
| `prisma/schema.prisma` | `ConnectorSyncRun` | 522-538 | Sync fields/indexes; `errorMessage` 533 |
| `prisma/migrations/20260913120000_remove_lead_activity_and_audit_log/migration.sql` | migration comments | 1-2 | AuditLog/LeadActivity removed |
| `docs/api.md` | export endpoint | 155-163 | Current API claims; date-bound claim at 161 |
| `docs/backend.md` | export services | 11-13,32,63 | Architecture/search claims |
| `docs/frontend.md` | export UI | 25,31,35-37,45 | Workspace and alternatePhone claim |
| `docs/performance.md` | exports | 24,45 | Limits and benchmark caveat |
| `docs/README.md` | canonical index | 24-37 | No dedicated export guide |
| `docs/experiments/32_EXPORT_SYSTEM_UX_AND_CAPABILITY_AUDIT.md` | prior audit | 79,88 | Stale 5-field search; blocked-filter observation |
| `tests/export-contracts.test.ts` | 8 tests | 31-161 | Contract coverage |
| `tests/export-query.test.ts` | 15 tests | 35-230 | Query coverage |
| `tests/export-delivery.test.ts` | 8 tests | 26-147 | Delivery coverage |
| `tests/export-ui.test.ts` | 8 tests | 20-162 | UI/query coverage |

---

## Overall Assessment

The export system is **architecturally sound and reasonably secure**, but it is **not yet contract-clean**. The highest-risk issues are silent data loss at date boundaries, a permanently blank Sync `Error` column, and a growing divergence between the rich export metadata and the fixed legacy CSV. The UI also overpromises in a few places and under-delivers in others: it shows column chips that do not match the file, disables filters without always explaining why, and provides no count/preview or progress.

The most valuable first step is **not** adding Activities/Notes/Follow-ups or redesigning the workspace. It is to make the existing five exports **correct, internally consistent, and testable**, then add a preflight count/preview so users know what they are downloading. After that, parity work (filters and Reports semantics) and accountability work (durable audit, rate limiting) will have a stable foundation.

**Recommended first phase:** Phase 1 — date-bound correctness, metadata/live-column reconciliation, Sync `Error`, contextual parity, and CSV formula policy, with contract tests. No implementation changes are included in this document; approval is required before proceeding.
