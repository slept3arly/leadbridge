# Export System Contracts — Phase 1

> **Status:** Phase 1 contract baseline consumed by Phase 2 query architecture and Phase 3 CSV delivery. See [20_EXPORT_QUERY_ARCHITECTURE.md](./20_EXPORT_QUERY_ARCHITECTURE.md) and [21_EXPORT_DELIVERY_RELIABILITY.md](./21_EXPORT_DELIVERY_RELIABILITY.md) for implemented behavior and bounded deviations.
> **Date:** 2026-11-07
> **Basis:** Source-verified findings in [18_EXPORT_SYSTEM_AUDIT.md](./18_EXPORT_SYSTEM_AUDIT.md), current Prisma models, permissions, and domain access policies.

## 1. Export Category Registry

The canonical typed registry is `src/lib/export/registry.ts`. Stable category identifiers, availability, labels, descriptions, row grain, date fields, filters, column-selection support, and aggregate/row-based kind are declared once. `src/lib/export/fields.ts` owns field metadata; `src/lib/export/filters.ts` owns category filter schemas and date-field names/defaults; `src/lib/export/policy.ts` owns category authorization/scope metadata. Registry filter names and date fields derive from those contract definitions to avoid parallel lists.

| ID | Label | Availability | Kind / row grain | Default date field | Columns |
|---|---|---|---|---|---|
| `leads` | Leads | Implemented in current endpoint | Rows; one non-deleted lead per row | `createdAt` | Selectable |
| `activities` | Activities | Planned | Rows; one ActivityEntry per row, repeating event/lead projections | `occurredAt` | Selectable |
| `follow-ups` | Follow-ups | Planned | Rows; one FollowUp per row | `dueDate` | Selectable |
| `notes` | Notes | Planned | Rows; one Note per row | `createdAt` | Selectable |
| `users` | Users | Implemented in current endpoint | Rows; one user per row | `createdAt` | Selectable |
| `providers` | Providers | Implemented in current endpoint | Rows; one LeadSource per row | `createdAt` | Selectable |
| `connectors` | Connectors | Planned | Rows; one connector per row using safe projection | `createdAt` | Selectable |
| `sync-history` | Connector Sync Runs | Implemented in current endpoint | Rows; one ConnectorSyncRun per row | `startedAt` | Selectable |
| `reports` | Reports | Implemented in current endpoint | Aggregate sections, no source-record row grain | `createdAt` | Not selectable |

“Implemented” means the category has a live API query path. Planned categories remain in the registry but are rejected as unavailable. `parseImplementedExportCategory()` distinguishes supported identifiers from implemented ones. The legacy `GET /api/export` query parameters, CSV headers/order, filename pattern, and response headers remain in use.

## 2. Authorization Matrix

`src/lib/export/policy.ts` defines the category policy. `canExportCategory()` reuses the existing `can()` helper and `Permission.EXPORT_LEADS`; it does not add a permission or alter existing role grants.

| Category | ADMIN | SALES/JUNIOR | SALES/SENIOR |
|---|---|---|---|
| Leads | Allowed | Denied | Allowed |
| Activities | Allowed | Denied | Allowed |
| Follow-ups | Allowed | Denied | Allowed |
| Notes | Allowed | Denied | Allowed |
| Users | Allowed | Denied | Denied |
| Providers | Allowed | Denied | Denied |
| Connector inventory | Allowed | Denied | Denied |
| Connector Sync Runs | Allowed | Denied | Denied |
| Reports | Allowed | Denied | Denied |

Admin policy is organization-wide for the category’s included records, with deleted leads excluded. All Sales access relies on `EXPORT_LEADS`; because current `can()` grants it only to Senior Sales, no broader Sales export permission is implied. Phase 2 enforces the implemented categories through the server-side export query service and authenticated session.

## 3. Sales Scope Rules

`SALES_SCOPE_RULES` in `policy.ts` provides the required query predicate contract:

- Lead rows: `assignedUserId = authenticated actor ID AND isDeleted = false`.
- Unassigned leads: excluded.
- Active and archived non-deleted leads: both included by default; the explicit archived selector can narrow to active or archived.
- Activities, Follow-ups and Notes: first constrain through a related lead satisfying the same assigned/non-deleted predicate. A client-supplied actor/owner/assignee ID never replaces the session identity or widens scope.
- Follow-ups additionally require `FollowUp.assignedUserId = authenticated actor ID`, as product policy explicitly requests both task assignment and visible parent lead. An unassigned task or task assigned to another salesperson is excluded even if its lead is visible.
- Users, Providers, Connectors, Sync Runs and Reports are Admin-only.
- Deleted leads are not selectable by this contract. There is no deleted-record export option.

Phase 2 implements Lead scope only. Activities, Follow-ups, and Notes remain planned; existing `LeadService`, `NoteService`, and `salesFollowUpLeadScope()` remain authoritative for their current application access. A future export service must enforce the export-specific Follow-up assignment requirement in addition to lead visibility.

## 4. Date and Time Contract

`src/lib/export/dates.ts` defines the preset identifiers, validates date inputs, resolves UTC calendar ranges, and returns internal `[from, toExclusive)` instants. UTC is canonical until a CRM timezone setting exists.

Presets are `all-time` (default), `today`, `yesterday`, `last-7-days`, `last-30-days`, `this-month`, `previous-month`, and `custom`. “Last N days” includes today and the preceding `N - 1` UTC calendar dates. Current and previous months use UTC month starts. Relative ranges do not use floating millisecond subtraction.

| Category | Supported date fields | Default |
|---|---|---|
| Leads | `createdAt`, `lastContactedAt`, `closedAt`, `nextFollowUpAt` | `createdAt` |
| Activities | `occurredAt`, `createdAt` | `occurredAt` |
| Follow-ups | `dueDate`, `createdAt`, `completedAt` | `dueDate` |
| Notes | `createdAt`, `editedAt` | `createdAt` |
| Users | `createdAt`, `updatedAt`, `lastLoginAt` | `createdAt` |
| Providers | `createdAt`, `updatedAt` | `createdAt` |
| Connectors | `createdAt`, `updatedAt`, `lastSyncedAt` | `createdAt` |
| Sync Runs | `startedAt`, `completedAt` | `startedAt` |
| Reports | `createdAt` | `createdAt` |

Custom boundaries accept either two strict ISO calendar dates or two offset-bearing ISO timestamps. Calendar dates include both selected dates by resolving the end date to the following UTC midnight exclusive. Timestamp `to` is exclusive as supplied. Mixed date-only/timestamp boundaries, invalid calendar dates, incomplete custom ranges, reversed/equal timestamp ranges, unsupported date fields, and extra range keys are invalid. A same-day date-only range is valid. Every exported date-time value is ISO-8601 UTC.

`resolveExportDateRange()` is a pure contract helper; it does not build Prisma predicates or perform database access.

## 5. Filter Contracts and Combination Semantics

`src/lib/export/filters.ts` contains strict category-specific Zod 4 schemas. Schemas reject unknown keys, invalid enum values, malformed scalar types and unsupported date fields. Multi-selects accept 1–100 values and deduplicate while preserving first occurrence. Free-text search is trimmed and bounded to 200 characters. ID filters are bounded strings. Filter schemas do not implement database queries.

| Category | Contract filters |
|---|---|
| Leads | Date range/field; status; priority; category; source IDs; assigned user IDs; city/state/country; search; archived state (`active`, `archived`, `both`) |
| Activities | Date range/field; event types; entry types; actions; responses; interests; lead IDs; actor IDs |
| Follow-ups | Date range/field; statuses; priorities; owner IDs; lead IDs; overdue boolean |
| Notes | Date range/field; lead IDs; author IDs; pinned boolean |
| Users | Date range/field; roles; Sales privileges; active/banned booleans; designations; search |
| Providers | Date range/field; source types; active boolean; name/slug search |
| Connectors | Date range/field; connector types; provider IDs; enabled boolean; connector statuses; health statuses; schedule types |
| Sync Runs | Date range/field; connector IDs/types; run statuses; error outcome (`any`, `with-error`, `without-error`) |
| Reports | Shared date range/field; source IDs; owner IDs; lead statuses |

The lead date options intentionally match the initial required list. `firstContactedAt`, `convertedAt`, `lastFollowUpAt`, and `updatedAt` may be added in a later contract revision; they are optional field catalog entries but not currently selectable date filters. The schemas include inactive User/Provider state as explicit filters, so future query defaults must not silently exclude inactive records.

Combination policy in `EXPORT_FILTER_COMBINATION` is:

- AND between filter groups, including date, category/owner/state and search.
- OR among selected values within one multi-select group.
- Search ORs across documented searchable fields, then ANDs with other groups.
- Date range ANDs with all other filters.
- Server-owned actor/lead/assignment predicates are always ANDed with client filters.
- Duplicate selected values are deduplicated preserving input order.
- Unknown keys and invalid values are rejected; no invalid value may silently broaden a result.

Category text search fields are defined as: Leads: name, company, email, phone, lead number; Users: name, email, employee code; Providers: name, slug; no other category currently defines free-text search. This contract layer records the search term schema; query implementation must use only these fields.

## 6. Field Allowlists and Defaults

`src/lib/export/fields.ts` is the only field metadata catalog. Every field has a stable ID, explicit CSV header, source/projection, type, sensitivity, default/optional selection state, null representation, and optional normalization note. `getDefaultExportColumns()` returns safe defaults; `resolveExportColumns()` rejects non-allowlisted or non-selectable IDs and restores stable registry order. Clients cannot provide arbitrary Prisma properties or relations.

| Category | Default columns (registry order) | Optional selectable columns |
|---|---|---|
| Leads | `leadNumber`, `name`, `company`, `email`, `phone`, `status`, `priority`, `category`, `city`, `state`, `country`, `requirement`, `createdAt`, `assignedTo`, `source` | `alternatePhone`, `firstContactedAt`, `lastContactedAt`, `nextFollowUpAt`, `lastFollowUpAt`, `closedAt`, `convertedAt`, `isArchived`, legacy `product`, `industry`, `website`, `jobTitle`, `address`, `budget`, `expectedValue`, `currency`, `lostReason`, `campaign`, `campaignId`, `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm` |
| Activities | `occurredAt`, `eventType`, `entryType`, `leadNumber`, `leadName`, `actor`, `action`, `response`, `interest` | `message` |
| Follow-ups | `title`, `dueDate`, `dueTime`, `status`, `priority`, `leadNumber`, `leadName`, `owner`, `createdBy`, `createdAt`, `completedAt` | `description` |
| Notes | `leadNumber`, `leadName`, `author`, `createdAt`, `editedAt`, `pinned`, `visibility` | `content`, `whatIDid`, `whatCustomerSaid` |
| Users | `name`, `email`, `role`, `salesPrivilege`, `active`, `employeeCode`, `designation`, `createdAt` | `phone`, `banned`, `lastLoginAt`, `updatedAt` |
| Providers | `name`, `slug`, `sourceType`, `active`, `createdAt` | `updatedAt` |
| Connectors | `name`, `type`, `enabled`, `status`, `healthStatus`, `scheduleType`, `provider`, `parser`, `lastSyncedAt` | `nextScheduledRun`, `consecutiveFailures`, `averageDurationMs` |
| Sync Runs | `runId`, `connector`, `type`, `status`, `startedAt`, `completedAt`, `recordsSeen`, `recordsCreated`, `recordsUpdated`, `recordsSkipped` | sanitized `errorDiagnostic` |
| Reports | Aggregate sections `summary`, `statuses`, `sources`, `owners`, `trends`, `activity` | None; aggregate export is not column-selectable |

Sensitive note contents and interaction messages are optional, never default. Relation metadata includes explicit selected projection strings such as `lead.leadNumber only`; it is not permission to serialize the full related model. Lead Product remains optional to preserve legacy compatibility but is not promoted to an active CRM input field.

## 7. Row Grain and Relation Rules

- Row categories export one row per declared source record: Lead, ActivityEntry, FollowUp, Note, User, LeadSource, Connector, or ConnectorSyncRun.
- Activity rows repeat the parent event and lead fields for each entry. Multiple entries are not collapsed into one ambiguous cell or multiplied by unrelated joins.
- Follow-ups and Notes are separate categories; neither is flattened into a lead row by default.
- Reports remain aggregate sections with no source-row grain.
- Relation selection must use the explicit field projection in the catalog, not unrestricted Prisma `include` or `select` derived from client input.
- Null is an empty cell; enum values are stable Prisma values; booleans are lowercase `true`/`false`; decimals are base-10 strings without locale formatting; dates are ISO-8601 UTC.

## 8. Request and Response Contracts

`src/lib/export/output.ts` defines the future request shapes. No route currently consumes these schemas.

- Download request: `{ category, filters, columns?, format? }`. `category` is a stable registry ID; `filters` must match that category's strict schema; `columns` are stable field IDs; `format` defaults to `csv` and is currently the only accepted format.
- Preview request: `{ category, filters, limit? }`, with a default preview limit of 20 and maximum 100. Count request: `{ category, filters }`, without row pagination or sampling. Both use the same category filter contracts as downloads.
- Unknown category identifiers fail request validation. Known but planned categories are recognized by the registry but unavailable until implemented; future API should return `CATEGORY_NOT_IMPLEMENTED` and must not silently route them to existing handlers.
- Validation errors: HTTP 400, code `VALIDATION_ERROR`, message, and structured issues with paths. Unauthorized category: HTTP 403, code `UNAUTHORIZED`, generic message. Planned category: HTTP 404, code `CATEGORY_NOT_IMPLEMENTED`. Limit exceeded: HTTP 413, code `LIMIT_EXCEEDED`. Timeout: HTTP 504, code `EXPORT_TIMEOUT`. Other failure: HTTP 500, code `EXPORT_FAILED`.
- Empty preview returns count zero and `empty: true`. Empty download returns a valid header-only CSV and metadata with zero rows and `empty: true`.
- Successful download metadata includes category, format, sanitized filename, `text/csv; charset=utf-8`, ISO generated time, row count and serialized byte count. A future route may expose these as response headers and/or a paired metadata object without changing the current route contract.

CSV contract: UTF-8, comma delimiter, LF record separator, explicit headers and deterministic allowlist order, null as empty, ISO-8601 UTC timestamps, raw stable enum values, lowercase boolean cells, decimal strings without locale transforms, and spreadsheet formula neutralization before CSV quoting. Existing `src/lib/csv.ts` already escapes syntax and common formula prefixes; the future serializer must preserve and test those protections.

## 9. Security Exclusions

The restricted list in `fields.ts` includes raw Lead payload/custom JSON, raw `Connector.configuration`, Better Auth Account/Session/Verification data, passwords, tokens, secrets, credentials and secret-bearing headers. Connector exports use only explicit safe metadata such as type, enabled/status, health, schedule, provider/parser labels, and synchronization metrics. Sync diagnostics must be redacted safe representations, never arbitrary raw `errorMessage` strings. Notes/activity text remains optional due to customer/personal data sensitivity. Do not expose deleted lead records in this contract.

The current output contracts are not yet a new public request/response API. Phases 2 and 3 retain the current endpoint, legacy parameters, columns, error envelope, and download behavior while adding server-side authorization, bounded keyset retrieval, incremental CSV delivery, and operation logging. Sync diagnostic output is blank in the legacy `Error` column because no safe sanitizer is available.

## 10. Export Accountability

`exportOperationLogSchema` validates structured events sent through the existing Pino infrastructure. Events include actor ID and role, category, operation start time, duration, outcome, emitted row and byte counts where available, a safe reason code, and accepted filter parameter names only. Stream outcomes include `SUCCESS`, `EMPTY`, `FAILED`, `LIMIT_EXCEEDED`, `TIMEOUT`, and `CANCELLED`.

Never log PII search values, note contents, credentials, raw filter payloads, arbitrary metadata, or exported row content. Logging is best-effort and has no dedicated persistence model; see Phase 3 for implementation and durability limitations.

## 11. Synchronous Export Limits

`EXPORT_LIMITS` sets the proposed initial bounds:

| Limit | Contract value |
|---|---:|
| Maximum rows | 50,000 |
| Maximum serialized CSV size | 25 MB (25,000,000 bytes) |
| Maximum execution time | 30 seconds |

Phase 3 enforces row and UTF-8 serialized-body byte ceilings and a 30-second application deadline. It streams output rather than assembling a full CSV. Each database statement is bounded by PostgreSQL `statement_timeout`; Prisma requests are not actively cancelled by stream disconnect. The repository does not configure a platform `maxDuration` or verify proxy/process limits, so the application deadline is not an infrastructure guarantee. Limits have not been capacity-tested against production-scale data. Snapshot isolation across the full download is not used; see the Phase 3 document for the keyset consistency policy.

## 12. Implementation Boundaries and Remaining Decisions

Phase 1 added definitions, validation, metadata, and contract tests. Phase 2 adds query policy and builders for Leads, Users, Providers, Sync Runs, and Reports. Phase 3 streams those existing exports and adds bounded reliability/accountability handling while retaining the live endpoint and CSV layout. No UI, schema, or migration changes were made. Planned categories are not added to the live endpoint.

Remaining before query implementation: verify how current activity operations encode entries and which text should appear in a sanitized diagnostic; agree the exact user-facing error/status mapping; define a stable privacy review for optional sensitive columns; measure representative exports against the row/byte/time caps; and determine whether safe report totals can all consistently share lead-creation date semantics. UTC remains the date basis until an explicit CRM business timezone exists.
